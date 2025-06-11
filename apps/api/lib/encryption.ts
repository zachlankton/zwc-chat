// crypto-utils.ts
import crypto from "crypto";
import { promisify } from "util";

import fs from "fs/promises";
import path from "path";

export async function generateMasterKey() {
	// Generate a cryptographically secure 32-byte (256-bit) key
	const masterKey = crypto.randomBytes(32);

	// Convert to different formats
	const keyFormats = {
		hex: masterKey.toString("hex"),
		base64: masterKey.toString("base64"),
		buffer: masterKey,
	};

	// Generate key metadata
	const keyMetadata = {
		keyId: crypto.randomUUID(),
		creationDate: new Date().toISOString(),
		keyLength: masterKey.length * 8, // Length in bits
		algorithm: "AES-256",
		format: "RAW",
		purpose: "Master Key for Data Encryption",
		rotationDate: new Date(
			Date.now() + 365 * 24 * 60 * 60 * 1000
		).toISOString(), // 1 year from now
	};

	// Create secure string for storing in environment variables
	const envFormat = `MASTER_KEY=${keyFormats.hex}`;

	// Save key information securely (in development only)
	const keyInfo = {
		...keyMetadata,
		masterKey: {
			hex: keyFormats.hex,
			base64: keyFormats.base64,
		},
		environmentVariable: envFormat,
		securityWarning:
			"IMPORTANT: Store this key securely. Never commit to version control.",
	};

	// Save to a temporary file
	const outputPath = path.join(process.cwd(), "master-key-info.json");
	await fs.writeFile(outputPath, JSON.stringify(keyInfo, null, 2));

	return keyInfo;
}

// Example usage
async function main() {
	try {
		console.log("Generating new master key...");
		const keyInfo = await generateMasterKey();

		console.log("\n=== Master Key Generated Successfully ===");
		console.log("\nKey ID:", keyInfo.keyId);
		console.log("Creation Date:", keyInfo.creationDate);
		console.log("Next Rotation Date:", keyInfo.rotationDate);
		console.log("\nHex Format (for environment variables):");
		console.log(keyInfo.environmentVariable);
		console.log(
			"\nDetailed key information has been saved to master-key-info.json"
		);
		console.log("\n⚠️  SECURITY WARNING ⚠️");
		console.log(
			"1. Store this key securely (preferably in a hardware security module)"
		);
		console.log(
			"2. Delete master-key-info.json after securely storing the key"
		);
		console.log("3. Never commit the key to version control");
		console.log("4. Implement key rotation procedures");
		console.log("5. Create secure backups of the key");
	} catch (error) {
		console.error("Error generating master key:", error);
		process.exit(1);
	}
}

try {
	if (require.main === module) {
		main();
	}
	// @ts-ignore
} catch (error) {
	// @ts-ignore
}

// Use scrypt for key derivation (PCI requirement 3.6.1)
const scrypt = promisify(crypto.scrypt);

// Constants aligned with PCI DSS requirements
const ALGORITHM = "aes-256-gcm"; // PCI 3.6.1 requires strong cryptography
const KEY_LENGTH = 32; // 256 bits
const IV_LENGTH = 12; // 96 bits for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits
const SALT_LENGTH = 32;

interface EncryptedData {
	encrypted: string; // Base64 encoded encrypted data
	iv: string; // Base64 encoded IV
	tag: string; // Base64 encoded auth tag
	salt: string; // Base64 encoded salt
	keyId: string | undefined; // 0,6 substring of master key
}

export class EncryptionService {
	private masterKey: Buffer | undefined;
	private keyId: string | undefined;

	constructor(masterKeyHex: string) {
		// PCI 3.6.4 requires secure key storage
		if (!masterKeyHex) {
			return;
		}

		if (!masterKeyHex || masterKeyHex.length !== 64) {
			console.error("Invalid master key length", masterKeyHex.length);
			throw new Error(
				"Invalid master key length. Require 32 bytes (64 hex characters)"
			);
		}
		this.masterKey = Buffer.from(masterKeyHex, "hex");
		this.keyId = masterKeyHex.substring(0, 6);
	}

