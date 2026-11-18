// Which STOREs of older builder versions may be forgotten
// (.github/workflows/image-retention.yml). Reads the history of own-image.js
// and the own-image.js of each release from git, asks Aleph about each STORE,
// and prints a report (Markdown) with the list's id. Forgets nothing itself.
//
// The rules are in src/lib/image-retention.js (which versions stay) and
// src/lib/forget-guard.js (which STOREs may go). One refusal: no list, exit 1.
//
// Usage (from pwa/, in a checkout with full history and tags):
//   node scripts/image-retention.mjs --releases <file> --account <0x…> [--keep 3] [--grace-days 14]
//     [--list <file>] [--expect <list id>]
// --releases: JSON [{ tagName, publishedAt }] (gh release list --json tagName,publishedAt)
// --list:     where the hashes to forget go, one per line
// --expect:   the id the dry run printed; exit 1 unless this list has it
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import { ALEPH_API, readFetch } from '../src/lib/aleph.js';
import { builderOf, listId, releasesInUse, retentionPlan, versionsFromHistory } from '../src/lib/image-retention.js';
import { retiredStoresToForget } from '../src/lib/forget-guard.js';
import { CREDITS_PER_USD } from '../src/lib/prices.js';

const OWN_IMAGE = 'pwa/src/lib/own-image.js';
const PRICING_ADDRESS = '0xFba561a84A537fCaa567bb7A2257e7142701ae2A';

const args = process.argv.slice(2);
const opt = (name, fallback = null) => {
	const at = args.indexOf(`--${name}`);
	return at >= 0 ? args[at + 1] : fallback;
};
const keep = Number(opt('keep', '3'));
const graceDays = Number(opt('grace-days', '14'));
const account = String(opt('account', ''));
const releasesFile = opt('releases');
if (!/^0x[0-9a-fA-F]{40}$/.test(account) || !releasesFile) throw new Error('usage: image-retention.mjs --releases <file> --account <0x…> [--keep 3] [--grace-days 14] [--list <file>] [--expect <id>]');

