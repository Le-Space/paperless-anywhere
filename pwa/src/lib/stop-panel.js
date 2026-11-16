// "Sichern und beenden" and "Löschen ohne Sicherung" as rows of lights, like
// the start (start-panel.js): one row per step, one light per fact. A light
// is lit only by what was reported, never by a timer: "app" for what the app
// signed or saved itself, "reported" for what the VM (its status page and
// its backup tool's log lines), the node, Aleph or Le Space's service said.
// The row under way is the first one not yet lit; its dark lights run.
// Pure; StartPanel.svelte draws it, the texts are in evidence-i18n.js
// (panelTexts.*.stop).

/** @typedef {import('./start-panel.js').LightState} LightState */
/** @typedef {{ id: string, state: LightState, key?: string, args?: (string | number)[], say?: string }} StopLight `key`: the text's key when it is not `id`; `args`: what the text names; `say`: the state's words when not those of `state` */
/** @typedef {{ id: string, state: 'off' | 'run' | 'done' | 'skipped' | 'failed', lights: StopLight[] }} StopRow */

/**
 * What the backup tool's log lines say (paperless-backup-filecoin's
 * backup.mjs, as paperless-backup passes them to the status page: the last
 * three every five seconds, so some may be missed). Only these lines count.
 * @param {string[]} lines
 */
export function backupFacts(lines) {
	/** @type {{ exporting: boolean, files: number | null, bytes: number | null, providers: number[], primary: number | null, parts: number | null, part: number | null, refused: number[], pieceCid: string | null, copies: number | null, requested: number | null }} */
	const f = { exporting: false, files: null, bytes: null, providers: [], primary: null, parts: null, part: null, refused: [], pieceCid: null, copies: null, requested: null };
	for (const raw of lines) {
		const l = String(raw).replace(/^\S+Z /, '');
		let m;
		if (/^exporting Paperless/.test(l)) f.exporting = true;
		else if ((m = /^export: (\d+) files/.exec(l))) f.files = Number(m[1]);
		else if ((m = /^uploading (\d+) bytes to providers ([\d, ]+) \(primary (\d+)\)/.exec(l))) {
			f.bytes = Number(m[1]);
			f.providers = m[2].split(',').map((x) => Number(x.trim())).filter((x) => x > 0);
			f.primary = Number(m[3]);
		} else if ((m = /^part (\d+)\/(\d+): \d+ bytes to provider/.exec(l))) {
			f.part = Number(m[1]);
			f.parts = Number(m[2]);
		} else if ((m = /^upload with primary (\d+) failed/.exec(l))) f.refused = [...new Set([...f.refused, Number(m[1])])];
		else if ((m = /^(?:piece|(\d+) parts, first piece) (\S+): (\d+)\/(\d+) copies/.exec(l))) {
			if (m[1]) f.parts = Number(m[1]);
			f.pieceCid = m[2];
			f.copies = Number(m[3]);
			f.requested = Number(m[4]);
		}
	}
	return f;
}

/**
 * @param {{
 *   kind: 'stop' | 'discard',
 *   sent?: boolean,
 *   status?: any,
 *   lines?: string[],
 *   erase?: { node?: string | null, forgot?: string | null, revoke?: string | null } | null,
 *   listed?: boolean | null,
 *   header?: 'checking' | 'opens' | 'refused' | 'unreachable' | null,
 *   busy?: boolean,
 *   finished?: boolean,
 *   failed?: boolean
 * }} s `sent`: the app sent the stop request; `status`: the VM's status page
 * answering it; `lines`: the backup's log lines seen so far; `erase`: what the
 * node ('erased', 'missing', or anything else for no answer), Aleph (the
 * FORGET's item hash) and Le Space's service ('revoked', 'pending', 'skipped')
 * said; `listed`: the backup is in the app's list (false: nothing new to list);
 * `header`: the app's own check that the backup's age header opens with this
 * vault's backup key (backup-header.js);
 * `busy`: the action still runs (only then does a light run); `failed`: it
 * ended in an error (the row under way failed).
 * @returns {StopRow[]}
 */
