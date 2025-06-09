import { MongoClient, Db, Collection } from "mongodb";
import type { SessionData } from "../api/auth/session/sessionCache";

const MONGODB_URI = process.env.MONGODB_URI || "mongodb://zwc-chat:asdfasdf@localhost:27017/zwc-chat?authSource=admin";
const DB_NAME = process.env.MONGODB_DB_NAME || "zwc-chat";

let client: MongoClient | null = null;
let db: Db | null = null;

export async function connectToDatabase(): Promise<Db> {
	if (db) return db;

	try {
		client = new MongoClient(MONGODB_URI);
		await client.connect();
		db = client.db(DB_NAME);
		console.log("Connected to MongoDB");
		return db;
	} catch (error) {
		console.error("Failed to connect to MongoDB:", error);
		throw error;
	}
}

export async function getSessionsCollection(): Promise<Collection<SessionData>> {
	const database = await connectToDatabase();
	const collection = database.collection<SessionData>("sessions");
	
	// Create index on token field for faster lookups
	await collection.createIndex({ token: 1 }, { unique: true });
	
	// Create TTL index on expiresAt to automatically remove expired sessions
	await collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 });
	
	return collection;
}

export async function closeDatabase() {
	if (client) {
		await client.close();
		client = null;
		db = null;
	}
}