	private async deriveKey(salt: Buffer): Promise<Buffer> {
		if (!this.masterKey) {
			throw new Error("Master key not set");
		}
		// @ts-ignore
		return (await scrypt(this.masterKey, salt, KEY_LENGTH)) as Buffer;
	}

	async encrypt(plaintext: string): Promise<string> {
		// Generate cryptographic random values
		const iv = crypto.randomBytes(IV_LENGTH);
		const salt = crypto.randomBytes(SALT_LENGTH);

		// Derive encryption key using salt
		const key = await this.deriveKey(salt);

		// Create cipher
		// @ts-ignore
		const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
			authTagLength: AUTH_TAG_LENGTH,
		});

		// Encrypt
		let encrypted = cipher.update(plaintext, "utf8", "base64");
		encrypted += cipher.final("base64");

		// Get authentication tag
		const tag = cipher.getAuthTag();

		// Return everything needed for decryption
		const encryptedData: EncryptedData = {
			encrypted: encrypted,
			iv: iv.toString("base64"),
			tag: tag.toString("base64"),
			salt: salt.toString("base64"),
			keyId: this.keyId,
		};

		// return stringified and base64 encoded
		const stringified = JSON.stringify(encryptedData);
		return Buffer.from(stringified).toString("base64");
	}

	async decrypt(encryptedDataString: string): Promise<string> {
		const encryptedData = JSON.parse(
			Buffer.from(encryptedDataString, "base64").toString("utf8")
		) as EncryptedData;

		const { encrypted, iv, tag, salt } = encryptedData;

		// Decode all base64 values
		const ivBuffer = Buffer.from(iv, "base64");
		const tagBuffer = Buffer.from(tag, "base64");
		const saltBuffer = Buffer.from(salt, "base64");

		// Derive key using salt
		const key = await this.deriveKey(saltBuffer);

		// Create decipher
		// @ts-ignore
		const decipher = crypto.createDecipheriv(ALGORITHM, key, ivBuffer, {
			authTagLength: AUTH_TAG_LENGTH,
		});

		// Set auth tag
		// @ts-ignore
		decipher.setAuthTag(tagBuffer);

		// Decrypt
		let decrypted = decipher.update(encrypted, "base64", "utf8");
		decrypted += decipher.final("utf8");

		return decrypted;
	}
}

// Example usage

// export const encryptionService = new EncryptionService(process.env.MASTER_KEY!);

// async function storeEncryptedData(
//   db: any,
//   email: string,
//   sensitiveData: string,
// ) {
//   const encrypted = await encryptionService.encrypt(sensitiveData);

//   return await db.insert(users).values({
//     email,
//     encryptedData: encrypted,
//     keyVersion: "1", // Track key version for rotation
//     updatedAt: new Date(),
//   });
// }

// async function retrieveDecryptedData(db: any, userId: number) {
//   const user = await db
//     .select()
//     .from(users)
//     .where(eq(users.id, userId))
//     .limit(1);

//   if (!user || !user[0].encryptedData) {
//     throw new Error("User or encrypted data not found");
//   }

//   return await encryptionService.decrypt(user[0].encryptedData);
// }

// // Key rotation example
// async function rotateEncryptedData(db: any, userId: number) {
//   const user = await db
//     .select()
//     .from(users)
//     .where(eq(users.id, userId))
//     .limit(1);

//   if (!user || !user[0].encryptedData) {
//     throw new Error("User or encrypted data not found");
//   }

//   // Decrypt with old key
//   const decrypted = await encryptionService.decrypt(user[0].encryptedData);

//   // Encrypt with new key
//   const newEncrypted = await encryptionService.encrypt(decrypted);

//   // Update database
//   await db
//     .update(users)
//     .set({
//       encryptedData: newEncrypted,
//       keyVersion: "2",
//       updatedAt: new Date(),
//     })
//     .where(eq(users.id, userId));
// }
