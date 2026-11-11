import { defineConfig } from '@playwright/test';

// The package card against a local mock of le-space-credits (e2e-credits/
// mock-credits.js on 127.0.0.1:4422): the declaration on withdrawal before a
// payment and the cancel page. It builds the app with VITE_CREDITS_URL set to
// the mock (into build/, as a release build with a credits service would be)
// and serves it on 4421. Never the real service.
export default defineConfig({
	testDir: 'e2e-credits',
	use: { baseURL: 'http://localhost:4421', acceptDownloads: true },
	webServer: [
		{ command: 'node e2e-credits/mock-credits.js', url: 'http://127.0.0.1:4422/__requests', reuseExistingServer: false },
		{ command: 'npx vite build && npx vite preview --port 4421 --strictPort', url: 'http://localhost:4421', reuseExistingServer: false, env: { VITE_CREDITS_URL: 'http://127.0.0.1:4422' }, timeout: 180_000 }
	]
});
