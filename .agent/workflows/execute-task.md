---
description: Execute a task from TASKS.md following all governance rules
---

# Task Execution Workflow

// turbo-all

## Pre-Execution Checklist

1. Read the target task from `TASKS.md`
2. Verify dependencies are complete (check Status in Task Index)
3. Read relevant governance docs if needed:
   - `RULES.md` — Scope control, change authority, STOP conditions, prohibited actions
   - `ARCHITECTURE.md` — Layer boundaries (UI → Application → Domain), dependency direction
   - `DOMAIN.md` — Canonical terminology (Player, Piece, Move, Capture, etc.), banned synonyms
   - `STYLEGUIDE.md` — File naming, folder structure, import order, type hints, docstrings

## Execution Steps

4. Create/modify files as defined in "In Scope" section
5. Mark each In Scope checkbox `[x]` as items are completed
6. Verify no "Forbidden" actions are violated

## Post-Execution

7. Run verification commands from task's Verification section
8. Mark all checkboxes as complete:
   - In Scope items → `[x]`
   - Deliverables → `[x]`
   - Acceptance Criteria → `[x]`
   - Verification → `[x]`
9. Update task Status: `**Status:** [x] Complete`
10. Update Task Index row status: `| ... | [x] |`
11. Suggest git commit message in format:
    ```
    <type>(<scope>): <description>
    
    Completes TASK-XXX-NNN
    ```
    Types: feat, fix, refactor, docs, chore, style

## Git Commit Message Convention

| Type | Usage |
|------|-------|
| `feat` | New feature (UI, game feature) |
| `chore` | Setup, config, tooling |
| `refactor` | Code restructuring |
| `docs` | Documentation changes |
| `fix` | Bug fixes |
| `style` | Formatting, no logic change |
