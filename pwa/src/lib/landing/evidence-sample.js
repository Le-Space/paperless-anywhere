// A made-up VM for the landing page's sample of the app's evidence view
// (Evidence.svelte). Nothing here belongs to anyone: every value says
// "example" in itself, so none can be mistaken for a real hash, address or
// host, and no link is built from them (`links: false`). Only the runtime is
// real: it is the same for everyone and public. evidence-sample.spec.js
// keeps it that way.
import { evidenceRows } from '../evidence.js';
import { RUNTIME_SAMPLE } from './trust.js';

const MEASUREMENT = 'example-measurement-0000000000000000';

export const SAMPLE = Object.freeze({
	running: {
		instanceHash: 'example-instance-0000000000000000',
		crnHash: 'example-node-0000000000000000',
		host: 'paperless.example',
		payer: '0xExample-0000000000000000',
		trustedExecution: { mode: 'sev_snp', measurements: [{ platform: 'sev_snp', registers: { launch: MEASUREMENT } }] },
		attestation: { measurement: MEASUREMENT, policy: '0x30000', launchTcb: { bootloader: 0, tee: 0, snp: 0, microcode: 0 }, at: Date.UTC(2026, 0, 1, 12, 0, 0), relay: { host: 'relay.example', own: false } },
		dataDisk: 'encrypted'
	},
	rootfsItemHash: 'example-image-0000000000000000',
	lastGood: { at: '2026-01-01T14:00:00Z', copies: 2, pieceCid: 'example-piece-0000000000000000' }
});

/** The sample's rows. @param {string} alephApi */
export const sampleRows = (alephApi = 'https://api2.aleph.im') =>
	evidenceRows({ running: SAMPLE.running, rootfsItemHash: SAMPLE.rootfsItemHash, runtime: RUNTIME_SAMPLE, alephApi, lastGood: SAMPLE.lastGood, backupsOn: true, links: false });
