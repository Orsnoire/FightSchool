## QuestAcademy Agent Instructions

Before making any architectural, product, gameplay, migration, or data-model changes, read:

`docs/Source_of_Truth.md`

That document defines the authority hierarchy for QuestAcademy and explains how to resolve conflicts between product vision, system design documents, current code, and historical prototype behavior.

## Start or Resume Work

Before editing, read `docs/ACTIVE_WORK.md` on current `main`, then inspect the
registered branch, open PR and that branch's copy of the checkpoint. Fetch the
remote heads and inspect local changes; chat history and an old checkout are not
proof of current work. Use `docs/CLEANUP_PLAN.md` for scope and exit gates.

- Keep one cleanup package active at a time initially. Use its registered branch
  and draft PR; do not start a second implementation of the same fix. Historical
  feature branches are references, not resume targets. Create a replacement only
  after checking existing work and recording why it is superseded.
- Reconcile the checkpoint with actual commits, PR state and CI before proceeding.
  If another session has advanced the branch, incorporate its work before writing.
  Use ordinary fast-forward pushes or expected-head checks; never overwrite an
  unexpected remote head or discard someone else's local changes.
- Before substantive code work, publish the package claim and draft PR. Commit
  and push small coherent checkpoints throughout the work, including explicitly
  labeled incomplete work on the draft branch. Do not leave the only recoverable
  copy in local files or conversation memory.
- Keep `docs/ACTIVE_WORK.md` on the active branch current: scope, completed and
  unfinished work, tests/results and the exact next action. After every push,
  update the PR description with the pushed SHA and verification state. Verify
  publication; a local commit is not a pushed checkpoint. If interrupted between
  push and documentation, inspect the newer diff and reconcile before resuming.
- Keep `main`'s checkpoint as the discovery pointer to the active branch/PR; its
  branch copy and live PR carry newer in-progress details. On completion, update
  the checkpoint and cleanup table, distinguishing verified, merged, deployed
  and accepted states. Register the next package before its implementation.

## Core Rules

- Do not assume existing code represents intended product behavior.
- Treat the current repository as an executable prototype and implementation reference.
- When code conflicts with current authoritative design documentation, follow the documented product intent unless doing so would destroy required functionality that has not yet been replaced.
- Do not preserve Replit-specific architecture, deployment assumptions, storage behavior, database structures, or workarounds merely for compatibility.
- Prefer clean, modular, maintainable systems over layering new behavior onto known prototype technical debt.
- Keep deterministic game logic separate from UI presentation, transport, timers, and persistence where practical.
- Keep academic content and campaign data separate from combat-engine logic.
- Only the seven registered enemy types may be authored: zombie, ghost, spider, vampire, slime, Samhain and goblin. Before adding another type, define its complete moveset, default AI and combat sprite, then extend the catalog verification tests. Goblin additions contain at least five individuals and retain swarm targeting.
- Avoid unnecessary provider lock-in.
- Never commit secrets, credentials, tokens, or production connection strings.
- Production code must not create test users, insecure credentials, or test data automatically.

## Before Implementing a Change

1. Read `docs/Source_of_Truth.md`.
2. Read the relevant current design documents referenced there.
3. Inspect the existing implementation.
4. Identify any conflict between code and current design.
5. Preserve behavior that still matches the intended product.
6. Replace obsolete architecture rather than extending it when practical.
7. Add or update tests for deterministic or security-sensitive behavior.
8. Update documentation when a major design decision changes.

## Product Principle

QuestAcademy is a persistent, content-agnostic educational JRPG platform.

When making a development decision, ask:

> Does this move QuestAcademy toward a robust, reusable educational RPG platform, or merely preserve an accident of the prototype?

Prefer the former.

## If Requirements Conflict

Do not silently choose an interpretation.

Follow the authority hierarchy in `docs/Source_of_Truth.md`.

If ambiguity remains, stop and request a product decision.
