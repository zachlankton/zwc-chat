import { AsyncLocalStorage } from "node:async_hooks";
import type { ExtendedRequest } from "./server-types";

export const asyncLocalStorage = new AsyncLocalStorage<ExtendedRequest>();
