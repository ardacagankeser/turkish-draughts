# TASK_TEMPLATE.md - Task Definition Format

> **Priority Level:** REFERENCE  
> Subordinate to all governance documents.

---

## Purpose

This template defines how tasks must be written for this project. All development work MUST be defined using this format before implementation begins.

---

## Task ID Format

```
TASK-[CATEGORY]-[NUMBER]
```

### Categories
| Code | Category | Example |
|------|----------|---------|
| `SETUP` | Project setup, configuration | `TASK-SETUP-001` |
| `GAME` | Game logic, rules, AI | `TASK-GAME-001` |
| `UI` | User interface, screens | `TASK-UI-001` |
| `FEAT` | New feature | `TASK-FEAT-001` |
| `FIX` | Bug fix | `TASK-FIX-001` |
| `REFACTOR` | Code refactoring | `TASK-REFACTOR-001` |
| `DOC` | Documentation | `TASK-DOC-001` |

---

## Required Sections

Every task MUST include these sections:

### 1. Header
```markdown
# TASK-[ID]: [Brief Title]

**Status:** [ ] Not Started / [/] In Progress / [x] Complete
**Priority:** Low / Medium / High / Critical
**Estimated Effort:** [Hours or T-shirt size]
```

### 2. Goal
Clear statement of what this task accomplishes.

```markdown
## Goal
[Single paragraph describing the objective]
```

### 3. Scope
Explicit boundaries of the task.

```markdown
## Scope

### In Scope
- [ ] Item 1
- [ ] Item 2

### Out of Scope
- Item explicitly excluded
- Another excluded item
```

### 4. Forbidden Actions
What MUST NOT be done during this task.

```markdown
## Forbidden

> ⛔ DO NOT EXCEED SCOPE

- Do not modify [specific file/module]
- Do not add [specific feature]
- Do not change [specific behavior]
```

### 5. Expected Output
Concrete deliverables and acceptance criteria.

```markdown
## Expected Output

### Deliverables
- [ ] File: `path/to/file.py`
- [ ] Feature: [Description]

### Acceptance Criteria
- [ ] Criterion 1 is met
- [ ] Criterion 2 is verified
- [ ] No regressions in existing functionality
```

### 6. Dependencies (if any)
```markdown
## Dependencies
- Requires: TASK-XXX-NNN (completed)
- Blocks: TASK-YYY-NNN
```

### 7. Verification
How to verify task completion.

```markdown
## Verification
- [ ] Manual test: [Description]
- [ ] Run: `command to verify`
```

---

## Complete Task Example

```markdown
# TASK-UI-001: Implement Main Menu Screen

**Status:** [ ] Not Started
**Priority:** High
**Estimated Effort:** 4 hours

## Goal
Create the main menu screen with game mode selection, difficulty options, timer settings, and side selection, following the design in `main_menu_ui_sample.html`.

## Scope

### In Scope
- [ ] Create `ui/menu_screen.py`
- [ ] AI vs Player mode button
- [ ] Local 2-Player mode button
- [ ] Difficulty selector (4 levels)
- [ ] Time control selector
- [ ] Side selection (White/Black/Random)
- [ ] Start game button
- [ ] Navigation to game screen

### Out of Scope
- Game logic
- Timer implementation
- Result screen
- Sound effects
- Settings persistence

## Forbidden

> ⛔ DO NOT EXCEED SCOPE

- Do not modify game logic in `game/board.py`
- Do not implement the actual timer countdown
- Do not add features not in the mockup
- Do not create additional screens

## Expected Output

### Deliverables
- [ ] File: `ui/menu_screen.py`
- [ ] File: `ui/theme.py` (if not exists)

### Acceptance Criteria
- [ ] All UI elements from mockup are present
- [ ] Mode selection works (AI/Local)
- [ ] Difficulty can be changed
- [ ] Time control can be changed
- [ ] Side selection works
- [ ] Start button triggers navigation
- [ ] Theme colors match design

## Dependencies
- Requires: TASK-SETUP-001 (project structure)
- Blocks: TASK-UI-002 (game screen)

## Verification
- [ ] Run application, menu displays
- [ ] Click all buttons, verify visual feedback
- [ ] Change all settings, values persist during session
- [ ] Click Start, appropriate screen loads
```

---

## Scope Control Reminder

> ⚠️ **CRITICAL**  
> 
> Every task file must include this reminder:
>
> **DO NOT EXCEED SCOPE**
>
> If during implementation you discover:
> - A needed feature not in scope → STOP, create new task
> - A bug unrelated to task → STOP, create FIX task
> - An improvement idea → Document for future, do not implement
> - Ambiguity in requirements → STOP, request clarification

---

## Task Status Tracking

Use these checkboxes consistently:

| Symbol | Meaning |
|--------|---------|
| `[ ]` | Not started |
| `[/]` | In progress |
| `[x]` | Complete |
| `[!]` | Blocked |
| `[-]` | Cancelled |

---

## Task File Location

Tasks should be stored in:
```
dama/.tasks/TASK-XXX-NNN.md
```

Or tracked in a central task registry file if preferred.

---

*Last Updated: 2026-01-19*
