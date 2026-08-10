# Accessibility Requirements

## Purpose
Specifies WCAG 2.1 AA requirements for the story, including mobile-specific additions when applicable.

## Role
UI/UX Designer

## Phase
Planning (Stage 4)

## Triggered By
`interaction-specification` complete.

## Inputs
- `interaction-specification` output
- Whether story affects mobile app

## Process
1. Derive WCAG 2.1 AA requirements specific to this story.
2. If story affects mobile app, add mobile-specific requirements:
   - Touch targets: minimum 44×44 points
   - VoiceOver (iOS) and TalkBack (Android) support
3. Add requirements as additional AC on the story kanban card, in Given/When/Then format (same as security AC).

These requirements are non-optional — Frontend/Mobile must implement.

## Outputs
Accessibility AC added to the story kanban card.

## Quality Gates
- [ ] WCAG 2.1 AA requirements specified for the story
- [ ] Mobile-specific requirements added when story affects mobile
- [ ] Requirements written in Given/When/Then format
- [ ] Added as AC on the story kanban card

## References
- `.claude/skills/ui-ux-designer/interaction-specification/SKILL.md`
- `.claude/skills/security-engineer/security-story-review/SKILL.md` (AC format precedent)
