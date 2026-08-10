# Performance Analysis

## Purpose
Analyses React Native performance using Expo-specific tools.

## Role
Mobile Developer

## Phase
Development (before PR) + CI

## Triggered By
Before raising PR for production-facing changes.

## Inputs
- Local Expo build/dev output

## Process

### Expo Atlas (bundle analysis)
```bash
EXPO_ATLAS=true npx expo export --platform all
npx expo-atlas .expo/atlas.jsonl
```
Agent reads `.expo/atlas.jsonl` JSON output. Look for: oversized chunks, duplicate modules, unused imports.

### EAS Observe CLI (runtime performance)
```bash
eas observe:list         # list available metrics
eas observe:get {metric} # read specific performance metric
```
Agent reads CLI output for: startup times, render performance, JS thread.

### Lighthouse (web mode only)
```bash
npx lighthouse http://localhost:8081 --output=json
```
Only valid for Expo web mode — not native.

## Outputs
Bundle and runtime performance reports.

## Quality Gates
- [ ] Expo Atlas run and large chunks addressed
- [ ] EAS Observe CLI used for runtime metrics
- [ ] Lighthouse run for web mode (if story affects web experience)

## References
- `.claude/skills/frontend-developer/performance-analysis/SKILL.md`
