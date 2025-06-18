import type { RequestWithSession } from "api/auth/session/sessionCache";

export class APIError extends Error {
	statusCode: number;
	extraData?: any;
	constructor(statusCode: number, message: string, extraData?: any) {
		super(message);
		this.name = "APIError";
		this.statusCode = statusCode;
		this.extraData = extraData ?? {};
		console.error({ error: message, ...extraData });
	}
}

export function notFound(msg: string = "Not Found", extraData?: any) {
	return new APIError(404, msg, extraData);
}

export function badRequest(msg: string = "Bad Request", extraData?: any) {
	return new APIError(400, msg, extraData);
}

export function conflict(msg: string = "Conflict", extraData?: any) {
	return new APIError(409, msg, extraData);
}

export function notAuthorized(msg: string = "Not Authorized", extraData?: any) {
	return new APIError(401, msg, extraData);
}

export function forbidden(msg: string = "Forbidden", extraData?: any) {
	return new APIError(403, msg, extraData);
}

export function noPermission(
	msg: string = "User does not have permission to perform this action",
	extraData?: any
) {
	return new APIError(403, msg, extraData);
}

export function rateLimitError(
	msg: string = "Too Many Requests. Rate Limit Exceeded",
	extraData?: any
) {
	return new APIError(429, msg, extraData);
}

export function internalServerError(
	msg: string = "Internal Server Error",
	extraData?: any
) {
	return new APIError(500, msg, extraData);
}

export function apiHandler(
	handler: (request: RequestWithSession, params?: any) => Promise<Response>
) {
	const apiFunc = async (request: RequestWithSession, params?: any) => {
		try {
			return await handler(request, params);
		} catch (error: any) {
			// If the error is a APIError, return an appropriate response
			if (error instanceof APIError) {
				return Response.json(
					{ error: error.message, ...error.extraData },
					{ status: error.statusCode }
				);
			}

			// Log the error for debugging purposes
			console.error(error);

			// Return an appropriate error response

			const response: any = {
				error: "Unhandled Error",
			};

			if (error.detail) {
				response["detail"] = error.detail;
			}

			if (error.message) {
				response["message"] = error.message;
			}

			if (error.code) {
				response["code"] = error.code;
			}

			if (error.constraint_name) {
				response["constraint_name"] = error.constraint_name;
			}

			return Response.json(
				{
					...response,
				},
				{ status: 500 }
			);
		}
	};
	apiFunc.handler = handler;
	return apiFunc;
}
