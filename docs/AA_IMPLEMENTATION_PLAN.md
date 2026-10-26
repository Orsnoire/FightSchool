# Alternate Advancement: design review and implementation plan

**Implementation authorized — October 26, 2026.** Baseline: `7d31da3f044e93042b3c2a4a55163b55ecf1d431` on `main`. See [active work](ACTIVE_WORK.md) for implementation and verification state. Campaign PR #81 and cleanup C12 PR #75 remain separate.

### Owner-approved implementation decisions

The owner authorized the proposed changes, delegated unresolved details to conservative power choices, and explicitly retained the primary-stat bonuses, tier restrictions, and overall costs to support student agency. These decisions supersede open questions and original chance values below:

- Keep all requested stat bonuses/prices and rank caps. **No total combat-AA budget.**
- **Dodge 10/20/30/40%; potion preservation 10/25/50%.** Costs unchanged.
- Confirmed **60 XP per AA**, and **Natural Agility 2/3/8 AA** for 25/50/75%.
- Separate HP and MP tracks; **owner correction: wrong/unanswered questions clear all combo points on every class; AA retains up to 1/2/3 existing points**; two baseline slots plus three AA slots.
- Use the proposed weapon-to-stat map and explicit-healing-only Natural Wisdom. No lifesteal, shield, full-heal, or fixed-revive bonus.
- Natural Agility permits one basic damaging attack through stun/hypnosis, retains the status, and does not bypass other blockers. Priest First Aid is not eligible for this attack exception.
- Dodge avoids eligible direct damage only, without additional general status immunity or blocked-damage EXP. No DoT/self-cost dodge.
- Proficiencies bypass class restrictions for their purchased weapon type or armor category/slot, but not ownership/level/hand rules. No paid universal light-armor licenses or implicit off-hand permissions.
- Recustomization changes a separate character display name and appearance for 5 AA; account/login identity, free initial creation, ordinary class changes, and gear recoloring stay separate.
- Permanent ranks may be purchased above the preview's tier, with clear inactive labels; effects are frozen per encounter and apply to later encounters. No free resource refill or respec.
- Retain the released shared EXP formula and stamina; do not invent a second AA formula or silently cap existing contribution rewards. Measure the feedback loop.

### Cross-class verification clarification

New encounters treat Soul Echo as an equipped cross-class passive: other classes need both Hex and Soul Echo; native Warlock 15 retains it automatically. It is never an action button. Historical saved rooms keep their original bonus until completion. This corrects a selectable no-op and an off-class bonus that previously ignored the passive slot. Existing multiclass primary-stat/mechanic bonuses are unchanged.

See the [reproducible balance report](reviews/2026-10-26-alternate-advancement.md) and implementation checkpoint for verification. The review below is retained as the original proposal; approved decisions above supersede its open questions and proposed rates.

## 1. Goal and confirmed requirements

Give students a useful progression path while their chosen class is capped, without requiring them to level alternate classes. AA purchases belong to the character and survive class changes and encounters with lower tier limits.

The owner confirmed **60 overflow XP = 1 AA point**, the current level 10 → 11 cost, and **Natural Agility prices of 2 / 3 / 8 AA**. These are incremental prices for each rank, not cumulative prices. Preserve the other supplied prices, including the unusual 2 / 3 / 8 progression, unless the owner approves a balance revision.

