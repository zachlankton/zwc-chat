import { asyncLocalStorage } from "./asyncLocalStore";
import { internalServerError } from "./utils";

export function LogRequestHeaders(req: Request) {
	const sanitizedHeaders = sanitizeHeaders(req);
	console.log("REQUEST HEADERS", sanitizedHeaders);
}

export function sanitizeHeaders(req: Request | undefined) {
	if (req === undefined)
		throw internalServerError(
			"Unexpected: request is undefined in sanitizeHeaders"
		);

	const headersCopy = { ...req.headers.toJSON() };
	headersCopy.cookie = undefined;
	headersCopy["x-api-secret"] = undefined;
	if (headersCopy.authorization) headersCopy.authorization = "********";
	return headersCopy;
}

function sanitizeResponseHeaders(res: Response) {
	const headersCopy = { ...res.headers.toJSON() };
	headersCopy["set-cookie"] = undefined;
	if (headersCopy.authorization) headersCopy.authorization = "********";
	return headersCopy;
}

async function sanitizeRequestBody(reqOrRes: Request | Response | undefined) {
	if (reqOrRes === undefined)
		throw internalServerError(
			"Unexpected: reqOrRes is undefined in sanitizeRequestBody"
		);

	const bodyText = await reqOrRes.text();
	let body = tryParseJson(bodyText);
	if (typeof body === "object") {
		const bodyProps = Object.keys(body);
		for (const prop of bodyProps) {
			if (prop.toLowerCase().includes("password")) body[prop] = "********";
			if (prop.toLowerCase() === "pw1") body[prop] = "********";
			if (prop.toLowerCase() === "pw2") body[prop] = "********";
			if (prop.toLowerCase().includes("token")) body[prop] = "********";
			if (prop.toLowerCase().includes("secret")) body[prop] = "********";
		}
	}
	return body;
}

export async function LogRequestBody(req: Request) {
	const clone = req.clone();
	const body = await sanitizeRequestBody(clone);
	console.log("REQUEST BODY", body);
}

export function LogResponseHeaders(res: Response) {
	const sanitizedHeaders = sanitizeResponseHeaders(res);
	console.log("RESPONSE HEADERS", sanitizedHeaders);
}

export async function LogResponseBody(res: Response) {
	const clone = res.clone();
	const body = await sanitizeRequestBody(clone);
	console.log("RESPONSE BODY", body);
}

export const runtimeOptions = {
	logHealthChecks: false,
	logRequestHeaders: false,
	logRequestBody: false,
	logResponseHeaders: false,
	logResponseBody: false,
	logObjects: process.env.DEV === "TRUE" ? true : false,
};

function tryParseJson(txt: string) {
	try {
		return JSON.parse(txt);
	} catch (error) {
		return txt;
	}
}

const oldLog = global.console.log;
const oldError = global.console.error;

function getLogContext(req: any) {
	req = req || {};
	req.logCount = req.logCount ?? 0;
	req.logCount++;
	const time = new Date().toISOString().replaceAll("T", " ").slice(5, 19);
	const server_id = req.server_id ?? "_";
	const request_id = req.id ?? "_";
	const session_id = req.session?.token?.slice(0, 8) ?? "_";
	const email = req.session?.email ?? "_";
	const accountId = req.account ?? "_";
	return `[${time} ${server_id} rid:${request_id}:${req.logCount} sid:${session_id} ${accountId} ${email}]`;
}

global.console.log = (...args) => {
	const req = asyncLocalStorage.getStore();

	if (!runtimeOptions.logHealthChecks && req?.path?.includes("/healthcheck"))
		return;
	const logContext = getLogContext(req);

	// purge objects from args if logObjects is false
	if (!runtimeOptions.logObjects) {
		args = args.map((arg) => {
			if (typeof arg === "object") return "[Runtime object logging disabled]";
			return arg;
		});
	}

	oldLog(logContext, ...args);
};

global.console.error = (...args) => {
	const req = asyncLocalStorage.getStore();

	if (!runtimeOptions.logHealthChecks && req?.path?.includes("/healthcheck"))
		return;
	const logContext = getLogContext(req);
	oldError(logContext, ...args);
};

console.log("Logging initialized");
