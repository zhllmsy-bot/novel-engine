# Human Audit Instructions

This archive is derived from the existing real lost-in-middle suite:

- Source archive: `.novel/evals/four-layer-suite-real-20260703-cleanwt-gpt55-full-r3`
- Calibration archive: `.novel/evals/system-a-lost-in-middle-calibration-queue`
- Review queue: `review-queue.tsv`
- Canonical rows: 54
- Duplicate rows: 6

## What To Fill

Open `review-queue.tsv` in a spreadsheet editor and fill only these columns:

- `human_choice`: use `left`, `right`, or `tie`.
- `human_accepts_judge`: use `yes` if the judge's claim/evidence is acceptable, `no` if it is not.
- `human_notes`: optional short note.

Do not edit these columns:

- `review_item_id`
- `item_kind`
- `canonical_packet_id`
- `duplicate_of`
- `shown_index`
- pair/run/sample metadata columns

Duplicate rows are intentional. Treat every row as fresh; do not search for its canonical counterpart.

## Ground Truth Rule

Do not judge from memory. Use the pinned L0 facts in `l0_needles`, the criteria fields, and the left/right samples in the row.

## After Filling

Run:

```bash
npm run generation:kappa -- \
  --archive-dir .novel/evals/system-a-lost-in-middle-calibration-queue \
  --human-audit .novel/evals/system-a-lost-in-middle-calibration-queue/review-queue.tsv \
  --json
```

The report is trustworthy only when `okToTrustJudge` is `true`.

Expected fail-closed blockers before filling:

- `blankHumanRows = 54`
- `auditBlankAcceptRows = 54`
- `duplicateBlankRows = 6`
- `okToTrustJudge = false`