| Upgrade | Ranks and effect | AA cost per rank | AA cost to finish |
| --- | --- | --- | --- |
| Primary stats, separately: STR, INT, AGI, MND, VIT | 10; +1 selected stat per rank | 2, 4, 6, 8, 10, 12, 14, 16, 18, 20 | 110 each; 550 for all five |
| Cross-class slots | 3; +1 slot per rank | 10, 20, 30 | 60 |
| Character recustomization | Repeatable change of name, sex/model, appearance | 5 per completed change | Repeatable |
| Weapon specialization, per weapon type | 6; +1 ATK, MAT, or RTK per rank while using that weapon type | 3, 6, 9, 12, 15, 18 | 63 per weapon type |
| Weapon proficiency | 1; use purchased weapon type on any class | 5 per type | 5 per type |
| Armor proficiency | 1; use purchased armor category in one specified body slot on any class | 5 per category/slot | 5 per category/slot |
| HP | 3; +10 maximum HP per rank | 2, 3, 8 | 13 |
| MP | 3; +10 maximum MP per rank | 2, 3, 8 | 13 |
| Combo preservation | 3; protect 1 / 2 / 3 existing combo points on an incorrect answer | 2, 3, 8 | 13 |
| Potion preservation | 3; 25% / 50% / 75% chance to retain a consumed combat potion, including Herbalist charges | 2, 3, 8 | 13 |
| Dodging | 4; 25% / 40% / 55% / 70% chance to avoid incorrect-answer or monster-counterattack damage | 2, 3, 8, 12 | 25 |
| Natural Toughness | 5; +1 DEF per rank | 5, 10, 15, 20, 25 | 75 |
| Natural Aggression | 5; +1 ATK per rank | 5, 10, 15, 20, 25 | 75 |
| Natural Wisdom | 5; +1 healing per rank | 5, 10, 15, 20, 25 | 75 |
| Natural Arcane Knowledge | 5; +1 MAT per rank | 5, 10, 15, 20, 25 | 75 |
| Natural Accuracy | 5; +1 RTK per rank | 5, 10, 15, 20, 25 | 75 |
| Natural Agility | 3; 25% / 50% / 75% chance to attack after a correct answer despite stun or hypnosis | **2, 3, 8 — confirmed** | 13 |

**Interpretation to confirm:** HP and MP are separate purchases. Treating them as one purchase would double that row's benefit for the same cost. No prices for off-hand proficiencies or a respec were supplied; neither is silently added.

| Encounter power limit | Highest active rank |
| --- | --- |
| Tier 1 | 1 |
| Tier 2 | 2 |
| Tier 3 | 4 |
| Tier 4 | Every purchased rank, up to that upgrade's maximum |

Thus rank 3 and rank 4 both unlock at Tier 3; a three-rank upgrade is fully active there. Buying high ranks never makes them active in a lower-tier encounter. Preserve purchased ranks rather than deleting or refunding them when a cap changes.

## 2. Flaws and balance risks

### Rank limits do not limit total power

A Tier 1 veteran can eventually own rank 1 in every track: all five primary stats, all five Natural bonuses, +10 HP, +10 MP, specialization, dodge, potion preservation, and armor access. All are legal under the proposed rank cap. Proficiencies have only one rank, so every proficiency is available at Tier 1. Heavy armor across the six body slots costs only 30 AA.

Consequently, the proposed cap bounds each upgrade but does not make a veteran approximately equal to a new student at the same tier. That may be a desirable reward for continued practice, but it must be an explicit balance choice. Permanent bonuses from alternate classes also remain; AA does not replace them or remove the incentive to collect both.

**Recommendation:** test fully developed characters at each tier, not just characters with one purchased track. If tiers are intended to enforce a narrow power range, add a separate active combat-AA budget per tier, with saved selections; cosmetics would not consume that budget. Its amounts and selection UI require another product decision. Do not invent a budget or assume rank caps already provide one.

### Dodge, potion preservation, and HP have unusually large early benefits

- At 70% dodge, eligible incoming damage averages 30% of its prior amount: about **3.33× effective HP against those attacks**, before other defenses. This is not a guarantee for any particular fight and does not include excluded damage sources.
- At 75% potion preservation, one charge averages **4 successful uses before consumption** (`1 / (1 - 0.75)`), when opportunities to use it remain. Herbalist crafting, shield potions, and party-wide Potion Diffuser amplify the advantage.
- First-rank HP costs only 2 AA for +10 maximum HP. A base 7-HP caster with no other HP bonuses becomes a 17-HP caster. VIT's first rank costs the same but adds only 1 maximum HP, alongside VIT's other benefits.
- Dodge also softens the consequences of incorrect answers. It must never change academic correctness, restore a correct-answer streak, or grant correct-answer EXP.

