# Turkish Draughts

Play **Turkish Draughts (Dama)** in the browser against a computer opponent built on alpha-beta search.

> **Status:** full rewrite in progress. The original Python/Flet prototype is preserved on the
> [`legacy/flet`](https://github.com/ardacagankeser/turkish-draughts/tree/legacy/flet) branch
> and the [`v0.1.0-legacy`](https://github.com/ardacagankeser/turkish-draughts/releases/tag/v0.1.0-legacy) tag.

## Goals

- **Correct rules.** A rules engine that implements Turkish Draughts exactly — see [docs/RULES.md](docs/RULES.md).
- **A strong, responsive opponent.** Negamax with alpha-beta pruning, iterative deepening, a
  transposition table and quiescence search, running in a Web Worker so the UI never blocks —
  see [docs/AI.md](docs/AI.md).
- **Zero-install play.** A static, offline-capable web app (PWA), deployed automatically from `main`.

## Roadmap

| Phase | Scope                                                                        | Status |
| ----- | ---------------------------------------------------------------------------- | ------ |
| 0     | Repository cleanup, GitHub Flow, contribution templates                      | ✅     |
| 1     | Rules engine in TypeScript with full rule & perft test suite                 | ✅     |
| 2     | AI: negamax + alpha-beta, iterative deepening, TT, quiescence, benchmarks    | ✅     |
| 3     | Web UI: React + Vite, animations, move hints, undo, i18n (TR/EN), mobile     | ✅     |
| 4     | CI/CD: checks on every PR, preview deploys, GitHub Pages, automated releases | ⏳     |
| 5     | Docs: architecture overview, AI write-up, demo GIF                           | ⏳     |

## Development

Requires Node.js 24 (see `.nvmrc`).

```bash
npm install
npm run dev        # start the dev server
npm test           # run the test suite
npm run lint       # ESLint
npm run typecheck  # TypeScript
npm run build      # production build into dist/
npm run bench      # AI matches, see docs/AI.md
```

## Contributing

This repository follows [GitHub Flow](https://docs.github.com/en/get-started/using-github/github-flow).
See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

The source code is available under the [PolyForm Noncommercial License 1.0.0](LICENSE).
You may read, run, study and change it for any **noncommercial** purpose: personal use,
learning, research and teaching. **Commercial use is reserved**, including publishing the game or
a derivative in an app store or on a website that earns money. For a commercial license, contact the author.

The name "Turkish Draughts", the logo and the graphic and sound assets are **not** covered by the
code license. All rights are reserved.
