import { defineConfig } from '@playwright/test';

// Against a real node, the real Aleph and a real attest relay: only from the
// "PWA start and stop" workflow, which provides the wallet and the image.
export default defineConfig({
	testDir: 'e2e-live',
	timeout: 75 * 60_000,
	// No trace, screenshot or video: the test types the recovery words and the
	// image's passphrase, and the workflow uploads test-results when it fails.
	use: { baseURL: 'http://localhost:4441', trace: 'off', screenshot: 'off', video: 'off' },
	webServer: { command: 'npx vite preview --port 4441 --strictPort', url: 'http://localhost:4441', reuseExistingServer: false }
});
