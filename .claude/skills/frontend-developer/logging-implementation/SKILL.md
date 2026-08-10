# Logging Implementation

## Purpose
Implements structured logging in frontend applications, sending to Loki via the universal log helper.

## Role
Frontend Developer

## Phase
Development

## Triggered By
Any significant event or error in the frontend.

## Inputs
- Code paths being implemented (Apollo errors, navigation, usecases, error boundaries, auth)

## Process

### Log Levels (same as backend)
- `debug`: internal state (dev-only, high volume)
- `info`: significant user actions (page navigate, form submit, auth)
- `warning`: unexpected but handled (retry, fallback UI shown)
- `error`: failures (API errors, render errors, unhandled exceptions)

### Key Areas Requiring Logs
- Apollo Client errors: log error with operation name and variables (sanitised)
- Page navigation: log info (page name, navigation source)
- UseCase execution: log info for significant operations (submit, save, delete)
- Error boundaries: log error with component stack (see `error-boundary-implementation`)
- Auth events: log info (login, logout, token refresh)

NEVER log: user passwords, payment data, PII details.

Universal log helper: implementation TBD when logging architecture finalised. For now: structured console calls with JSON format.

## Outputs
Structured log calls embedded across frontend code.

## Quality Gates
- [ ] All key areas have log calls
- [ ] No PII or sensitive data in log messages
- [ ] Error boundaries log at error level with component context

## References
- `.claude/skills/frontend-developer/error-boundary-implementation/SKILL.md`
- `.claude/skills/backend-developer/logging-implementation/SKILL.md`
