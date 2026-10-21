# Math display repair — October 21, 2026

Owner request: typed/imported math such as x^2 should display with proper
exponents, subscripts and fractions.

Branch: fix/math-text-rendering; [PR #83](https://github.com/Orsnoire/FightSchool/pull/83).
Initial baseline: 374c47847a077e4a1bd9e1c393dca6de4c823921.

## Behavior

The shared renderer previously returned plain text immediately and only rendered
HTML equations carrying .math-inline[data-latex]. It now recognizes bare powers,
subscripts and common LaTeX commands in question/answer text, including HTML text
nodes. Bare numeric or parenthesized scripts keep the entire exponent/index:
x^12, x^-2, a_12, and x^(n+1).

Explicit inline delimiters \( ... \) and $...$, and display delimiters
\[ ... \] and $$...$$, support formulas beyond the conservative bare-text
recognition. Use \frac{a}{b} for stacked fractions. Existing equation metadata
continues to work.

Only the rendered view changes. Saved question text, answer values and grading
are unchanged. Prose, prices, identifiers, URLs, code, graph labels and existing
math are preserved. Invalid expressions remain readable; HTML sanitization and
KaTeX's trust: false boundary remain enforced.

The active question editor uses plain textareas, which preserve equation source.
An initially investigated legacy rich-text component has no active caller and is
not changed by this repair.

## Verification

- All 334 tests pass, including 16 rich-content tests. TypeScript and both
  production builds pass. Verified runtime: 9de50aa9f5d2b7ed008e1a815dac99504858477f.
- Both requested quiz CSVs pass the real importer and shared renderer:
  48 questions and 264 equations, with keys/timers/math metadata preserved.
- New regressions cover powers, subscripts, fractions, all four delimiter styles,
  malformed math, sanitization, prose/currency/address preservation, CSV keys,
  tightly spaced inequalities and exact source-character preservation.
- The existing Chromium authoring/lobby fixture now checks CSV import, editing,
  save/reload, answer identity and rendered MathML at desktop/phone sizes. Browser
  [Authoring/lobby Chromium job](https://github.com/Orsnoire/FightSchool/actions/runs/39637229852/job/119350950820)
  passes at that runtime, and both math screenshots were visually inspected.
  Local Chromium downloads returned invalid archives, so browser evidence
  comes from CI. The existing initial-loading job also passes.
- [CI 39637229319](https://github.com/Orsnoire/FightSchool/actions/runs/39637229319)
  passes at that runtime. Exact-current-head CI and all browser gate results
  are attached to PR #83; inspect those results before merging.
  Documentation-only checkpoints do not change the verified runtime.

State: implemented and locally verified, with the math browser scenario verified.
Not merged, deployed or live accepted. No migration, gameplay, student-data or
provider changes. Campaign, domain routing and C12 work remain separate.

Next: require green exact-current-head CI/browser gates, then review PR #83 for
merge and deployment. Release authorization and live acceptance are separate
from the implementation and browser fixture checks.
