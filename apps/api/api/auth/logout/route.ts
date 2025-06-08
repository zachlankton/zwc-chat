import { apiHandler, notAuthorized } from "lib/utils";
import { getCurrentSession } from "../session/utils";
import { sessionCache } from "../session/sessionCache";
import { WorkOS } from "@workos-inc/node";

const workosApiKey = process.env.WORKOS_API_KEY;
const clientId = process.env.WORKOS_CLIENT_ID;
const redirectUri = process.env.WORKOS_REDIRECT_URI;
const cookiePW = process.env.WORKOS_COOKIE_PW;

if (!clientId) throw "WORKOS_CLIENT_ID env var is not set";
if (!redirectUri) throw "WORKOS_REDIRECT_URI env var is not set";
if (!workosApiKey) throw "WORKOS_API_KEY env var is not set";
if (!cookiePW) throw "WORKOS_COOKIE_PW env var is not set";

const workos = new WorkOS(workosApiKey, {
	clientId,
});

export const POST = apiHandler(async (req: any) => {
	const authHeader = req.headers.get("authorization");

	await getCurrentSession(req);
	if (!req.session) throw notAuthorized();

	const authorization = authHeader.slice(7);

	const workOsSession = workos.userManagement.loadSealedSession({
		sessionData: req.session.data!,
		cookiePassword: cookiePW,
	});

	const logOutUrl = await workOsSession.getLogoutUrl();

	// delete session
	sessionCache.delete(authorization);

	return Response.json({ logOutUrl });
});
