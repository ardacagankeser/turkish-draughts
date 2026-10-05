// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MemoryStorage, fakeAi, fakeAnalysis } from '../test/fakes';
import { HOP_MS } from './animation';
import { App } from './App';
import { MESSAGES, detectLanguage, translator } from './i18n';

afterEach(cleanup);

function renderApp(storage = new MemoryStorage()) {
  storage.setItem('turkish-draughts:language', 'en');
  return {
    user: userEvent.setup(),
    storage,
    ...render(<App createAi={fakeAi} createAnalysis={fakeAnalysis} storage={storage} />),
  };
}

describe('App', () => {
  it('asks for a side and a level, then shows the starting position', async () => {
    const { user } = renderApp();
    const dialog = screen.getByRole('dialog', { name: 'New game' });
    await user.click(within(dialog).getByLabelText('Hard'));
    await user.click(within(dialog).getByRole('button', { name: 'Start game' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getAllByRole('gridcell')).toHaveLength(64);
    expect(screen.getByRole('gridcell', { name: 'a3, white man' })).toBeInTheDocument();
    expect(screen.getByText('Your move')).toBeInTheDocument();
    expect(screen.getByText(/Computer/)).toHaveTextContent('Hard');
  });

  it('plays a move by clicking, and the computer answers', async () => {
    const { user } = renderApp();
    await user.click(screen.getByRole('button', { name: 'Start game' }));
    await user.click(screen.getByRole('gridcell', { name: 'c3, white man' }));
    await user.click(screen.getByRole('gridcell', { name: 'c4' }));
    expect(screen.getByText('c3-c4')).toBeInTheDocument();
    await waitFor(
      () => {
        expect(screen.getByText('Your move')).toBeInTheDocument();
      },
      { timeout: 3000 },
    );
    expect(screen.getByRole('button', { name: 'Take back' })).toBeEnabled();
    expect(screen.getByRole('gridcell', { name: 'c4, white man' })).toBeInTheDocument();
  });

  it('can be played with the keyboard', async () => {
    const { user } = renderApp();
    await user.click(screen.getByRole('button', { name: 'Start game' }));
    const a1 = screen.getByRole('gridcell', { name: 'a1' });
    a1.focus();
    // From a1: two squares up to a3, select it, one more up to a4, play.
    await user.keyboard('{ArrowUp}{ArrowUp}{Enter}{ArrowUp}{Enter}');
    expect(screen.getByText('a3-a4')).toBeInTheDocument();
  });

  it('shows an evaluation bar that can be hidden, and the result at the end', async () => {
    const { user } = renderApp();
    await user.click(screen.getByRole('button', { name: 'Start game' }));
    const bar = screen.getByRole('meter', { name: 'Evaluation bar' });
    await waitFor(() => {
      expect(bar).toHaveAttribute('aria-valuetext', expect.stringMatching(/equal|better/));
    });
    await user.click(screen.getByRole('button', { name: 'Evaluation bar' }));
    expect(screen.queryByRole('meter')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Evaluation bar' }));
    await user.click(screen.getByRole('button', { name: 'Resign' }));
    await user.click(screen.getByRole('button', { name: 'Are you sure?' }));
    expect(screen.getByRole('meter')).toHaveAttribute('aria-valuenow', '0');
    // Hiding still works once the game is over.
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await user.click(screen.getByRole('button', { name: 'Evaluation bar' }));
    expect(screen.queryByRole('meter')).not.toBeInTheDocument();
  });

  it('does not reopen the game-over dialog for a game that ended before a reload', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      'turkish-draughts:v1',
      JSON.stringify({
        settings: { human: 1, level: 'easy' },
        moves: ['c3-c4'],
        ending: { reason: 'resignation', winner: -1 },
      }),
    );
    renderApp(storage);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Game over: You lose. By resignation.');
  });

  it('browses the moves by clicking the list and with the keyboard', async () => {
    const { user } = renderApp();
    await user.click(screen.getByRole('button', { name: 'Start game' }));
    await user.click(screen.getByRole('gridcell', { name: 'c3, white man' }));
    await user.click(screen.getByRole('gridcell', { name: 'c4' }));
    await waitFor(
      () => {
        expect(screen.getByText('Your move')).toBeInTheDocument();
      },
      { timeout: 3000 },
    );

    await user.click(screen.getByRole('button', { name: 'c3-c4' }));
    expect(screen.getByRole('button', { name: 'c3-c4' })).toHaveAttribute('aria-current', 'true');
    expect(screen.getByRole('status')).toHaveTextContent('Viewing move 1 of 2');
    // The board shows the position after White's first move and is read-only.
    expect(screen.getByRole('gridcell', { name: 'c4, white man' })).toBeInTheDocument();

    await user.keyboard('{ArrowLeft}');
    expect(screen.getByRole('gridcell', { name: 'c3, white man' })).toBeInTheDocument();
    await user.keyboard('{End}');
    expect(screen.queryByRole('button', { name: 'Back to the game' })).not.toBeInTheDocument();
    expect(screen.getByText('Your move')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Start position' }));
    await user.click(screen.getByRole('button', { name: 'Back to the game' }));
    expect(screen.getByText('Your move')).toBeInTheDocument();
  });

  it('plays a move by dragging a piece and dropping it', async () => {
    const { user } = renderApp();
    await user.click(screen.getByRole('button', { name: 'Start game' }));
    const from = screen.getByRole('gridcell', { name: 'c3, white man' });
    const to = screen.getByRole('gridcell', { name: 'c4' });
    fireEvent.pointerDown(from, { button: 0, pointerId: 1, clientX: 10, clientY: 10 });
    fireEvent.pointerMove(from, { button: 0, pointerId: 1, clientX: 40, clientY: -20 });
    fireEvent.pointerUp(to, { button: 0, pointerId: 1, clientX: 40, clientY: -20 });
    expect(screen.getByText('c3-c4')).toBeInTheDocument();
  });

  it('draws arrows and circles with the right button, and clears them with a click', async () => {
    const { user, container } = renderApp();
    await user.click(screen.getByRole('button', { name: 'Start game' }));
    const e3 = screen.getByRole('gridcell', { name: 'e3, white man' });
    const e5 = screen.getByRole('gridcell', { name: 'e5' });
    fireEvent.pointerDown(e3, { button: 2, pointerId: 2 });
    fireEvent.pointerUp(e5, { button: 2, pointerId: 2 });
    fireEvent.pointerDown(e5, { button: 2, pointerId: 2 });
    fireEvent.pointerUp(e5, { button: 2, pointerId: 2 });
    expect(container.querySelectorAll('.drawings polyline')).toHaveLength(1);
    expect(container.querySelectorAll('.drawings circle')).toHaveLength(1);
    fireEvent.pointerDown(e5, { button: 0, pointerId: 3 });
    fireEvent.pointerUp(e5, { button: 0, pointerId: 3 });
    expect(container.querySelectorAll('.drawings polyline, .drawings circle')).toHaveLength(0);
  });

  it('shows a capture chain step by step, and finishes it where the piece is dropped', async () => {
    const animate = vi.fn();
    HTMLElement.prototype.animate = animate;
    // After these moves White must take three pieces: d4xd6xb6xb8.
    const storage = new MemoryStorage();
    storage.setItem(
      'turkish-draughts:v1',
      JSON.stringify({
        settings: { human: 1, level: 'easy' },
        moves: ['a3-a4', 'b6-b5', 'd3-d4', 'd6-d5'],
      }),
    );
    const { user, container } = renderApp(storage);
    await user.click(screen.getByRole('gridcell', { name: 'd4, white man' }));
    await user.click(screen.getByRole('gridcell', { name: 'd6' }));
    // A clicked step hops to the landing square, then the jumped piece fades.
    expect(animate).toHaveBeenCalledTimes(2);
    expect(animate.mock.calls[1]?.[1]).toMatchObject({ delay: HOP_MS });
    animate.mockClear();
    // The man now shows, faded, on the landing square; the jumped piece is faded too.
    expect(screen.getByRole('gridcell', { name: 'd6, white man' })).toBeInTheDocument();
    expect(screen.getByRole('gridcell', { name: 'd4' })).toBeInTheDocument();
    expect(container.querySelectorAll('.piece.ghost')).toHaveLength(2);
    expect(screen.getByRole('status')).toHaveTextContent('Continue the capture');

    // Drag the faded piece on from the landing square to the end of the chain.
    const d6 = screen.getByRole('gridcell', { name: 'd6, white man' });
    const b8 = screen.getByRole('gridcell', { name: 'b8' });
    fireEvent.pointerDown(d6, { button: 0, pointerId: 4, clientX: 0, clientY: 0 });
    fireEvent.pointerMove(d6, { button: 0, pointerId: 4, clientX: -60, clientY: -60 });
    fireEvent.pointerUp(b8, { button: 0, pointerId: 4, clientX: -60, clientY: -60 });
    expect(screen.getByText('d4xd5xc6xb7')).toBeInTheDocument();
    expect(screen.getByRole('gridcell', { name: 'b8, white king' })).toBeInTheDocument();
    // Dropped in place, the piece does not move again: the three jumped pieces fly off at once.
    expect(animate).toHaveBeenCalledTimes(3);
    for (const [, options] of animate.mock.calls) expect(options).toMatchObject({ delay: 0 });
    delete (HTMLElement.prototype as Partial<HTMLElement>).animate;
  });

  it('shows the focus ring only for keyboard navigation, not for Shift', async () => {
    const { user, container } = renderApp();
    await user.click(screen.getByRole('button', { name: 'Start game' }));
    const c3 = screen.getByRole('gridcell', { name: 'c3, white man' });
    await user.click(c3);
    fireEvent.keyDown(c3, { key: 'Shift' });
    expect(container.querySelector('.board')).not.toHaveClass('keyboard');
    fireEvent.keyDown(c3, { key: 'ArrowUp' });
    expect(container.querySelector('.board')).toHaveClass('keyboard');
  });

  it('has keyboard shortcuts and a help dialog that gives the focus back', async () => {
    const { user, container } = renderApp();
    await user.click(screen.getByRole('button', { name: 'Start game' }));
    const coordinate = () => container.querySelector('.coord.file')?.textContent;
    expect(coordinate()).toBe('a');
    await user.keyboard('f');
    expect(coordinate()).toBe('h');

    const help = screen.getByRole('button', { name: 'Keyboard shortcuts' });
    await user.click(help);
    const dialog = screen.getByRole('dialog', { name: 'Keyboard shortcuts' });
    expect(dialog).toHaveTextContent('Flip board');
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(help).toHaveFocus();

    await user.keyboard('n');
    expect(screen.getByRole('dialog', { name: 'New game' })).toBeInTheDocument();
  });

  it('plays a typed move and announces it', async () => {
    const { user } = renderApp();
    await user.click(screen.getByRole('button', { name: 'Start game' }));
    const input = screen.getByRole('textbox', { name: 'Type a move' });
    await user.type(input, 'a2-a3{Enter}');
    expect(screen.getByRole('alert')).toHaveTextContent('not a legal move');
    await user.clear(input);
    await user.type(input, 'c3-c4{Enter}');
    expect(screen.getByText('c3-c4')).toBeInTheDocument();
    expect(input).toHaveValue('');
    await waitFor(
      () => {
        expect(document.querySelector('[aria-live="polite"].visually-hidden')).toHaveTextContent(
          /Computer played/,
        );
      },
      { timeout: 3000 },
    );
  });

  it('has a settings dialog whose choices apply at once and are remembered', async () => {
    const { user, storage } = renderApp();
    await user.click(screen.getByRole('button', { name: 'Start game' }));
    await user.click(screen.getByRole('button', { name: 'Settings' }));
    const dialog = screen.getByRole('dialog', { name: 'Settings' });
    const root = document.documentElement;

    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Board' }), 'green');
    expect(root.dataset.board).toBe('green');
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Theme' }), 'dark');
    expect(root.dataset.theme).toBe('dark');
    await user.click(within(dialog).getByRole('checkbox', { name: 'Show coordinates' }));
    expect(root.dataset.coordinates).toBe('off');
    await user.click(within(dialog).getByRole('checkbox', { name: 'Show the evaluation bar' }));
    expect(screen.queryByRole('meter')).not.toBeInTheDocument();
    await user.click(within(dialog).getByRole('checkbox', { name: 'Mute' }));
    expect(within(dialog).getByRole('slider', { name: 'Volume' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Sound' })).toHaveAttribute('aria-pressed', 'false');
    await user.selectOptions(within(dialog).getByRole('combobox', { name: 'Language' }), 'tr');
    expect(screen.getByRole('dialog', { name: 'Ayarlar' })).toBeInTheDocument();

    expect(JSON.parse(storage.getItem('turkish-draughts:preferences') ?? '{}')).toMatchObject({
      board: 'green',
      theme: 'dark',
      coordinates: false,
      muted: true,
    });
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('starts a timed game with a clock for each side', async () => {
    const { user } = renderApp();
    await user.click(screen.getByRole('radio', { name: '3+2' }));
    await user.click(screen.getByRole('button', { name: 'Start game' }));
    expect(screen.getByRole('timer', { name: 'White clock' })).toHaveTextContent('3:00');
    expect(screen.getByRole('timer', { name: 'Black clock' })).toHaveTextContent('3:00');
  });

  it('has no clocks in an untimed game', async () => {
    const { user } = renderApp();
    await user.click(screen.getByRole('button', { name: 'Start game' }));
    expect(screen.queryByRole('timer')).not.toBeInTheDocument();
  });

  it('switches language', async () => {
    const { user } = renderApp();
    await user.click(screen.getByRole('button', { name: 'TR' }));
    expect(screen.getByRole('dialog', { name: 'Yeni oyun' })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('tr');
  });

  it('shows the result after resigning', async () => {
    const { user } = renderApp();
    await user.click(screen.getByRole('button', { name: 'Start game' }));
    await user.click(screen.getByRole('button', { name: 'Resign' }));
    await user.click(screen.getByRole('button', { name: 'Are you sure?' }));
    const dialog = screen.getByRole('dialog', { name: 'You lose' });
    expect(dialog).toHaveTextContent('By resignation.');
    await user.click(within(dialog).getByRole('button', { name: 'Close' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // The finished game stays finished: only a new game (or flipping the board) is possible.
    expect(screen.getByRole('status')).toHaveTextContent('Game over: You lose. By resignation.');
    for (const name of ['Take back', 'Hint', /Offer draw/, 'Resign', 'Play']) {
      expect(screen.getByRole('button', { name })).toBeDisabled();
    }
    expect(screen.getByRole('textbox', { name: 'Type a move' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'New game' })).toBeEnabled();
  });
});

describe('i18n', () => {
  it('has every message in both languages', () => {
    expect(Object.keys(MESSAGES.tr).sort()).toEqual(Object.keys(MESSAGES.en).sort());
  });

  it('fills in values and detects Turkish browsers', () => {
    expect(translator('en')('drawOffersLeft', { n: 2 })).toBe('Draw offers left: 2');
    expect(detectLanguage(['tr-TR', 'en'])).toBe('tr');
    expect(detectLanguage(['de-DE'])).toBe('en');
  });
});
