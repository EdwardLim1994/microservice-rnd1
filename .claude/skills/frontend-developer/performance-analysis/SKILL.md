# Performance Analysis

## Purpose
Analyses frontend performance using Lighthouse CLI and the Rsbuild bundle analyzer before PR and in CI.

## Role
Frontend Developer

## Phase
Development (before PR) + CI (automated gate)

## Triggered By
Before raising any PR for production-facing changes.

## Inputs
- Local dev server / build output

## Process

### Lighthouse CLI (runtime metrics)
```bash
npx lighthouse http://localhost:3000 --output=json \
  --output-path=./lighthouse-report.json \
  --chrome-flags="--headless"
```
Agent reads JSON output and identifies issues.

### Rsbuild Bundle Analyzer (build-time metrics)
```bash
bun run build --analyze
```
Agent reads bundle analysis report for: oversized chunks (> 500KB uncompressed = investigate), duplicate dependencies (same package in multiple chunks), missing code splitting (large vendor bundles).

### Performance Budgets (`lighthouserc.json`)
```json
{
  "ci": {
    "assert": {
      "assertions": {
        "categories:performance": ["error", {"minScore": 0.8}],
        "categories:accessibility": ["error", {"minScore": 0.9}],
        "largest-contentful-paint": ["error", {"maxNumericValue": 2500}],
        "cumulative-layout-shift": ["error", {"maxNumericValue": 0.1}],
        "total-blocking-time": ["error", {"maxNumericValue": 300}]
      }
    }
  }
}
```

### Steps
1. Run bundle analysis — identify and fix any chunks > 500KB.
2. Run Lighthouse locally against dev server.
3. If any budget fails: fix before raising PR.
4. CI runs Lighthouse against deployed preview automatically.

## Outputs
Bundle analysis and Lighthouse reports; budget-passing PR.

## Quality Gates
- [ ] Bundle analysis run and large chunks addressed
- [ ] Lighthouse all budgets pass locally
- [ ] lighthouserc.json exists and CI is configured

## References
- `.claude/skills/tech-lead/definition-of-done-enforcement/SKILL.md`
