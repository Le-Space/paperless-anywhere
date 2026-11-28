// The screen tour (e2e-screens/tour.spec.js): the install dialog's screenshots
// and the README's, from the built site with made-up data only. Run on demand,
// not in CI: `pnpm build && pnpm screens`.
import { defineConfig } from '@playwright/test';

export default defineConfig({
	testDir: 'e2e-screens',
	// Not test-results itself, which a run empties: the pictures go to test-results/screens.
	outputDir: 'test-results/tour',
	timeout: 120_000,
	use: { baseURL: 'http://localhost:4442', reducedMotion: 'reduce', colorScheme: 'light' },
	webServer: { command: 'npx vite preview --port 4442 --strictPort', url: 'http://localhost:4442', reuseExistingServer: false }
});