**Recommendation:** compare the requested chances against a lower-power candidate of **10 / 20 / 30 / 40% dodge** and **10 / 25 / 50% potion preservation**. These are proposals, not approved replacements. Do not simultaneously change prices, chances, HP, and encounter scaling: measure each change's impact. If the requested chances are retained, accept that these are major survivability upgrades rather than small bonuses.

### AA power can accelerate AA earning

The released shared reward formula is `max(0, prorated base XP + correct answers - incorrect answers + actual damage + blocking + actual HP healed)`, followed by existing stamina and fractional carry. Buying attack/healing/defense power can increase later contribution EXP, which can buy more AA power. This affects progression pace and fairness among jobs even when the rank costs look reasonable.

At the confirmed conversion, a 2-AA first rank costs 120 overflow XP; maxing one primary stat costs 6,600; all five primary stats cost 33,000; all five Natural tracks cost 22,500. These are costs, not estimates of sessions or school days. No live student earnings distribution was analyzed for this plan.

**Recommendation:** use the existing shared award pipeline exactly once. Measure post-stamina AA earnings by job and accuracy, including deliberately prolonged fights and repeated host exits. AA dodge should record avoidance separately and award **no fabricated blocked-damage EXP**. Before release, decide whether repeatable damage/healing/blocking loops require contribution limits tied to answered questions. Any change belongs in the shared EXP formula, not a second AA-only reward formula that can drift.

### Some upgrades conflict with the current implementation

| Finding | Consequence and proposed resolution |
| --- | --- |
| Only Headshot users currently lose one combo point on a wrong/unanswered question | “Prevent loss of up to three points” makes ranks 2–3 redundant. Recommend a protected floor: `after = max(normalAfterLoss, min(beforeLoss, activeRank))`. With rank 2, 3 CP still becomes 2, but 2 stays 2. It never creates points or introduces a new reset penalty for other jobs. Confirm this interpretation. |
| Light armor is already permitted for every class | Do not sell a license that changes nothing. Show universal access as already available, without charging. Heavy/leather licenses remain meaningful across classes even when the current class already permits them. |
| Weapon permission and attack formulas are separate | Equipping a staff on a Warrior does not turn its basic attack into MAT damage. Show the actual current-job benefit; proficiency grants permission, not a new attack formula or class ability. Specialization affects its named stat, not every ability that happens to use the weapon. |
| Some built-in weapons have explicit `classRestriction` as well as weapon-type restrictions | A type license that bypasses only the latter would still reject legitimate purchases. Under the owner's “any class” rule, bypass class-based restrictions for that purchased category/slot consistently. Keep ownership, required level, valid slot, and compatible hands. Truly class-bound special items would need a separately approved exception, not an accidental legacy gate. |
| Off-hands are separate from the six armor slots | A weapon license must not silently grant a shield, spellbook, quiver, or potion off-hand. Off-hand licenses and prices remain an explicit future decision. |
| Lobby slot 2 says “level 30”; jobs stop at 15 | The equipment page and server permit two existing slots. Recommend reconciling all screens to that two-slot baseline, then adding the three AA slots for a maximum of five. Preserve existing saved choices. |
| Tier 1 limits effective job levels to 4; cross-class unlocks start at level 8 | Buying an extra slot cannot unlock an otherwise unavailable ability. Show that a slot can be owned but have no eligible cross-class ability in the current tier. |
| Appearance edits are currently free through existing paths | A 5-AA recustomization needs one paid server operation covering all character-edit paths. Otherwise the old endpoint bypasses the fee. Initial creation and ordinary class changes remain free. |
| Status effects currently prevent action selection | Natural Agility needs an explicit one-round exception, shared by the server and UI; adding a random check only during damage execution will never permit the blocked action. |

### Equal stat prices do not produce equal benefits

Current basic attacks include Wizard `MAT + INT`, Ranger `RTK + 2×AGI`, and Bard `RTK + STR + INT + AGI + MND + VIT`. A Tier 1 purchase of +1 in all five primary stats adds five raw basic damage to Bard, but only one to Wizard. INT also increases MP and multiplies Fireball; several tank abilities multiply ATK by a combination of primary stats. Natural bonuses and specialization add further stacking.

