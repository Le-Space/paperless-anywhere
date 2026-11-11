// What runs in the VM, read at build time from the files the image is built
// from (rootfs/images.txt, rootfs/files/compose.yml, rootfs/build-image.sh),
// so /lizenzen names the versions this build ships, not hand-copied ones.

/** `name upstream@digest` lines of rootfs/images.txt. */
export function parseImages(text) {
	return text
		.split('\n')
		.map((l) => l.trim())
		.filter((l) => l && !l.startsWith('#'))
		.map((l) => {
			const [name, src] = l.split(/\s+/);
			const [ref, digest] = src.split('@');
			const at = ref.lastIndexOf(':');
			return { name, image: ref.slice(0, at), tag: ref.slice(at + 1), digest };
		});
}

/** The one-layer copies compose.yml pulls: { name: 'ghcr.io/…@sha256:…' }. */
export function parseCompose(text) {
	/** @type {Record<string, string>} */
	const out = {};
	for (const m of text.matchAll(/image:\s*(ghcr\.io\/le-space\/paperless-anywhere\/([\w-]+)@sha256:[0-9a-f]{64})/g)) out[m[2]] = m[1];
	return out;
}

/** `NAME=value` assignments at the top of build-image.sh. */
export function parseBuildVars(text) {
	/** @type {Record<string, string>} */
	const out = {};
	for (const m of text.matchAll(/^([A-Z_]+)=(\S+)$/gm)) out[m[1]] = m[2];
	return out;
}

/** Licence and source of each image in images.txt, by name. */
export const IMAGE_LICENCES = {
	paperless: { title: 'Paperless-ngx', licence: 'GPL-3.0', source: (tag) => `https://github.com/paperless-ngx/paperless-ngx/tree/v${tag}` },
	postgres: { title: 'PostgreSQL', licence: 'PostgreSQL License', source: () => 'https://www.postgresql.org/ftp/source/' },
	valkey: { title: 'Valkey', licence: 'BSD-3-Clause', source: () => 'https://github.com/valkey-io/valkey' },
	gotenberg: { title: 'Gotenberg', licence: 'MIT', source: () => 'https://github.com/gotenberg/gotenberg/releases' },
	tika: { title: 'Apache Tika', licence: 'Apache-2.0', source: () => 'https://tika.apache.org/download.html' }
};

/** Everything /lizenzen lists about the VM, from the three files' texts. */
export function stackInfo({ images, compose, build }) {
	const flat = parseCompose(compose);
	const vars = parseBuildVars(build);
	return {
		images: parseImages(images).map((i) => ({ ...i, flat: flat[i.name] ?? null, ...(IMAGE_LICENCES[i.name] ?? { title: i.name, licence: '', source: () => '' }), source: (IMAGE_LICENCES[i.name]?.source ?? (() => ''))(i.tag) })),
		tools: [
			{ title: 'Debian 12 (bookworm)', version: '', licence: 'DFSG', source: 'https://sources.debian.org/' },
			{ title: 'Docker Compose', version: vars.COMPOSE_VERSION ?? '', licence: 'Apache-2.0', source: `https://github.com/docker/compose/tree/${vars.COMPOSE_VERSION}` },
			{ title: 'lego', version: vars.LEGO_VERSION ?? '', licence: 'MIT', source: `https://github.com/go-acme/lego/tree/${vars.LEGO_VERSION}` },
			{ title: 'Node.js', version: vars.NODE_VERSION ?? '', licence: 'MIT', source: `https://github.com/nodejs/node/tree/${vars.NODE_VERSION}` },
			{ title: 'paperless-backup-filecoin', version: (vars.BACKUP_TOOL_COMMIT ?? '').slice(0, 7), licence: 'MIT', source: `https://github.com/Le-Space/paperless-backup-filecoin/tree/${vars.BACKUP_TOOL_COMMIT}` }
		]
	};
}
