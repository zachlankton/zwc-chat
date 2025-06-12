import { useQuery, type FetchQueryOptions } from "@tanstack/react-query";
import { queryClient } from "~/providers/queryClient";
import { get, post } from "~/lib/fetchWrapper";

export interface SessionData {
  userId: string;
  email: string;
  name: string | null;
  imgSrc: string | null;
  roles: string[];
  isSubscribed: boolean;
  token: string;
  expiresAt: Date;
  requestTimestampHistory: number[];
  requestPerSecondLimit: string;
}

const ONE_MINUTE = 1000 * 60;
export const SESSION_Q_KEY = "SESSION";
export const SESSION_Q_FUN = () => get<SessionData>(`/auth/session`);
export const SESSION_Q_FUN_W_PATH = (path: string) =>
  get<SessionData & { status: number; authorizationUrl: string }>(
    `/auth/session?return=${path}`,
  );
export const SESSION_Q_STALETIME = ONE_MINUTE;

export const APIKEYINFO_Q_KEY = "APIKEYINFO";
export const APIKEYINFO_Q_FUN = () => get<any>(`/auth/key-status`);
export const APIKEYINFO_Q_STALETIME = ONE_MINUTE;

export function fetchSession(originalUrlPath: string) {
  return queryClient.fetchQuery({
    queryKey: [SESSION_Q_KEY],
    queryFn: () => SESSION_Q_FUN_W_PATH(originalUrlPath),
    staleTime: ONE_MINUTE * 5,
  });
}

export function getSession() {
  return queryClient.getQueryData([SESSION_Q_KEY]) as SessionData | undefined;
}

export function setSession(sess: SessionData) {
  return queryClient.setQueryData([SESSION_Q_KEY], sess);
}

export const sessionQuery: FetchQueryOptions<SessionData> = {
  queryKey: [SESSION_Q_KEY],
  queryFn: SESSION_Q_FUN,
  staleTime: ONE_MINUTE * 5,
};

export function useSession() {
  const q = useQuery(sessionQuery);
  return q.data;
}

export const apiKeyInfoQuery: FetchQueryOptions<any> = {
  queryKey: [APIKEYINFO_Q_KEY],
  queryFn: APIKEYINFO_Q_FUN,
  staleTime: ONE_MINUTE * 5,
};

export function useApiKeyInfo() {
  const q = useQuery(apiKeyInfoQuery);
  return q.data;
}