**Recommendation:** retain the understandable catalog, but compare basic attacks, expensive abilities, healing, Hex ticks/MDF, defenses, and resource limits for every job at every tier. Explicitly show derived effects in the purchase preview. Do not claim all +1 upgrades have equal combat value.

### This extends progression; it does not make power progression infinite

Every combat track has a maximum. Recustomization is repeatable but is not a compelling repeat purchase for everyone. Preserve unspent points with no expiry. Future cosmetic collections, titles, or other optional repeatable uses can extend the system without endless vertical power; they are outside this initial implementation.

## 3. Proposed implementation rules

The following resolves technical details for review. Gameplay interpretations marked above and in section 7 remain proposals until confirmed.

### A. One catalog and one effective-rank calculation

Add a shared typed AA catalog with stable IDs, category, maximum rank, incremental price, effect per rank, minimum tier per rank, target weapon/armor slot where applicable, and description data. Derive descriptions and previews from the same values used by combat and purchases. Avoid separate hardcoded shop, UI, and combat tables.

Use one pure projection such as `resolveAAEffects(ownedRanks, context, effectiveEquipment)` for lobby previews, combat profiles, equipment permission checks, and campaign integration. Determine the active rank before calculating any effects. Retain the existing class and ability formulas; AA changes their inputs unless a specific mechanic says otherwise.

Proposed specialization map: sword/two-handed sword/fist/claws → ATK; wand/staff/herbs → MAT; bow/harp/spoon → RTK. This completes the ten current weapon types but requires catalog review, especially Herbs. Herbs' MAT helps its basic damage, not its MND-based potion healing. Derive the bonus from the actually equipped weapon after tier and compatibility filtering; no weapon means no specialization benefit.

### B. Preserve the existing XP bank and use integer points

Keep earning through the current authoritative reward transaction. Ordinary class EXP fills the encounter's permitted class progression first; overflow goes to the character's existing `aa_experience`. No automatic diversion of uncapped class EXP and no award duplication. Preserve participation proration, daily stamina, fractional XP, reward receipts, and unguilded encounter ineligibility.

For economy version 1, treat `aa_experience` as cumulative earned overflow XP and add an integer `aa_points_spent` balance plus a purchase ledger. Compute:

```
totalEarnedAA = floor(aa_experience / 60)
availableAA = totalEarnedAA - aa_points_spent
xpTowardNextAA = aa_experience % 60
```

Existing 125 overflow XP becomes 2 earned AA, 2 available AA, and 5/60 XP toward the next point. Preserve the separate existing fractional `xp_remainder`; do not round it into a bonus point or discard it. Since no spending system exists, historical spent points begin at zero. Record the migration's opening balance once, without replaying combat receipts.

Use an additive migration with a balance audit and nonnegative constraints. Choose safe integer storage/API bounds and test large existing balances. Do not rewrite applied migration 0014. The conversion belongs to a versioned economy definition fixed at 60 for v1, initialized from the confirmed level-10 requirement; a later class-XP curve change must not silently revalue previously earned AA. Any future exchange-rate revision needs an explicit migration policy.

Persist ranks by `(studentId, upgradeId)`; parameterized upgrades get stable distinct IDs. Store purchase receipts with request ID, catalog/economy version, rank before/after, integer price, and operation type. Cosmetic purchases are repeatable receipts, not a meaningless accumulating rank.

### C. Atomic, authenticated purchases

Expose an authenticated AA summary/catalog endpoint and a purchase endpoint accepting an upgrade ID, expected next rank, catalog version, and idempotency key. The server supplies the price and effects. It rejects another student's ID, unknown upgrades, skipped/maxed ranks, stale quotes, duplicate incompatible payloads, and insufficient funds.

Lock the same student row used by combat rewards; debit points, grant the rank or appearance change, and store the receipt in one transaction. The balance guard and expected-rank guard must hold under concurrent tabs, simultaneous reward arrival, and retries after a lost response. Returning an existing receipt must not charge again. GET requests are read-only.

