# QuestAcademy custom domain

> **OPERATING REFERENCE — original domain active; additional domain pending.** October 21: `questacademy.link` is configured in [PR #82](https://github.com/Orsnoire/FightSchool/pull/82), but is not yet attached or live-verified. The hosting connector is returning internal errors. October 9 status reconciliation:
> canonical-domain deployment and acceptance are verified in [current status](../CURRENT_STATUS.md).
> Broader recovery/rollback signoff remains open in [cleanup C12](../CLEANUP_PLAN.md).

The canonical browser address remains https://questacademy.bookwyrminteractive.studio.
The owner also authorized https://questacademy.link as an additional address for
the same classroom application. Both addresses should serve the app directly;
there is no redirect or separate installation. The `www` hostname is outside this request.
The existing questacademy-staging Worker serves this domain at its root, retaining
its current database, sessions, Durable Object namespace, and workers.dev address.
The application is deployed; domain access alone does not complete the remaining
infrastructure recovery/rollback acceptance.

Wrangler declares a Custom Domain and manages its DNS record and certificate.
PUBLIC_ORIGIN is the canonical domain. ADDITIONAL_PUBLIC_ORIGINS explicitly retains
the staging origin for existing acceptance checks and adds `https://questacademy.link`. HTTP mutations and WebSocket
upgrades share this exact allowlist; arbitrary origins remain forbidden.

## Apply

Run Deploy Cloudflare Staging on the reviewed commit and approve its existing
cloudflare-staging environment gate if requested. The Cloudflare API token must
also be permitted to manage custom domains in both the bookwyrminteractive.studio and questacademy.link zones,
which must be active in the same account as the Worker. Confirm the new zone's
ownership/activation and inspect existing DNS and Worker domain attachments before applying. A conflicting DNS record
must be reviewed rather than automatically overwritten. The current deployment
workflow applies committed additive database migrations before publishing the Worker.

The workflow checks the canonical domain, additional domain and workers.dev
address after deployment, including HTTP origin enforcement and WebSocket access. Verify teacher login,
student login and a live classroom fight on the canonical domain before use.
Existing cookies are hostname-specific; users sign in separately on each address,
using the same accounts and saved progress. Keep the canonical PUBLIC_ORIGIN and
existing domain attachment unchanged when adding the new address.

## Rollback

Redeploy the previous code if necessary. Before detaching a hostname, inspect its
current Cloudflare binding. Do not delete the database or Durable Object namespace.

This document supersedes the Phase 2 instruction to leave the custom domain
unattached for this explicitly authorized domain-access change.
