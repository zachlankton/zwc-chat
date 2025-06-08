// Type definitions for the WebSocket client
type WebSocketMessageType = "request" | "response" | "update" | "notification";
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

// Pending request tracking
interface PendingRequest {
  request: RequestMessage;
  timeoutId: number;
  resolve: (value: Response) => void;
  reject: (reason: any) => void;
  timestamp: number;
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
  type UpdateMessage,
  type Message,
  type WebSocketClientOptions,
  type WebSocketMessageType,
  type HttpMethod,
};
