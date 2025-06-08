import { apiHandler } from "lib/utils";

export const GET = apiHandler(async (req) => {
	return Response.json({ message: "OK" }, { status: 200 });
});