Recommendation: allow permanent purchases above the current encounter cap, with a clear warning that the rank is inactive there. Apply purchases to the next encounter, not an in-progress room. No general respec is included until refund rules are approved; correction tooling must be audited and avoid inventing earned EXP.

### D. Authoritative context and preserved loadouts

Classroom combat already snapshots a hosting guild's limit tier. Use that power limit, not the monster's adaptive difficulty tier or the shop's equipment tier. An unrelated low-tier guild membership must not cap another guild's fight. For future campaign encounters, use the stricter of the campaign encounter limit and any hosting-guild limit actually applicable to that encounter. Do not infer restrictions from every guild on the account.

Classroom job caps are currently 4/8/10/15; the campaign roadmap specifies 4/8/12/15. Keep these distinct until campaign policy resolves the discrepancy. Both can use the same AA rank-to-tier mapping. A difficult adaptive classroom enemy does not unlock higher AA ranks.

Freeze effective AA ranks, loadout, and rule version with the player's encounter profile. Reconnect restores that profile, not freshly purchased upgrades. Decide the initial snapshot point consistently with participant enrollment; late joiners use the room's frozen tier. Old saved rooms default to zero AA effects. Purchases never refill HP, MP, combo, or potions in an existing fight.

Replace the two hardcoded cross-class fields with an ordered, per-job loadout collection capable of five slots, using a temporary compatibility adapter for existing data and saved rooms. Active capacity is the two baseline slots plus active AA slot ranks. Validate ability eligibility using capped job levels; reject duplicate/native/locked abilities. Extra slots become inactive at lower tiers while preserving their saved assignments and order.

### E. Stats and equipment

Apply effective primary-stat AA to job + gear + existing passive inputs before deriving HP, MP, combo limits, and attack formulas. Add flat HP/MP increases after their ordinary derivation. Add Natural ATK/MAT/RTK/DEF and conditional weapon specialization exactly once. Pass Natural Wisdom through the shared healing-value calculation so execution and preview agree.

Recommended Natural Wisdom scope: add flat healing to explicit healing abilities, including healing potions and each eligible party-heal recipient. Do not turn it into MND, shield strength, extra potion crafting, or lifesteal beyond damage actually dealt. Fixed “revive at 1 HP” and percentage/full-heal effects retain their stated behavior unless explicitly changed. Define this scope in the catalog and test it, rather than modifying every call to the generic HP restoration function.

Use proficiency-aware validation in equipment saves, job-switch restoration, combat-profile construction, shop/loot comparisons, and permission labels. The six body slots are head, chest, arms, hands, legs, and feet. A license never grants ownership, bypasses an item's required level, makes two-handed weapons accept an off-hand, or changes which stat an ability uses. Custom gear must follow the same classification rules.

For persistent campaign HP/MP, context or equipment changes clamp current resources to new maxima without granting repeated free healing; define the transition once with campaign work. Raising a maximum should not automatically fill the added capacity. New classroom fights keep their existing start-resource policy.

### F. Preservation, dodge, and status exceptions

