# Storybook Component Documentation

## Purpose
Documents every component in Storybook with stories covering all states, variants, and interactions.

## Role
Frontend Developer

## Phase
Development (alongside `component-development`)

## Triggered By
Any new component created — no exceptions.

## Inputs
- Implemented component from `component-development`

## Rule
Every component MUST have a Storybook story before PR can merge. Tech Lead DoD verification includes checking Storybook stories exist.

## Process
Story file: `{Component}.stories.tsx` alongside the component file.

### Required Stories Per Component
- Default: component in its default/empty state
- With Data: component with realistic data
- States: all variants (if component has multiple visual states)
- Interactive: Storybook interactions testing user interactions

### Story Pattern
```typescript
import type { Meta, StoryObj } from '@storybook/react'
import { {Component} } from './{Component}'

const meta: Meta<typeof {Component}> = {
  title: '{Feature}/{Component}',
  component: {Component},
}
export default meta

type Story = StoryObj<typeof {Component}>

export const Default: Story = { args: {} }
export const WithData: Story = { args: { data: mockData } }
export const Interactive: Story = {
  play: async ({ canvasElement }) => {
    // Storybook interaction test
    const canvas = within(canvasElement)
    await userEvent.click(canvas.getByRole('button'))
    await expect(canvas.getByText('submitted')).toBeInTheDocument()
  },
}
```

## Outputs
Story file for every component, passing interaction tests.

## Quality Gates
- [ ] Story file exists alongside every component file
- [ ] Default, WithData, and Interactive stories present
- [ ] Storybook test runner passes all interaction tests

## References
- `.claude/skills/frontend-developer/component-development/SKILL.md`
- `.claude/skills/tech-lead/definition-of-done-enforcement/SKILL.md`
