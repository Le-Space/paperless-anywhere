// The start of a VM as rows of lights: one row per step, one light per fact.
// A light's state comes from what the start reported and from nothing else:
// no light is lit by a timer, and a light is "app" (checked by the app
// itself) only for what the app computed, signed or verified in this
// session. What the VM or Aleph merely says is "reported". A resumed start
// that finds the VM unlocked has checked no report: "skipped", never "app".
// Pure; StartPanel.svelte draws it, the texts are in evidence-i18n.js.

/** @typedef {'off' | 'run' | 'app' | 'reported' | 'skipped' | 'failed'} LightState */
/** @typedef {{ id: string, state: LightState }} Light */
/** @typedef {{ id: string, state: 'off' | 'run' | 'done' | 'skipped' | 'failed', lights: Light[] }} PanelRow */

const ORDER = ['measure', 'instance', 'network', 'unlock', 'ready'];

/**
 * @param {{
 *   step: string,
 *   libPhase?: string,
 *   unlock?: { already?: boolean, injected?: string[], attestation?: { measurement: string } | null } | null,
 *   status?: any,
 *   restore?: boolean,
 *   finished?: boolean,
 *   failed?: boolean
 * }} s `step` is the lifecycle step under way (measure, instance, network,
 * unlock, ready); `libPhase` the attestation library's phase within `unlock`;
 * `unlock` what the unlock returned; `status` the VM's status page.
 * @returns {PanelRow[]}
 */
export function startPanel({ step, libPhase = '', unlock = null, status = null, restore = false, finished = false, failed = false }) {
	const at = ORDER.indexOf(step);
	const past = (/** @type {string} */ id) => finished || at > ORDER.indexOf(id);
	const now = (/** @type {string} */ id) => !finished && step === id;
	/** A fact that holds once its step is over. @returns {LightState} */
	const after = (/** @type {string} */ id, /** @type {'app' | 'reported'} */ how) => (past(id) ? how : now(id) ? (failed ? 'failed' : 'run') : 'off');

	// The report is verified once the library moves on to the hand-over, or
	// the unlock came back with its measurement.
	const verified = Boolean(unlock?.attestation?.measurement) || (now('unlock') && libPhase === 'unlock');
	const already = Boolean(unlock?.already);
	/** @type {LightState} */
	const attest = verified ? 'app' : already ? 'skipped' : now('unlock') ? (failed ? 'failed' : 'run') : past('unlock') ? 'skipped' : 'off';
	const handing = now('unlock') && verified && !unlock?.injected;
	/** @type {LightState} */
	const handed = unlock?.injected ? 'app' : already ? 'skipped' : handing ? (failed ? 'failed' : 'run') : past('unlock') ? 'skipped' : 'off';
	/** @type {LightState} */
	const stored = unlock?.injected?.length ? 'reported' : already ? 'skipped' : handing ? (failed ? 'failed' : 'run') : 'off';

	const timeline = status?.start?.timeline ?? {};
	const waiting = now('ready') ? (failed ? 'failed' : 'run') : 'off';
	/** What the VM's status page says, else waiting. @returns {LightState} */
	const said = (/** @type {unknown} */ yes, /** @type {unknown} */ no = false) => (no ? 'failed' : yes ? 'reported' : waiting);
	const up = Boolean(status?.paperless && (status?.phase === 'ready' || status?.phase === 'restore-failed'));

	/** @type {[string, Light[]][]} */
	const rows = [
		['measure', [{ id: 'runtime', state: after('measure', 'app') }, { id: 'measurement', state: after('measure', 'app') }]],
		['instance', [{ id: 'signed', state: after('instance', 'app') }, { id: 'notified', state: after('instance', 'reported') }]],
		['network', [{ id: 'port', state: after('network', 'reported') }, { id: 'address', state: after('network', 'reported') }]],
		['attestation', [{ id: 'report', state: attest }, { id: 'binding', state: attest }]],
		['unlock', [{ id: 'handed', state: handed }, { id: 'stored', state: stored }]],
		...(restore ? [/** @type {[string, Light[]]} */ (['restore', [{ id: 'restored', state: said(status?.restore?.status === 'done', status?.restore?.status === 'failed') }]])] : []),
		[
			'ready',
			[
				{ id: 'dataDisk', state: said(status?.dataDisk?.status === 'encrypted', status?.phase === 'data-disk-failed') },
				{ id: 'containers', state: said(timeline.containers) },
				{ id: 'cert', state: said(timeline.cert) },
				{ id: 'paperless', state: said(up || timeline.paperless || finished) }
			]
		]
	];
	return rows.map(([id, lights]) => {
		const states = lights.map((l) => l.state);
		// A row with some facts lit and others still dark is under way, until the start is over.
		const state = states.includes('failed') ? 'failed' : states.includes('run') ? 'run' : states.every((x) => x === 'off') ? 'off' : states.every((x) => x === 'skipped') ? 'skipped' : states.includes('off') && !finished ? 'run' : 'done';
		return { id, state, lights };
	});
}

/** The row under way, for the one line a screen reader hears. @param {PanelRow[]} rows */
export const currentRow = (rows) => rows.find((r) => r.state === 'failed') ?? rows.find((r) => r.state === 'run') ?? null;
