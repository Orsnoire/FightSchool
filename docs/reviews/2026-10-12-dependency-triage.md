# C02 dependency triage — October 12, 2026

Status: draft PR #56; local verification passed; final CI/browser checks pending. No merge or deployment.

## Scope and method

Baseline `af8d389`: npm audit reports 32 package entries (21 high, 9 moderate, 2 low). Updated lockfile reports 12 entries (5 high, 7 moderate). Counts include transitive/metavulnerability entries, not distinct demonstrated exploits. No exploit against the live service was attempted.

Updated in groups: editor/math first, then ORM and build dependencies. No forced audit fix, blanket dependency upgrade, framework migration, schema regeneration or production data access. Direct upgraded versions are exact; transitives are locked.

## Advisory disposition

| Package | Baseline versions | Updated versions | Disposition |
| --- | --- | --- | --- |
| `@babel/core` | 7.28.4 | 7.29.7 | No longer reported in current audit |
| `@esbuild-kit/core-utils` | 3.3.2 | 3.3.2 | Retained; build/CLI-only chain, see below |
| `@esbuild-kit/esm-loader` | 2.6.5 | 2.6.5 | Retained; build/CLI-only chain, see below |
| `@tailwindcss/typography` | 0.5.15 | 0.5.15 | Retained; build/CLI-only chain, see below |
| `@tiptap/core` | 3.7.2 | 3.31.4 | No longer reported in current audit |
| `brace-expansion` | 2.0.1 | 2.1.7 | No longer reported in current audit |
| `braces` | 3.0.3 | 3.0.3 | Retained; build/CLI-only chain, see below |
| `browserslist` | 4.24.2 | 4.29.3 | No longer reported in current audit |
| `chokidar` | 3.6.0 | 3.6.0 | Retained; build/CLI-only chain, see below |
| `drizzle-kit` | 0.31.4 | 0.31.11 | Retained; build/CLI-only chain, see below |
| `drizzle-orm` | 0.39.1 | 0.45.4 | No longer reported in current audit |
| `esbuild` | 0.18.20, 0.21.5, 0.25.9 | 0.18.20, 0.25.9, 0.28.2 | Retained; build/CLI-only chain, see below |
| `fast-glob` | 3.3.2 | 3.3.2 | Retained; build/CLI-only chain, see below |
| `glob` | 10.4.5 | 10.5.0 | No longer reported in current audit |
| `katex` | 0.16.25 | 0.19.0 | No longer reported in current audit |
| `linkify-it` | 5.0.0 | — | No longer reported in current audit |
| `lodash` | 4.17.21 | 4.18.1 | No longer reported in current audit |
| `markdown-it` | 14.1.0 | — | No longer reported in current audit |
| `mathlive` | 0.107.1 | 0.111.1 | No longer reported in current audit |
| `micromatch` | 4.0.8 | 4.0.8 | Retained; build/CLI-only chain, see below |
| `minimatch` | 9.0.5 | 9.0.9 | No longer reported in current audit |
| `nanoid` | 3.3.8 | 3.3.20 | No longer reported in current audit |
| `picomatch` | 2.3.1 | 2.3.2, 4.0.7 | No longer reported in current audit |
| `postcss` | 8.4.47 | 8.5.29 | No longer reported in current audit |
| `postcss-nested` | 6.2.0 | 6.2.0 | Retained; build/CLI-only chain, see below |
| `postcss-selector-parser` | 6.0.10, 6.1.2 | 6.0.10, 6.1.4 | Retained; build/CLI-only chain, see below |
| `prosemirror-view` | 1.41.3 | 1.42.6 | No longer reported in current audit |
| `rollup` | 4.24.4 | 4.64.5 | No longer reported in current audit |
| `source-map-js` | 1.2.1 | 1.2.2 | No longer reported in current audit |
| `tailwindcss` | 3.4.17, 4.1.3 | 3.4.17, 4.1.3 | Retained; build/CLI-only chain, see below |
| `vite` | 5.4.20 | 6.4.4 | No longer reported in current audit |
| `ws` | 8.18.0 | 8.22.0 | No longer reported in current audit |
| `yaml` | 2.6.0 | 2.9.1 | No longer reported in current audit |

