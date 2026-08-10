# Sprint Retrospective Report
# Release: v{X}.{Y}.{Z}
# Sprint Goal: {goal from milestone}
# Period: {start date} → {end date}
# Generated: {timestamp}
# Status: COMPLETED | COMPLETED_WITH_INCIDENT | ROLLED_BACK

---

## 1. Sprint Summary

| Metric | This Sprint | Previous Sprint | Trend |
|--------|-------------|-----------------|-------|
| Stories committed | N | N | →↑↓ |
| Stories delivered | N | N | →↑↓ |
| Velocity (story points) | N | N | →↑↓ |
| Must Ship delivered | N/N | N/N | →↑↓ |
| Should Ship delivered | N/N | N/N | →↑↓ |
| Can Hold deferred | N | N | →↑↓ |
| Sprint goal achieved | Yes/Partial/No | Yes/Partial/No | → |

---

## 2. Quality Metrics

| Metric | This Sprint | Previous Sprint | Trend |
|--------|-------------|-----------------|-------|
| SonarQube coverage | N% | N% | →↑↓ |
| New bugs introduced | N | N | →↑↓ |
| New code smells | N | N | →↑↓ |
| Security hotspots | N | N | →↑↓ |
| PR blocks by Tech Lead | N | N | →↑↓ |
| Convention violations | N | N | →↑↓ |
| Tech debt cards created | N | N | →↑↓ |
| Tech debt cards resolved | N | N | →↑↓ |

---

## 3. UAT Metrics

| Metric | This Sprint | Previous Sprint | Trend |
|--------|-------------|-----------------|-------|
| Stories UAT tested | N | N | → |
| UAT acceptance pass rate | N% | N% | →↑↓ |
| Bugs found in UAT | N | N | →↑↓ |
| Critical/High bugs | N | N | →↑↓ |
| Low bugs | N | N | →↑↓ |
| Average UAT cycles/story | N | N | →↑↓ |
| Regression pass rate | N% | N% | →↑↓ |

---

## 4. Performance Metrics (Staging)

| Endpoint Type | p50 | p95 | p99 | SLA | Status |
|---------------|-----|-----|-----|-----|--------|
| GraphQL query | Xms | Xms | Xms | 500ms | ✅❌ |
| GraphQL mutation | Xms | Xms | Xms | 1000ms | ✅❌ |
| gRPC call | Xms | Xms | Xms | 200ms | ✅❌ |
| Kafka consumer | Xms | Xms | Xms | 100ms | ✅❌ |

| Metric | This Sprint | Previous Sprint | Trend |
|--------|-------------|-----------------|-------|
| Breaking point (users) | N | N | →↑↓ |
| Primary resource ceiling | CPU/Memory/DB/Kafka | - | → |
| Estimated cost at load | $X/month | $X/month | →↑↓ |

---

## 5. Security Metrics

| Metric | This Sprint | Previous Sprint | Trend |
|--------|-------------|-----------------|-------|
| CVEs found | N | N | →↑↓ |
| CVEs resolved | N | N | →↑↓ |
| CVEs outstanding | N | N | →↑↓ |
| Secrets scan findings | N | N | →↑↓ |
| ZAP baseline findings | N crit, N high, N low | - | →↑↓ |
| ZAP full scan findings | N crit, N high, N low | - | →↑↓ |
| Pentest findings | N crit, N high, N low | - | →↑↓ |
| Compliance requirements | N met / N total | N met / N total | →↑↓ |

---

## 6. Release Metrics

| Metric | This Sprint | Previous Sprint | Trend |
|--------|-------------|-----------------|-------|
| RC cycles needed | N | N | →↑↓ |
| Hotfixes this sprint | N | N | →↑↓ |
| Deployment duration | N min | N min | →↑↓ |
| Rollbacks | N | N | →↑↓ |
| Changelog completeness | N/N stories | N/N stories | →↑↓ |

---

## 7. Incident Report
<!-- Only present if Status = COMPLETED_WITH_INCIDENT or ROLLED_BACK -->
<!-- Delete this section if no incident occurred -->

### What Failed
{specific description of what went wrong in production}

### Root Cause
{identified root cause — specific, not generic}

### Contributing Factors
{what allowed this to slip through all gates}

### Gate That Should Have Caught It
{which specific test, scan, or review process}

### Prevention Actions
{specific changes — each has an owner, an action, and a measure of success}

---

## 8. Pattern Analysis

### What Went Well
{data-backed observations — always reference specific metrics}
Example: "UAT acceptance pass rate improved from 72% to 91% — suggesting
AC quality improvements from v0.1.0 retro are taking effect."

### Pain Points
{data-backed observations — always reference specific metrics}
Example: "Average UAT cycles per story increased from 1.2 to 1.8 — stories
are reaching UAT with more issues than previous sprint."

### Root Causes Identified
{for each pain point: specific system or process cause, not people}

---

## 9. Improvement Actions

| # | Problem | Root Cause | Action | Owner | Measure | Priority | Type |
|---|---------|------------|--------|-------|---------|----------|------|
| 1 | {specific problem} | {system cause} | {specific action} | {role} | {measurable outcome} | Must/Should/Can | SKILL/CONVENTION/PIPELINE/PROCESS |

Action types:
  SKILL: update a .claude/skills/ file
  CONVENTION: update CLAUDE.md
  PIPELINE: update CI/CD configuration
  PROCESS: update a command or stage sequence

---

## 10. Next Sprint Preview

| Item | Detail |
|------|--------|
| Improvement actions entering backlog | N items (Must Ship: N, Should: N, Can: N) |
| Carry-over stories | N stories from this sprint |
| High-priority tech debt | N items |
| Next sprint version | v{X}.{Y}.{Z+1} |
| Suggested sprint start | {date} |

---

## Appendix: Linked Artifacts

| Artifact | Location |
|----------|----------|
| Sprint kanban board | .kanban/boards.json (sprint v{X}.{Y}.{Z}) |
| OpenSpec changes | openspec/changes/ (all slugs this sprint) |
| QA metrics detail | openspec/changes/retro-v{X}.{Y}.{Z}/qa.md |
| Security metrics detail | openspec/changes/retro-v{X}.{Y}.{Z}/security.md |
| Performance raw data | openspec/changes/retro-v{X}.{Y}.{Z}/performance.md |
| Incident report | openspec/changes/retro-v{X}.{Y}.{Z}/incident.md |
| Changelog | CHANGELOG.md (v{X}.{Y}.{Z} section) |
| Release notes | apps/docs/src/content/internal/latest/releases/ |
