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

- 16 rich-content tests and TypeScript pass.
- Both requested quiz CSVs pass the real importer and shared renderer:
  48 questions and 264 equations, with keys/timers/math metadata preserved.
- New regressions cover powers, subscripts, fractions, all four delimiter styles,
  malformed math, sanitization, prose/currency/address preservation, CSV keys,
  tightly spaced inequalities and exact source-character preservation.
- The existing Chromium authoring/lobby fixture now checks CSV import, editing,
  save/reload, answer identity and rendered MathML at desktop/phone sizes. Browser
  execution is pending CI; local Chromium downloads returned invalid archives.
- Full regression tests and production builds are in progress.

State: implemented and focused checks passed; full CI/browser review pending.
Not merged, deployed or live accepted. No migration, gameplay, student-data or
provider changes. Campaign, domain routing and C12 work remain separate.

Next: finish the full gates, inspect exact-current-head CI/browser results,
resolve any failures and present the verified change for release.
