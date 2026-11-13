// German text belongs in the catalogue (this folder, and the landing page's
// own landing/i18n.js). This test reads every other source file of the app
// and reports what looks like German in a string or in markup: an umlaut or
// ß, German quotation marks, or a run of common German words.
//
// NOT_YET lists the files still to be moved into the catalogue. It only
// shrinks: a file leaves the list when its texts have moved, and the test
// fails if a listed file is clean (so the list stays true) or if a file not
// on the list has German in it.
import { readdirSync, readFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';

const SRC = fileURLToPath(new URL('../../', import.meta.url));

/** Where German is at home. */
const CATALOGUES = [/^lib\/i18n\//, /^lib\/landing\/i18n\.js$/, /^lib\/evidence-i18n\.js$/, /^lib\/landing\/evidence-sample\.js$/, /^lib\/licences\//];

/** Files whose texts have not moved yet. Remove a line with the PR that moves them. */
const NOT_YET = new Set([
	'lib/BackupExport.svelte',
	'lib/BackupLine.svelte',
	'lib/BackupPlaces.svelte',
	'lib/Balances.svelte',
	'lib/Cancel.svelte',
	'lib/HourQuote.svelte',
	'lib/Package.svelte',
	'lib/ProviderHealth.svelte',
	'lib/Setup.svelte',
	'lib/StripeCheckout.svelte',
	'lib/Terms.svelte',
	'lib/TopUp.svelte',
	'lib/Withdraw.svelte',
	'lib/aleph.js',
	'lib/attest-p2p.js',
	'lib/backup-fetch.js',
	'lib/backup-overview.js',
	'lib/backups.js',
	'lib/balances.js',
	'lib/credits.js',
	'lib/keys/age.js',
	'lib/keys/passkey.js',
	'lib/keys/vault.js',
	'lib/permissions.js',
	'lib/providers.js',
	'lib/relays.js',
	'lib/runtime-pin.js',
	'lib/storage.js',
]);

const GERMAN = /[äöüÄÖÜß„“]|\b(?:nicht|und|oder|für|wird|werden|wurde|kein|keine|bitte|noch|schon|dein|deine|deinem|deiner|eine|einen|einer|dieser|diese|dieses|gerade|läuft|Sicherung|Sicherungen|Schlüssel|Tresor|Guthaben|Einrichtung)\b/;

/** The file without its comments, which may say anything. */
function withoutComments(text) {
	return text
		.replace(/<!--[\s\S]*?-->/g, '')
		.replace(/\/\*[\s\S]*?\*\//g, '')
		.replace(/(^|[^:'"`\\])\/\/[^\n]*/g, '$1');
}

/** Lines of `text` that carry German where a person would read it. */
export function germanLines(text) {
	return withoutComments(text)
		.split('\n')
		.map((line, i) => ({ line: line.trim(), n: i + 1 }))
		.filter(({ line }) => GERMAN.test(line))
		// A test id or a storage key may keep a German word; it is a name, not a text.
		.filter(({ line }) => GERMAN.test(line.replace(/data-testid=(?:"[^"]*"|\{`[^`]*`\}|\{[^}]*\})/g, '').replace(/getByTestId\('[^']*'\)/g, '')))
		.map(({ line, n }) => `${n}: ${line.slice(0, 120)}`);
}

function files(dir) {
	return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
		const path = join(dir, entry.name);
		if (entry.isDirectory()) return files(path);
		return /\.(svelte|js)$/.test(entry.name) && !/\.spec\.js$/.test(entry.name) ? [path] : [];
	});
}

const all = files(SRC)
	.map((path) => ({ path, name: relative(SRC, path).split(sep).join('/') }))
	.filter(({ name }) => !CATALOGUES.some((c) => c.test(name)));

describe('German text outside the catalogue', () => {
	it('is found by the check itself', () => {
		expect(germanLines("const a = 'Für einen Start reicht es nicht';")).toHaveLength(1);
		expect(germanLines('<p>Deine Dokumente</p>')).toHaveLength(0); // no marker word: the list above is deliberately short
		expect(germanLines('<p>Noch kein Paket</p>')).toHaveLength(1);
		expect(germanLines("// Für einen Start\nconst a = 'ready';")).toHaveLength(0);
		expect(germanLines('<!-- "Übersicht" -->\n<p>{$t.app.lock}</p>')).toHaveLength(0);
		expect(germanLines('<button data-testid="glance-Sicherungen">{label}</button>')).toHaveLength(0);
	});

	it('is in no file that has been moved to the catalogue', () => {
		const found = all.filter(({ name }) => !NOT_YET.has(name)).map(({ path, name }) => ({ name, lines: germanLines(readFileSync(path, 'utf8')) })).filter((f) => f.lines.length);
		expect(found).toEqual([]);
	});

	it('still is in every file listed as not moved yet', () => {
		const names = new Set(all.map((f) => f.name));
		const gone = [...NOT_YET].filter((name) => !names.has(name));
		const clean = all.filter(({ name }) => NOT_YET.has(name)).filter(({ path }) => germanLines(readFileSync(path, 'utf8')).length === 0).map((f) => f.name);
		expect({ gone, clean }).toEqual({ gone: [], clean: [] });
	});
});
