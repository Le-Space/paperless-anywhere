// The areas "Start" and "Sicherung" of the v0.2 interface (lib/v2/Paperless.svelte):
// one template for both views, on the same flow control as the app at /app/.
// The vault, its sealed profile and every hash here are made up and put into
// the Aleph mock; nothing leaves the test.
import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';
import { privateKeyToAccount } from 'viem/accounts';
import { alephMock } from './aleph-mock.js';
import { alephPrivateKey, deriveBytes, LABELS, newMasterSecret } from '../src/lib/keys/derive.js';
import { newSeedPhrase, seal, sealingKeyFromSeedPhrase } from '../src/lib/keys/seal.js';
import { seedIndexAccount, VAULT_KEY } from '../src/lib/keys/index-keys.js';
import { PROFILE_KEY } from '../src/lib/profile.js';

const HOST = 'vm.example.test:24000';
const LAUNCH = '2a'.repeat(48);
const INSTANCE = 'c'.repeat(64);
const PAYER = '0x00000000000000000000000000000000000000bb';
const RUNNING = {
	instanceHash: INSTANCE,
	crnHash: 'd'.repeat(64),
	host: HOST,
	payer: PAYER,
	trustedExecution: { mode: 'sev_snp', policy: 196608, runtime: 'made-up', measurements: [{ platform: 'sev_snp', registers: { launch: LAUNCH } }] },
	dataDisk: 'encrypted',
	attestation: { measurement: LAUNCH, policy: '0x30000', launchTcb: { bootloader: 4, tee: 0, snp: 22, microcode: 213 }, at: Date.UTC(2026, 0, 2, 3, 4, 5), relay: { host: 'relay.example.test', own: false } }
};
// What a start needs, so that the profile counts as set up.
const SET_UP = { network: 'calibration', role: 'test', rootfsItemHash: 'e'.repeat(64), crnHash: 'd'.repeat(64), luksPassphrase: 'made-up-passphrase', appPays: true };

test.use({ locale: 'de-DE' });

/** Opens /v0.2/ with a vault whose sealed profile is `profile`; returns the messages sent to Aleph. */
async function open(page, profile) {
	const aggregates = await alephMock()(page.context());
	const master = newMasterSecret();
	const phrase = newSeedPhrase();
	aggregates.set(seedIndexAccount(phrase).address, { [VAULT_KEY]: { v: 1, box: await seal(master, sealingKeyFromSeedPhrase(phrase), 'master/seed') } });
	const sealed = await seal(new TextEncoder().encode(JSON.stringify(profile)), deriveBytes(master, LABELS.profileKey), 'profile');
	aggregates.set(privateKeyToAccount(alephPrivateKey(master)).address, { [PROFILE_KEY]: { v: 1, box: sealed } });
	await page.context().route(/^https?:\/\/(?!localhost|api2\.aleph\.im)/, (route) => route.abort());
	await page.context().route(`https://${HOST}/anywhere/**`, (route) => route.fulfill({ json: { v: 2, phase: 'ready', paperless: true, backupRequest: null }, headers: { 'access-control-allow-origin': '*' } }));
	const sent = [];
	page.on('request', (request) => {
		if (request.method() === 'POST' && request.url() === 'https://api2.aleph.im/api/v0/messages') sent.push(request.postDataJSON().message);
	});
	await page.goto('/v0.2/');
	await page.getByTestId('v2-have-vault').click();
	await page.getByTestId('v2-words').fill(phrase);
	await page.getByTestId('v2-open-words').click();
	await expect(page.getByTestId('v2-state')).toHaveText('unlocked');
	return sent;
}
const technical = (page) => page.getByRole('banner').getByTestId('view-technical').click();
const standard = (page) => page.getByRole('banner').getByTestId('view-standard').click();
/** No serious or critical accessibility finding on what shows now. */
async function accessible(page, what) {
	const { violations } = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze();
	expect(violations.filter((v) => ['serious', 'critical'].includes(v.impact ?? '')).map((v) => `${what}: ${v.id} (${v.nodes.map((n) => n.target.join(' ')).join('; ')})`)).toEqual([]);
}

