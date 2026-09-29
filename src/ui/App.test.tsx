// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { MemoryStorage, fakeAi } from '../test/fakes';
import { App } from './App';
import { MESSAGES, detectLanguage, translator } from './i18n';

afterEach(cleanup);

function renderApp(storage = new MemoryStorage()) {
  storage.setItem('turkish-draughts:language', 'en');
  return {
    user: userEvent.setup(),
    storage,
    ...render(<App createAi={fakeAi} storage={storage} />),
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
    expect(screen.getByRole('status')).toHaveTextContent('Game over — You lose · By resignation.');
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
