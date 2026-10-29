# Mathematics question engine and quiz authoring project

**DESIGN RECORD / FUTURE WORK — October 29, 2026.**
**Project ID: MATH. Implementation has not started.**

The owner requested this project be recorded after the mathematics feasibility
discussion. It captures the agreed direction and requested scope; the proposed
packages and unresolved policies below are planning material, not a release or
authorization to implement every package at once. Follow the
[Source of Truth](Source_of_Truth.md), [expansion plan](EXPANSION_PLAN.md) and
[active-work checkpoint](ACTIVE_WORK.md) before starting implementation.
Register the selected package and its branch/PR when implementation is scheduled.

## 1. Purpose and teacher outcome

Make reusable mathematics practice practical for teachers: select or enter a
problem, confirm the skill and mathematical structure, preview valid variations,
choose a session length, and use fresh questions during a fight. Teachers should
not need to write generator code or manually author every numerical variation.

The intended everyday workflow is a searchable template bank with manual entry,
visual builders and PDF import feeding the same authoring and review process.
The mathematics capabilities remain a content module within QuestAcademy's
content-agnostic platform, separate from combat mechanics.

## 2. Agreed direction and requested scope

The October 29 conversation establishes these requirements:

- **Recognition and teacher approval happen during authoring.** A proposed
  template must preserve the intended skill, not merely the appearance of an
  example. The teacher confirms its interpretation before it is used.
- **Validated mathematical generation handles live play.** Approved templates
  produce fresh variants during a fight without requiring a generative AI call
  for every question or answer.
- **The teacher chooses an intended session question count** independently of
  how many source questions or templates were selected. Whether that count is
  a balancing target or a hard stopping point remains an explicit open decision.
- **Broad mathematics coverage is a project goal:** elementary arithmetic through
  calculus, with computational linear algebra and matrices included. Geometry
  and graphs must have practical authoring paths. Coverage is delivered through
  tested problem families, not a claim to recognize every possible problem.
- **Equivalent expressions are essential for teacher usability.** Grading must
  understand supported mathematical answers, domain assumptions and required
  response forms rather than relying solely on text equality.
- **A searchable problem-template bank is requested.** Teachers should be able
  to discover, preview and reuse a skill without supplying a source problem.
- **PDF-assisted entry is a requested capability to investigate and stage.**
  Manual entry is an acceptable fallback; geometry and graphs are especially
  important usability cases. No OCR/model provider, paid API, self-hosting
  arrangement or blanket prohibition on recognition models has been selected.

The owner authorized recording this project and linking it into design direction.
Runtime changes, deployments, data migrations, new subscriptions and model hosting
are outside this documentation task.

## 3. Teacher workflow

1. **Start from the bank, an example, or a PDF selection.** Preserve the original
   problem alongside any extracted text and proposed mathematical interpretation.
2. **Confirm the task and supported family.** The same expression can be used for
   simplification, finding a domain, or evaluating a limit. Recognition cannot
   silently decide the instructional objective from notation alone.
3. **Configure allowed variation.** Provide teacher-facing controls for number
   ranges, signs, fractions, difficulty, required operations, solution types,
   domain restrictions, diagrams and calculator expectations as appropriate.
4. **Preview several variants.** Show the prompt, diagram where applicable,
   accepted answer, restrictions, explanation where supported, and distractors.
   Surface unsupported or ambiguous interpretations for correction.
5. **Compose the session.** Select templates, question count, timing and a
   coverage mix. Proposed controls include quotas or weights and shuffled versus
   grouped order; exact UI and defaults remain to be selected.
6. **Publish a reviewed version.** An active session uses a frozen template
   version and grading policy. Later author edits affect later sessions.
7. **Review results by question and skill.** Retain the exact generated instance
   and associate it with its template family for meaningful performance reports.

An unrecognized problem can remain an ordinary fixed question or be mapped by
the teacher to an existing supported template. Do not invent unsupported
generation rules or silently randomize its visible numbers.

## 4. Mathematical structure and coverage

A template describes the task, parameters, dependencies, constraints, answer
rules, and any visual construction. It is more than text with numeric blanks.

For example, simplify (x^2 - a^2)/(x - a) uses a linked square and factor; its
simplified expression is x + a on the original domain x != a. Independently
randomizing the square and denominator could remove the intended cancellation.
A system-solving template can choose an invertible matrix A and an integer
solution vector x, then calculate b = Ax to construct a system with the intended
unique solution. Integration families can be constructed around a specified
technique or known antiderivative.

