import {
	userIsSuperAdmin,
	type RequestWithSession,
} from "api/auth/session/sessionCache";
import {
	getCurrentSession,
	validateAdminKeyHeader,
} from "api/auth/session/utils";
import { runtimeOptions } from "lib/logging";
import { apiHandler, noPermission, notAuthorized } from "lib/utils";

export const GET = apiHandler(async (req: RequestWithSession) => {
	await getCurrentSession(req);
	if (!req.session) throw notAuthorized();
	const isSuperAdmin = userIsSuperAdmin(req);
	if (!isSuperAdmin) throw noPermission("Only super admins can get options");

	return Response.json(runtimeOptions);
});

export const POST = apiHandler(async (req: RequestWithSession) => {
	validateAdminKeyHeader(req);

	const body = await req.json().catch(() => {});

	if ("logHealthChecks" in body)
		runtimeOptions.logHealthChecks = body.logHealthChecks;
	if ("logRequestHeaders" in body)
		runtimeOptions.logRequestHeaders = body.logRequestHeaders;
	if ("logRequestBody" in body)
		runtimeOptions.logRequestBody = body.logRequestBody;
	if ("logResponseHeaders" in body)
		runtimeOptions.logResponseHeaders = body.logResponseHeaders;
	if ("logResponseBody" in body)
		runtimeOptions.logResponseBody = body.logResponseBody;
	if ("logObjects" in body) runtimeOptions.logObjects = body.logObjects;

	return Response.json(runtimeOptions);
});
