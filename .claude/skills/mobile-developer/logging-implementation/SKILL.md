# Logging Implementation

## Purpose
Implements structured logging in the mobile app, sending to Loki via the universal log helper.

## Role
Mobile Developer

## Phase
Development

## Triggered By
Any significant event or error in the mobile app.

## Inputs
- Code paths being implemented

## Process
Identical to frontend `logging-implementation`. Same log levels, same key areas, same "never log PII" rule.

## Outputs
Structured log calls embedded across mobile app code.

## Quality Gates
- [ ] All key areas have log calls
- [ ] No PII or sensitive data in log messages
- [ ] Error boundaries log at error level with component context

## References
- `.claude/skills/frontend-developer/logging-implementation/SKILL.md`
- `.claude/skills/mobile-developer/error-boundary-implementation/SKILL.md`
