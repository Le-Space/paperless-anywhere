import { defineConfig } from '@playwright/test';

// Against a real node, the real Aleph and a real attest relay: only from the
// "PWA start and stop" workflow, which provides the wallet and the image.
export default defineConfig({
	testDir: 'e2e-live',
	timeout: 75 * 60_000,
	use: { baseURL: 'http://localhost:4441', trace: 'retain-on-failure' },
	webServer: { command: 'npx vite preview --port 4441 --strictPort', url: 'http://localhost:4441', reuseExistingServer: false }
});