| Coverage area | Illustrative families | Properties to control |
| --- | --- | --- |
| Elementary arithmetic | Operations, missing values, fractions, decimals, percentages | Regrouping, remainders, signs, magnitude, exactness and denominator relationships |
| Algebra | Linear/quadratic equations, inequalities, factoring, radicals, rational expressions and systems | Factorability, solution count/type, excluded values, extraneous solutions and required form |
| Precalculus | Functions, transformations, exponentials, logarithms and trigonometry | Domain/range, bases, angle units, exact values, periods and representation |
| Calculus | Limits, derivatives, integrals and structured applications | Intended technique, continuity, domains, differentiability, singularities, convergence and difficulty |
| Geometry and graphs | Similarity, triangle/circle relationships, coordinate geometry and function graphs | Valid constructions, stated givens, labels, scale conventions, axes, intervals and open/closed points |
| Linear algebra | Matrix operations, determinants, inverses, row reduction, rank, eigenvalues/eigenvectors and bases | Dimensions, rank, invertibility, solution space, multiplicities, numeric complexity and valid alternative answers |

These are coverage goals, not an initial-release checklist. Arbitrary proofs,
unrestricted written explanations and universal diagram interpretation need
separate assessment designs. A symbolic library's ability to compute an answer
does not by itself establish a pedagogically valid generator.

## 5. Mathematical grading contract

Each supported family needs a defined answer type and grading policy:

- Exact numbers, fractions, radicals and symbolic expressions where appropriate.
  Numerical tolerance and rounding must be explicit for approximate answers.
- Equivalence under declared assumptions and the problem's intended domain.
  Simplification must not erase required exclusions or change branch choices.
- Mathematical equivalence and the requested form are separate checks. A correct
  factorization must be factored; an expansion task must be expanded; returning
  the original expression is not sufficient merely because it is equivalent.
- Equations, unordered solution sets, intervals, vectors and matrices need
  structure-aware comparison. Some tasks require multiple conditions or answers.
- Antiderivatives require the appropriate constant/domain policy. Eigenvectors
  and bases can have many correct representations; grading must check the
  defining properties or subspace rather than one stored vector or basis.
- Distinguish a proven incorrect answer from an unsupported or indeterminate
  check. Do not claim universal symbolic equivalence or treat a solver timeout
  as evidence that a learner is wrong. The live fallback needs an explicit
  policy before release.
- Numerical sampling may help find counterexamples but is not a general proof
  of symbolic equivalence. Use family-specific exact checks where feasible.

The quiz editor must communicate the response requirements and provide practical
math entry. Include parser limits and resource bounds; user-authored expressions
or imported templates must not execute arbitrary application code.

## 6. Template bank and recognition

Proposed bank features:

- Searchable names, descriptions, skills and common synonyms; filters for topic,
  course/grade band, difficulty, answer type, calculator use and visual content.
- Optional standards tags, sample questions and configurable parameter ranges.
- Reusable teacher presets, favorites and personal versions without changing the
  underlying published template for active sessions.
- Coverage/status labels that distinguish supported generation and grading from
  fixed-question-only or experimental content.

Keyword/synonym search and filters can operate without generative AI. Semantic
search, community publishing, shared ownership and marketplace distribution are
possible later additions, not requirements of the first bank.

Recognition maps parsed content and the teacher-confirmed task onto a supported
family. Rule-based recognition is feasible for supported structures. Optional AI
can propose interpretations during authoring, but teacher review and mathematical
validation remain necessary. An AI model must not become the live grading authority.

## 7. PDF, graph and geometry entry

Treat extraction, mathematical interpretation and template selection as separate
steps with a teacher-review boundary.

| Input | Feasible approach | Limitation and fallback |
| --- | --- | --- |
| PDF with selectable text | Extract text and positions; recover supported notation and propose family matches | Reading order, fractions, exponents and symbols can be damaged; review against the source |
| Scanned page or formula image | OCR, potentially specialized math OCR that converts a formula to structured notation | Recognition may use a trained model even when no paid API is involved; correction remains necessary |
| Geometry diagram or graph | Preserve a source crop; propose a known visual family or use a teacher-assisted builder | Lines and pixels do not establish mathematical givens, graph semantics or the intended task |
| Manual or visual entry | Structured math editor, matrix entry and family-specific graph/geometry controls | Covers supported families without requiring PDF recognition |

