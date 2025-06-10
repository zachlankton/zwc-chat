const txtDecoder = new TextDecoder();
// Type definitions for the WebSocket client
type WebSocketMessageType =
  | "request"
  | "response"
  | "response-chunked"
  | "update"
  | "notification";
type HttpMethod = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

// Base message interface
interface WebSocketMessage {
  type: WebSocketMessageType;
  id?: string;
}

// Request message interface
interface RequestMessage extends WebSocketMessage {
  type: "request";
  id: string;
  method: string;
  path: string;
  headers?: any;
  body?: any;
}

// Response message interface
interface ResponseMessage extends WebSocketMessage {
  type: "response";
  id: string;
  status: number;
  headers?: Headers;
  body?: any;
}

interface ResponseChunkedMessage extends WebSocketMessage {
  type: "response-chunked";
  id: string;
  status: number;
  headers?: Headers;
  body?: any;
}

// Response message interface
interface NotificationMessage extends WebSocketMessage {
  type: "notification";
  id: string;
  status: number;
  headers?: Headers;
  body?: any;
}

// Update message interface
interface UpdateMessage extends WebSocketMessage {
  type: "update";
  resource: string;
  action: "created" | "updated" | "deleted";
  body?: Record<string, any>;
}

// Union type for all message types
type Message =
  | RequestMessage
  | ResponseMessage
  | ResponseChunkedMessage
  | UpdateMessage
  | NotificationMessage;

// Client configuration options
interface WebSocketClientOptions {
  token: string | null;
  reconnectInterval: number;
  maxReconnectAttempts: number;
  reconnectBackoffMultiplier: number;
  autoReconnect: boolean;
  debug: boolean;
  log: boolean;
  requestTimeout: number;
  API_URL: string | null;
}

// Event handler types
type EventHandler<T> = (data: T) => void;

interface EventHandlers {
  message: EventHandler<Message>[];
  open: EventHandler<Event>[];
  close: EventHandler<CloseEvent>[];
  error: EventHandler<Event>[];
  reconnect: EventHandler<{ attempt: number }>[];
  reconnectFailed: EventHandler<{ attempts: number }>[];
}

interface EventType {
  id: string;
  provider: string;
  model: string;
  object: string;
  created: number;
  choices: [
    {
      index: number;
      delta: {
        role: "system" | "developer" | "user" | "assistant" | "tool";
        content: string;
        reasoning: string | null;
      };
      finish_reason: string | null;
      native_finish_reason: string | null;
      logprobs: any | null;
    },
  ];
  usage: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
}

export type StreamResponse = {
  stream: ReadableStream<EventType>;
  status: string;
  statusText: string;
  headers: any;
};

// Pending request tracking
interface PendingRequest {
  request: RequestMessage;
  timeoutId: number;
  resolve: (value: Response) => void;
  reject: (reason: any) => void;
  timestamp: number;
}

interface PendingResponse {
  pendingChunks: any;
  response: StreamResponse;
  timeoutId: number;
  controller: ReadableStreamDefaultController<any>;
  timestamp: number;
  buffer: string; // Buffer to accumulate partial SSE events
}

// The client class
class WebSocketClient {
  private url: string;
  private token?: string | null;
  private options: WebSocketClientOptions;
  private socket: WebSocket | null;
  private messageQueue: Message[];
  private reconnectAttempts: number;
  private isReconnecting: boolean;
  private eventHandlers: EventHandlers;
  private requestMap: Map<string, PendingRequest>;
  private responseMap: Map<string, PendingResponse>;

  constructor(url: string, options: Partial<WebSocketClientOptions> = {}) {
    this.url = url;
    this.options = {
      reconnectInterval: 1000,
      maxReconnectAttempts: 50,
      reconnectBackoffMultiplier: 1.5,
      autoReconnect: true,
      debug: false,
      log: false,
      requestTimeout: 30000,
      token: null,
      API_URL: null,
      ...options,
    };
    this.token = options.token;
    this.socket = null;
    this.messageQueue = [];
    this.reconnectAttempts = 0;
    this.isReconnecting = false;
    this.eventHandlers = {
      message: [],
      open: [],
      close: [],
      error: [],
      reconnect: [],
      reconnectFailed: [],
    };
    this.requestMap = new Map<string, PendingRequest>();
    this.responseMap = new Map<string, PendingResponse>();

    this.connect();
  }

