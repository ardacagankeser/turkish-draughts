# Contributing

## Workflow (GitHub Flow)

1. `main` is always deployable. Never commit to it directly.
2. Branch from `main` using a type prefix: `feat/…`, `fix/…`, `chore/…`, `docs/…`, `refactor/…`, `test/…`, `ci/…`.
3. Keep each pull request focused on one change. Open it early as a draft if you want feedback.
4. CI must pass before merging. Every pull request gets a preview deployment at
   `https://ardacagankeser.github.io/turkish-draughts/pr-preview/pr-<number>/`, linked in a PR comment.
   Merging to `main` deploys the site.
5. Merge with **squash and merge**. The PR title becomes the commit message on `main`.
6. Delete the branch after merging.

## Commit and PR titles

PR titles follow [Conventional Commits](https://www.conventionalcommits.org/), because releases and the
changelog are generated from them:

```
feat(engine): enforce maximum capture rule for kings
fix(ui): keep selection when the clock ticks
```

Types: `feat`, `fix`, `perf`, `refactor`, `test`, `docs`, `ci`, `build`, `chore`.
Add `!` after the type (`feat!:`) for breaking changes.

## Licensing of contributions

The project is licensed under the [PolyForm Noncommercial License 1.0.0](LICENSE). By submitting a
contribution, you agree that it is licensed under the same terms. You also grant the maintainer the
right to license it under other terms, including commercial ones, so that the project can offer
commercial licenses.

## Rules changes

Any change to game behaviour must update [docs/RULES.md](docs/RULES.md) and add tests in the same PR.