## Exposure and retained findings

- Browser editor: Tiptap attributes/Markdown, ProseMirror paste, MathLive HTML/MathML and KaTeX rendering process authored or entered content. Upgrade these even where a particular vulnerable API is not currently invoked. Tiptap 3.31.4 resolves ProseMirror view 1.42.6; MathLive 0.111.1 and KaTeX 0.19.0. Preserve sanitization and trust=false. Disable StarterKit’s duplicate underline registration while keeping the existing standalone extension.
- ORM: Drizzle 0.45.4 fixes SQL identifier escaping. Repository search found no application `sql.identifier` or `sql.raw` calls; current query values use parameters/static schema names. This reduces observed exposure, not a reason to keep the vulnerable version. Added an embedded-quote identifier regression. Drizzle Kit 0.31.11 remains compatible with current config; C03 still owns broken generation metadata.
- Runtime/transitive dependencies: compatible updates remove the reported lodash and ws entries. No application API changes.
- Vite 6.4.4 stays within plugin-react 4.7’s supported range and supports the CI Node 22 runtime. Build/source-map/glob helper patches are lockfile updates within their declared ranges.
- Retained braces (GHSA-vfj7-8cjw-p6xm): affects Tailwind 3 → chokidar/fast-glob/micromatch. No patched braces release is advertised by this audit; suggested top-level fix is Tailwind 4, a CSS framework migration. These tools process repository-controlled build patterns; they are not Worker request handlers. Do not accept arbitrary build configuration/globs from users. Defer the framework migration to a separately reviewed change.
- Retained selector-parser (GHSA-rj75-hqrm-r3gf): Tailwind 3/postcss-nested/typography constrain older majors; compatible refresh still leaves vulnerable versions. Processes repository CSS selectors, not live submitted answers. Audit suggests an old typography downgrade; do not apply it or force a cross-major override without compatibility review.
- Retained esbuild (GHSA-67mh-4wv8-2f99): Drizzle Kit → deprecated esbuild-kit loader → esbuild 0.18.20. Vulnerable development-server API is not used by this loader/config. The primary bundler is patched. Do not expose the nested esbuild development server. Audit suggests Drizzle Kit 0.18.1 downgrade; reject that incompatible downgrade. Revisit when upstream replaces its loader.

`npm audit --omit=dev` still reports 7 entries because tailwindcss-animate is declared as a production dependency and pulls Tailwind through a peer requirement. This classification does not establish shipped runtime exposure: Tailwind and its plugins are imported by build config, not application/Worker source. Do not report a zero production audit.

These are scoped deferrals, not claims that the full dependency audit is clean. Build-only dependencies can still pose developer/CI risk if untrusted source or configuration is executed.

## Verification

- Baseline: npm ci, TypeScript and all 208 tests passed.
- Editor checkpoint: TypeScript and 7 rich-content tests passed (existing HTML/SVG/math sanitization plus real paste/undo/redo and MathLive hostile text serialization).
- Updated TypeScript, all 211 tests (5 + 7 + 192 + 7), and client/Worker production builds pass. Final exact-head CI/browser evidence pending.
- Full suite applies all 15 shipped migrations in disposable PGlite and checks preserved student data, auth/session boundaries, rewards and SQL paths. No shipped SQL history changed; schema generation reconciliation remains C03.
- Local Chromium install failed: upstream download returned invalid/truncated ZIPs. Browser checks run in the existing GitHub acceptance workflow. Added package manifest/lockfile path triggers so future dependency-only changes cannot skip it.
- Existing large client bundle warning belongs to C07.

## Advisory references