  public setToken(token: string): void {
    this.token = token;
    this.connect();
  }

  private failAllRequests(data: any) {
    this._debug(
      `Failing all messages in queue (${this.messageQueue.length} messages)`,
      data,
    );

    // Copy and clear the queue before processing to avoid infinite loops
    // if errors during sending cause messages to be re-queued
    const queueCopy = [...this.messageQueue];
    this.messageQueue = [];

    queueCopy.forEach((message) => {
      if (message.id === undefined) return;
      const pendingRequest = this.requestMap.get(message.id);
      if (pendingRequest) {
        clearTimeout(pendingRequest.timeoutId);
        this.requestMap.delete(message.id);

        pendingRequest.resolve(
          new Response(JSON.stringify(data.body), {
            status: 401,
            headers: { "Content-Type": "application/json" },
          }),
        );
      }
    });
  }

  // Establish connection
  public async connect(): Promise<void> {
    if (
      this.socket &&
      (this.socket.readyState === WebSocket.OPEN ||
        this.socket.readyState === WebSocket.CONNECTING)
    ) {
      this._debug("Connection already exists");
      return;
    }

    if (!this.token) {
      this._debug("Token must be set before connecting to websocket server");
      return;
    }

    if (this.isReconnecting) {
      // double check our session is not expired
      const resp = await fetch(`${this.options.API_URL}/auth/session`, {
        headers: {
          Authorization: `Bearer ${this.token}`,
        },
      });
      const data = await resp.json();
      this._debug("session test", data);

      if (resp.status === 401) return this.failAllRequests({ body: data });
    }

    this._debug("Establishing connection to", this.url);

    try {
      this.socket = new WebSocket(`${this.url}/${this.token}`);
      this.socket.binaryType = "arraybuffer";

      this.socket.onopen = (event: Event) => {
        this._debug("Connection established");
        this.reconnectAttempts = 0;
        this.isReconnecting = false;

        // Process any queued messages
        this._processQueue();

        // Call event handlers
        this._triggerEvent("open", event);
      };

      this.socket.onmessage = (event: MessageEvent) => {
        try {
          if (event.data instanceof ArrayBuffer) {
            const view = new Uint8Array(event.data);
            const headerLength = new DataView(view.buffer).getUint32(0, true);
            const header = JSON.parse(
              txtDecoder.decode(view.slice(4, 4 + headerLength)),
            );
            const data = view.slice(4 + headerLength);
            const text = txtDecoder.decode(data);

            if (header.status !== 200) {
              const pendingRequest = this.requestMap.get(header.id);
              if (pendingRequest) {
                clearTimeout(pendingRequest.timeoutId);
                this.requestMap.delete(header.id);

                pendingRequest.resolve(
                  new Response(text, {
                    status: header.status,
                    statusText: header.statusText,
                  }),
                );
              }
              this._log("Received message:", { header, text });

              return;
            }

            let pendingResponse = this.responseMap.get(header.id);
            if (!pendingResponse) {
              let stashController: ReadableStreamDefaultController<any> | null =
                null;
              const stream = new ReadableStream({
                async start(controller) {
                  stashController = controller;
                },
              });

              pendingResponse = {
                pendingChunks: [],
                timestamp: Date.now(),
                timeoutId: window.setTimeout(() => {
                  stashController!.close();
                  this.responseMap.delete(header.id);
                }, 60000),

                controller: stashController!,
                response: {
                  stream,
                  status: header.status,
                  statusText: header.statusText,
                  headers: {
                    "Transfer-Encoding": "chunked",
                    "Content-Type": "text/html; charset=UTF-8",
                    "X-Content-Type-Options": "nosniff",
                  },
                },
                buffer: "", // Initialize empty buffer for SSE events
              };

              this.responseMap.set(header.id, pendingResponse!);
            }

            // Append new text to buffer
            pendingResponse.buffer += text;

            const pendingRequest = this.requestMap.get(header.id);
            if (pendingRequest) {
              clearTimeout(pendingRequest.timeoutId);
              this.requestMap.delete(header.id);

              //@ts-ignore
              pendingRequest.resolve(pendingResponse.response);
            }

            // Process complete SSE events (delimited by \n\n)
            const events = pendingResponse.buffer.split("\n\n");

            // Keep the last item as it might be incomplete
            pendingResponse.buffer = events.pop() || "";

            // Process all complete events
            for (const event of events) {
              if (event.trim() === "") continue;

              // Extract data from SSE event
              const dataMatch = event.match(/^data: (.+)$/m);
              if (dataMatch) {
                const data = dataMatch[1];

                if (data.trim() === "[DONE]") {
                  this._log("Received message:", { header, data });
                  clearTimeout(pendingResponse.timeoutId);
                  pendingResponse.controller.close();
                  this.responseMap.delete(header.id);
                } else {
                  // Try to parse as JSON
                  const parsed = tryParseJson(data);
                  if (parsed !== null) {
                    pendingResponse.controller.enqueue(parsed);
                  }
                }
              }
            }
          }

          const data = JSON.parse(event.data) as Message;
          this._log("Received message:", data);

          // Handle responses to specific requests
          if (data.type === "response" && data.id) {
            const pendingRequest = this.requestMap.get(data.id);
            if (pendingRequest) {
              clearTimeout(pendingRequest.timeoutId);
              this.requestMap.delete(data.id);

              pendingRequest.resolve(
                new Response(JSON.stringify(data.body), {
                  status: data.status,
                  headers: data.headers,
                }),
              );
            }
          }

          if (data.type === "response-chunked" && data.id) {
          }

          // Call event handlers
          this._triggerEvent("message", data);
        } catch (error) {
          this._debug("Error parsing message:", error);
        }
      };

      this.socket.onclose = (event: CloseEvent) => {
        this._debug("Connection closed:", event.code, event.reason);
        this._triggerEvent("close", event);

        if (this.options.autoReconnect && !this.isReconnecting) {
          this._reconnect();
        }
      };

      this.socket.onerror = (event: Event) => {
        this._debug("Connection error:", event);
        this._triggerEvent("error", event);
      };
    } catch (error) {
      this._debug("Error creating WebSocket:", error);
      if (this.options.autoReconnect) {
        this._reconnect();
      }
    }
  }

