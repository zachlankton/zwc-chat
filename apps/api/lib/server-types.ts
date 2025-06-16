import type {
	RequestWithSession,
	SessionData,
} from "api/auth/session/sessionCache";
import type { Server } from "bun";

export interface ExtendedRequest extends RequestWithSession {
	cookies: Map<string, string>;
	ip: string | undefined;
	params: any;
	server_id: string;
	id: string;
	path: string;
	performance_start: number;
	requestCloneInCaseOfError: Request;
	logCount?: number;
	eventName?: string;
	eventData?: any;
	eventErrorAlreadyLogged?: boolean;
	session: SessionData;
	accountId: string;
	rateLogged: boolean;
	timestamp: number;
	messageIdToReplace?: string; // For message retry functionality
	overrideAssistantTimestamp?: number;
	wsId: string;
}

export type RouteHandler = (
	req: ExtendedRequest,
	ctx: { server: Server; params: Record<string, string> }
) => Promise<Response> | Response;
