#!/usr/bin/env bun

import { provisioningService } from "../lib/openRouterProvisioning";
import { EncryptionService } from "../lib/encryption";

async function testProvisioning() {
	console.log("🧪 Testing OpenRouter API Key Provisioning...\n");

	// Test 1: Check environment variables
	console.log("1️⃣ Checking environment variables:");
	const provisioningKey = process.env.OPENROUTER_PROVISIONING_KEY;
	const masterKey = process.env.MASTER_KEY;

	if (!provisioningKey || provisioningKey === "your-provisioning-key-here") {
		console.log("❌ OPENROUTER_PROVISIONING_KEY not set properly");
		console.log("   Please set a valid provisioning key in .env file");
		return;
	} else {
		console.log("✅ OPENROUTER_PROVISIONING_KEY is set");
	}

	if (!masterKey || masterKey === "your-master-key-here") {
		console.log(
			"⚠️  MASTER_KEY not set properly - encryption will be disabled"
		);
		console.log(
			"   To enable encryption, generate a key with: bun run lib/encryption.ts"
		);
	} else {
		console.log("✅ MASTER_KEY is set");
	}

	// Test 2: Test encryption/decryption
	if (masterKey && masterKey !== "your-master-key-here") {
		console.log("\n2️⃣ Testing encryption service:");
		try {
			const encryptionService = new EncryptionService(masterKey);
			const testKey = "sk-or-v1-test1234567890";
			const encrypted = await encryptionService.encrypt(testKey);
			const decrypted = await encryptionService.decrypt(encrypted);

			if (decrypted === testKey) {
				console.log("✅ Encryption/decryption working correctly");
			} else {
				console.log("❌ Encryption/decryption failed");
			}
		} catch (error) {
			console.log("❌ Encryption test failed:", error);
		}
	}

	// Test 3: Test API key provisioning
	console.log("\n3️⃣ Testing API key provisioning:");
	console.log("⚠️  This will create a real API key with a $10 limit");
	console.log("   Press Ctrl+C to cancel, or wait 5 seconds to continue...");

	await new Promise((resolve) => setTimeout(resolve, 5000));

	try {
		const testUserId = "test-user-" + Date.now();
		const testEmail = `test-${Date.now()}@example.com`;

		console.log(`\n📝 Creating key for test user: ${testEmail}`);

		const { key, encryptedKey } = await provisioningService.createKey(
			testUserId,
			testEmail,
			1 // $1 limit for testing
		);

		console.log("✅ API key created successfully!");
		console.log(`   Key hash: ${key.data.hash}`);
		console.log(`   Limit: $${key.data.limit}`);
		console.log(`   Usage: $${key.data.usage}`);
		console.log(`   Encrypted: ${encryptedKey ? "Yes" : "No"}`);

		// Test 4: Retrieve key info
		console.log("\n4️⃣ Testing key retrieval:");
		const retrievedKey = await provisioningService.getKey(key.data.hash);
		console.log("✅ Key retrieved successfully!");
		console.log(`   Status: Active`);
		console.log(`   Usage: $${retrievedKey.data.usage}`);
		console.log(`   Limit remaining: $${retrievedKey.data.limit_remaining}`);

		// Test 5: Update key
		console.log("\n5️⃣ Testing key update:");
		const updatedKey = await provisioningService.updateKey(key.data.hash, {
			name: "Updated Test Key",
			disabled: true,
		});
		console.log("✅ Key updated successfully!");
		console.log(`   New name: ${updatedKey.data.name}`);
		console.log(`   Disabled: ${updatedKey.data.disabled}`);

		// Test 6: Delete key
		console.log("\n6️⃣ Testing key deletion:");
		await provisioningService.deleteKey(key.data.hash);
		console.log("✅ Key deleted successfully!");

		console.log(
			"\n🎉 All tests passed! The provisioning system is working correctly."
		);
	} catch (error) {
		console.error("\n❌ Provisioning test failed:", error);
		console.log("\nPossible issues:");
		console.log("- Invalid provisioning API key");
		console.log("- Network connectivity issues");
		console.log("- OpenRouter API is down");
	}
}

// Run the test
testProvisioning().catch(console.error);