const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 64 << 20 });
const top = git('rev-parse', '--show-toplevel').trim();
const showAt = (rev) => {
	try {
		return execFileSync('git', ['-C', top, 'show', `${rev}:${OWN_IMAGE}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
	} catch {
		return null;
	}
};

// The history of own-image.js on this checkout, oldest first.
const history = git('-C', top, 'log', '--reverse', '--format=%H %cI', '--', OWN_IMAGE)
	.trim()
	.split('\n')
	.filter(Boolean)
	.map((line) => {
		const [commit, at] = line.split(' ');
		return { commit, at, source: showAt(commit) ?? '' };
	});
const versions = versionsFromHistory(history);
const current = builderOf(readFileSync(`${top}/${OWN_IMAGE}`, 'utf8'));
if (!current) throw new Error('own-image.js in this checkout fixes no builder');

// Each release with the builder its own-image.js fixes; the hashes it names are kept.
const releases = JSON.parse(readFileSync(releasesFile, 'utf8')).map((r) => {
	const src = showAt(r.tagName);
	return { tag: r.tagName, publishedAt: r.publishedAt, roothash: src ? (builderOf(src)?.roothash ?? null) : null, hashes: src?.match(/[0-9a-f]{64}/g) ?? [] };
});
const plan = retentionPlan({ versions, current: current.roothash, releases, keep, graceDays, now: Date.now() });
const inUse = new Set(releasesInUse(releases, { now: Date.now(), graceDays }).map((r) => r.tag));
const kept = new Set([...(readFileSync(`${top}/${OWN_IMAGE}`, 'utf8').match(/[0-9a-f]{64}/g) ?? []), ...releases.filter((r) => inUse.has(r.tag)).flatMap((r) => r.hashes)]);

const read = async (path) => {
	const res = await readFetch(`${ALEPH_API}${path}`, path);
	if (res.status === 404) return null;
	if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
	return res.json();
};
const message = async (hash) => {
	const m = await read(`/api/v0/messages/${hash}`);
	const content = m?.message?.content ?? (m?.message?.item_content ? JSON.parse(m.message.item_content) : null);
	return { hash, status: m?.status ?? 'unknown', type: m?.message?.type, sender: m?.message?.sender, file: content?.item_hash ?? null };
};

// The files the kept versions hold, through any of their STOREs.
const keptFiles = new Set();
for (const h of plan.keptStores) {
	const m = await message(h);
	if (m.file) keptFiles.add(m.file);
}

// The retired versions' STOREs, and every other STORE of the account with the same file (a pin again).
const sizes = new Map();
for (let page = 1; ; page++) {
	const f = await read(`/api/v0/addresses/${account}/files?pagination=200&page=${page}`);
	for (const x of f?.files ?? []) sizes.set(x.item_hash, x.size);
	if (!f?.files?.length || page * 200 >= (f.pagination_total ?? 0)) break;
}
const rows = [];
const retiredFiles = new Set();
for (const v of plan.retired) {
	for (const h of v.stores) {
		const m = await message(h);
		rows.push({ version: v, ...m, size: sizes.get(h) ?? null });
		if (m.file) {
			retiredFiles.add(m.file);
			const same = await read(`/api/v0/messages.json?addresses=${account}&msgTypes=STORE&contentHashes=${m.file}&pagination=50`);
			for (const other of same?.messages ?? []) {
				if (rows.some((r) => r.hash === other.item_hash) || v.stores.includes(other.item_hash)) continue;
				rows.push({ version: v, ...(await message(other.item_hash)), size: sizes.get(other.item_hash) ?? null, pin: true });
			}
		}
	}
}
// Already forgotten (or never there): nothing to do for those.
const live = rows.filter((r) => r.status !== 'forgotten' && r.status !== 'unknown');
const gone = rows.filter((r) => !live.includes(r));
const { forget, refused } = retiredStoresToForget(live, { account, retiredFiles, keptFiles, kept });
const id = forget.length ? await listId(forget) : null;

// What it saves: Aleph's storage price, credits per MiB and hour.
const pricing = await read(`/api/v0/aggregates/${PRICING_ADDRESS}.json?keys=pricing`).catch(() => null);
const perMiBHour = Number(pricing?.data?.pricing?.storage?.price?.storage?.credit ?? NaN);
const bytes = live.reduce((n, r) => n + (r.size ?? 0), 0);
const perDay = (bytes / 2 ** 20) * perMiBHour * 24;

const short = (h) => `${String(h).slice(0, 12)}…`;
const out = [];
out.push(`## Image retention: keep the newest ${keep}, releases in use for ${graceDays} days after their successor`, '');
out.push('### Versions that stay', '', '| builder (workload roothash) | since | why |', '|---|---|---|');
for (const k of plan.kept) out.push(`| \`${short(k.roothash)}\` | ${versions.find((v) => v.roothash === k.roothash)?.since.slice(0, 10)} | ${k.why.join('; ')} |`);
out.push('', '### Versions whose STOREs may go', '');
if (!plan.retired.length) out.push('None.');
else {
	out.push('| builder | plain image (SHA-256) | STORE | file | size | status |', '|---|---|---|---|---|---|');
	for (const r of rows) out.push(`| \`${short(r.version.roothash)}\` | \`${short(r.version.plainSha256)}\` | \`${r.hash}\`${r.pin ? ' (pinned again)' : ''} | \`${short(r.file)}\` | ${r.size ? `${(r.size / 1e6).toFixed(0)} MB` : '?'} | ${r.status} |`);
}
out.push('');
if (gone.length) out.push(`${gone.length} of them are forgotten already; nothing to do for those.`, '');
if (refused.length) {
	out.push('### Refused: nothing will be forgotten', '', ...refused.map((r) => `- ${r}`), '');
} else if (forget.length) {
	out.push(`**${forget.length} STOREs, ${(bytes / 1e9).toFixed(2)} GB.** List id: \`${id}\``, '');
	if (Number.isFinite(perDay)) out.push(`Saves about ${Math.round(perDay).toLocaleString('en')} credits a day (${(perDay / CREDITS_PER_USD).toFixed(4)} USD; ${((perDay * 30) / CREDITS_PER_USD).toFixed(2)} USD a month) at Aleph's storage price of ${perMiBHour} credits per MiB and hour.`, '');
	out.push('To forget exactly this list: run the workflow with action "forget" and this list id.');
} else out.push('Nothing to forget.');
console.log(out.join('\n'));

const listFile = opt('list');
if (listFile) writeFileSync(listFile, forget.map((h) => `${h}\n`).join(''));
const expect = opt('expect');
if (refused.length) process.exit(1);
if (expect !== null && expect !== id) {
	console.error(`the list id is ${id}, not ${expect}: the list changed since the dry run, so nothing is forgotten`);
	process.exit(1);
}
