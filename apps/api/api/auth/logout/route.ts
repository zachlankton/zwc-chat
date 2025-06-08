import { apiHandler, notAuthorized } from "lib/utils";
import { getCurrentSession } from "../session/utils";
import { sessionCache } from "../session/sessionCache";

export const POST = apiHandler(async (req: any) => {
	const authHeader = req.headers.get("authorization");

	await getCurrentSession(req);
	if (!req.session) throw notAuthorized();

	const authorization = authHeader.slice(7);

	// delete session
	sessionCache.delete(authorization);

	return Response.json({});
});
