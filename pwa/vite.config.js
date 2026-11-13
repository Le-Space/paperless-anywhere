import { execSync } from 'node:child_process';
import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';
import { licences } from './scripts/licences.js';

// What the footer shows: the release (PAPERLESS_VERSION, set by the deploy
// workflow), the commit and when this build was made.
function commit() {
	if (process.env.GITHUB_SHA) return process.env.GITHUB_SHA;
	try {
		return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim();
	} catch {
		return '';
	}
}

export default defineConfig({
	plugins: [sveltekit(), licences()],
	define: {
		__BUILD__: JSON.stringify({ version: process.env.PAPERLESS_VERSION || 'dev', commit: commit().slice(0, 7), time: new Date().toISOString() })
	},
	// The dev server pre-bundles dependencies into .vite/deps, where the attest
	// package's `new URL('…_bg.wasm', import.meta.url)` no longer finds its file.
	optimizeDeps: { exclude: ['@le-space/attest-wasm'] },
	// The unit tests read the app's texts in German, whatever the machine's language.
	test: { include: ['src/**/*.spec.js'], environment: 'node', setupFiles: ['src/lib/i18n/test-setup.js'] }
});
