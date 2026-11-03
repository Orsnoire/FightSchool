# MATH-01: exact rational grading, first slice

Status: **IMPLEMENTED / VERIFIED LOCALLY / UNMERGED (latest CI status in PR #96)**.
Branch `feature/math-01-exact-grading`, [PR #96](https://github.com/Orsnoire/FightSchool/pull/96).
Inspected baseline: `d8233a2d94fe0c11f56b960cb4b677dcffab4609`.
The November 3 owner request authorizes this bounded slice of the
[mathematics project](../MATH_QUESTION_ENGINE_PROJECT.md), independently of C12.

## Implemented boundary

`shared/contracts/math-answers.ts` defines a strict, JSON-safe version 1 answer
contract. `shared/math/rational.ts` evaluates bounded numerical arithmetic with
native `BigInt` numerator/denominator pairs. `shared/math/grade-answer.ts` validates
the contract, compares exact values, then checks the requested response form.
It never uses floating-point tolerance, numerical sampling, `eval` or a symbolic solver.

The new teacher-authenticated `POST /api/fights/math/grade-preview` endpoint is a
non-persisting review surface, with the existing Worker origin and session guards.
It takes the entire proposed contract and submitted answer; it accepts no fight,
student or session identifiers and reads no saved answer key. It does not save
questions, attempts, results or rewards, nor create a combat room. There is no UI
or live grading activation in this slice.

Existing `questionSchema`, `FightQuestion`, `correctAnswer: string`, CSV dialect,
`answersMatch`, combat commands and saved rooms retain their existing behavior.
An existing fixed question whose key is `1/2` still does **text** matching; this
PR does not silently enable mathematics grading for it. Live integration needs
an explicit indeterminate policy, persistence/replay and answer-secrecy design.

## Contract and examples

```json
{
  "answerContract": {
    "version": 1,
    "kind": "exact_rational",
    "expected": "1/2",
    "requiredForm": "reduced_fraction",
    "domain": {
      "min": { "value": "0", "inclusive": false },
      "max": { "value": "1", "inclusive": true },
      "excluded": ["1/3"]
    }
  },
  "submitted": "2/4"
}
```

This returns `{"status":"incorrect","reason":"required_form"}`: the value is
equal but the fraction is not reduced. Omitting `requiredForm` (or using `any`)
accepts `2/4`, `0.5`, or `1/(1+1)`. Changing `submitted` to `2/6` produces
`outside_domain`, because exclusions are also compared exactly.

Domain means the **numerical answer's admissible values**: rational lower/upper
bounds and an excluded-value list. It is not a variable-domain proof, a domain
answer type or a way to assert equivalence of `x/x` and `1`. No variable assumptions
are accepted or silently discarded. An expected value outside the domain, invalid
bound/exclusion, impossible required literal form, unknown field/version/kind or
unsupported expected expression returns `indeterminate / invalid_contract`.
The Zod schema validates structure; use the grader for semantic validation too.

## Grammar and form decisions

Version 1 accepts ASCII integer and terminating-decimal literals, unary `+`/`-`,
binary `+ - * /`, parentheses and whitespace **between** tokens. Multiplication
and division precede addition and subtraction; binary operations associate left.
Decimals become exact powers-of-ten fractions. Digits separated by whitespace
are never joined. Zero denominators, including intermediate ones, remain undefined.

| Required form | Accepted representation after outer whitespace is trimmed |
| --- | --- |
| `any` (default) | Any supported numerical expression equal to the expected value |
| `integer` | One optionally signed integer literal; `2.0`, `4/2` and `1+1` fail this form |
| `fraction` | Signed integer numerator / signed nonzero integer denominator; spaces around `/` allowed |
| `reduced_fraction` | The fraction form with positive denominator and coprime numerator/denominator; `0/1` and `n/1` allowed |

Leading zeroes and a leading `+` are allowed; no display-format canonicalization is
required. Required forms demand literal digits next to their signs, not parentheses
or arithmetic. The expected string describes the value and need not itself have
the required student form. A required fraction/integer must be expressible within
the literal limits below.

Variables, radicals, powers (both `^` and `**`), scientific notation, implicit
multiplication, mixed-number notation, LaTeX, Unicode math symbols, percentages,
units, equations, sets and matrices are outside v1. Recognizable unsupported
notation returns indeterminate; no general symbolic equivalence is claimed.
This API takes plain text, not MathLive/LaTeX output. Practical math-entry support
and a teacher-facing editor remain later authoring work.

## Results and resource bounds

| Status | Reasons / meaning |
| --- | --- |
| `correct` | Exact value, numerical domain and required form all pass |
| `incorrect` | `not_equal`, `required_form`, `outside_domain`, `malformed_expression`, or `undefined_value` within supported syntax |
| `indeterminate` | `unsupported_notation`, `resource_limit`, or `invalid_contract`; not learner-error evidence |

The preview returns these outcomes as HTTP 200 JSON. Invalid JSON/envelopes return
400 and bodies over 32,768 received UTF-8 bytes return 413. Unauthorized or
non-teacher actors get 401; the existing Worker origin guard returns 403.
Responses are not cacheable. Envelope strings above 5,000 characters are rejected;
within that envelope, mathematical input beyond the 512-character budget returns
`indeterminate / resource_limit`.

Each expression is bounded to 512 characters, 256 non-whitespace tokens,
32 nested parentheses/unary signs, 100 digits per literal, and 1,024 bits per
intermediate numerator/denominator before reduction. Comparison cross-products
are at most twice that size. There are at most 32 exclusions. A cancellable
expression can hit the intermediate bound; that is indeterminate, not incorrect.
No timeout is interpreted as a wrong answer. These are conservative implementation
bounds, not classroom latency guarantees or final curriculum policies.

## Dependencies and deferred work

- No package or lockfile changes. Native `BigInt` uses the existing ES2022 target;
  structural validation uses existing Zod; tests use existing Node/tsx/PGlite.
- No CAS/parser dependency or recognition provider is selected. This small parser
  implements only the documented numerical grammar.
- No database migration, production connection, student-data access, deployment,
  generated combat session, PDF recognition or curriculum family selection.
- Only the answer-contract part of MATH-01 is implemented. Template/instance
  provenance contracts and broader bounded symbolic grading remain deferred.
- Live indeterminate handling, frozen/persisted grading policies, replay, answer
  privacy and teacher/student UI must be reviewed before live mathematics grading.

## Verification checkpoint

The 14 focused tests in `tests/phase4/math-grading.test.ts` pass. They cover
exact equivalences, false near-matches beyond floating-point precision, 5,082
independent fraction comparisons plus 77 negative-denominator scaling checks,
operator precedence, malformed/undefined input, unsupported notation, form/domain
checks, invalid contracts, all parser limits, deterministic JSON output, unchanged
fixed-question combat results, authentication and HTTP body validation.

The real Worker integration regression additionally exercises all grading outcomes,
teacher/student/origin authorization and read-only SQL against a disposable PGlite
database; no production data is involved.

Local verification on implementation `91fd2a9`:

- `npm test`: **433 tests pass** (5 phase2, 7 phase3, 405 phase4, 16 rich-content).
- A separate phase4 run with `--test-concurrency=2`: **405 pass**.
- `node --test tests/deployment/*.test.mjs`: **13 pass**.
- `npm run check`, `npm run build:cloudflare` and `git diff --check`: pass.

GitHub CI/browser results for the final documentation checkpoint are tracked in
[PR #96](https://github.com/Orsnoire/FightSchool/pull/96). Source publication is
verified against the local Git tree; only this registration/evidence documentation
changes after the tested implementation. No merge, deployment or live acceptance
is claimed.
