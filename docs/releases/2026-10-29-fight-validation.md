# Fight-authoring validation release — October 29, 2026

[PR #94](https://github.com/Orsnoire/FightSchool/pull/94) is merged and deployed.
Oversized CSV graph questions previously caused Save to fail silently. Imports
now validate the complete question set before adding rows, and Save displays
an actionable question number and limit. Failed imports and saves preserve the
draft. Existing content limits and server authorization remain intact. The
corrected practice CSV retains all 60 questions and both graphs.

All 412 application tests, deployment checks, TypeScript and builds pass in
[PR CI](https://github.com/Orsnoire/FightSchool/actions/runs/40899338745) and
[merged-main CI](https://github.com/Orsnoire/FightSchool/actions/runs/40900934066).
All four [browser jobs](https://github.com/Orsnoire/FightSchool/actions/runs/40899338631)
pass, including desktop and phone validation recovery. The corrected practice
bank passes the real importer, full schema, authenticated local creation and
rich-content rendering.

The initial [release workflow](https://github.com/Orsnoire/FightSchool/actions/runs/40901926454)
stopped during final verification. Subsequent [read-only verification](https://github.com/Orsnoire/FightSchool/actions/runs/40902850822)
passed with the application unchanged, after which the site reopened.
[Post-release preflight](https://github.com/Orsnoire/FightSchool/actions/runs/40903715905)
passes. No database migration was needed.

[Live acceptance](https://github.com/Orsnoire/FightSchool/actions/runs/40903774311)
is **BLOCKED**. Both attempts created a fight and hosted a room, then timed out
at student join. The retry used unchanged code, fixtures and deadlines. The
subsequent storage/concurrency step was skipped. The cause remains unconfirmed;
no operational acceptance pass is claimed and no further run remains active.

Next: register a separate student-join investigation, resolve the failure and
rerun the unchanged canonical suite. Preserve both failures as evidence. Do not
weaken deadlines or repeatedly rerun to conceal the failure. Concurrent design
work, the campaign owner playtest, preview and C12/PR #75 remain separate.
