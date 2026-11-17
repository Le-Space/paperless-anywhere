// A start continued after a reload, when the VM is up already: it is found
// on the fixed address or the 2n6 name, and nothing is set up again (no
// second port mapping, no unlock), even while the node's list does not answer.
import { describe, expect, it, vi, beforeEach } from 'vitest';

const net = vi.hoisted(() => ({
	/** @type {(h: string) => any} */ status: () => null,
	/** @type {() => Promise<string | null>} */ twoN6: async () => null,
	/** @type {() => Promise<any>} */ mapped: () => new Promise(() => {}),
	forward: vi.fn(async () => ({})),
	unlock: vi.fn(async () => {
		throw new Error('unlocked again');
	}),
	/** @type {(a: any) => Promise<any>} */ watch: async ({ host }) => ({ phase: 'ready', host })
}));
vi.mock('./attest-wasm-load.js', () => ({ loadAttestWasm: async () => ({}) }));
vi.mock('./own-image-check.js', async (orig) => ({ ...(await orig()), ownImageVerified: () => true }));
vi.mock('./relays.js', async (orig) => ({ ...(await orig()), attestRelaysFor: async () => ['wss://relay.example'] }));
vi.mock('@le-space/attest-wasm/instance', async (orig) => ({ ...(await orig()), unlockInstance: (...a) => net.unlock(...a) }));
vi.mock('./start-watch.js', async (orig) => ({ ...(await orig()), watchStart: (a) => net.watch(a) }));
vi.mock('./vm.js', async (orig) => ({
	...(await orig()),
	crnAddress: async () => 'https://node.example',
	mapped443: () => net.mapped(),
	publicAddress: async () => ({ ipv4: '192.0.2.1', port: 24000 }),
	hostname: () => net.twoN6(),
	vmStatus: async (host) => net.status(host),
	forward443: (...a) => net.forward(...a)
}));

const { resumeStart } = await import('./lifecycle.js');
const master = new Uint8Array(32).fill(7);
const hash = 'cd'.repeat(32);
const profile = {
	rootfsItemHash: 'r'.repeat(64),
	luksPassphrase: 'p',
	crnHash: 'c'.repeat(64),
	role: 'primary',
	network: 'calibration',
	dnsToken: 'made-up-token',
	starting: { instanceHash: hash, crnHash: 'c'.repeat(64), payer: '0x' + '1'.repeat(40), trustedExecution: {}, restoreEntry: null, at: Date.now() - 20 * 60_000 }
};
const processed = () => vi.spyOn(globalThis, 'fetch').mockImplementation(async () => new Response(JSON.stringify({ status: 'processed' }), { status: 200 }));

describe('continuing a start whose VM is up already', () => {
	beforeEach(() => {
		net.status = () => null;
		net.twoN6 = async () => null;
		net.mapped = () => new Promise(() => {});
		net.forward.mockClear();
		net.unlock.mockClear();
		net.unlock.mockImplementation(async () => {
			throw new Error('unlocked again');
		});
		net.watch = async ({ host }) => ({ phase: 'ready', host });
	});

	it('finds it on the fixed address while the node and the 2n6 name do not answer', async () => {
		net.status = (h) => (h.endsWith('.vm.le-space.de:24000') ? { phase: 'ready' } : null);
		const f = processed();
		const steps = [];
		const vm = await resumeStart(master, profile, (p) => steps.push(p));
		f.mockRestore();
		expect(vm.host).toMatch(/\.vm\.le-space\.de:24000$/);
		expect(net.forward).not.toHaveBeenCalled();
		expect(net.unlock).not.toHaveBeenCalled();
		expect(steps.some((p) => p.already)).toBe(true);
	});

	it('finds it on the 2n6 name when the fixed address does not answer', async () => {
		net.twoN6 = async () => 'made-up-name.2n6.me';
		net.status = (h) => (h === 'made-up-name.2n6.me' ? { phase: 'restoring' } : null);
		const f = processed();
		const vm = await resumeStart(master, profile, () => {});
		f.mockRestore();
		expect(vm.host).toMatch(/\.vm\.le-space\.de:24000$/);
		expect(net.forward).not.toHaveBeenCalled();
		expect(net.unlock).not.toHaveBeenCalled();
	});

	it('does not ask the fixed name of a start younger than the first look', async () => {
		const asked = [];
		net.status = (h) => (asked.push(h), null);
		net.mapped = async () => 24000;
		const f = processed();
		const e = await resumeStart(master, { ...profile, starting: { ...profile.starting, at: Date.now() } }, () => {}).catch((x) => x);
		f.mockRestore();
		expect(e.message).toBe('unlocked again');
		// Asked once the port is there (as before), never by the look for a running VM.
		expect(asked.filter((h) => h.endsWith(':24000'))).toHaveLength(1);
	});

	it('maps no second port when the node already lists one, and unlocks a VM that does not answer', async () => {
		net.mapped = async () => 24000;
		const f = processed();
		const e = await resumeStart(master, profile, () => {}).catch((x) => x);
		f.mockRestore();
		expect(e.message).toBe('unlocked again');
		expect(net.forward).not.toHaveBeenCalled();
		expect(net.unlock).toHaveBeenCalledTimes(1);
	});

	it('a second hand-over stays in the last step, and one that hangs does not hold the watch', async () => {
		net.mapped = async () => 24000;
		let calls = 0;
		net.unlock.mockImplementation(async () => (++calls === 1 ? { injected: [] } : new Promise(() => {})));
		let again = null;
		net.watch = async ({ host, unlockAgain }) => {
			again = await unlockAgain().then(() => 'done', (e) => e.message);
			return { phase: 'ready', host };
		};
		const steps = [];
		const f = processed();
		const vm = await resumeStart(master, profile, (p) => steps.push(p), { unlockAgainMs: 20 });
		f.mockRestore();
		expect(vm.host).toMatch(/\.vm\.le-space\.de:24000$/);
		expect(net.unlock).toHaveBeenCalledTimes(2);
		expect(again).toMatch(/no answer within 20 ms/);
		// After the step "ready" began, nothing moves the panel back to "unlock".
		const ready = steps.findIndex((p) => p.step === 'ready');
		expect(ready).toBeGreaterThan(0);
		expect(steps.slice(ready).every((p) => p.step === 'ready')).toBe(true);
		expect(steps.slice(ready).length).toBeGreaterThan(1);
	});
});
