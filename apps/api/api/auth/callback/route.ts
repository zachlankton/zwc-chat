import { randomBytes } from "crypto";
import { apiHandler } from "lib/utils";

import { WorkOS } from "@workos-inc/node";
import {
	type RequestWithSession,
	type SessionData,
} from "../session/sessionCache";
import { userDefaultRateLimit } from "../session/utils";
import { setSession } from "lib/sessionStorage";
import { connectToDatabase, getUsersCollection, type User } from "lib/database";
import { provisioningService } from "lib/openRouterProvisioning";
import { AuthCodeLock } from "lib/authCodeLock";

const workosApiKey = process.env.WORKOS_API_KEY;
const clientId = process.env.WORKOS_CLIENT_ID;
const redirectUri = process.env.WORKOS_REDIRECT_URI;
const cookiePW = process.env.WORKOS_COOKIE_PW;

if (!clientId) throw "WORKOS_CLIENT_ID env var is not set";
if (!redirectUri) throw "WORKOS_REDIRECT_URI env var is not set";
if (!workosApiKey) throw "WORKOS_API_KEY env var is not set";
if (!cookiePW) throw "WORKOS_COOKIE_PW env var is not set";

const workos = new WorkOS(workosApiKey, { clientId });

// Maximum number of users allowed in the system
const MAX_USER_LIMIT = Number(process.env.MAX_USER_LIMIT) || 10;

export const GET = apiHandler(async (req: RequestWithSession) => {
	// The authorization code returned by AuthKit
	const url = new URL(req.url);
	const code = url.searchParams.get("code");

	if (!code) {
		return new Response("No code provided", { status: 400 });
	}

	try {
		// Use lock to prevent race conditions with duplicate auth codes
		const result = await AuthCodeLock.withLock(code, async () => {
			const auth = await workos.userManagement.authenticateWithCode({
				code,
				clientId,
				session: {
					sealSession: true,
					cookiePassword: cookiePW,
				},
			});

			// Check if user exists in our database
			await connectToDatabase();
			const usersCollection = await getUsersCollection();
			let user = await usersCollection.findOne({ email: auth.user.email });

			// If new user, create user record
			if (!user) {
				// Check if we've reached the user limit
				const userCount = await usersCollection.countDocuments();
				if (userCount >= MAX_USER_LIMIT) {
					console.log(
						`User limit reached (${userCount}/${MAX_USER_LIMIT}). Rejecting new user: ${auth.user.email}`
					);
					throw new Error("USER_LIMIT_REACHED");
				}

				const now = new Date();
				const newUser: User = {
					userId: auth.user.id,
					email: auth.user.email,
					createdAt: now,
					updatedAt: now,
				};

				const result = await usersCollection.insertOne(newUser);
				user = { ...newUser, _id: result.insertedId };
				console.log(`Created new user record for: ${auth.user.email}`);
			} else if (user.userId !== auth.user.id) {
				// User exists but with different WorkOS ID (different auth provider)
				console.log(
					`Updating userId for ${auth.user.email} from ${user.userId} to ${auth.user.id}`
				);
				await usersCollection.updateOne(
					{ email: auth.user.email },
					{
						$set: {
							userId: auth.user.id,
							updatedAt: new Date(),
						},
					}
				);
				user.userId = auth.user.id;
			}

			// Check if user needs an API key (new user or existing user without key)
			if (!user.openRouterApiKey) {
				console.log(
					`${user.email} does not have an openRouterApiKey, attempting to make one`
				);
				try {
					const { key, encryptedKey } = await provisioningService.createKey(
						auth.user.id,
						auth.user.email
					);

					if (!encryptedKey) {
						throw new Error(
							"createKey did not return encryptedKey; aborting to avoid storing plaintext secret"
						);
					}

					// Update user with API key information
					await usersCollection.updateOne(
						{ email: auth.user.email },
						{
							$set: {
								openRouterApiKey: encryptedKey,
								openRouterKeyHash: key.data.hash,
								openRouterKeyLimit: key.data.limit,
								openRouterKeyUsage: key.data.usage,
								openRouterKeyCreatedAt: new Date(key.data.created_at),
								updatedAt: new Date(),
							},
						}
					);

					// Update local user object
					user.openRouterApiKey = encryptedKey;
					user.openRouterKeyHash = key.data.hash;
					user.openRouterKeyLimit = key.data.limit;
					user.openRouterKeyUsage = key.data.usage;
					user.openRouterKeyCreatedAt = new Date(key.data.created_at);

					console.log(
						`Provisioned OpenRouter API key for user: ${auth.user.email}`
					);
				} catch (error) {
					console.error(
						`Failed to provision API key for user ${auth.user.email}:`,
						error
					);
					// Continue without API key - will use global key as fallback
				}
			} else {
				console.log(`User ${auth.user.email} already has an API key`);
			}

			// Decrypt API key for in-memory storage
			let decryptedApiKey: string | undefined;
			if (user?.openRouterApiKey) {
				try {
					decryptedApiKey = await provisioningService.decryptKey(
						user.openRouterApiKey
					);
				} catch (error) {
					console.error("Failed to decrypt API key:", error);
				}
			}

			const session: SessionData = {
				token: randomBytes(32).toString("hex"),
				userId: auth.user.id,
				email: auth.user.email,
				name: auth.user.firstName,
				imgSrc: auth.user.profilePictureUrl,
				roles: JSON.parse(auth.user.metadata.roles ?? "[]") as string[],
				isSubscribed: JSON.parse(auth.user.metadata.isSubscribed ?? "false"),
				data: auth.sealedSession!,
				expiresAt: new Date(Date.now() + 1000 * 60 * 60),
				requestPerSecondLimit: userDefaultRateLimit,
				requestTimestampHistory: [],
				openRouterApiKey: decryptedApiKey, // Store decrypted key for cache
				hasOwnOpenRouterKey: user?.hasOwnOpenRouterKey ?? false,
			};

			// We need a special method that stores decrypted in cache but encrypted in DB
			await setSession(session.token, session, user?.openRouterApiKey);

			// Return the session data from the lock callback
			return {
				token: session.token,
				userId: session.userId,
				email: session.email,
				name: session.name,
				imgSrc: session.imgSrc,
				roles: session.roles,
				isSubscribed: session.isSubscribed,
				expiresAt: session.expiresAt,
				requestPerSecondLimit: session.requestPerSecondLimit,
			};
		});

		// Return the result from the lock
		return Response.json(result, { status: 201 });
	} catch (error: any) {
		// Handle lock errors
		if (error.message === "AUTH_CODE_ALREADY_USED") {
			return new Response("Authorization code has already been used", {
				status: 409,
			});
		}
		if (error.message === "AUTH_CODE_IN_PROGRESS") {
			return new Response("Authorization code is currently being processed", {
				status: 429,
			});
		}
		if (error.message === "USER_LIMIT_REACHED") {
			return new Response(
				"Sorry, we aren't accepting new users at the moment, please try again tomorrow",
				{
					status: 503,
				}
			);
		}

		// Other errors
		console.error("Auth callback error:", error);
		return new Response("Authentication failed", { status: 500 });
	}
});
