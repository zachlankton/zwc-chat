import crypto from "crypto";
import type { RequestWithSession } from "api/auth/session/sessionCache";

const BASE62 = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ";
const bigInt62 = BigInt(62);

export function generateID() {
	// Generate a 128-bit number (16 bytes)
	const buffer = crypto.randomBytes(16);

	// Convert the buffer to a BigInt
	let number = BigInt("0x" + buffer.toString("hex"));

	// Convert the BigInt to a Base62 string
	let base62 = "";
	while (number > 0) {
		base62 = BASE62[Number(number % bigInt62)] + base62;
		number = number / bigInt62;
	}

	// Pad the string to ensure a length of 22 characters
	base62 = base62.padStart(22, "0");

	return base62;
}

export function uuidToBase62(uuid: string) {
	// Remove hyphens from UUID
	let noHyphensUUID = uuid.replace(/-/g, "");

	// Convert UUID (hexadecimal) to BigInt
	let num = BigInt("0x" + noHyphensUUID);

	// Convert the BigInt to a Base62 string
	let base62 = "";
	while (num > 0) {
		base62 = BASE62[Number(num % bigInt62)] + base62;
		num = num / bigInt62;
	}
	return base62;
}

export function base62ToUUID(base62: string) {
	let num = BigInt(0);

	// Convert from Base62 to BigInt
	for (let char of base62) {
		num = num * BigInt(62) + BigInt(BASE62.indexOf(char));
	}

	// Convert BigInt to a hexadecimal string
	let hex = num.toString(16).padStart(32, "0");

	// Format the hexadecimal string as a UUID
	return (
		hex.substring(0, 8) +
		"-" +
		hex.substring(8, 12) +
		"-" +
		hex.substring(12, 16) +
		"-" +
		hex.substring(16, 20) +
		"-" +
		hex.substring(20)
	);
}

function generateSecureRandom3DigitNumber() {
	const randomBytes = new Uint8Array(2);
	crypto.getRandomValues(randomBytes);
	const randomNumber = (randomBytes[0] << 8) | randomBytes[1];
	return (randomNumber % 900) + 100;
}

export function generateUniqueIdString() {
	const timestamp = Date.now().toString();
	const random3DigitNumber = generateSecureRandom3DigitNumber();
	let uniqNum = `${random3DigitNumber}${timestamp}`;
	// check if passes luhn check
	const luhnCheckDigit = luhnCheck(uniqNum);
	if (luhnCheckDigit) {
		// change the last digit to make it invalid so
		// these numbers are not mistaken for credit card numbers
		const lastDigit = parseInt(uniqNum[uniqNum.length - 1]);
		const newLastDigit = (lastDigit + 1) % 10;
		uniqNum = uniqNum.slice(0, -1) + newLastDigit;
	}
	return uniqNum;
}

function luhnCheck(numWithSpaces: string) {
	const ccNum = numWithSpaces.replaceAll(" ", "");
	const arr = [0, 2, 4, 6, 8, 1, 3, 5, 7, 9];
	let bit = 1;
	let len = ccNum.length;
	let sum = 0;
	let val;

	while (len) {
		val = parseInt(ccNum.charAt(--len), 10);
		sum += (bit ^= 1) ? arr[val] : val;
	}

	return sum && sum % 10 === 0;
}

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

export function getColumns(table: any) {
	const columnsSymbol = Object.getOwnPropertySymbols(table).find(
		(symbol) => symbol.description === "drizzle:Columns"
	);
	return table[columnsSymbol!];
}

export function getPrimaryKey(columns: any) {
	const columnKeys = Object.keys(columns);
	if (columns["uniqueId"]) return columns["uniqueId"];
	const primaryKeyName = columnKeys.find(
		(key) => columns[key].primary === true
	);
	return columns[primaryKeyName!];
}

export function getPgInlineForeignKeys(table: any) {
	const pgInlineForeignKeysSymbol = Object.getOwnPropertySymbols(table).find(
		(symbol) => symbol.description === "drizzle:PgInlineForeignKeys"
	);
	return table[pgInlineForeignKeysSymbol!];
}

export function getTableName(table: any) {
	const pgInlineForeignKeysSymbol = Object.getOwnPropertySymbols(table).find(
		(symbol) => symbol.description === "drizzle:Name"
	);
	return table[pgInlineForeignKeysSymbol!];
}

export function getAccountIdColumnName(table: any) {
	const pgInlineForeignKeys = getPgInlineForeignKeys(table);
	for (const pgInlineForeignKey of pgInlineForeignKeys) {
		const fk = pgInlineForeignKey.reference();
		const columnName = fk.columns[0].name;
		const foreignColumn = fk.foreignColumns[0];
		const foreignTableName = getTableName(fk.foreignTable);
		if (foreignColumn.name === "uniqueId" && foreignTableName === "accounts") {
			const columnKeyNames = Object.keys(fk.columns[0].table);
			const columnKeyName = columnKeyNames.find(
				(key) => fk.columns[0].table[key].name === columnName
			);
			return columnKeyName;
		} else {
			return null;
		}
	}
}

const pepper =
	process.env.PASSWORD_PEPPER ?? "cs8J9qNs4x7GcMk5ghfa7maavbFXM9fQ";
export function hashPassword(username: string, password: string) {
	if (!username || !password) {
		throw new Error("Username and password are required");
	}
	const hasher = new Bun.CryptoHasher("sha3-512");
	const randomSalt = crypto.randomBytes(16).toString("base64");
	hasher.update(username + password + pepper + randomSalt);
	const hash = hasher.digest("base64");
	return `${randomSalt}:${hash}`;
}

export function verifyPassword(
	username: string,
	password: string,
	_hash: string
) {
	if (!username || !password || !_hash) {
		throw new Error("Username, password, and hash are required");
	}
	const hasher = new Bun.CryptoHasher("sha3-512");
	const [randomSalt, hash] = _hash.split(":");
	if (!randomSalt || !hash) {
		throw new Error("Invalid hash");
	}
	hasher.update(username + password + pepper + randomSalt);
	return hasher.digest("base64") === hash;
}

export async function getContainerMetadata() {
	const metadataEndpoint = process.env.ECS_CONTAINER_METADATA_URI_V4;

	try {
		const response = await fetch(`${metadataEndpoint}/task`);
		const metadata = await response.json();
		return metadata;
	} catch (error) {
		console.error("Failed to fetch container IP:", error);
		return null;
	}
}
