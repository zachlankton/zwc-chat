// In-memory store for tracking auth codes being processed
// This prevents race conditions when the same code is used multiple times
const processingCodes = new Map<string, Promise<any>>();
const processedCodes = new Set<string>();

// Clean up old codes after 5 minutes to prevent memory leaks
const CODE_EXPIRY = 5 * 60 * 1000; // 5 minutes

export class AuthCodeLock {
	static async withLock<T>(
		code: string,
		callback: () => Promise<T>
	): Promise<T> {
		// Check if this code was already successfully processed
		if (processedCodes.has(code)) {
			throw new Error("AUTH_CODE_ALREADY_USED");
		}

		// Check if this code is currently being processed
		const existing = processingCodes.get(code);
		if (existing) {
			// Wait for the existing process to complete
			throw new Error("AUTH_CODE_IN_PROGRESS");
		}

		// Create a new promise for this code
		const promise = callback()
			.then((result) => {
				// Mark as successfully processed
				processedCodes.add(code);
				processingCodes.delete(code);

				// Schedule cleanup
				setTimeout(() => {
					processedCodes.delete(code);
				}, CODE_EXPIRY);

				return result;
			})
			.catch((error) => {
				// Remove from processing on error
				processingCodes.delete(code);
				throw error;
			});

		// Store the promise
		processingCodes.set(code, promise);

		return promise;
	}

	// Optional: Clean up method for testing
	static clear() {
		processingCodes.clear();
		processedCodes.clear();
	}
}
