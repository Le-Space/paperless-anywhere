import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: 'e2e',
	use: { baseURL: 'http://localhost:4441' },
	webServer: { command: 'npx vite preview --port 4441 --strictPort', url: 'http://localhost:4441', reuseExistingServer: false }
});
