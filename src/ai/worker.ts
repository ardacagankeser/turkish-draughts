/// <reference lib="webworker" />
import type { AnalysisRequest } from './analysis';
import { analyse, isAnalysisRequest } from './analysis';
import type { AiRequest } from './protocol';
import { handleRequest } from './protocol';
import { Searcher } from './search';
import { Tablebase } from './tablebase';

// One searcher per worker, so the transposition table survives between moves.
// The same script runs both the playing AI and the live analysis, in separate workers.
const searcher = new Searcher();
const scope = self as unknown as DedicatedWorkerGlobalScope;
/** The analysis that should be running; any other one stops at its next depth. */
let currentAnalysis = 0;

scope.onmessage = (event: MessageEvent<AiRequest | AnalysisRequest>) => {
  const request = event.data;
  if (!isAnalysisRequest(request)) {
    scope.postMessage(handleRequest(searcher, request));
    return;
  }
  currentAnalysis = request.type === 'analyse' ? request.id : 0;
  if (request.type === 'analyse') {
    void analyse(
      searcher,
      request,
      (update) => {
        scope.postMessage(update);
      },
      () => currentAnalysis === request.id,
    );
  }
};

/** Loads the endgame tablebase in the background; the AI plays without it until then. */
async function loadTablebase(): Promise<void> {
  try {
    const response = await fetch(`${import.meta.env.BASE_URL}tablebase/3pieces.bin.gz`);
    if (!response.ok) return;
    let bytes = new Uint8Array(await response.arrayBuffer());
    // Some servers decompress .gz files on the fly; only inflate if it is still gzip.
    if (bytes[0] === 0x1f && bytes[1] === 0x8b) {
      const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('gzip'));
      bytes = new Uint8Array(await new Response(stream).arrayBuffer());
    }
    searcher.tablebase = new Tablebase(bytes);
  } catch {
    // Without the tablebase the search still plays endgames, just not perfectly.
  }
}

void loadTablebase();