- **Combo (owner correction):** wrong answers and timeouts clear all CP for every class. With AA, `after = min(before, activeRank)` retains up to 1/2/3 existing CP. Wrong-answer damage and retaliation cannot refill this loss; normal monster attacks still grant the Monk's existing on-hit CP. The correct-answer streak always resets. Never generate CP from zero.
- **Potions:** roll once per successfully used, actually charge-consuming potion action, including Herbalist healing/shield potions and Potion Diffuser. A charge must exist and be reserved when queuing; hoped-for preservation cannot fund extra queued actions. Party-wide use gets one roll per consumed charge, not one per recipient. Failed/cancelled actions do not charge or roll. Life Potion currently consumes no potion charge, so its name alone does not trigger preservation. Future inventory consumables should reuse this hook when implemented.
- **Dodge:** introduce typed incoming damage causes so eligible incorrect-answer attacks and direct monster counterattacks are explicit. Recommended exclusions are DoT ticks, self-sacrifice, and trip/self-inflicted damage. Roll before shields or guard resources are spent, on the player who would actually receive the attack after redirection. Do not reroll an already immune or guaranteed-dodged hit. Count a dodged hit as zero actual damage, preventing damage-based lifesteal; record avoidance separately from EXP-bearing blocking. Non-damage status application is a separate policy decision: the current request promises damage avoidance, not blanket spell immunity.
- **Natural Agility:** after ordinary correct-answer recovery, if stun or hypnosis still blocks the player, make one roll for one normal basic attack. The status remains; the success does not grant an unrestricted ability turn, extra attack, or immediate cure. Treat Hypnotic Stare as hypnosis. Do not include paralysis, web, fear, or another independent action blocker without approval. If the normal recovery already freed the student, do not add an extra attack. Priest's normal action is First Aid, so its eligibility/behavior needs an explicit decision rather than silently bypassing status for a heal.

All random outcomes use the existing persisted server PRNG and stable action identity. Duplicate commands, reconnects, and room restoration must not reroll a chance. Communicate preserved charges, avoided damage, and permitted status attacks through normal combat events and previews.

### G. Recustomization

Open a preview editor showing the fixed 5-AA price. Charge once only when the changed character appearance/name successfully saves, atomically with the update. Preview, cancellation, failed validation, and saving no changes do not charge. A session may change several allowed attributes for that one fee.

Use a character display name, not the student login identifier or immutable student ID. Preserve teacher identity/reporting and existing account-name corrections. Initial character creation and class switching remain free; separate their endpoints/fields from paid recustomization. Synchronize canonical appearance and any legacy sex/model fields so switching classes cannot bypass the fee. Decide whether free equipment recoloring is outside this fee; recommendation: keep gear dyes separate from character appearance.

## 4. AA interface

Add a dedicated **Advancement** screen reachable from the lobby/progression area, with a visible link to cross-class loadouts and recustomization. Use a compact summary and list/cards; a large branching tree does not fit these mostly independent tracks.

| UI area | Required information and behavior |
| --- | --- |
| Wallet summary | **Available AA**, **Total earned AA**, **Spent AA**, plus progress such as `23 / 60 XP to next AA`. Explain that EXP earned above the encounter's class cap becomes AA EXP. |
| Context bar | Current class, hosting guild/campaign where relevant, and active tier. A clearly labeled Tier 1–4 preview changes the display only, never live combat permissions. |
| Category navigation | Primary stats; Combat; Weapons; Armor proficiencies; Utility. Count matching upgrades. |
| Search/filter | Search name/weapon/effect; All, Affordable, Owned, Unpurchased, Maxed, Active here, Restricted by tier, Relevant to current class. Filters combine predictably and offer Clear filters. Do not hide temporarily inactive purchases by default. |
| Upgrade card/row | Name, concise effect, owned rank/max, effective rank, rank markers with tier labels, next-rank price, next-rank benefit, and current-job stat preview. Clearly distinguish unowned, owned-but-inactive, unaffordable, and maxed. |
| Purchase details | Exact incremental cost and resulting balance; effect before/after; when and where the rank becomes active. One deliberate Buy rank action, pending state, and authoritative receipt. No per-purchase generic confirmation dialog is needed. |
| Proficiencies | Category/type and affected slot, current-class permission, and classes whose access changes. Universal light-armor access displays as already available, never a paid upgrade. |
| Slot upgrades | Show existing slots and purchased extra slots; label inactive slots by required tier. Preserve their assignments and provide keyboard/touch selection as well as drag-and-drop. |
| Recustomization | Separate preview editor with `Save changes — 5 AA`; accessible Cancel, validation, and insufficient-balance handling. |

Example only: **18 Available · 47 Total earned · 29 Spent · 23/60 XP**. A Strength card can show **Owned 6/10 · Active 2/10 at Tier 2 · Next rank 7 costs 14 AA · Requires Tier 4 to use rank 7**. If purchased in that context, it must not imply that current-fight STR increases.

