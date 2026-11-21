// The STOREs a refused publication left behind: which of the named ones may be
// forgotten (.github/workflows/forget-leftovers.yml). Prints a report
// (Markdown) with the list's id. Forgets nothing itself.
//
// The rules are in src/lib/forget-guard.js (leftoverRefusal). One refusal: no
// list, exit 1.
//
// Usage (from pwa/, in a checkout with full history and tags):
//   node scripts/forget-leftovers.mjs --account <0x…> --hashes "<item hashes>" [--list <file>] [--expect <list id>]
import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { ALEPH_API, readFetch } from '../src/lib/aleph.js';
import { listId } from '../src/lib/image-retention.js';
import { leftoversToForget } from '../src/lib/forget-guard.js';

const OWN_IMAGE = 'pwa/src/lib/own-image.js';
const args = process.argv.slice(2);
const opt = (name, fallback = null) => {
	const at = args.indexOf(`--${name}`);
	return at >= 0 ? args[at + 1] : fallback;
};
const account = String(opt('account', ''));
const given = String(opt('hashes', '')).split(/[\s,]+/).filter(Boolean);
if (!/^0x[0-9a-fA-F]{40}$/.test(account) || !given.length) throw new Error('usage: forget-leftovers.mjs --account <0x…> --hashes "<item hashes>" [--list <file>] [--expect <id>]');
const wrong = given.filter((h) => !/^[0-9a-f]{64}$/.test(h));
if (wrong.length) throw new Error(`no item hash: ${wrong.join(' ')}`);

const git = (...a) => execFileSync('git', a, { encoding: 'utf8', maxBuffer: 256 << 20, stdio: ['ignore', 'pipe', 'ignore'] });
const top = git('rev-parse', '--show-toplevel').trim();
const tryGit = (...a) => {
	try {
		return git('-C', top, ...a);
	} catch {
		return '';
	}
};
const hashesIn = (text) => text.match(/[0-9a-f]{64}/g) ?? [];

// Every hash this checkout names in any tracked file, every version of
// own-image.js in its history, and the own-image.js of every tag.
const named = new Set(hashesIn(tryGit('grep', '-ohIE', '[0-9a-f]{64}', 'HEAD')));
const commits = tryGit('log', '--format=%H', '--', OWN_IMAGE).trim().split('\n').filter(Boolean);
const tags = tryGit('tag', '--list').trim().split('\n').filter(Boolean);
if (!named.size || !commits.length || !tags.length) throw new Error('this checkout shows no hashes, no history of own-image.js or no tags: it needs the full history and the tags');
for (const rev of [...commits, ...tags]) for (const h of hashesIn(tryGit('show', `${rev}:${OWN_IMAGE}`))) named.add(h);

const read = async (path) => {
	const res = await readFetch(`${ALEPH_API}${path}`, path);
	if (res.status === 404) return null;
	if (!res.ok) throw new Error(`${path}: HTTP ${res.status}`);
	return res.json();
};
/** Every processed message of the account of these types. */
const messages = async (types) => {
	const out = [];
	for (let page = 1; ; page++) {
		const r = await read(`/api/v0/messages.json?addresses=${account}&msgTypes=${types}&pagination=200&page=${page}`);
		if (!r) throw new Error(`the account's ${types} messages could not be read`);
		out.push(...(r.messages ?? []));
		if (!r.messages?.length || page * 200 >= (r.pagination_total ?? 0)) return out;
	}
};

/** An item hash or a file's CID. */
const REF = /[0-9a-f]{64}|Qm[1-9A-HJ-NP-Za-km-z]{44}|baf[a-z2-7]{50,}/g;
// The files of the account's STOREs that are named, and what its programs and instances name.
const namedFiles = new Set();
for (const m of await messages('STORE')) if (named.has(m.item_hash) && m.content?.item_hash) namedFiles.add(m.content.item_hash);
const referenced = new Set();
for (const m of await messages('PROGRAM,INSTANCE')) for (const h of JSON.stringify(m.content ?? {}).match(REF) ?? []) referenced.add(h);

// Its aggregates too: the site's deploys and its domains are named there, not in a program.
const aggregates = await read(`/api/v0/aggregates/${account}.json`);
if (!aggregates?.data) throw new Error("the account's aggregates could not be read");
for (const h of JSON.stringify(aggregates.data).match(REF) ?? []) referenced.add(h);

const sizes = new Map();
for (let page = 1; ; page++) {
	const f = await read(`/api/v0/addresses/${account}/files?pagination=200&page=${page}`);
	for (const x of f?.files ?? []) sizes.set(x.item_hash, x.size);
	if (!f?.files?.length || page * 200 >= (f.pagination_total ?? 0)) break;
}
const rows = [];
for (const hash of given) {
	const m = await read(`/api/v0/messages/${hash}`);
	const content = m?.message?.content ?? (m?.message?.item_content ? JSON.parse(m.message.item_content) : null);
	rows.push({ hash, status: m?.status ?? 'unknown', type: m?.message?.type, sender: m?.message?.sender, file: content?.item_hash ?? null, size: sizes.get(hash) ?? null, time: m?.message?.time ?? null });
}
// Already forgotten: nothing to do for those.
const live = rows.filter((r) => r.status !== 'forgotten');
const { forget, refused } = live.length ? leftoversToForget(live, { account, named, namedFiles, referenced }) : { forget: [], refused: [] };
const id = forget.length ? await listId(forget) : null;
const bytes = live.reduce((n, r) => n + (r.size ?? 0), 0);

const short = (h) => `${String(h).slice(0, 12)}…`;
const out = ['## Leftovers of a refused publication', '', '| STORE | file | size | sent | status |', '|---|---|---|---|---|'];
for (const r of rows) out.push(`| \`${r.hash}\` | \`${short(r.file)}\` | ${r.size ? `${(r.size / 1e6).toFixed(0)} MB` : '?'} | ${r.time ? new Date(r.time * 1000).toISOString().slice(0, 16) : '?'} | ${r.status} |`);
out.push('', `Checked against ${named.size} hashes the repository, the history of own-image.js and ${tags.length} tags name, and ${referenced.size} a program, an instance or an aggregate of the account names.`, '');
if (rows.length > live.length) out.push(`${rows.length - live.length} of them are forgotten already; nothing to do for those.`, '');
if (refused.length) out.push('### Refused: nothing will be forgotten', '', ...refused.map((r) => `- ${r}`), '');
else if (forget.length) out.push(`**${forget.length} STOREs, ${(bytes / 1e9).toFixed(2)} GB.** List id: \`${id}\``, '', 'To forget exactly this list: run the workflow with action "forget", the same hashes and this list id.');
else out.push('Nothing to forget.');
console.log(out.join('\n'));

const listFile = opt('list');
if (listFile) writeFileSync(listFile, forget.map((h) => `${h}\n`).join(''));
const expect = opt('expect');
if (refused.length) process.exit(1);
if (expect !== null && expect !== id) {
	console.error(`the list id is ${id}, not ${expect}: the list changed since the dry run, so nothing is forgotten`);
	process.exit(1);
}
