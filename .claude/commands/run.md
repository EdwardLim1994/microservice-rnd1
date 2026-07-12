# `/run` — Full SDLC Orchestrator

Chains all four roles sequentially for a complete release or hotfix cycle.
Pauses at developer action points and resumes on explicit `/run continue`.

---

## Usage

```
/run release [version]               # full release cycle, pauses at PR merges
/run release [version] --checkpoint  # pauses after each role for review
/run hotfix [version]                # full hotfix cycle
/run hotfix [version] --checkpoint   # hotfix with role checkpoints
/run continue                        # resume after a pause
/run status                          # show current position in the run
```

---

## State File

`/run` maintains state between pauses in `.claude/run-state.json`.
This file is written after every completed phase so `/run continue`
knows exactly where to resume.

```json
{
  "mode": "release | hotfix",
  "version": "[version]",
  "checkpoint": false,
  "phase": "pm | qa | dev | devops | done",
  "currentFeature": "[feat-issue-number or null]",
  "completedFeatures": [],
  "pendingFeatures": [],
  "userStoryIssues": [],
  "featureIssues": [],
  "openPRs": [],
  "pauseReason": "[description of what developer needs to do]",
  "startedAt": "[ISO timestamp]",
  "updatedAt": "[ISO timestamp]"
}
```

State file is committed to the release/hotfix branch after every write
so it survives session restarts.

---

## Pause Points

`/run` pauses and waits for `/run continue` at these points:

| Pause | Reason | What developer does |
|---|---|---|
| After each feature PR opened | Developer must review and merge | Review PR, merge, type `/run continue` |
| After all features merged | Developer must instruct US PR | Type `/run continue` to open user story PR |
| After user story PR opened | Developer must review and merge | Check e2e results, merge, type `/run continue` |
| After deployment | Developer UAT sign-off | UAT, then type `/run continue` to mark done |

With `--checkpoint` additional pauses are added:

| Checkpoint | What developer reviews |
|---|---|
| After `/pm` completes | GitHub issues, labels, branches |
| After `/qa` completes | Integration and e2e test cases |
| After each `/dev` feature | Implementation before opening PR |

---

## Orchestration Logic

### `/run release [version]` or `/run hotfix [version]`

```
1. Read CLAUDE.md and this command file
2. Check for .claude/run-state.json
   - If exists and phase != done → ask: "A run is already in progress for [version].
     Type /run continue to resume, or /run reset to start over."
   - If not exists → initialise state file and begin

3. Detect OpenSpec files
   - If .openspec/requirements/[release|hotfix]/[version]/requirements.yaml exists
     → files already committed by bootstrap script → skip /pm Phase 0 entirely
   - If neither → post /blocked:
     "No OpenSpec files found at .openspec/requirements/[release|hotfix]/[version]/.
      Run the bootstrap script generated from the Claude Project alignment chat first:
        bash bootstrap-[version].sh
      Then re-run this command."

4. Execute /pm
   Read .claude/SOP/project-management.md
   Run all /pm phases (skip Phase 0 if already done, skip Phase 2 if files from Phase 0)
   On completion:
     - Update state: phase=qa, userStoryIssues=[list], featureIssues=[list]
     - Commit state file
   If --checkpoint:
     PAUSE → "PM complete. GitHub issues and branches created.
              Review issues at [github issues link] then type /run continue."

5. Execute /qa
   Read .claude/SOP/qa.md
   Run all /qa phases across all feature branches and user story branches
   On completion:
     - Update state: phase=dev, pendingFeatures=[ordered list of feat issue numbers]
     - Commit state file
   If --checkpoint:
     PAUSE → "QA complete. Integration and e2e tests written.
              Review test files then type /run continue."

6. Execute /dev — feature loop
   For each feature in pendingFeatures (in order):

     a. Read .claude/SOP/development.md
     b. Implement feature on feat/[number]-[title] branch
     c. Pass all quality gates (integration tests, SonarQube, self-review)
     d. Write docs pages
     e. Open feature PR

     If --checkpoint:
       PAUSE → "Feature [FEAT-n] implemented. Review implementation on feat/[number]-[title]
                before PR is opened. Type /run continue to open the PR."
       On /run continue → open the PR

     f. Update state: currentFeature=[number], openPRs=[...+pr-number]
     g. Commit state file

     PAUSE → "Feature PR #[pr-number] is open for [FEAT-n] [title].
              Quality gates: Integration tests ✅ | SonarQube ✅ | Self-review ✅
              Please review and merge feat/[number]-[title] → us/[number]-[title]
              then type /run continue."

     Wait for /run continue

     h. Verify PR is merged (gh pr view [pr-number] --json state)
        If not merged → "PR #[pr-number] does not appear to be merged yet.
                         Please merge it and type /run continue."
        If merged → update state: completedFeatures=[...+number], currentFeature=null

   Repeat for each feature

7. All features merged — user story PR pause
   Update state: phase=us-pr
   Commit state file

   PAUSE → "All [n] feature PRs merged into us/[number]-[title].
            e2e tests are ready in ./e2e/ and will trigger on PR creation.
            Type /run continue to open the user story PR."

   Wait for /run continue

8. Open user story PR
   Read .claude/SOP/development.md Phase 6
   Open PR: us/[number]-[title] → release/[version]
   GitHub Actions e2e workflow triggers automatically

   Update state: phase=e2e-review
   Commit state file

   PAUSE → "User story PR #[pr-number] is open.
            e2e tests are running — check GitHub Actions for results.
            Once e2e passes, please review and merge us/[number]-[title] → release/[version]
            then type /run continue."

   Wait for /run continue

9. Verify user story PR is merged
   If not merged → "PR #[pr-number] does not appear to be merged yet."
   If merged → update state: phase=devops

10. Execute /devops
    Read .claude/SOP/devops.md
    Run Scenario B (deployment): rover compose → terraform → helm → health check

    Update state: phase=uat
    Commit state file

    PAUSE → "Deployment complete. Infrastructure is ready for UAT.
             Please sign off UAT then type /run continue to mark this release as done."

    Wait for /run continue

11. Mark done
    Update state: phase=done
    Commit state file

    Print run summary:
    "Release [version] complete.
     User stories: [n]
     Features: [n]
     PRs merged: [list]
     Deployed to: [environment]
     Duration: [time from startedAt to now]
     Remember to merge release/[version] into main and tag the release."
```