Show all ranks and prices in the expanded card, including later tier requirements. Rank markers need text/accessible labels, not color alone. Support keyboard focus, screen readers, narrow phones, loading/error/empty states, server-side stale-balance rejection, and reconnect after a successful purchase whose response was lost. A teacher-facing read-only breakdown is useful for explaining a student's effective power; editing points is a separate audited operation.

## 5. Implementation sequence and completion gates

| Package | Deliverable | Completion evidence |
| --- | --- | --- |
| AA-0: settle rules and pace | Resolve section 7; catalog with exact effects/costs; baseline vs requested vs reduced-chance simulations; confirm tier-wide power policy | Reviewed decisions and deterministic per-job/per-tier report, including full breadth, no-AA baseline, extreme builds, and earnings sensitivity |
| AA-1: wallet and purchase foundation | Shared catalog/projection, additive migration, preserved bank, integer balances, receipts, authenticated summary and purchase service; minimal real AA screen | Migrated populated fixtures; correct opening balances/remainders; concurrent spend/earn and retry tests; owner isolation; no negative balances or skipped ranks |
| AA-2: deterministic upgrades | Primary/Natural/HP/MP effects, specialization, proficiencies, five-slot loadouts, tier projection in previews and room profiles | Every class and tier agrees between preview/server; lower-tier restrictions preserve saves; compatible hands; current resources do not refill; zero-AA regression behavior |
| AA-3: chance mechanics | Combo preservation, potion preservation, dodge, Natural Agility, events and selection UI | Seeded probability-boundary cases, replay/restoration consistency, real-resource reservation, timeout/status/guard/DoT interactions, no synthetic EXP credit |
| AA-4: complete interface and recustomization | Filters, rank details, balance/purchase UX, paid editor, responsive and accessible loadout changes | Browser acceptance on desktop and phone; keyboard purchase/filter/edit flows; failure/retry states; no remaining free paid-edit bypass |
| AA-5: release and campaign integration contract | Full catalog regression/balance report, upgrade/rollback rehearsal, isolated acceptance; campaign adapter when that mode is ready | Exact-revision CI/build/browser pass, migration preservation, approved balance decisions, deploy and canonical acceptance evidence; distinguish classroom release from future campaign verification |

