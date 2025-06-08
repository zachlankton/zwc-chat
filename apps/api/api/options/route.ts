import {
	userIsSuperAdmin,
	type RequestWithSession,
} from "api/auth/session/sessionCache";
import { getCurrentSession } from "api/auth/session/utils";
import { runtimeOptions } from "lib/logging";
import { apiHandler, noPermission, notAuthorized } from "lib/utils";

export const GET = apiHandler(async (req: RequestWithSession) => {
	await getCurrentSession(req);
	if (!req.session) throw notAuthorized();
	const isSuperAdmin = userIsSuperAdmin(req);
	if (!isSuperAdmin) throw noPermission("Only super admins can get options");

	return Response.json(runtimeOptions);
});

/*
This current setup assumes only one container is running.
If multiple containers are running, we need to come up with
a way to distribute these POST requests to all containers.
Thinking of having each server register itself at start up
with the postgres db and store it private subnet address.
Then we can send the POST request to the private subnet address
and it will be routed to the correct server.
Lots to think about here tho... like how to handle removing
stale servers from the db, etc...
*/
export const POST = apiHandler(async (req: RequestWithSession) => {
	await getCurrentSession(req);
	if (!req.session) throw notAuthorized();
	const isSuperAdmin = userIsSuperAdmin(req);
	if (!isSuperAdmin) throw noPermission("Only super admins can set options");

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
