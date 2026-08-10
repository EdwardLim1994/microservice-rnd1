# /handoff {from-phase} {to-phase} KAN-{N}

## Purpose
Context handoff between phases.

Example: `/handoff planning development KAN-5`

## Triggered By
Phase transition for a story/release: Planning→Development, Development→UAT, UAT→Staging, Staging→Release, Release→Retrospective.

## Pre-checks
- Outgoing phase's work for KAN-{N} is complete.

## Steps
1. Invoke `shared/context-handoff`.
2. Outgoing phase lead creates handoff document.
3. Receiving role confirms document read before starting.

## Output
Handoff document at `openspec/changes/{slug}/handoff-{from}-{to}.md`.

## On Failure
If the receiving role has not confirmed the handoff document is read: the phase transition does not proceed.

## References
- `.claude/skills/shared/context-handoff/SKILL.md`
