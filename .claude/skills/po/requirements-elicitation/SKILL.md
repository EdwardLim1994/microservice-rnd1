# Requirements Elicitation

## Purpose
Transforms a vague idea into clear unambiguous requirements before planning begins.

## Role
Product Owner

## Phase
Planning (Stage 1)

## Triggered By
`/start` command or new feature discussion with Edward.

## Inputs
- Edward's feature description
- Retro improvement actions, security findings, or tech debt with user-facing impact (also valid inputs)

Valid inputs are not limited to Edward's ideas:
- Retro improvement actions
- Security findings with user-facing impact
- Tech debt with user-facing impact

NOTE: Bug/hotfix tickets bypass PO entirely — go straight to PM.

## Process
1. Read Edward's feature description carefully.
2. Ask structured clarifying questions (max 7, grouped):
   - WHO: who is the user, what is their goal
   - WHAT: what problem is being solved (not the solution)
   - WHY: business value, priority justification
   - SCOPE: what is explicitly out of scope
   - CONSTRAINTS: technical, time, regulatory
   - DEPENDENCIES: existing services affected
   - SUCCESS: what does done look like
3. Wait for Edward's responses.
4. Summarise understanding as Problem Statement (one paragraph).
5. Confirm with Edward before proceeding.
6. If confirmed → trigger `epic-and-story-writing`.
7. If not confirmed → refine and repeat from step 2.

## Outputs
Confirmed Problem Statement.

## Quality Gates
- [ ] Edward has confirmed Problem Statement is accurate
- [ ] Out of scope items explicitly listed
- [ ] No solution assumptions in Problem Statement
- [ ] All constraints and dependencies documented

## References
- `.claude/skills/po/epic-and-story-writing/SKILL.md`
- `.claude/skills/pm/planning-session-kickoff/SKILL.md`
