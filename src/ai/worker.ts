/// <reference lib="webworker" />
import type { AiRequest } from './protocol';
import { handleRequest } from './protocol';
import { Searcher } from './search';

// One searcher per worker, so the transposition table survives between moves.
const searcher = new Searcher();
const scope = self as unknown as DedicatedWorkerGlobalScope;

scope.onmessage = (event: MessageEvent<AiRequest>) => {
  scope.postMessage(handleRequest(searcher, event.data));
};