---

### `/run continue`

```
1. Read .claude/run-state.json
2. If file does not exist → "No run in progress. Start with /run release [version]."
3. If phase = done → "This run is already complete."
4. Resume from current phase and step using state file context
5. Read the SOP for the current phase before resuming
```

---

### `/run status`

```
1. Read .claude/run-state.json
2. If file does not exist → "No run in progress."
3. Print:
   "Run status for [mode] [version]
    Current phase: [phase]
    Completed features: [n]/[total]
    Open PRs: [list]
    Paused at: [pauseReason]
    Last updated: [updatedAt]"
```

---

### `/run reset`

```
1. Warn: "This will reset the run state for [version]. Any completed work
          (issues, branches, PRs) will remain in GitHub but the run tracker
          will be cleared. Type /run reset confirm to proceed."
2. On confirm → delete .claude/run-state.json, commit deletion
3. "Run state cleared. Start again with /run release [version]."
```

---

## Error Handling

If any role hits a `/blocked` condition during a `/run` session:

```
1. Write current state to run-state.json with pauseReason = blocked condition details
2. Commit state file
3. Print:
   "/run paused — blocked condition encountered
    Role: [role]
    Issue: [description]
    Waiting for: [what is needed]
    Once resolved, type /run continue to resume from this point."
```

`/run` never skips a blocked condition or moves to the next step automatically.

---

## Hotfix Differences

`/run hotfix [version]` follows the same orchestration but:
- Reads from `.openspec/requirements/hotfix/[version]/`
- Branches are `hotfix/[version]-[desc]` and `bugfix/[number]-[desc]`
- Feature loop iterates over bugfix branches instead of feat branches
- Final PR is hotfix → main instead of us → release
- Final pause includes version bump reminder:
  ```
  Hotfix PR #[pr-number] is open.
  e2e tests running — check GitHub Actions.
  When ready to merge: remember to bump version [X.Y.Z] → [version] manually on merge.
  Type /run continue after merging to proceed to deployment.
  ```

---

## Stopping Conditions

`/run` stops and posts `/blocked` if:
- OpenSpec files are missing and none are attached
- Any role SOP stopping condition is hit
- A quality gate fails after 3 fix cycles
- A PR that should be merged is still open when `/run continue` is called
- `run-state.json` is corrupted or unreadable
- Rover supergraph compose fails