  // Send a message, queue if needed
  public send(message: Message): boolean {
    if (this._isSocketReady()) {
      const messageStr = JSON.stringify(message);
      this.socket!.send(messageStr);
      this._log("Message sent:", message);
      return true;
    } else {
      this._debug("Socket not ready, queueing message:", message);
      this.messageQueue.push(message);
      return false;
    }
  }

  // Send a request and return a promise
  public request(
    requestMsg: Omit<RequestMessage, "id" | "type">,
    timeout?: number,
  ): Promise<Response>;
  public request(
    requestMsg: RequestMessage,
    timeout?: number,
  ): Promise<Response>;
  public request(
    requestMsg: Partial<RequestMessage> &
      Pick<RequestMessage, "method" | "path">,
    timeout: number = this.options.requestTimeout,
  ): Promise<Response> {
    return new Promise<Response>((resolve, reject) => {
      const hdrs = requestMsg.headers
        ? Object.fromEntries(requestMsg.headers.entries())
        : {};
      hdrs.Referer = location.href;
      // Ensure the message has required fields
      const message: RequestMessage = {
        type: "request",
        id: requestMsg.id || this._generateId(),
        method: requestMsg.method,
        path: requestMsg.path,
        headers: hdrs,
        body: requestMsg.body,
      };

      // Set up timeout for this request
      const timeoutId: number = window.setTimeout(() => {
        this.requestMap.delete(message.id);
        reject(new Error(`Request timeout: ${message.id}`));
      }, timeout);

      // Store request data
      this.requestMap.set(message.id, {
        request: message,
        timeoutId,
        resolve,
        reject,
        timestamp: Date.now(),
      });

      // Send the message
      const sent = this.send(message);

      // If not sent and not queued properly
      if (!sent && !this.options.autoReconnect) {
        clearTimeout(timeoutId);
        this.requestMap.delete(message.id);
        reject(new Error("Failed to send request: socket is not connected"));
      }
    });
  }

