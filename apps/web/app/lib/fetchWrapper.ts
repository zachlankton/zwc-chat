import { getSession } from "~/stores/session";
import { WebSocketClient } from "./webSocketClient";

export const API_URL = import.meta.env.VITE_API_URL || "https://localhost:3000";
export const LS_REDIRECTED_TO_LOGIN = "redirected-to-login";
export const LS_TOKEN = "token";

const urlObject = new URL(API_URL);
const https = urlObject.protocol === "https:";
const ws_proto = https ? "wss://" : "ws://";
const host = urlObject.host;
const WS_API_URL = `${ws_proto}${host}`;
export const wsClient = new WebSocketClient(WS_API_URL, {
  debug: true,
  log: true, //(API_URL as string).includes("localhost") ? true : false,
  API_URL,
});

interface FetchOptions extends RequestInit {
  params?: Record<string, string>;
  baseUrl?: string;
  autoHandleStates?: boolean;
  resolveImmediately?: boolean;
}

export class HttpError extends Error {
  constructor(
    public status: number,
    public statusText: string,
    public data: any,
  ) {
    let message = "";
    if (data?.error) {
      message = `${data.error} ${data.message ? `: ${data.message}` : ""}`;
    } else {
      message = `HTTP Error! Status: ${status} ${statusText}`;
    }
    super(message);
    this.name = "HttpError";
    this.data = data;
  }
}

export async function fetchWrapper(
  endpoint: string,
  options: FetchOptions = {},
) {
  let { params, baseUrl, autoHandleStates, ...fetchOptions } = options;
  baseUrl = baseUrl || API_URL;

  const url = new URL(`${baseUrl}${endpoint}`);
  if (params) {
    Object.keys(params).forEach((key) =>
      url.searchParams.append(key, params[key]),
    );
  }

  try {
    const currentSession = getSession();
    const headers = new Headers({
      "Content-Type": "application/json",
      Authorization: `Bearer ${localStorage?.getItem(LS_TOKEN)}`,
      ...fetchOptions.headers,
    });

    let response;

    if (currentSession?.token) {
      wsClient.setToken(currentSession.token);
      response = await wsClient.request(
        {
          ...fetchOptions,
          method: fetchOptions.method ?? "GET",
          path: url.pathname + "?" + url.searchParams.toString(),
          headers,
        },
        undefined,
        options.resolveImmediately,
      );
    } else {
      response = await fetch(url.toString(), {
        ...fetchOptions,
        headers,
        referrerPolicy: "no-referrer-when-downgrade",
      });
    }

    let data;
    const contentType = response.headers.get("content-type");
    if (contentType && contentType.includes("application/json")) {
      try {
        data = await response.json();
      } catch (error) {
        console.warn("Failed to parse JSON response", error);
        data = await response.text();
      }
    } else {
      data = await response.text();
    }

    if (!response.ok && !autoHandleStates) {
      throw new HttpError(response.status, response.statusText, data);
    }

    return data;
  } catch (error: any) {
    if ("message" in error) {
      let httpError = null;
      const alreadyHttpError = error instanceof HttpError;
      httpError = alreadyHttpError
        ? error
        : new HttpError(error.status, error.message, error);

      throw httpError;
    } else {
      const httpError = new HttpError(
        0,
        `Unknown error in fetchWrapper`,
        error,
      );
      console.error("Fetch error", error);
      throw httpError;
    }
  } finally {
  }
}

export async function get<T>(
  endpoint: string,
  options: FetchOptions = {},
): Promise<T> {
  return fetchWrapper(endpoint, options);
}

export async function post<T>(
  endpoint: string,
  body: any,
  options: FetchOptions = {},
): Promise<T> {
  return fetchWrapper(endpoint, {
    ...options,
    method: "POST",
    body: JSON.stringify(body),
  });
}

export async function put<T>(
  endpoint: string,
  body: any,
  options: FetchOptions = {},
): Promise<T> {
  return fetchWrapper(endpoint, {
    ...options,
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export async function del<T>(
  endpoint: string,
  options: FetchOptions = {},
): Promise<T> {
  return fetchWrapper(endpoint, {
    ...options,
    method: "DELETE",
  });
}

export async function patch<T>(
  endpoint: string,
  body: any,
  options: FetchOptions = {},
): Promise<T> {
  return fetchWrapper(endpoint, {
    ...options,
    method: "PATCH",
    body: JSON.stringify(body),
  });
}
