import type { RequestWithSession } from "api/auth/session/sessionCache";
import { validateAdminKeyHeader } from "api/auth/session/utils";
import { apiHandler } from "lib/utils";

export const POST = apiHandler(async (req: RequestWithSession) => {
	validateAdminKeyHeader(req);

	return Response.json({ notImplemented: true });
});