Register one coherent implementation package/branch/PR when implementation is requested, following [active work](ACTIVE_WORK.md) and [cleanup exit gates](CLEANUP_PLAN.md#exit-gates-before-expansion-resumes). This planning branch is not a second Campaign or C12 implementation. Keep the purchase system gated until its corresponding effects and UI are complete; students must not pay for an inactive unfinished feature.

Do not require campaign production deployment to deliver classroom AA. Build against an explicit power-context contract now, then verify actual campaign persistence and tier transitions with the campaign package. Do not describe campaign support as shipped based only on shared helpers.

## 6. Verification cases that matter

1. **Conversion and awards:** 0/59/60/61/125 XP; fractional carry; a reward crossing the class cap; maximum class; stamina; repeated solo exit/teacher end; duplicate receipts; ineligible unguilded fight; simultaneous combat rewards and purchases. Preserve all existing banked EXP.
2. **Purchase correctness:** insufficient funds; stale rank/price; two requests for one rank; different purchases competing for one balance; replay after commit but before response; mismatched idempotency payload; max rank; malformed upgrade; cross-student access.
3. **Context:** every catalog rank under T1–T4; multiple guilds; changed guild tier during a running room; adaptive enemy tier; old saved room; late join/rejoin; new purchase while fighting; campaign/guild restriction combination. No permanent rank/loadout loss.
4. **Combat:** all jobs and existing passives; correct attack-stat specialization; direct abilities and Hex initial/ticks with MDF; actual healing caps and AoE; primary/flat stacking; HP/MP transitions; preserved combo at 0/below/at/above protected floor; incorrect answers still incorrect.
5. **Chance outcomes:** exact random boundaries just below/at each threshold, with controlled seeded inputs; no flaky probabilistic pass/fail tests. Add fixed-seed simulations for balance measurements, separately from correctness tests. Cover shield/guard order, guaranteed dodge, DoT exclusions, missing charge, Diffuser's single consumption, hypnosis recovery plus overlapping blockers, and restart without rerolls.
6. **Equipment/loadouts/editor:** all ten weapon types, all six body slots, redundant light licenses, built-in and custom class restrictions, off-hand pairing, five ordered slots with tier suppression, per-job restoration, free creation/class change, paid multi-field edit, cancellation/no-op, and every legacy appearance endpoint.
7. **User experience:** distinguish earned/available/spent; rank vs active rank; every later cost/tier visible; combined filters and zero results; affordable state after another tab spends; phone overflow and touch; keyboard/screen-reader labels; delayed request and recovery.

No runtime test pass is claimed for this document. Repository inspection, exact arithmetic, and documentation consistency checks support the plan; balance recommendations still need simulation and classroom observation.

## 7. Product decisions still needed before dependent implementation

| Decision | Recommendation / boundary |
| --- | --- |
| Rank caps only, or total active combat-AA budget too? | Rank caps satisfy the stated requirement. Add a budget only if the intended promise is similar power among same-tier players; determine amounts from AA-0 rather than guessing. |
| Retain the requested dodge/potion chances? | Balance-test against the lower-chance candidate in section 2; retain the original values in the requirements until explicitly revised. |
| Combo preservation meaning | Adopt protected floor, avoiding redundant ranks and avoiding a new global miss-reset penalty. |
| HP/MP and cross-class baseline | Separate HP and MP tracks; preserve two baseline slots and add three. Remove the stale level-30 UI restriction. |
| Specialization and healing scope | Confirm the weapon-to-stat map and explicit-heal-only Natural Wisdom scope, including full-heal/revive exceptions. |
| Natural Agility scope | One normal basic attack, status retained; stun/hypnosis only. Decide Priest/First Aid behavior and overlapping control semantics. |
| Dodge/status scope | Avoid eligible damage, with no general status immunity. Clarify whether any on-hit status also requires a landed damaging hit. |
| Cosmetics and licenses | Display-name changes, separate gear dyes, no useless light-armor charge; off-hand licenses are not yet specified. |

Confirmed decisions no longer open: **60 XP per AA** and **Natural Agility costs 2 / 3 / 8**. Do not make these depend on an arbitrary future interpretation of “level 10.”

## 8. Code and specification anchors

- [XP curve, shared rewards, class unlocks and passives](../shared/jobSystem.ts)
- [Current overflow award transaction and row lock](../migrations/cloudflare/0014_guild_quests.sql); [fractional XP/stamina foundation](../migrations/cloudflare/0008_daily_combat_stamina.sql)
- [Guild caps and AA bank rules](guild-quests-and-tiers.md); [campaign power-policy question O-11](CAMPAIGN_DEVELOPMENT_ROADMAP.md)
- [Character stats and basic attack formulas](../shared/schema.ts); [shared ability values and healing](../shared/combat/abilityValues.ts)
- [Equipment gates and categories](../shared/equipment-rules.ts); [slot definitions](../shared/equipment-slots.ts); [loadout storage](../shared/job-loadouts.ts)
- [Equipment write validation](../worker/services/equipment.ts); [capped combat profiles and rewards](../worker/db/game-repository.ts); [participant construction](../worker/combat/participants.ts)
- [Incorrect-answer combo penalty](../worker/combat/phases.ts); [potion use](../worker/combat/ability-execution.ts); [incoming damage](../worker/combat/health.ts); [status preparation](../shared/combat/status-effects.ts)
- [Lobby slot discrepancy](../client/src/features/lobby/CrossClassPanel.tsx); [equipment-page slots](../client/src/pages/StudentEquipment.tsx); [current appearance/class flow](../client/src/features/lobby/useClassAppearance.ts)
- [Released shared EXP and Hex behavior](combat/solo-exit-xp-and-periodic-effects.md); [current release checkpoint](releases/2026-10-26-pr85.md)
