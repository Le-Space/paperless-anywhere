// Proof of Data Possession on Filecoin Warm Storage, as the landing page and
// docs/backup-proofs.md explain it. The parameters are the mainnet values of
// the warm storage service (getPDPConfig(), read 2026-11-16; CHALLENGES_PER_PROOF).

export const PDP = Object.freeze({ leafBytes: 32, challenges: 5, periodEpochs: 2880, windowEpochs: 60, epochSeconds: 30 });

/**
 * The chance that a loss of share `f` shows within `periods` proving periods,
 * with `k` challenges each: 1 − (1 − f)^(k·periods).
 * @param {number} f @param {number} periods @param {number} [k]
 */
export const detected = (f, periods, k = PDP.challenges) => 1 - (1 - f) ** (k * periods);

/** The rows of the table: share missing, and the chance within 1, 7 and 30 days. */
export const DETECTION_ROWS = Object.freeze([1, 0.1, 0.01, 0.001].map((f) => ({ f, days: [1, 7, 30].map((d) => detected(f, d)) })));

export const DOCS_URL = 'https://github.com/Le-Space/paperless-anywhere/blob/main/docs/backup-proofs.md';