For generated visual questions, build the diagram from the same parameters and
constraints as the answer. Keep labels, ticks, scales, discontinuities and
open/closed endpoints consistent. Never infer a geometric equality only because
a drawing appears to have that property. A source image may be retained as a
fixed question; it cannot become a variable diagram just by changing its labels.

No external AI service is necessary for the template bank and deterministic live
generation. Scanned-math recognition may use a local/self-hosted learned model;
that removes a third-party inference dependency, not computing or maintenance
costs. Provider, licensing, infrastructure and quality evaluation are open.

## 8. Proposed live-session design

The following are engineering recommendations to validate in the first runtime
package, not separately approved gameplay policies:

- Freeze the selected template versions, constraints, grading policies, planned
  question count and coverage distribution when the session starts.
- Schedule coverage so a short session includes the intended skill mix. Resolve
  quota/weight rounding and insufficient-length cases visibly.
- Generate on the server at round boundaries, with optional preparation of a
  small upcoming buffer. Publish only validated questions.
- Persist each generated instance and its provenance: template/version, parameter
  values, generation seed/version, prompt, visual data and server-held answer.
  A seed alone is insufficient if the generator later changes.
- Keep generation randomness independent from combat randomness, so generating
  a question or retrying it cannot change enemy actions or rewards.
- Proposed initial shared-fight behavior: everyone receives the same generated
  instance each round. Per-student variants remain a separate design choice.
- Bound generation/checking work and retries. Avoid repeats where the finite
  parameter space permits them; define exhaustion and failure behavior before
  enabling a family. Never silently substitute an unreviewed skill.
- Refresh, reconnection, room hibernation and duplicate requests must retain the
  exact question and grading result. Keep answers private until the existing
  answer-reveal phase.
- Reporting must preserve both template-level skill identity and instance-level
  evidence. Review question-key, quest evidence and XP/AA/reward interactions
  rather than treating every numeric variation as a new reward entitlement.

Planned session length must be separate from template-bank size and actual
answered-round count. Completion, victory, defeat and reward semantics must be
resolved before introducing a strict question-count stop.

## 9. Existing implementation touchpoints

Inspected baseline: main commit ca1c0cb7e6d254833ee20d8b76a0214b0090bdaf
on October 29, 2026. Reinspect current main before coding.

- [Question contracts](../shared/contracts/fights.ts) and
  [database types](../worker/db/schema.ts) currently describe fixed prompts,
  options, a string answer and a timer. Existing authored questions and CSVs
  must continue to work.
- [CSV import](../client/src/features/fight-authoring/csv.ts) and
  [question authoring](../client/src/features/fight-authoring/useQuestionAuthoring.ts)
  are entry points for the expanded creator; retain the current import dialect.
- [Answer comparison](../shared/combat/phaseRules.ts) currently normalizes text.
  Mathematical grading needs an explicit typed contract and server validation.
- [Encounter setup](../worker/combat/encounter-setup.ts) derives the question
  budget from the saved question array length.
  [Phase progression](../worker/combat/phases.ts) cycles the existing bank.
  Both must distinguish templates, planned length and generated instances.
- [Attempt recording](../shared/combat/attempts.ts) and
  [room persistence](../worker/combat/room-persistence.ts) assume frozen fight
  content. Extend their contracts coherently for exact generated-question history.

Follow current source authority and preserve live student data, fixed-question
behavior, campaign bank permissions, answer secrecy and existing combat rules.
This project does not select a symbolic library or require a provider change.

## 10. Proposed work packages

All packages are **NOT STARTED**. IDs are planning identifiers, not PR numbers.
The order is a proposed dependency sequence; choose a bounded first slice and
register it in active work before implementation.

