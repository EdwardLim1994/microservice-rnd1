# Accessibility Implementation

## Purpose
Implements WCAG 2.1 AA accessibility requirements from the UI/UX Designer's `accessibility-requirements` skill output.

## Role
Frontend Developer

## Phase
Development

## Triggered By
Any component or page development.

## Inputs
- `accessibility-requirements` AC items on the story card

Source: UI/UX `accessibility-requirements` AC items on the story card. These are non-optional — must be implemented.

## Process

### WCAG 2.1 AA Checklist (apply to all components)
- [ ] All images have alt text
- [ ] Heading hierarchy is correct (h1 → h2 → h3, not skipped)
- [ ] Color contrast: 4.5:1 for normal text, 3:1 for large text
- [ ] All interactive elements keyboard accessible (Tab, Enter, Space, Arrow keys)
- [ ] Focus visible on all interactive elements
- [ ] Form labels associated with inputs (`htmlFor` + `id`)
- [ ] Error messages associated with form fields (`aria-describedby`)
- [ ] Dynamic content updates announced (`aria-live` where needed)

HeroUI components: verify each HeroUI component used meets WCAG 2.1 AA. Some HeroUI components may need additional aria attributes — add them.

## Outputs
Implemented components meeting WCAG 2.1 AA.

## Quality Gates
- [ ] All accessibility AC items from UI/UX verified
- [ ] Keyboard navigation tested manually
- [ ] Color contrast verified (use contrast checker)
- [ ] Focus visible on all interactive elements

## References
- `.claude/skills/ui-ux-designer/accessibility-requirements/SKILL.md`
- `.claude/skills/frontend-developer/component-development/SKILL.md`
