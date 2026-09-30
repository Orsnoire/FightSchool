interface DurableObjectId {}

interface DurableObjectStub {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

interface DurableObjectNamespace {
  idFromName(name: string): DurableObjectId;
  get(id: DurableObjectId): DurableObjectStub;
}

interface DurableObjectState {
  acceptWebSocket(webSocket: WebSocket): void;
  getWebSockets(): WebSocket[];
  storage: DurableObjectStorage;
}

interface DurableObjectStorage {
  get<T>(key: string): Promise<T | undefined>;
  put<T>(key: string, value: T): Promise<void>;
  delete(key: string): Promise<boolean>;
  setAlarm(scheduledTime: number | Date): Promise<void>;
  deleteAlarm(): Promise<void>;
}

interface Fetcher {
  fetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response>;
}

interface WebSocket {
  deserializeAttachment(): unknown;
  serializeAttachment(value: unknown): void;
}

interface ResponseInit {
  webSocket?: WebSocket;
}

declare class WebSocketPair {
  0: WebSocket;
  1: WebSocket;
}
interface R2ObjectBody {
  body: ReadableStream;
  httpMetadata?: { contentType?: string };
}
interface R2Bucket {
  get(key: string): Promise<R2ObjectBody | null>;
  head(key: string): Promise<unknown | null>;
  put(
    key: string,
    value: Uint8Array,
    options?: { httpMetadata: { contentType: string } },
  ): Promise<unknown>;
}
