# Context Handoff

## Purpose
Clean state transfer between phases so the receiving role starts with everything needed — no hunting for artifacts, no assumptions.

## Role
Shared — outgoing phase lead at every phase transition

## Phase
Cross-phase

## Triggered By
Phase transitions: Planning→Development, Development→UAT, UAT→Staging, Staging→Release, Release→Retrospective.

## Inputs
- Artifacts produced during the outgoing phase
- Decisions and rationale from the outgoing phase

## Process
1. Outgoing lead identifies all artifacts produced this phase.
2. Documents current state of every relevant item.
3. Lists all decisions made and their rationale.
4. Lists all open items the receiving role must address.
5. Lists known issues or risks.
6. Commits handoff document to OpenSpec change folder.
7. Notifies receiving role(s) handoff is ready.
8. Receiving role confirms document read before starting.

## Outputs
Location: `openspec/changes/{slug}/handoff-{from}-{to}.md`

```
# Context Handoff — {Phase} → {Phase}
# Story/Release: KAN-{N} / v{X}.{Y}.{Z}
# Date: {date}
# From: {role} — To: {role(s)}

## What Was Done
## Current State
## Artifacts Location (table: Artifact | Location)
## Decisions Made (table: Decision | Rationale)
## Open Items
## Known Issues
## Next Steps (numbered)
```

## Quality Gates
- [ ] Handoff document committed before phase transition
- [ ] All artifact locations are correct paths
- [ ] Receiving role confirmed document read
- [ ] No phase transition without completed handoff

## References
- `.claude/skills/shared/status-reporting/SKILL.md`
- `.claude/skills/shared/risk-logging/SKILL.md`
