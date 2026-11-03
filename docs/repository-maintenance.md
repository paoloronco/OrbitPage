# Repository maintenance

This is the maintainer's working backlog for the OSS repository. It is separate
from [installation maintenance](./wiki/administration/maintenance.md) and does not
promise a commit or release every week. Shared product behavior belongs here;
hosted-only changes belong in the managed-service repository.

## Working cadence

- Reserve two sessions of 30–45 minutes per week. Select one bounded task per
  session according to evidence, urgency and the available time.
- Review the latest [weekly checks](./wiki/development/github-automation.md#weekly-maintenance-checks)
  and existing reports before changing code. Deduplicate findings and verify
  them against current `main`.
- Fix urgent security and data-loss problems immediately. Follow [SECURITY.md](../SECURITY.md)
  for private vulnerability reporting; do not copy sensitive findings into this
  public backlog or public issues.
- If a review finds nothing actionable, make no change. Never split a complete
  fix from its tests, delay a ready fix to fill a later date, refresh timestamps
  alone or change formatting just to produce activity.
- Weekly checks only produce Actions results and a run summary. Implementing,
  reviewing, committing, pushing and releasing fixes are separate maintainer
  actions. There is no automatic backlog writer or code-fixing agent.

## Acceptance criteria for a maintenance commit

1. Identify the problem and its source: a reproducible report, failed check,
   inaccurate instruction, meaningful coverage gap or demonstrated duplication.
2. Describe the benefit to users, contributors or maintainers. Confirm that the
   existing implementation or tests do not already address it.
3. Keep one coherent change, including its regression test and documentation
   when applicable. Preserve data, routes, schemas and compatibility.
4. Run the relevant [checks](../CONTRIBUTING.md#checks); record their exact results
   and any unverified environment. Do not weaken a check to make a change pass.
5. Use a specific `type(scope): description` subject. Explain the evidence and
   verification in the body when they are not obvious from the diff.
6. Apply the existing [release rules](../CONTRIBUTING.md#release-notes): runtime,
   schema, installer and deployment changes require green main CI and a patch
   release; documentation-only and test-only changes do not require a release.

Performance claims need a reproducible before/after measurement. A dependency
update needs a compatibility, advisory or maintenance reason; a newer version
alone does not make an upgrade urgent.

## Four-week pilot: 9 November–6 December 2026

Owner: repository maintainer. All items below are **open** review tasks, not
confirmed bugs. Reorder them when real findings deserve priority. Each review
may close with evidence that no change is needed. If a candidate exceeds one
session, document its scope and schedule the complete change separately.

### Week 1: 9–15 November — establish the baseline

- [ ] **M01 — Review the first weekly run.** Inspect audit results, all three
  browser engines, both Docker architectures and Node 22/24/26 outcomes. Classify
  failures as product, compatibility, test or provider/runner problems. Done:
  retain the run URL, tested SHA and actionable findings; do not change package
  versions or thresholds merely to obtain a green run.
- [ ] **M02 — Verify the source quick start in a clean environment.** Follow
  [Run from source](../README.md#run-from-source) and
  [Development workflow](./wiki/development/Development.md) with temporary data.
  Check initial setup, `/health`, public page and restart persistence. Done:
  record the environment and outcomes; correct only reproduced discrepancies.

### Week 2: 16–22 November — strengthen regression evidence

- [ ] **M03 — Review newsletter failure and refresh coverage.** Start with
  `app/e2e/newsletter-subscribers.spec.ts`, which already covers combined filters,
  sorting, cancellation, last-page removal, phone layout and Italian labels.
  Check whether a failed deletion or a refresh during filtering leaves a usable,
  accurate list. Done: identify a meaningful missing scenario, add a focused test
  if justified and fix a reproduced bug together with that test.
- [ ] **M04 — Check keyboard behavior of one recently changed dialog.** Reuse
  `app/src/lib/use-dialog-accessibility.test.ts` and the owning browser suite.
  Verify Tab/Shift+Tab, Escape, focus restoration and error feedback at phone and
  desktop widths. Done: record the selected dialog and observed outcomes; add
  coverage or a fix only for an identified gap.

### Week 3: 23–29 November — protect recovery and error paths

- [ ] **M05 — Check one backup compatibility edge case.** Review
  `app/src/lib/portable-backup.test.ts` and
  `app/server/services/backup-service.test.js` against a synthetic older export
  or a missing-media fixture. Never use a real database or customer export.
  Done: document the selected case and expected rollback/restore behavior;
  extend coverage only when it adds a distinct guarantee.
- [ ] **M06 — Trace one repeated validation or error-handling path.** Select it
  from a real finding in weeks 1–2; trace callers and existing shared helpers.
  Done: either explain why separate behavior is necessary or make one focused
  extraction with existing contracts and regression coverage intact. File length
  alone is not a reason to refactor.

### Week 4: 30 November–6 December — review sustainability

- [ ] **M07 — Triage dependency and CI findings.** Review new advisories and
  failures across the pilot; distinguish transient infrastructure failures from
  repeatable regressions. Keep runtime and tooling updates scoped and check both
  dependency graphs. Done: document priorities and compatible remedies; do not
  increase timeouts or regenerate lockfiles without an identified cause.
- [ ] **M08 — Review the pilot and choose the next backlog.** Compare useful
  findings resolved, outstanding problems, maintainer time and CI duration.
  Confirm that the schedule actually ran. Done: retain meaningful results and
  follow-up work, adjusting the cadence when necessary. Commit count and daily
  contribution streaks are not success metrics.

## Recording outcomes

Update an item when it gains a substantive result. Include the review date,
tested SHA, run/issue link when available, finding, verification and resulting
commit/release if any. A completed review may say "no change needed" with its
evidence; consolidate such outcomes in the next useful backlog update instead
of creating a commit for each check. Never mark future tasks complete in advance.

Return to [Development](./wiki/development/README.md).
