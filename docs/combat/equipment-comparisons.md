# Equipment comparisons

Status: implemented for review on `feat/gear-comparisons`, not deployed. Stacked
on Tier 1 PR #44, after remembered-loadout PR #43.

Hover an item card or focus/tap its **Compare** button to inspect equipment
bonuses before changing gear. This is available in the lobby equipment picker,
guild shop and loot reward cards. The dedicated equipment screen retains its
slot selectors and adds expandable **Compare [slot] options** lists with the
same hover/focus/tap comparison. Close, Escape or clicking outside dismisses it.
Desktop uses a side-positioned hover panel. Phones use a centered comparison
dialog with an explicit Close button, sized to the viewport and internally scrollable.

The panel names the candidate and currently equipped item, then shows Current,
After and signed Change values for STR, INT, AGI, MND, VIT, DEF, ATK, MAT and RTK.
Stats present only on the outgoing item remain visible as losses; negative
modifiers are handled correctly. Equal values show zero. Empty slots explicitly
say nothing is equipped. The same item is marked already equipped. These are
**equipment bonuses**, not calculated final combat damage, HP or healing totals.

A weapon that conflicts with the current off hand includes that off hand's lost
stats in the comparison and names the required removal. The preview does not
perform that removal or bypass the server's equip validation. An incompatible
off-hand candidate explains that it needs a compatible weapon without guessing
which weapon the player would select. Job/material, level and hand-pair blockers
remain visible; a player can still claim or buy gear for future use.

Special effects are separate from numerical stats: acquiring or replacing the
Priest ankh and Healer's Potion shows the healing or three-round ATK effect gained
or lost. Equal effects do not appear as gains. Comparisons never equip, purchase,
claim or spend anything. Reward selection remains one explicit Claim action;
claiming places the item in inventory rather than equipping it.

Loot/shop comparisons subscribe to the shared saved student/job-level queries
and equipped-item metadata. They use the saved loadout, not an old combat
snapshot, and refresh on window focus. Loading, failed or missing current-item
data gets an explicit unavailable state instead of treating the slot as empty.
Lobby/equipment comparisons reuse their authoritative cached loadout queries.
Existing save/reward invalidations update comparisons without a reload.

No server or database migration is added by this feature. Pending: review and
deployment of this stack; item artwork, equipped overlays and animation remain
separate work. Validation includes signed stat changes, displaced off hands,
effects, blocked items, absent/refreshing metadata, and actual reward comparisons
at Chromebook and phone widths, including hover, tap, keyboard and no-claim checks.
