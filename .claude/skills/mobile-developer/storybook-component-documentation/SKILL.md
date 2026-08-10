# Storybook Component Documentation

## Purpose
Documents every component in Storybook with stories covering all states, variants, and interactions.

## Role
Mobile Developer

## Phase
Development (alongside `component-development`)

## Triggered By
Any new component created — no exceptions.

## Inputs
- Implemented component from `component-development`

## Process
Storybook for React Native — different setup than web Storybook. Same requirement as frontend: every component MUST have a story. Stories work in Expo web mode for development. Same story types: Default, WithData, Interactive.

## Outputs
Story file for every mobile component, passing interaction tests.

## Quality Gates
- [ ] Story file exists alongside every component file
- [ ] Default, WithData, and Interactive stories present
- [ ] Stories verified working in Expo web mode

## References
- `.claude/skills/frontend-developer/storybook-component-documentation/SKILL.md`
- `.claude/skills/mobile-developer/component-development/SKILL.md`
