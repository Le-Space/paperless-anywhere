import { defineConfig } from '@playwright/test';

// Step 5 of #202: how long a browser takes to upload an image the size of a
// sealed one to Aleph, through the app's own upload code (storeOnAleph), and
// until Aleph has processed it. Only from the workflow "Own image: upload
// from a browser", which provides the paying key and forgets the file again.
// The dev server serves the app's modules as they are, so the page can import
// own-image.js itself.
export default defineConfig({
	testDir: 'e2e-upload',
	timeout: 60 * 60_000,
	// The test holds a key that pays: nothing is recorded.
	// bypassCSP: the test file comes from a local server on another port, which
	// the app's policy does not let the page fetch. The upload itself goes to
	// https://api2.aleph.im, which the policy allows (connect-src https:).
	use: { baseURL: 'http://localhost:4451', bypassCSP: true, trace: 'off', screenshot: 'off', video: 'off' },
	webServer: { command: 'npx vite dev --port 4451 --strictPort', url: 'http://localhost:4451', reuseExistingServer: false, timeout: 180_000 }
});