- [@babel/core: Arbitrary File Read via sourceMappingURL Comment](https://github.com/advisories/GHSA-4x5r-pxfx-6jf8)
- [Tiptap: mergeAttributes() turns an own __proto__ key into inherited executable DOM attributes](https://github.com/advisories/GHSA-cp6q-959q-f8rh)
- [Tiptap: Quadratic ReDoS in block and inline Markdown attribute parsing](https://github.com/advisories/GHSA-j95f-988m-3j2f)
- [brace-expansion Regular Expression Denial of Service vulnerability](https://github.com/advisories/GHSA-v6h2-p8h4-qcjw)
- [brace-expansion: Zero-step sequence causes process hang and memory exhaustion](https://github.com/advisories/GHSA-f886-m6hf-6m8v)
- [brace-expansion: DoS via exponential-time expansion of consecutive non-expanding {} groups](https://github.com/advisories/GHSA-3jxr-9vmj-r5cp)
- [brace-expansion: DoS via unbounded expansion length causing an out-of-memory process crash](https://github.com/advisories/GHSA-mh99-v99m-4gvg)
- [brace-expansion: DoS via unbounded intermediate arrays, bypassing the CVE-2026-14257 mitigation](https://github.com/advisories/GHSA-rgw5-rvv9-x895)
- [brace-expansion: Quadratic-time expansion of the `{a},b}` rewrite causes CPU denial of service](https://github.com/advisories/GHSA-q2hr-2g5m-vwhr)
- [brace-expansion: DoS via uncontrolled recursion on nested brace groups causing stack exhaustion](https://github.com/advisories/GHSA-qhr7-859c-m2p7)
- [brace-expansion: DoS via uncontrolled recursion in parseCommaParts causing stack exhaustion](https://github.com/advisories/GHSA-6j4f-fj2g-mc7p)
- [braces vulnerable to stack-exhaustion denial of service through deeply nested patterns](https://github.com/advisories/GHSA-vfj7-8cjw-p6xm)
- [Browserslist: Unbounded memory growth (no cache eviction) via distinct query results, leading to eventual OOM](https://github.com/advisories/GHSA-c83g-rgw3-j3cx)
- [Browserslist: Uncaught crash / prototype write via untrusted browserslist-stats.json custom stats (normalizeStats)](https://github.com/advisories/GHSA-73wf-gq98-2v4g)
- [Drizzle ORM has SQL injection via improperly escaped SQL identifiers](https://github.com/advisories/GHSA-gpj5-g38j-94v9)
- [esbuild enables any website to send any requests to the development server and read the response](https://github.com/advisories/GHSA-67mh-4wv8-2f99)
- [glob CLI: Command injection via -c/--cmd executes matches with shell:true](https://github.com/advisories/GHSA-5j98-mcp5-4vw2)
- [KaTeX: Existing prototype pollution can bypass trust restrictions](https://github.com/advisories/GHSA-238p-pmpm-9mq7)
- [LinkifyIt#match scan loop has quadratic algorithmic complexity](https://github.com/advisories/GHSA-22p9-wv53-3rq4)
- [linkify-it: Quadratic-complexity DoS via the `mailto:` validator scan-loop on attacker text](https://github.com/advisories/GHSA-v245-v573-v5vm)
- [lodash vulnerable to Code Injection via `_.template` imports key names](https://github.com/advisories/GHSA-r5fr-rjxr-66jc)
- [lodash vulnerable to Prototype Pollution via array path bypass in `_.unset` and `_.omit`](https://github.com/advisories/GHSA-f23m-r3pf-42rh)
- [Lodash has Prototype Pollution Vulnerability in `_.unset` and `_.omit` functions](https://github.com/advisories/GHSA-xxjr-mmjv-4gpg)
- [markdown-it is has a Regular Expression Denial of Service (ReDoS)](https://github.com/advisories/GHSA-38c4-r59v-3vqw)
- [markdown-it: Quadratic complexity DoS in smartquotes rule via replaceAt string operations](https://github.com/advisories/GHSA-6v5v-wf23-fmfq)
- [markdown-it linkify: true has two quadratic paths, so a few hundred KB of markdown blocks the event loop for tens of seconds](https://github.com/advisories/GHSA-253c-mchw-3w2r)
- [mathlive's Lack of Escaping of HTML allows for XSS](https://github.com/advisories/GHSA-fm7p-gw32-828p)
- [minimatch has a ReDoS via repeated wildcards with non-matching literal in pattern](https://github.com/advisories/GHSA-3ppc-4f35-3m26)
- [minimatch has ReDoS: matchOne() combinatorial backtracking via multiple non-adjacent GLOBSTAR segments](https://github.com/advisories/GHSA-7r86-cg39-jmmj)
- [minimatch ReDoS: nested *() extglobs generate catastrophically backtracking regular expressions](https://github.com/advisories/GHSA-23c5-xmqv-rm74)
- [nanoid: non-secure generators can loop indefinitely with negative size](https://github.com/advisories/GHSA-28wg-ghj8-5hjv)
- [nanoid: custom generators can loop indefinitely when size is zero](https://github.com/advisories/GHSA-2v37-7h3g-55p8)
- [nanoid: Integer Overflow or Wraparound](https://github.com/advisories/GHSA-xwg4-73v4-xw9w)
- [Picomatch: Method Injection in POSIX Character Classes causes incorrect Glob Matching](https://github.com/advisories/GHSA-3v7f-55p6-f55p)
- [Picomatch has a ReDoS vulnerability via extglob quantifiers](https://github.com/advisories/GHSA-c2c7-rcm5-vvqj)
- [PostCSS has XSS via Unescaped </style> in its CSS Stringify Output](https://github.com/advisories/GHSA-qx2v-qp2m-jg93)
- [PostCSS: Arbitrary file read and information disclosure via attacker-controlled sourceMappingURL in CSS comments](https://github.com/advisories/GHSA-6g55-p6wh-862q)
- [PostCSS: incomplete fix of GHSA-6g55-p6wh-862q — attacker-controlled sourceMappingURL reads arbitrary .map files when `from` is unset](https://github.com/advisories/GHSA-fxqj-rqcc-2cmp)
- [PostCSS: Path Traversal in Previous Source Map Auto-Loading (sourceMappingURL) leads to Arbitrary .map File Disclosure](https://github.com/advisories/GHSA-r28c-9q8g-f849)
- [postcss-selector-parser allows denial of service through uncontrolled AST recursion](https://github.com/advisories/GHSA-w9m9-85wc-3x92)
- [PostCSS: Quadratic complexity in flat selector parsing allows CPU exhaustion](https://github.com/advisories/GHSA-rj75-hqrm-r3gf)
- [ProseMirror has a XSS vulnerability in prosemirror-view's paste handling](https://github.com/advisories/GHSA-c8x8-7fp4-3x9w)
- [Rollup 4 has Arbitrary File Write via Path Traversal](https://github.com/advisories/GHSA-mw96-cpmx-2vgc)
- [source-map-js allows event-loop denial of service through indexed source-map section offsets](https://github.com/advisories/GHSA-68fv-2mgg-jv7q)
- [vite allows server.fs.deny bypass via backslash on Windows](https://github.com/advisories/GHSA-93m4-6634-74q7)
- [Vite Vulnerable to Path Traversal in Optimized Deps `.map` Handling](https://github.com/advisories/GHSA-4w7w-66w2-5vf9)
- [launch-editor: NTLMv2 hash disclosure via UNC path handling on Windows](https://github.com/advisories/GHSA-v6wh-96g9-6wx3)
- [vite: `server.fs.deny` bypass on Windows alternate paths](https://github.com/advisories/GHSA-fx2h-pf6j-xcff)
- [ws: Uninitialized memory disclosure](https://github.com/advisories/GHSA-58qx-3vcg-4xpx)
- [ws: Memory exhaustion DoS from tiny fragments and data chunks](https://github.com/advisories/GHSA-96hv-2xvq-fx4p)
- [yaml is vulnerable to Stack Overflow via deeply nested YAML collections](https://github.com/advisories/GHSA-48c2-rrv3-qjmp)
