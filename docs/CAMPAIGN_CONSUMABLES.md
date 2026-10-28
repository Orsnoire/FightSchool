# Campaign consumables — October 21 playtest

The owner requested a consumable inventory, item shop and status items. This is
implemented on the campaign pilot branch. Deployment and verification status live
in [active work](ACTIVE_WORK.md). Classroom combat has no purchased campaign bag.

| Item | Effect | Prototype price | Weight |
| --- | --- | ---: | ---: |
| Potion | Restore 5 HP, capped at maximum; cannot revive | 10 | 1 |
| Antivenom | Cure poison | 10 | 1 |
| Ennervator | Cure stun | 12 | 1 |
| Psychic Needle | Lose exactly 1 HP to cure Hypnosis or Hypnotic Stare | 10 | 1 |
| Sticky Shoes | Prevent trip for five enemy turns | 20 | 1 |
| Stun protection (name TBD) | Prevent stun for five enemy turns | 20 | 1 |
| Psychic Crown | Prevent Hypnosis and Hypnotic Stare for five enemy turns | 20 | 1 |
| Silver Knife | Cure webbed; consumed on use | 10 | 1 |

Names and effects follow the owner's request; the stun-protection name remains
open. Prices, Potion strength, equal weights and the following limits are explicit
playtest defaults for review, not final economy decisions:

- The bag records quantities and total weight. There is no carry limit yet. Gear
  weight and encumbrance are not specified by this pilot.
- Any job can use bought items on itself. One item can be used per combat round,
  during the question or selection phases before Ready. Items do not require a
  correct answer or replace its academic credit. During a question, self-cures
  remain available while stunned, webbed or hypnotized. A wholly disabled party
  still skips its action-selection clocks; use its cure during the question.
- Psychic Needle requires at least 2 HP to avoid an accidental knockout. Its
  direct HP cost bypasses shields/defense. This is an explicit exception to the
  ordinary rule that only another enemy's direct hit breaks hypnosis.
- A cure with no relevant status, a full-health Potion, or an unavailable item
  cannot be consumed. Ennervator does not cure paralysis.
- Protection prevents new applications, including both hypnosis types for the
  crown. It does not cure an existing effect. Five enemy turns includes the
  next enemy turn after use. Remaining protection survives encounters; walking,
  menus, resting and reconnecting do not consume turns. Reuse refreshes to five,
  without stacking, and is rejected when five turns already remain.
- Potions/protection can be used from the exploration Items menu. Status cures
  are useful in combat; the existing pilot does not persist ailments between
  encounters. Buying multiple copies adds quantity rather than an owned-gear flag.
- Bought Potions are distinct from Herbalist healing/crafting charges. Existing
  job abilities and inn replenishment of those charges are preserved. The inn
  never replenishes bought items. There are no free shop-item grants.

The item shop appears at **S**, at the east side of town. Migration 0020 adds it
to existing saved pilot layouts without regenerating maps, extends the atomic
purchase routine, and settles remaining item quantities/protection with combat
results. Active encounters begun before this update retain their old resources.
The authoritative bag stays locked in the encounter until settlement; retries,
reloads and concurrent commands cannot duplicate an item or purchase.

## Combat responsiveness follow-up

A two-round live QA probe of the prior preview acknowledged commands in
124–151 ms. Support confirmation to visible resolution took about 1.0–1.2 s;
final playback acknowledgment to visible completion took about 10 s. The probe
used scripted animation acknowledgments, so it does not establish browser or
device animation performance. This points to synchronous reporting/result work
in this observed path, not a slow input acknowledgment.

Campaign rooms now publish a state immediately after its durable checkpoint,
before optional SQL reporting. The battlefield can animate while reporting
finishes, and completion can show **Saving your results…** while rewards settle.
Rewards are only exposed after their result receipt is durably saved. Existing
four-second answer feedback, three-second next-question lead-in, status rules,
server authority and command authentication are preserved. Database work still
serializes room commands; this is not a claim that all possible latency is fixed.
