import { sveltekit } from '@sveltejs/kit/vite';
import { defineConfig } from 'vite';

export default defineConfig({
	plugins: [sveltekit()],
	// The dev server pre-bundles dependencies into .vite/deps, where the attest
	// package's `new URL('…_bg.wasm', import.meta.url)` no longer finds its file.
	optimizeDeps: { exclude: ['@le-space/attest-wasm'] },
	test: { include: ['src/**/*.spec.js'], environment: 'node' }
});
