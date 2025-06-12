import { EncryptionService } from "./encryption";

const OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1/keys";
const PROVISIONING_KEY = process.env.OPENROUTER_PROVISIONING_KEY;
const MASTER_KEY = process.env.MASTER_KEY;

if (!PROVISIONING_KEY) {
	console.warn("OPENROUTER_PROVISIONING_KEY not set - provisioning disabled");
}

if (!MASTER_KEY) {
	console.warn("MASTER_KEY not set - API key encryption disabled");
}

export interface OpenRouterKey {
	data: {
		created_at: string;
		updated_at: string;
		hash: string;
		label: string;
		name: string;
		disabled: boolean;
		limit?: number;
		usage: number;
	};
	key?: string; // Only returned on creation
}

export interface ProvisioningError {
	code: string;
	message: string;
}

class OpenRouterProvisioningService {
	private encryptionService: EncryptionService | null = null;

	constructor() {
		if (MASTER_KEY) {
			this.encryptionService = new EncryptionService(MASTER_KEY);
		}
	}

	private async makeRequest(
		method: string,
		path: string,
		body?: any
	): Promise<Response> {
		if (!PROVISIONING_KEY) {
			throw new Error("Provisioning API key not configured");
		}

		const response = await fetch(`${OPENROUTER_BASE_URL}${path}`, {
			method,
			headers: {
				Authorization: `Bearer ${PROVISIONING_KEY}`,
				"Content-Type": "application/json",
			},
			body: body ? JSON.stringify(body) : undefined,
		});

		if (!response.ok) {
			const error = await response.text();
			throw new Error(`OpenRouter API error: ${error} ${response.status}`);
		}

		return response;
	}

	async createKey(userId: string, email: string, limit?: number) {
		try {
			const response = await this.makeRequest("POST", "", {
				name: `User: ${email}`,
				label: `user-${userId}`,
				limit: limit || 1, // Default $1 limit for new users
			});

			const result = (await response.json()) as OpenRouterKey;

			// Encrypt the API key if encryption is available
			let encryptedKey: string | undefined;
			if (this.encryptionService && result.key) {
				encryptedKey = await this.encryptionService.encrypt(result.key);
			}

			return { key: result, encryptedKey };
		} catch (error) {
			console.error("Failed to create OpenRouter key:", error);
			throw error;
		}
	}

	async getKey(keyHash: string) {
		const response = await this.makeRequest("GET", `/${keyHash}`);
		const result = (await response.json()) as {
			data: {
				label: string;
				usage: number;
				is_free_tier: boolean;
				is_provisioning_key: boolean;
				limit: number;
				limit_remaining: number;
			};
		};

		return result;
	}

	async updateKey(
		keyHash: string,
		updates: Partial<{
			name: string;
			disabled: boolean;
			limit: number;
		}>
	) {
		const response = await this.makeRequest("PATCH", `/${keyHash}`, updates);
		const result = (await response.json()) as {
			data: {
				name: string;
				label: string;
				limit: number;
				disabled: boolean;
				created_at: string;
				updated_at: string;
				hash: string;
			};
		};
		return result;
	}

	async deleteKey(keyHash: string) {
		const response = await this.makeRequest("DELETE", `/${keyHash}`);
		const result = (await response.json()) as {
			data: {
				success: boolean;
			};
		};
		return result;
	}

	async listKeys(offset = 0) {
		const response = await this.makeRequest("GET", `?offset=${offset}`);
		const result = (await response.json()) as {
			data: [
				{
					name: string;
					label: string;
					limit: number;
					disabled: boolean;
					created_at: string;
					updated_at: string;
					hash: string;
				},
			];
		};
		return result;
	}

	async decryptKey(encryptedKey: string) {
		if (!this.encryptionService) {
			throw new Error("Encryption service not available");
		}
		return this.encryptionService.decrypt(encryptedKey);
	}
}

export const provisioningService = new OpenRouterProvisioningService();
