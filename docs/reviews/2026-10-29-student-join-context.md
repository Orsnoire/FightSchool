# Student join context isolation — October 29, 2026

Status: REGISTERED / IMPLEMENTATION NOT STARTED. Branch: `fix/student-join-context`.

Owner direction: load campaign context only for campaign fights. Ordinary fights should use only the guild context required for admission, frozen power caps and reward attribution. This package follows the unresolved student-join acceptance failure recorded in PR #94; unnecessary lookups are confirmed, but the timeout's root cause is not yet established.

Scope:
- Separate campaign encounter/profile resolution from ordinary fight loading.
- Reuse the server-loaded session during join; preserve membership checks, frozen level/AA caps and the hosting guild identity used for quest/reward credit.
- Preserve campaign owner-only admission and frozen HP, resources and loadouts; retain reconnect/recovery behavior.
- Add database-backed query-boundary and authorization regression coverage. Run existing campaign, guild, AA and combat checks plus TypeScript/builds.

No migration, live data change or production deployment is included. Do not claim the timeout resolved until the unchanged live acceptance suite passes. C12/PR #75 and the mathematics design project remain separate.
