import { MongoClient, Db, Collection } from "mongodb";
import type { SessionData } from "../api/auth/session/sessionCache";

const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
	throw new Error("MONGODB_URI environment variable is not set");
}
const DB_NAME = process.env.MONGODB_DB_NAME;
if (!DB_NAME) {
	throw new Error("MONGODB_DB_NAME environment variable is not set");
}

export let db: Db | null = null;
export let sessionCollection: Collection<SessionData> | null = null;

let client: MongoClient | null = new MongoClient(MONGODB_URI, {
	minPoolSize: 5,
	maxPoolSize: 100,
	maxConnecting: 10,
	serverSelectionTimeoutMS: 5000,
	socketTimeoutMS: 45000,
});

export async function connectToDatabase(): Promise<Db> {
	if (db) return db;

	try {
		if (!client) throw "client is null";
		await client.connect();
		db = client.db(DB_NAME);
		sessionCollection = db.collection<SessionData>("sessions");
		createIndexes();
		console.log("Connected to MongoDB");
		return db;
	} catch (error) {
		console.error("Failed to connect to MongoDB:", error);
		throw error;
	}
}

export async function getSessionsCollection() {
	if (!sessionCollection) throw "sessionCollection is null";
	return sessionCollection;
}

export async function closeDatabase() {
	if (client) {
		await client.close();
		client = null;
		db = null;
	}
}

async function createIndexes() {
	console.log("Creating Indexes");
	if (sessionCollection) {
		// Create index on token field for faster lookups
		await sessionCollection.createIndex({ token: 1 }, { unique: true });

		// Create TTL index on expiresAt to automatically remove expired sessions
		await sessionCollection.createIndex(
			{ expiresAt: 1 },
			{ expireAfterSeconds: 0 }
		);
	}
}

