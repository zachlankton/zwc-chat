import { WorkOS } from "@workos-inc/node";
import type { RequestWithSession } from "api/auth/session/sessionCache";
import { validateAdminKeyHeader } from "api/auth/session/utils";
import { apiHandler, badRequest } from "lib/utils";

const workos = new WorkOS(
	"sk_test_a2V5XzAxSlg2TkczNlZaRVpBOUtFMFJYWUo2QThXLGNZSHZ0SzNnZDZmeHh3TEN6VVY2aWNtc3I"
);
async function findUser({ email }: { email: string }) {
	return workos.userManagement.listUsers({ email });
}

async function getUser({ userId }: { userId: string }) {
	return workos.userManagement.getUser(userId);
}

async function updateUser(body: {
	userId: string;
	data: { metadata: { isSubscribed: boolean; roles: string[] } };
}) {
	if (!body.userId || !body.data) throw badRequest("Need userId and data");
	const { userId, data } = body;

	const user = await getUser({ userId });
	if (!user) throw "Invalid User Id";

	await workos.userManagement.updateUser({
		...user,
		userId,
		firstName: user.firstName ?? undefined,
		lastName: user.lastName ?? undefined,
		externalId: user.externalId ?? undefined,
		metadata: {
			isSubscribed: JSON.stringify(data.metadata.isSubscribed),
			roles: JSON.stringify(data.metadata.roles),
		},
	});
}

const GETUSER = "get-user";
const FINDUSER = "find-user";
const UPDATEUSER = "update-user";
const actionWhitelist = [GETUSER, FINDUSER, UPDATEUSER];

const actions = {
	[GETUSER]: getUser,
	[FINDUSER]: findUser,
	[UPDATEUSER]: updateUser,
};

export const POST = apiHandler(async (req: RequestWithSession) => {
	validateAdminKeyHeader(req);

	const url = new URL(req.url);
	const action = url.searchParams.get("action") as keyof typeof actions;

	if (!action || !actionWhitelist.includes(action)) throw badRequest();

	const body = await req.json();

	const results = actions[action](body);
	console.log(results);

	return Response.json({ results });
});
