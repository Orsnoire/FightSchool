# MATH-02 live authoring acceptance — November 5, 2026

**PASS: all ten check groups.** The owner explicitly approved dedicated QA
teachers, templates and test students after the initial approval block. The
prepared test ran once successfully after approval. Only acceptance code and
documentation changed; no application deployment or migration was needed.

Tested script: `tests/staging/math-authoring-acceptance.mjs`, commit
`0f6b2c4b71ed04523df6ac5cbe68c78a766fffb7`.

Fixtures: **two teachers, three templates, twelve students**. Requests use the
normal authenticated application API. Passwords and session cookies are generated
or received only in memory and are not logged or committed. Fixtures use unique QA
names and are retained in their own accounts. All fourteen sessions were logged out.

| Check group | Observed result |
| --- | --- |
| Catalog | Teacher-only access and non-cacheable responses pass |
| Product rule | Ten independently computed integer answers, deterministic previews, form/wrong/symbolic outcomes, save/retry/approval/reopen/history pass |
| Quotient rule | Same ten-answer and authoring checks pass |
| Power rule | Same ten-answer and authoring checks pass |
| Search and isolation | Approved-template search, cross-owner isolation and origin protection pass |
| Invalid settings | Empty pools and unsupported generator versions rejected |
| Student authorization | Twelve students denied all eight teacher-only operations, with six concurrent student checks |
| Mixed concurrency | Teacher previews, cross-owner reads and student denials pass with up to eight simultaneous requests; previews stay deterministic |
| Concurrent saves | Two saves against the same head yield one success and one conflict; exactly one draft revision is added; retry and prior approved snapshot remain intact |
| Session cleanup | All dedicated teacher/student sessions logged out successfully |

The eight student-denied operations are template listing, catalog, detail, history,
preview, creation, approval and grading preview. Each returns authentication denial.
Other teachers cannot retrieve or approve the owner's templates. These checks do
not grant students access to authoring or enable generated combat.

The simultaneous-save fixture ends with its original draft, immutable approved
revision and one new draft. The other two approved templates remain unchanged.
Existing classroom records were not targets of this authoring test.

Thirty generated answers passed exact grading. Wrong integers return incorrect,
decimal literals violate the integer-only form, and symbolic input remains
indeterminate. Positive-real-base identity assumptions remain in every prompt.

The earlier canonical combat suite passed teacher/student combat and all eight
operational checks; browser CI passed desktop and phone authoring plus fixed
questions/CSV compatibility. Combined with this live authoring result, the bounded
MATH-02 pilot is **operationally accepted**. Broader symbolic mathematics and
generated sessions remain separate work. [Release record](2026-11-05-math-02.md).
