# Additional QuestAcademy address — October 21, 2026

- Owner authorized adding `https://questacademy.link` to the existing classroom application while retaining `https://questacademy.bookwyrminteractive.studio`.
- Branch: `ops/questacademy-link`, [PR #82](https://github.com/Orsnoire/FightSchool/pull/82). Scope: an additional Custom Domain, exact HTTP/WebSocket origin allowance, deployment smoke check and routing documentation. No gameplay or database changes.
- Prepared: both Custom Domains in Wrangler, new address added to the existing exact origin allowlist, and a third deployment smoke check covering HTTP/WebSocket access. Local configuration/origin checks pass. Not merged or deployed. Cloudflare account and API discovery calls currently return internal errors; no live routing change has been made.
- Next: inspect the new domain's zone/DNS and existing Worker settings when provider access returns, then apply and check both addresses. Do not overwrite conflicting DNS records.
- Campaign implementation remains in [PR #81](https://github.com/Orsnoire/FightSchool/pull/81), with its own preview deployment pending. C12 remains in [PR #75](https://github.com/Orsnoire/FightSchool/pull/75).
