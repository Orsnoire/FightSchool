# Campaign visual pass — October 28, 2026

Owner requested map and battle-screen art updates before beta access. `/docs` is the art/design reference; use `CAMPAIGN_ART_DIRECTION.md`, `CAMPAIGN_DEVELOPMENT_ROADMAP.md`, `avatar-art-direction.md` and the source-of-truth hierarchy. Current baseline is main `63d61c58ad753ef09c66e464f400b591a873e689`; PRs #81/#88/#89 are merged and operationally accepted. Only C12 #75 remains open; it is separate.

Registered branch: `feature/campaign-visual-pass`. Scope: render the exact equipped battle avatar at map scale; replace the colored-button/letter placeholder map with continuous terrain and recognizable landmarks; provide coordinated original overworld and normal-cave battle artwork. Start with the existing playable region and cave, consistent with the documented one-theme workshop. Preserve existing layout coordinates, collision/access rules, movement/save behavior, avatar identity/palettes/loadouts and all progress. No regeneration, migration, beta enablement, new enemy roster or animation rig changes.

State: CLAIMED, before implementation. Next: publish draft PR, create original artwork with provenance, implement map presentation and scene selection, then verify desktop/phone screenshots and existing functional tests. Keep beta closed for visual review. Record implemented, verified, merged and deployed states separately.

## First implementation checkpoint (incomplete)

Owner approved the landmark icons and added forest terrain plus complete mountain/cave-wall border combinations. Shared equipped avatar, original material/landmark atlases, grassland/cave scenes, 47 adjacency cases, camera/overview and on-demand menu are implemented. Existing interior blocked mountain cells display forest; mountains frame the overworld without rewriting layouts/collision. The optional environment enum is fixed by the server at encounter creation. Old rooms fall back to grassland.

TypeScript passes. Browser, deterministic border and functional regression verification remain pending; no visual acceptance, merge, deployment or beta access is claimed. Next: verify fixtures and inspect desktop/phone renderings and all border combinations. [Asset contract and provenance](../campaign-art-v1.md).
