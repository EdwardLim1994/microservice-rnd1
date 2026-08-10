# TDD Workflow

## Purpose
Test-Driven Development workflow for all backend implementation — ensures tests are planned before code is written.

## Role
Backend Developer

## Phase
Development

## Triggered By
Developer picks up a task (via `/implement KAN-{N}`).

## Inputs
- OpenSpec `design.md` for the task
- `contracts/` proto/graphql schema
- Generated types in `packages/api/src/generated/`

## Process (STRICT — never skip steps)
1. Read OpenSpec `design.md` for this task.
2. Read `contracts/` for relevant proto/graphql schema.
3. Read generated types in `packages/api/src/generated/` (after `api-type-generation`).
4. Write pseudo code (internal thinking — NOT committed to repo):
   - What classes/functions are needed?
   - What is the happy path?
   - What are the error/edge cases?
   - Which parts are worth unit testing?
5. Generate all classes using generators (see `server-scaffolding`).
6. Write failing unit tests first (for each UseCase + Repository).
7. Implement minimum business logic to make tests pass.
8. Refactor while keeping tests green.
9. Run `component-integration-test-writing` to verify wiring.
10. Raise PR.

Pseudo code is internal — it helps the agent plan before writing. Never commit pseudo code. Use it to identify what to generate and test.

## Outputs
Implemented, tested feature ready for PR.

## Quality Gates
- [ ] OpenSpec design.md read before implementation
- [ ] Generated types confirmed available (Data Engineer api-type-generation done)
- [ ] Tests written before implementation
- [ ] All tests passing before PR raised

## References
- `.claude/skills/backend-developer/server-scaffolding/SKILL.md`
- `.claude/skills/backend-developer/unit-test-writing/SKILL.md`
- `.claude/skills/backend-developer/component-integration-test-writing/SKILL.md`
- `.claude/skills/data-engineer/api-type-generation/SKILL.md`
