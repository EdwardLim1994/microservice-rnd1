# Release Notes Writing

## Purpose
Writes business-facing release notes in plain language for clients and non-technical stakeholders.

## Role
Release Manager

## Phase
Release

## Triggered By
`changelog-aggregation` complete.

## Inputs
- Aggregated `CHANGELOG.md`
- Delivered user stories (not commits or PR titles)

## Process
1. Base content on delivered user stories, not raw commits/PR titles.
2. Write in plain language — no technical jargon. Audience: clients, non-technical stakeholders.
3. Structure into required sections.
4. Publish.

### Sections
- What's New
- What's Fixed
- Known Limitations
- Upgrade Notes

## Outputs
Published to: `apps/docs/src/content/internal/latest/releases/`

## Quality Gates
- [ ] Written in plain language (no jargon)
- [ ] Based on user stories, not commits
- [ ] All four required sections present
- [ ] Published to correct docs location

## References
- `.claude/skills/release-manager/changelog-aggregation/SKILL.md`
- `.claude/skills/release-manager/release-communication/SKILL.md`
