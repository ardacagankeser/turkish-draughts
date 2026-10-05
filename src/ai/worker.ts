/// <reference lib="webworker" />
import type { AnalysisRequest } from './analysis';
import { analyse, isAnalysisRequest } from './analysis';
import type { AiRequest } from './protocol';
import { handleRequest } from './protocol';
import type { ReviewRequest } from './review';
import { isReviewRequest, review } from './review';
import { Searcher } from './search';
import { loadTablebase } from './tablebase-loader';

// One searcher per worker, so the transposition table survives between moves.
// The same script runs the playing AI, the live analysis and the game review, each in its
// own worker.
const searcher = new Searcher();
const scope = self as unknown as DedicatedWorkerGlobalScope;
/** The analysis that should be running; any other one stops at its next depth. */
let currentAnalysis = 0;

scope.onmessage = (event: MessageEvent<AiRequest | AnalysisRequest | ReviewRequest>) => {
  const request = event.data;
  if (isReviewRequest(request)) {
    currentAnalysis = request.id;
    void review(
      searcher,
      request,
      (update) => {
        scope.postMessage(update);
      },
      () => currentAnalysis === request.id,
    );
    return;
  }
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

// The AI plays without the endgame tablebase until it has loaded.
void loadTablebase().then((tablebase) => {
  searcher.tablebase = tablebase;
});