  // Close the connection
  public close(code: number = 1000, reason: string = "Normal closure"): void {
    if (this.socket) {
      this.options.autoReconnect = false; // Prevent auto reconnect
      this.socket.close(code, reason);
    }
  }

  // Event listener registration
  public on<K extends keyof EventHandlers>(
    event: K,
    callback: EventHandlers[K][number],
  ): boolean {
    if (this.eventHandlers[event]) {
      (this.eventHandlers[event] as any[]).push(callback);
      return true;
    }
    return false;
  }

  // Event listener removal
  public off<K extends keyof EventHandlers>(
    event: K,
    callback: EventHandlers[K][number],
  ): boolean {
    if (this.eventHandlers[event]) {
      this.eventHandlers[event] = (this.eventHandlers[event] as any[]).filter(
        (cb) => cb !== callback,
      );
      return true;
    }
    return false;
  }

  // Clear message queue
  public clearQueue(): number {
    const queueLength = this.messageQueue.length;
    this.messageQueue = [];
    return queueLength;
  }

  // Private methods
  private _isSocketReady(): boolean {
    return !!this.socket && this.socket.readyState === WebSocket.OPEN;
  }

  private _processQueue(): void {
    if (this.messageQueue.length === 0) return;

    this._debug(`Processing queue (${this.messageQueue.length} messages)`);

    // Copy and clear the queue before processing to avoid infinite loops
    // if errors during sending cause messages to be re-queued
    const queueCopy = [...this.messageQueue];
    this.messageQueue = [];

    queueCopy.forEach((message) => {
      this.send(message);
    });
  }

  private _reconnect(): void {
    if (this.isReconnecting) return;

    this.isReconnecting = true;
    this.reconnectAttempts++;

    if (this.reconnectAttempts > this.options.maxReconnectAttempts) {
      this._debug("Max reconnection attempts reached");
      this._triggerEvent("reconnectFailed", {
        attempts: this.reconnectAttempts,
      });
      return;
    }

    const delay =
      this.options.reconnectInterval *
      Math.pow(
        this.options.reconnectBackoffMultiplier,
        this.reconnectAttempts - 1,
      );

    this._debug(
      `Attempting to reconnect in ${delay}ms (attempt ${this.reconnectAttempts})`,
    );

    setTimeout(() => {
      this._triggerEvent("reconnect", { attempt: this.reconnectAttempts });
      this.connect();
    }, delay);
  }

  private _triggerEvent<K extends keyof EventHandlers>(
    event: K,
    data: Parameters<EventHandlers[K][number]>[0],
  ): void {
    if (this.eventHandlers[event]) {
      (this.eventHandlers[event] as any[]).forEach((callback) => {
        try {
          callback(data);
        } catch (error) {
          console.error(`Error in ${event} event handler:`, error);
        }
      });
    }
  }

  private _generateId(): string {
    return (
      Date.now().toString(36) + Math.random().toString(36).substring(2, 11)
    );
  }

  private _debug(...args: any[]): void {
    if (this.options.debug) {
      console.debug("[WebSocketClient DEBUG]", ...args);
    }
  }

  private _log(...args: any[]): void {
    if (this.options.debug || this.options.log) {
      console.log("[WebSocketClient]", ...args);
    }
  }
}

// Export types and class
export {
  WebSocketClient,
  type WebSocketMessage,
  type RequestMessage,
  type ResponseMessage,
  type ResponseChunkedMessage,
  type UpdateMessage,
  type Message,
  type WebSocketClientOptions,
  type WebSocketMessageType,
  type HttpMethod,
};

function tryParseJson(txt: string) {
  try {
    return JSON.parse(txt);
  } catch (error) {
    console.error("FAILED TO PARSE CHUNK", txt);
    return null;
  }
}
