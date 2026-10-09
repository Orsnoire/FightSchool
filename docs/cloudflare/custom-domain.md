# QuestAcademy custom domain

> **CURRENT OPERATING REFERENCE — domain active.** October 9 status reconciliation:
> canonical-domain deployment and acceptance are verified in [current status](../CURRENT_STATUS.md).
> Broader recovery/rollback signoff remains open in [cleanup C12](../CLEANUP_PLAN.md).

The canonical browser address is https://questacademy.bookwyrminteractive.studio.
The existing questacademy-staging Worker serves this domain at its root, retaining
its current database, sessions, Durable Object namespace, and workers.dev address.
The application is deployed; domain access alone does not complete the remaining
infrastructure recovery/rollback acceptance.

Wrangler declares a Custom Domain and manages its DNS record and certificate.
PUBLIC_ORIGIN is the canonical domain. ADDITIONAL_PUBLIC_ORIGINS explicitly retains
the staging origin for existing acceptance checks. HTTP mutations and WebSocket
upgrades share this exact allowlist; arbitrary origins remain forbidden.

## Apply

Run Deploy Cloudflare Staging on the reviewed commit and approve its existing
cloudflare-staging environment gate if requested. The Cloudflare API token must
also be permitted to manage custom domains in the bookwyrminteractive.studio zone,
which must be active in the same account as the Worker. A conflicting DNS record
must be reviewed rather than automatically overwritten. The current deployment
workflow applies committed additive database migrations before publishing the Worker.

The workflow checks both domain names after deployment. Verify teacher login,
student login and a live classroom fight on the canonical domain before use.
Existing cookies are hostname-specific; users may need to sign in again.

## Rollback

Redeploy the previous code if necessary. Before detaching a hostname, inspect its
current Cloudflare binding. Do not delete the database or Durable Object namespace.

This document supersedes the Phase 2 instruction to leave the custom domain
unattached for this explicitly authorized domain-access change.