| Package | Deliverable | Exit evidence |
| --- | --- | --- |
| MATH-01 — contracts and grading foundation | Versioned template/instance/answer contracts, exact arithmetic and a bounded initial set of equivalence/form/domain checks | Correct and incorrect equivalent-looking answers, domain traps, malformed input and indeterminate cases exercised through server boundaries |
| MATH-02 — bank and authoring pilot | Search/filter/preview, teacher approval, presets and selected initial generators; manual entry remains available | A teacher can select a skill, tune it, review several variants and save/reopen it without code; fixed questions/CSV remain compatible |
| MATH-03 — generated fight sessions | Intended length, coverage schedule, server generation, persisted instances and report integration | Shared-round consistency, reconnect/hibernation/retry, answer secrecy, no duplicate rewards and agreed completion/scaling behavior |
| MATH-04 — recognition and visual authoring | Supported-form matching, source comparison, structured matrix entry and selected graph/geometry builders | Ambiguous inputs require confirmation; generated visuals and mathematical answers agree; unsupported inputs have a usable fallback |
| MATH-05 — curriculum expansion | Additional tested families across arithmetic, algebra, precalculus, calculus and linear algebra | Each family passes the mathematics, grading, visual and teacher-workflow gates below; publish an honest coverage matrix |
| MATH-06 — PDF-assisted import | Selectable-text extraction first; evaluated scanned-math/diagram assistance as separate increments | Reviewed extraction fixtures, visible correction flow, model/service failure fallback and documented cost/quality limits |

A useful proposed pilot is rational-expression or exponent-rule practice for
Math 3/AP Precalculus, with a small arithmetic family to exercise cross-level
configuration. This is a recommendation, not an approved initial family list.
Equivalent-expression grading is part of the foundation, not an indefinite
follow-up after live generation.

## 11. Acceptance gates

For each released family and its integration:

1. Verify generated answers independently against the intended mathematics.
   Exercise boundaries and degenerate parameter combinations, not just typical
   examples. Use exhaustive finite ranges where practical and broader generated
   cases where necessary.
2. Verify preservation of the intended technique and configured difficulty.
   Check domains, solution multiplicity and diagram consistency.
3. Check distractors are distinct and incorrect under the same assumptions.
   Reject accidental multiple-correct choices unless the question type permits them.
4. Check alternative valid answers, required forms and indeterminate outcomes.
   No regex-only or floating-point-only claim of general equivalence.
5. Preserve exact published instances and grading after retries, reloads and
   template edits; preserve fixed questions, imports, ownership and campaign access.
6. Measure generation/grading latency and resource use for realistic classroom
   concurrency. Select bounds and failure behavior before release; no performance
   guarantee is established by this document.
7. Complete teacher usability review on desktop and student math-entry/visual
   checks on classroom-sized screens. Source errors must be correctable without
   rewriting an entire quiz.
8. Record implemented, tested, merged, deployed and accepted states separately.
   Apply the existing data-preserving migration and release process if needed.

## 12. Open decisions before their affected packages

- Initial family list, implementation priority and relationship to the existing
  cleanup/release queue.
- Symbolic math/parser components, supported expression grammar, runtime
  placement, licensing and resource budgets.
- Target question count versus hard stop; early enemy defeat, exhausted count,
  continued practice and resulting completion/reward rules.
- Exact quota/weight/order controls and the initial shared versus individual
  question policy.
- Live behavior for generation exhaustion, invalid variants and grading that
  cannot be determined within supported rules; these are not automatically
  student errors.
- Timing, calculator, approximate-answer, units and partial-credit policies
  where relevant to a family.
- Bank ownership, sharing, moderation and version compatibility; personal use
  can precede public contribution.
- PDF/OCR depth and optional model deployment; success criteria for geometry
  and graph recognition versus teacher-assisted reconstruction.

## 13. Research references

These establish available technical building blocks; they are not dependency
selections or evidence of QuestAcademy implementation.

- [Moodle calculated questions](https://docs.moodle.org/500/en/Calculated_question_type):
  parameterized prompts and formula-based answers.
- [SymPy calculus](https://docs.sympy.org/latest/tutorial/calculus.html),
  [matrices](https://docs.sympy.org/latest/tutorial/matrices.html) and
  [assumptions](https://docs.sympy.org/latest/guides/assumptions.html):
  symbolic calculation and explicit mathematical assumptions.
- [PyMuPDF text extraction](https://pymupdf.readthedocs.io/en/latest/recipes-text.html)
  and [page API](https://pymupdf.readthedocs.io/en/latest/page.html):
  text positions and drawing paths are extraction data, not inferred mathematics.
- [pix2tex / LaTeX-OCR](https://github.com/lukas-blecher/LaTeX-OCR):
  learned formula-image recognition that can be self-hosted; interpretation,
  template selection and review remain separate.
