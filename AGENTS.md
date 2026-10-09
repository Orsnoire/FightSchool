## QuestAcademy Agent Instructions

Before making any architectural, product, gameplay, migration, or data-model changes, read:

`docs/Source_of_Truth.md`

That document defines the authority hierarchy for QuestAcademy and explains how to resolve conflicts between product vision, system design documents, current code, and historical prototype behavior.

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
