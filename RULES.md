# RULES.md - Project Governance Rules

> **Priority Level:** HIGHEST  
> This document defines immutable rules that override all other project documents.

---

## Document Hierarchy

Conflicts between documents are resolved in the following order (highest to lowest priority):

1. **RULES.md** (this document)
2. **ARCHITECTURE.md**
3. **DOMAIN.md**
4. **STYLEGUIDE.md**
5. **TASK_TEMPLATE.md**
6. Individual task definitions

---

## Scope Control Rules

### SC-1: No Feature Expansion
New features, capabilities, or behaviors MUST NOT be added unless explicitly defined in an approved task.

### SC-2: Task Boundary Enforcement
All work MUST be traceable to a specific task ID. Work outside task scope is prohibited.

### SC-3: Requirement Validation
Before implementing any feature:
- Verify it exists in the approved implementation plan
- Confirm it belongs to the current task scope
- Check it does not conflict with existing functionality

### SC-4: UI Scope
UI changes MUST align with the reference mockups (`main_menu_ui_sample.html`, `gameplay_ui_sample.html`) or explicit task requirements. Creative additions require approval.

---

## Change Authority Rules

### Permitted Without Approval
- Bug fixes within existing functionality
- Code formatting per STYLEGUIDE.md
- Adding missing docstrings
- Renaming for DOMAIN.md compliance
- Performance optimizations that preserve behavior

### Requires Explicit Task Definition
- New features or screens
- Changes to game logic (TurkishDraughts rules)
- AI algorithm modifications
- Database or persistence additions
- External API integrations
- Dependency additions

### Prohibited Actions
- Modifying Turkish Draughts game rules without explicit approval
- Changing architectural layers without ARCHITECTURE.md update
- Using terminology outside DOMAIN.md definitions
- Silent refactors that alter public interfaces
- Guessing user intent when requirements are ambiguous
- Removing functionality without explicit task instruction

---

## STOP Conditions

Agent or developer MUST halt and request clarification when:

1. **Ambiguity Detected**: Task requirements can be interpreted multiple ways
2. **Scope Creep Risk**: Implementation naturally leads beyond task boundaries
3. **Conflict Found**: Task conflicts with RULES, ARCHITECTURE, or DOMAIN
4. **Missing Dependency**: Required component from another task does not exist
5. **Game Logic Change**: Any modification to Turkish Draughts rules is implied
6. **Breaking Change**: Proposed change would break existing functionality
7. **Uncertainty**: Confidence level in correct interpretation falls below 80%

### STOP Response Format
```
STOP: [Condition Type]
Context: [What triggered the stop]
Options: [Possible interpretations or solutions]
Question: [Specific clarification needed]
```

---

## Validation Requirements

### Before Implementation
- [ ] Task ID is assigned
- [ ] Scope is explicitly defined
- [ ] Forbidden actions are noted
- [ ] Expected output is clear

### Before Commit/Completion
- [ ] All code follows STYLEGUIDE.md
- [ ] Terminology matches DOMAIN.md
- [ ] Architecture complies with ARCHITECTURE.md
- [ ] No scope creep occurred
- [ ] Tests/verification performed per task

---

## Enforcement

These rules are **mandatory**, not advisory. Violations require:
1. Immediate rollback of non-compliant changes
2. Documentation of violation
3. Task revision before proceeding

---

*Last Updated: 2026-01-19*
