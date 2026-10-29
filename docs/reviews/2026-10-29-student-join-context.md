# Student join context isolation — October 29, 2026

Status: IMPLEMENTED / LOCALLY VERIFIED / CI PENDING. Branch: `fix/student-join-context`, [draft PR #95](https://github.com/Orsnoire/FightSchool/pull/95).

Owner direction: load campaign context only for campaign fights. Ordinary fights should use only the guild context required for admission, frozen power caps and reward attribution. This package follows the unresolved student-join acceptance failure recorded in PR #94; unnecessary lookups are confirmed, but the timeout's root cause is not yet established.

Scope:
- Separate campaign encounter/profile resolution from ordinary fight loading.
- Reuse the server-loaded session during join; preserve membership checks, frozen level/AA caps and the hosting guild identity used for quest/reward credit.
- Preserve campaign owner-only admission and frozen HP, resources and loadouts; retain reconnect/recovery behavior.
- Add database-backed query-boundary and authorization regression coverage. Run existing campaign, guild, AA and combat checks plus TypeScript/builds.

No migration, live data change or production deployment is included. Do not claim the timeout resolved until the unchanged live acceptance suite passes. C12/PR #75 and the mathematics design project remain separate.

## Implementation

Campaign admission already allocates `CP` followed by 32 uppercase UUID hex characters; ordinary hosted/solo rooms use six-character codes. A shared generator/classifier now makes that existing boundary explicit without a migration. It classifies a server-loaded session identity; clients cannot supply a campaign flag or bypass session lookup and authentication. Six-character codes beginning with `CP` remain ordinary fights.

Ordinary fight lookup and combat-profile loading never query campaign encounter storage. Student-created ordinary fights check guild membership without fetching the fight merely to identify its kind. A missing campaign snapshot fails closed instead of falling back to the classroom question bank.

Join passes its already-loaded session to profile resolution. Profile loading still checks active membership, honors the room's saved cap and carries the hosting guild ID into quest/reward attribution. Guildless fights do not query guild data. Campaign joins return the frozen character snapshot before fetching current levels, equipment or avatar; owner-only entry and unsettled-encounter checks remain enforced. Recovery callers with only a session ID retain one lookup.

## Verification

- 31 targeted tests pass, including a real-database regression that temporarily makes campaign encounter storage unavailable while ordinary fight lookup and profile loading still succeed.
- The regressions cover six-character `CP` codes, session reuse, guildless joins, membership revocation/archive rejection, saved level/AA caps, guild reward identity, campaign ownership, frozen HP/MP/consumables, settled/missing snapshots and reconnect behavior.
- All 419 application tests, TypeScript, client/Worker builds and all 13 deployment tests pass. Published-head CI is pending.

The earlier live timeout is not proven to originate in the removed reads. This change is not deployed and does not claim a live acceptance pass.