test('a running Paperless: Standard says it in plain words; Technisch adds the address and the evidence in the same place', async ({ page }) => {
	await open(page, { ...SET_UP, running: RUNNING });
	const status = page.getByTestId('v2-status');
	await expect(status.getByRole('heading', { level: 1 })).toHaveText('Paperless läuft', { timeout: 30_000 });
	await expect(page.getByTestId('v2-open')).toHaveAttribute('href', `https://${HOST}/`);
	// Standard: no address, no hashes, no evidence table; one plain line that it was checked.
	await expect(page.getByTestId('v2-host')).toHaveCount(0);
	await expect(page.getByTestId('evidence')).toHaveCount(0);
	const start = page.getByTestId('v2-start');
	await expect(start).not.toContainText(LAUNCH);
	await expect(start).not.toContainText('Attestierung');
	await expect(page.getByTestId('v2-proof')).toContainText('Geprüft: echte, verschlüsselte Maschine.');
	await page.getByTestId('v2-proof').locator('summary').click();
	await expect(page.getByTestId('v2-proof')).toContainText('Der Prozessor der Maschine hat bestätigt');
	// The sign-in: the password is hidden until asked for, and copying says that it worked or not.
	await expect(page.getByTestId('v2-password')).toHaveCount(0);
	await page.getByTestId('v2-login').getByRole('button', { name: 'anzeigen' }).click();
	await expect(page.getByTestId('v2-password')).toHaveText(/\S{12,}/);
	await page.getByTestId('v2-copy-password').click();
	await expect(page.getByTestId('v2-login').getByRole('status')).toHaveText(/Kopiert|Kopieren ging nicht/);
	// Without backups set up, the stop says what that means.
	await expect(page.getByTestId('v2-stop-card')).toContainText('Sicherungen sind nicht eingerichtet');
	await accessible(page, 'running, Standard');

	// Technisch: everything above stays; the address and the evidence come on top.
	await technical(page);
	await expect(page.getByTestId('v2-proof')).toBeVisible();
	await expect(page.getByTestId('v2-open')).toBeVisible();
	await expect(page.getByTestId('v2-host')).toContainText(HOST);
	const evidence = page.getByTestId('evidence');
	await expect(evidence).toBeVisible();
	await evidence.locator('summary').click();
	await expect(evidence.getByTestId('evidence-attestation')).toContainText(LAUNCH);
	await accessible(page, 'running, Technisch');

	// Sicherung: the tools are there in both views, whatever Paperless does.
	await page.getByTestId('v2-area-backup').click();
	await expect(page.getByRole('heading', { level: 1, name: 'Sicherung' })).toBeFocused();
	await expect(page.getByTestId('v2-backups-off')).toContainText('Sicherungen sind nicht eingerichtet.');
	await expect(page.getByTestId('v2-download')).toContainText('Dokumente herunterladen');
	await standard(page);
	await expect(page.getByTestId('v2-download')).toBeVisible();
	await accessible(page, 'Sicherung, Standard');
	// Nothing wider than a phone.
	await page.setViewportSize({ width: 360, height: 800 });
	expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
});

test('an interrupted start: "Abbrechen und Maschine löschen" asks, then forgets the VM on Aleph, so nothing keeps costing', async ({ page }) => {
	const sent = await open(page, { ...SET_UP, starting: { instanceHash: INSTANCE, crnHash: 'd'.repeat(64), payer: PAYER, at: '2026-11-17T10:00:00.000Z' } });
	const status = page.getByTestId('v2-status');
	await expect(status.getByRole('heading', { level: 1 })).toHaveText('Der Start wurde unterbrochen', { timeout: 30_000 });
	await expect(status).toContainText('kostet Laufzeit');
	await expect(page.getByTestId('v2-resume')).toBeVisible();
	// Standard has no "only forget": that would leave a paid machine running.
	await expect(page.getByTestId('v2-only-forget')).toHaveCount(0);
	await page.getByTestId('v2-abandon').click();
	const dialog = page.getByTestId('v2-confirm');
	await expect(dialog).toContainText('kostet danach nichts mehr');
	// "Zurück" changes nothing.
	await page.getByTestId('v2-confirm-no').click();
	await expect(status.getByRole('heading', { level: 1 })).toHaveText('Der Start wurde unterbrochen');
	expect(sent.filter((m) => m.type === 'FORGET')).toHaveLength(0);
	await page.getByTestId('v2-abandon').click();
	await page.getByTestId('v2-confirm-yes').click();
	await expect(status.getByRole('heading', { level: 1 })).toHaveText('Paperless ist aus', { timeout: 30_000 });
	const forgets = sent.filter((m) => m.type === 'FORGET');
	expect(forgets).toHaveLength(1);
	expect(JSON.parse(forgets[0].item_content).hashes).toEqual([INSTANCE]);
});

test('not set up yet: Standard leads to the setup in the technical view with one button', async ({ page }) => {
	await open(page, { network: 'calibration', role: 'test' });
	const status = page.getByTestId('v2-status');
	await expect(status.getByRole('heading', { level: 1 })).toHaveText('Paperless ist aus', { timeout: 30_000 });
	await expect(status).toContainText('noch nicht fertig eingerichtet');
	await expect(page.getByTestId('v2-start-button')).toHaveCount(0);
	// What is missing is named in the technical view only.
	await expect(page.getByTestId('v2-missing')).toHaveCount(0);
	await page.getByTestId('v2-open-setup').click();
	await expect(page.getByRole('banner').getByTestId('view-technical')).toHaveAttribute('aria-pressed', 'true');
	await expect(page.getByRole('heading', { level: 1, name: 'System' })).toBeFocused();
	await expect(page.getByTestId('v2-setup')).toHaveAttribute('open', '');
	await page.getByTestId('v2-area-start').click();
	await expect(page.getByTestId('v2-missing')).toContainText('Es fehlt noch:');
	// The choice of what to start with and the role are what the technical view adds here.
	await expect(page.getByTestId('v2-tech')).toContainText('Dieser Start');
	await expect(page.getByTestId('role-line')).toBeVisible();
});
