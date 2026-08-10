# Regression Testing

## Purpose
Runs regression suites at both per-story and combined-sprint levels to catch flow breakage before Staging release.

## Role
QA Engineer

## Phase
UAT (before Staging release)

## Triggered By
Per story: story's regression impact matrix ready. Combined: all sprint stories merged.

## Inputs
- Per-story regression impact matrices (from `test-strategy-definition`)

## Process

### Two Levels
1. Per story: each story's regression impact matrix runs independently.
2. Combined (before staging): all stories merged, deduplicated, tagged.

### Deduplication
If two stories both require auth tests, run once.

### Tagging Format
`@story:KAN-N` on each test for traceability.

### Combined Report
Groups by story:
```
KAN-{N}: X passed, Y failed
KAN-{N}: X passed, Y failed
Shared: X passed, Y failed
```

## Outputs
Combined regression report grouped by story.

## Quality Gates
- [ ] Per-story regression suites run before combination
- [ ] Combined suite deduplicated
- [ ] Tests tagged with @story:KAN-N
- [ ] Combined report grouped by story

## References
- `.claude/skills/qa-engineer/test-strategy-definition/SKILL.md`
- `.claude/skills/qa-engineer/staging-sign-off/SKILL.md`