export function stopPanel({ kind, sent = false, status = null, lines = [], erase = null, listed = null, header = null, busy = false, finished = false, failed = false }) {
	const stop = status?.stop ?? null;
	// The backup of this stop: the outcome in stop.json, else the one running.
	const b = stop?.backup ?? (stop ? status?.backup : null) ?? null;
	const entry = b?.backup ?? null;
	const f = backupFacts([...lines, ...(Array.isArray(b?.log) ? b.log : [])]);
	const over = ['done', 'partial', 'failed', 'unchanged', 'skipped', 'refused'].includes(b?.status) || ['ready', 'partial', 'failed'].includes(stop?.status);
	// No new backup: none set up, or nothing changed since the last one.
	const none = over && (!b || b.status === 'unchanged' || b.status === 'skipped');

	/** @type {[string, StopLight[]][]} */
	const rows = [];
	const lit = (/** @type {unknown} */ yes, /** @type {'app' | 'reported'} */ how = 'reported') => (yes ? how : 'off');
	if (kind === 'stop') {
		const copies = Array.isArray(entry?.copies) ? entry.copies : [];
		const ids = [...new Set([...f.providers, ...copies.map((/** @type {any} */ c) => Number(c.providerId)), ...f.refused])];
		const want = entry?.requestedCopies ?? f.requested ?? null;
		const have = entry ? copies.length : f.copies;
		const parts = Array.isArray(entry?.parts) && entry.parts.length > 1 ? entry.parts.length : f.parts;
		const bytes = entry?.size ?? f.bytes;
		const pieceCid = entry?.pieceCid ?? f.pieceCid;
		const skip = none ? 'skipped' : 'off';
		rows.push(
			['request', [{ id: 'sent', state: lit(sent || stop, 'app') }, { id: 'taken', state: lit(stop) }]],
			[
				'export',
				[
					// Paperless's own container answers no more: paused for the export.
					{ id: 'paused', state: lit(stop && (status?.paperless === false || over)) },
					{ id: 'exported', state: none ? 'skipped' : lit(f.files != null || f.bytes != null || entry), ...(f.files != null ? { key: 'exportedFiles', args: [f.files] } : {}) }
				]
			],
			[
				'sealed',
				[
					{ id: 'sealed', state: none ? 'skipped' : lit(bytes != null), ...(bytes != null ? { key: parts && parts > 1 ? 'sealedParts' : 'sealedSize', args: [bytes, parts ?? 1] } : {}) },
					// Checked by the app itself, after the stop: green only when the header opened.
					...(header ? [/** @type {StopLight} */ ({ id: 'header', state: header === 'opens' ? 'app' : header === 'refused' ? 'failed' : header === 'checking' ? 'run' : 'skipped', ...(header === 'unreachable' ? { key: 'headerUnreachable' } : header === 'refused' ? { key: 'headerRefused' } : {}) })] : [])
				]
			],
			[
				'upload',
				ids.length
					? ids.map((id) => {
							const c = copies.find((/** @type {any} */ x) => Number(x.providerId) === id);
							/** @type {LightState} */
							const state = c ? 'reported' : f.refused.includes(id) || (entry && over) ? 'failed' : 'off';
							return { id: `copy-${id}`, state, key: c ? 'copyAt' : 'copyTo', args: c ? [id, String(c.dataSetId ?? ''), String(c.location ?? '')] : [id] };
						})
					: [{ id: 'copies', state: skip }]
			],
			[
				'piece',
				[
					{ id: 'pieceCid', state: none ? 'skipped' : lit(pieceCid), ...(pieceCid ? { key: 'pieceCidIs', args: [pieceCid] } : {}) },
					{ id: 'confirmed', state: none ? 'skipped' : have != null && want ? (have >= want ? 'reported' : 'failed') : 'off', ...(have != null && want ? { key: 'confirmedOf', args: [have, want] } : {}) }
				]
			]
		);
	}
	const node = erase?.node;
	/** @type {StopLight[]} */
	const forget = [
		node === 'erased' || node === 'missing'
			? { id: 'node', state: 'reported', key: node === 'missing' ? 'nodeGone' : 'node' }
			: { id: 'node', state: erase?.forgot && node !== undefined ? 'skipped' : 'off', ...(erase?.forgot && node !== undefined ? { key: 'nodeLater', say: 'later' } : {}) },
		{ id: 'forgot', state: lit(erase?.forgot, 'app') }
	];
	// The backup key goes only with the last VM that used it.
	if (erase?.revoke === 'revoked' || erase?.revoke === 'pending') forget.push({ id: 'revoke', state: erase.revoke === 'revoked' ? 'reported' : 'failed', key: erase.revoke === 'revoked' ? 'revoke' : 'revokeLater', ...(erase.revoke === 'pending' ? { say: 'later' } : {}) });
	rows.push(['forget', forget]);
	if (kind === 'stop') rows.push(['listed', [{ id: 'listed', state: listed ? 'app' : listed === false || (none && finished) ? 'skipped' : 'off', ...(listed === false || (none && finished) ? { key: 'nothingNew' } : {}) }]]);

	// The row under way: the first with a dark light, while the action runs.
	const open = finished || (!busy && !failed) ? -1 : rows.findIndex(([, lights]) => lights.some((l) => l.state === 'off'));
	return rows.map(([id, lights], i) => {
		const ls = lights.map((l) => (i === open && l.state === 'off' ? { ...l, state: /** @type {LightState} */ (failed ? 'failed' : 'run') } : l));
		const states = ls.map((l) => l.state);
		const state = states.includes('failed') ? 'failed' : states.includes('run') ? 'run' : states.every((x) => x === 'off') ? 'off' : states.every((x) => x === 'skipped') ? 'skipped' : 'done';
		return { id, state, lights: ls };
	});
}
