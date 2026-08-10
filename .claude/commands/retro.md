# /retro v{X}.{Y}.{Z}

## Purpose
Retrospective session after production deployment is confirmed stable.

## Triggered By
Automatically after `/release-production` completes; or manually by Edward.

## Pre-checks
- Production stable (30-min monitoring passed, no incidents).

## Steps
1. Invoke `/metrics` first (parallel metrics collection from all roles).
2. Run PM `retrospective-facilitation` (6 stages).
3. If `--incident` flag: add Stage 2a incident analysis.

## Output
- Fixed 10-section report: `openspec/changes/retro-v{X}.{Y}.{Z}/retro.md`
- Improvement kanban cards in Backlog
- Sprint milestone closed in kanban
- Signal: "Ready for next /start"

## On Failure
If production is not yet stable (monitoring window still open or an incident is unresolved): block and wait, or run with `--incident` once resolved.

## References
- `.claude/commands/metrics.md`
- `.claude/skills/pm/retrospective-facilitation/SKILL.md`
- `openspec/retro-template.md`
