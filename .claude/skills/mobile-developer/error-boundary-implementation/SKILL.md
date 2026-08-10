# Error Boundary Implementation

## Purpose
Implements React Native error boundaries at appropriate levels to handle runtime failures gracefully.

## Role
Mobile Developer

## Phase
Development

## Triggered By
Any new page, module, or complex component created.

## Inputs
- App/module/component structure

## Process
React Native error boundaries — different from web React. Use `react-native-error-boundary` or a custom `ErrorBoundary` class component.

Same levels as frontend: App, Module, Component. Log to Loki via logging helper. Fallback UI must be React Native components (not HTML).

## Outputs
App, module, and component-level error boundaries with React Native fallback UI.

## Quality Gates
- [ ] App-level error boundary wraps the entire app
- [ ] Module-level boundaries on all feature modules
- [ ] Errors logged to Loki
- [ ] Fallback UI uses React Native components (not HTML)

## References
- `.claude/skills/frontend-developer/error-boundary-implementation/SKILL.md`
- `.claude/skills/mobile-developer/logging-implementation/SKILL.md`
