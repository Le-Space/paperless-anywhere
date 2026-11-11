// Vite plugin for /lizenzen. It gives the page what runs in the VM (from the
// rootfs files, see src/lib/licences/stack.js) as __STACK__, and writes
// third-party-licences.txt next to the app: name, version, licence and
// licence text of every package the browser bundle actually contains (MIT,
// Apache-2.0 and the font licences ask for their notice to travel with the
// copy; the minified bundle drops it).
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { stackInfo } from '../src/lib/licences/stack.js';

const root = fileURLToPath(new URL('../../rootfs/', import.meta.url));

export function stack() {
	const read = (p) => readFileSync(join(root, p), 'utf8');
	return stackInfo({ images: read('images.txt'), compose: read('files/compose.yml'), build: read('build-image.sh') });
}

/** The package directory a bundled module comes from, or null. */
export function packageDir(id) {
	const path = id.replace(/^\0/, '').split('?')[0];
	const at = path.lastIndexOf(`${sep}node_modules${sep}`);
	if (at < 0) return null;
	const rest = path.slice(at + 14).split(sep);
	const parts = rest[0].startsWith('@') ? 2 : 1;
	return path.slice(0, at + 14) + rest.slice(0, parts).join(sep);
}

function notice(dir) {
	const pkg = JSON.parse(readFileSync(join(dir, 'package.json'), 'utf8'));
	const files = readdirSync(dir).filter((f) => /^(licen[cs]e|copying|notice)/i.test(f)).sort();
	const texts = files.map((f) => readFileSync(join(dir, f), 'utf8').trim());
	const licence = typeof pkg.license === 'string' ? pkg.license : (pkg.license?.type ?? (pkg.licenses ?? []).map((l) => l.type).join(' OR '));
	const author = typeof pkg.author === 'string' ? pkg.author : pkg.author?.name;
	const repo = typeof pkg.repository === 'string' ? pkg.repository : pkg.repository?.url;
	return { name: pkg.name, version: pkg.version, licence: licence || 'see text', author, repo, texts };
}

export function licences() {
	let client = false;
	return {
		name: 'paperless-licences',
		config: () => ({ define: { __STACK__: JSON.stringify(stack()) } }),
		configResolved(c) {
			client = !c.build.ssr;
		},
		generateBundle() {
			if (!client) return;
			const dirs = new Set();
			for (const id of this.getModuleIds()) {
				const dir = packageDir(id);
				if (dir && existsSync(join(dir, 'package.json'))) dirs.add(dir);
			}
			const seen = new Map();
			for (const dir of dirs) {
				const n = notice(dir);
				if (n.name) seen.set(`${n.name}@${n.version}`, n);
			}
			const list = [...seen.values()].sort((a, b) => a.name.localeCompare(b.name));
			const head = `Third-party software in the Paperless anywhere web app (${list.length} packages)\n` + 'Name, version and licence of every package in the browser bundle, each followed by its licence text.\n';
			const body = list.map((n) => `${'='.repeat(78)}\n${n.name} ${n.version} (${n.licence})\n${'='.repeat(78)}\n${n.author ? `Author: ${n.author}\n` : ''}${n.repo ? `Source: ${n.repo}\n` : ''}\n${n.texts.join('\n\n') || `The package ships no licence file; its package.json names the licence: ${n.licence}.`}\n`).join('\n');
			this.emitFile({ type: 'asset', fileName: 'third-party-licences.txt', source: `${head}\n${body}` });
		}
	};
}
