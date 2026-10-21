# Math display repair — October 21, 2026

Owner request: make typed/imported math such as `x^2` display with proper exponents, scripts, and fractions in QuestAcademy.

Branch: `fix/math-text-rendering`. Initial baseline: `374c47847a077e4a1bd9e1c393dca6de4c823921`.

Scope: shared question/answer rich-content rendering and equation preservation in the teacher editor, with regression checks for ordinary text, existing math, SVG, and sanitization. No answer-grading, gameplay, migration, or stored-content rewrite.

Status: claim only; implementation and verification pending. Separate campaign, domain routing, and C12 branches remain untouched. Next: reproduce raw math and editor round-trip behavior, implement the scoped repair, and verify before proposing release.
