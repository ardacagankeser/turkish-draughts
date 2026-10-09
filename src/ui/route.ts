import { useSyncExternalStore } from 'react';
import { INITIAL_FEN } from '../engine';

/**
 * The three pages, kept in the URL hash so a position or a game can be shared as a link and
 * GitHub Pages needs no server routing:
 *
 * - `#/` plays a game,
 * - `#/analysis?fen=…&moves=c3-c4,f6-f5&ply=1` is the analysis board,
 * - `#/editor?fen=…` is the position editor,
 * - `#/archive` lists finished games.
 */
export type Route =
  | { readonly page: 'play' }
  | {
      readonly page: 'analysis';
      readonly fen: string;
      readonly moves: readonly string[];
      /** The position to show first; the end of the moves when missing. */
      readonly ply: number | null;
    }
  | { readonly page: 'editor'; readonly fen: string }
  | { readonly page: 'archive' };

export function parseRoute(hash: string): Route {
  const [path = '', query = ''] = hash.replace(/^#/, '').split('?');
  const params = new URLSearchParams(query);
  const fen = params.get('fen') ?? INITIAL_FEN;
  if (path === '/analysis') {
    const moves = (params.get('moves') ?? '').split(',').filter(Boolean);
    const ply = Number(params.get('ply'));
    return {
      page: 'analysis',
      fen,
      moves,
      ply: params.has('ply') && Number.isInteger(ply) && ply >= 0 ? ply : null,
    };
  }
  if (path === '/editor') return { page: 'editor', fen };
  if (path === '/archive') return { page: 'archive' };
  return { page: 'play' };
}

/** The hash for a route; the standard position and empty values are left out. */
export function routeHash(route: Route): string {
  if (route.page === 'play') return '#/';
  if (route.page === 'archive') return '#/archive';
  const params = new URLSearchParams();
  if (route.fen !== INITIAL_FEN) params.set('fen', route.fen);
  if (route.page === 'analysis') {
    if (route.moves.length > 0) params.set('moves', route.moves.join(','));
    if (route.ply !== null) params.set('ply', String(route.ply));
  }
  // Commas and colons read better unescaped, and are safe in a fragment.
  const query = params.toString().replace(/%2C/g, ',').replace(/%3A/g, ':');
  return `#/${route.page}${query ? `?${query}` : ''}`;
}

/** A full link to a route on this site, to copy and share. */
export function routeLink(route: Route): string {
  const { origin, pathname } = window.location;
  return `${origin}${pathname}${routeHash(route)}`;
}

export function navigate(route: Route): void {
  window.location.hash = routeHash(route);
}

const subscribe = (onChange: () => void) => {
  window.addEventListener('hashchange', onChange);
  return () => {
    window.removeEventListener('hashchange', onChange);
  };
};

/** The current hash; a route is parsed from it, so React compares plain strings. */
export function useHash(): string {
  return useSyncExternalStore(subscribe, () => window.location.hash);
}
