// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryStorage, fakeAi, fakeAnalysis } from '../test/fakes';
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
    fireEvent.pointerDown(e5, { button: 2, pointerId: 2, shiftKey: true });
    fireEvent.pointerUp(e5, { button: 2, pointerId: 2, shiftKey: true });
    expect(container.querySelectorAll('.drawings polyline')).toHaveLength(1);
    expect(container.querySelectorAll('.drawings circle')).toHaveLength(1);
    fireEvent.pointerDown(e5, { button: 0, pointerId: 3 });
    fireEvent.pointerUp(e5, { button: 0, pointerId: 3 });
    expect(container.querySelectorAll('.drawings polyline, .drawings circle')).toHaveLength(0);
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
    for (const name of ['Take back', 'Hint', /Offer draw/, 'Resign']) {
      expect(screen.getByRole('button', { name })).toBeDisabled();
    }
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
