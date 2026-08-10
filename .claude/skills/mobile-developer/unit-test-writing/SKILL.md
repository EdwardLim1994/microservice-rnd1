# Unit Test Writing

## Purpose
Writes unit tests for hooks and usecases following TDD workflow.

## Role
Mobile Developer

## Phase
Development (write before implementation)

## Triggered By
tdd-workflow equivalent for mobile — task picked up.

## Inputs
- Planned hooks/usecases for the task

## Process
Tools: Vitest + React Native Testing Library (RNTL — different from RTL).
```typescript
import { render, fireEvent } from '@testing-library/react-native'
```

Same TDD approach and coverage target (≥ 80%) as frontend. Mock: platform adapters (use web stubs in tests).

## Outputs
Passing unit test suite for hooks and usecases.

## Quality Gates
- [ ] Tests written before implementation (TDD)
- [ ] Platform adapters mocked with web stubs
- [ ] Error states tested (not just happy path)
- [ ] Coverage ≥ 80% for new hooks and usecases

## References
- `.claude/skills/frontend-developer/unit-test-writing/SKILL.md`
- `.claude/skills/mobile-developer/platform-adapter-implementation/SKILL.md`
