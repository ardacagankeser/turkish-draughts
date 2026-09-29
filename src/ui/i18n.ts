import { createContext, useContext } from 'react';
import type { GameResult } from '../engine';
import type { Level } from '../ai';

export type Language = 'tr' | 'en';
export const LANGUAGES: readonly Language[] = ['tr', 'en'];

const en = {
  title: 'Turkish Draughts',
  subtitle: 'Dama against the computer',
  white: 'White',
  black: 'Black',
  you: 'You',
  computer: 'Computer',
  yourTurn: 'Your move',
  thinking: 'Thinking…',
  mustCapture: 'You must capture — take the most pieces possible.',
  continueChain: 'Continue the capture: pick the next landing square.',
  newGame: 'New game',
  undo: 'Take back',
  hint: 'Hint',
  offerDraw: 'Offer draw',
  resign: 'Resign',
  flip: 'Flip board',
  moves: 'Moves',
  noMoves: 'No moves yet.',
  captured: 'Captured',
  start: 'Start game',
  cancel: 'Cancel',
  playAs: 'Play as',
  random: 'Random',
  level: 'Level',
  drawAccepted: 'The computer accepts the draw.',
  drawDeclined: 'The computer declines the draw.',
  drawOffersLeft: 'Draw offers left: {n}',
  confirmResign: 'Are you sure?',
  youWin: 'You win!',
  youLose: 'You lose',
  draw: 'Draw',
  gameOver: 'Game over',
  playAgain: 'Play again',
  close: 'Close',
  language: 'Language',
  analysis: 'Analysis',
  evalBar: 'Evaluation bar',
  evalPending: 'Evaluating…',
  evalEqual: 'The position is equal ({score})',
  evalBetter: '{side} is better ({score})',
  depth: 'depth {n}',
  dama: 'DAMA!',
  rules: 'Rules',
  board: 'Board',
  square: '{square}',
  squareWith: '{square}, {piece}',
  whiteMan: 'white man',
  whiteKing: 'white king',
  blackMan: 'black man',
  blackKing: 'black king',
  'level.beginner': 'Beginner',
  'level.easy': 'Easy',
  'level.medium': 'Medium',
  'level.hard': 'Hard',
  'level.expert': 'Expert',
  'reason.no-pieces': 'All pieces were captured.',
  'reason.no-moves': 'No legal move left.',
  'reason.resignation': 'By resignation.',
  'reason.timeout': 'On time.',
  'reason.one-piece-each': 'One piece each.',
  'reason.repetition': 'The same position occurred three times.',
  'reason.no-progress': '50 moves each without a capture or a man move.',
  'reason.agreement': 'By agreement.',
};

export type MessageKey = keyof typeof en;

const tr: Record<MessageKey, string> = {
  title: 'Türk Daması',
  subtitle: 'Bilgisayara karşı dama',
  white: 'Beyaz',
  black: 'Siyah',
  you: 'Siz',
  computer: 'Bilgisayar',
  yourTurn: 'Sıra sizde',
  thinking: 'Düşünüyor…',
  mustCapture: 'Taş almak zorunlu — en çok taşı alan hamleyi yapın.',
  continueChain: 'Almaya devam edin: bir sonraki kareyi seçin.',
  newGame: 'Yeni oyun',
  undo: 'Geri al',
  hint: 'İpucu',
  offerDraw: 'Beraberlik teklif et',
  resign: 'Pes et',
  flip: 'Tahtayı çevir',
  moves: 'Hamleler',
  noMoves: 'Henüz hamle yok.',
  captured: 'Alınan',
  start: 'Oyunu başlat',
  cancel: 'Vazgeç',
  playAs: 'Taraf',
  random: 'Rastgele',
  level: 'Seviye',
  drawAccepted: 'Bilgisayar beraberliği kabul etti.',
  drawDeclined: 'Bilgisayar beraberliği reddetti.',
  drawOffersLeft: 'Kalan beraberlik teklifi: {n}',
  confirmResign: 'Emin misiniz?',
  youWin: 'Kazandınız!',
  youLose: 'Kaybettiniz',
  draw: 'Berabere',
  gameOver: 'Oyun bitti',
  playAgain: 'Tekrar oyna',
  close: 'Kapat',
  language: 'Dil',
  analysis: 'Analiz',
  evalBar: 'Üstünlük çubuğu',
  evalPending: 'Değerlendiriliyor…',
  evalEqual: 'Pozisyon dengeli ({score})',
  evalBetter: '{side} önde ({score})',
  depth: 'derinlik {n}',
  dama: 'DAMA!',
  rules: 'Kurallar',
  board: 'Tahta',
  square: '{square}',
  squareWith: '{square}, {piece}',
  whiteMan: 'beyaz taş',
  whiteKing: 'beyaz dama',
  blackMan: 'siyah taş',
  blackKing: 'siyah dama',
  'level.beginner': 'Acemi',
  'level.easy': 'Kolay',
  'level.medium': 'Orta',
  'level.hard': 'Zor',
  'level.expert': 'Usta',
  'reason.no-pieces': 'Tüm taşlar alındı.',
  'reason.no-moves': 'Oynanacak hamle kalmadı.',
  'reason.resignation': 'Pes edildi.',
  'reason.timeout': 'Süre bitti.',
  'reason.one-piece-each': 'İki tarafta da birer taş kaldı.',
  'reason.repetition': 'Aynı pozisyon üç kez tekrarlandı.',
  'reason.no-progress': 'Taş alınmadan ve yoz oynanmadan her taraf 50 hamle yaptı.',
  'reason.agreement': 'Anlaşmayla.',
};

export const MESSAGES: Record<Language, Record<MessageKey, string>> = { en, tr };

export type Translate = (key: MessageKey, values?: Record<string, string | number>) => string;

export function translator(language: Language): Translate {
  const messages = MESSAGES[language];
  return (key, values) =>
    messages[key].replace(/\{(\w+)\}/g, (_, name: string) => String(values?.[name] ?? ''));
}

export const levelKey = (level: Level): MessageKey => `level.${level}`;
export const reasonKey = (result: GameResult): MessageKey => `reason.${result.reason}`;

export function detectLanguage(preferred: readonly string[] = navigator.languages): Language {
  return preferred.some((tag) => tag.toLowerCase().startsWith('tr')) ? 'tr' : 'en';
}

export const I18nContext = createContext<{ t: Translate; language: Language }>({
  t: translator('en'),
  language: 'en',
});

export const useI18n = () => useContext(I18nContext);
