# Accessibility Implementation

## Purpose
Implements mobile-specific WCAG 2.1 AA accessibility requirements from the UI/UX Designer's `accessibility-requirements` skill output.

## Role
Mobile Developer

## Phase
Development

## Triggered By
Any component or page development.

## Inputs
- `accessibility-requirements` AC items on the story card

Same source as frontend: UI/UX `accessibility-requirements` AC items on the story card.

## Process

### Mobile-Specific WCAG 2.1 AA
- Touch targets: minimum 44×44 points (critical for mobile)
- VoiceOver (iOS): `accessibilityLabel`, `accessibilityRole`, `accessibilityHint`
- TalkBack (Android): `contentDescription`, `importantForAccessibility`
- `accessibilityState` for toggles, checkboxes, selections
- Avoid using pressable elements that are smaller than 44pt

## Outputs
Implemented components meeting mobile WCAG 2.1 AA requirements.

## Quality Gates
- [ ] All accessibility AC items from UI/UX verified
- [ ] Touch targets meet 44×44 point minimum
- [ ] VoiceOver and TalkBack attributes present
- [ ] accessibilityState set for interactive controls

## References
- `.claude/skills/ui-ux-designer/accessibility-requirements/SKILL.md`
- `.claude/skills/frontend-developer/accessibility-implementation/SKILL.md`
