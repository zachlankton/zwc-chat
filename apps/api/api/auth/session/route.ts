import { apiHandler } from "lib/utils";
import { getCurrentSession } from "./utils";

import type { RequestWithSession } from "./sessionCache";
import { WorkOS } from "@workos-inc/node";

const workosApiKey = process.env.WORKOS_API_KEY;
const clientId = process.env.WORKOS_CLIENT_ID;
const redirectUri = process.env.WORKOS_REDIRECT_URI;
const orgId = process.env.WORKOS_ORG_ID;

if (!clientId) throw "WORKOS_CLIENT_ID env var is not set";
if (!redirectUri) throw "WORKOS_REDIRECT_URI env var is not set";
if (!workosApiKey) throw "WORKOS_API_KEY env var is not set";
if (!orgId) throw "WORKOS_ORG_ID env var is not set";

const workos = new WorkOS(workosApiKey);

export const GET = apiHandler(async (req: RequestWithSession) => {
	await getCurrentSession(req);

	if (!req.session) {
		const newUrl = new URL(req.url);
		const returnPath = newUrl.searchParams.get("return");
		const authorizationUrl = workos.userManagement.getAuthorizationUrl({
			// Specify that we'd like AuthKit to handle the authentication flow
			provider: "authkit",

			// The callback endpoint that WorkOS will redirect to after a user authenticates
			redirectUri,
			clientId,
			organizationId: orgId,
			state: returnPath ?? "",
		});

		console.log({ authorizationUrl });

		return Response.json({ authorizationUrl }, { status: 302 });
	}

	return Response.json(req.session);
});
