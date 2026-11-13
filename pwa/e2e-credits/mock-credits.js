// A local stand-in for le-space-credits, on 127.0.0.1 only: the routes the
// package card uses, with made-up answers. It checks no signature; the unit
// tests do. GET /__requests lists what it received, POST /__state sets
// whether a Stripe-billed plan runs and whether it can still be withdrawn.
// Never the real service.
import { createServer } from 'node:http';

const PORT = Number(process.env.MOCK_CREDITS_PORT ?? 4422);
const ORIGIN = process.env.MOCK_CREDITS_ORIGIN ?? 'http://localhost:4421';

const RENEWS_AT = '2026-12-01T00:00:00.000Z';
const WITHDRAWAL = {
	version: '1',
	de: 'Beispieltext zum Widerruf: Ich verlange ausdrücklich, dass vor Ablauf der Widerrufsfrist begonnen wird.',
	en: 'Example withdrawal text: I expressly request an early start.'
};
const RECEIVED_AT = '2026-11-11T10:15:00.000Z';

const PAYER = '0x' + '5'.repeat(40);
const OFFER = { month_credits: 150, month_price_cents: 150, year_price_cents: 1800, year_days: 365, copies: 3, quota_gib: 32, retention_days: 30 };
// `backup`: null (the service pays no backups), 'none', 'line', 'paid', 'soon', 'week', 'ended' or 'over'.
let state = { plan: true, cancelled: false, withdrawable: false, backup: null, offered: false, included: false, vouchers: false, termsDue: false, voucherRunning: false, voucherGranted: false };
// With `included`, the packages offered carry the backup in their price (le-space-credits#72).
const PACKAGES_INCLUDED = [{ id: 'paperless-15-backup', hours: 15, price_credits: 640, backup_included: true }, { id: 'paperless-100-backup', hours: 100, price_credits: 1640, backup_included: true }, { id: 'paperless-always-backup', hours: 730, price_credits: 9050, backup_included: true }];
const BACKUPS = {
	none: { funded_until: null, active: false, renews_with_plan: false, retention_until: null, notice: null },
	line: { funded_until: RENEWS_AT, active: true, renews_with_plan: true, retention_until: '2026-12-31T00:00:00.000Z', notice: null },
	paid: { funded_until: '2027-11-13T00:00:00.000Z', active: true, renews_with_plan: false, retention_until: '2027-12-13T00:00:00.000Z', notice: null },
	soon: { funded_until: '2026-12-06T00:00:00.000Z', active: true, renews_with_plan: false, retention_until: '2027-01-05T00:00:00.000Z', notice: { kind: 'expires_soon', funded_until: '2026-12-06T00:00:00.000Z', retention_until: '2027-01-05T00:00:00.000Z', days_left: 23, retention_days_left: 53 } },
	week: { funded_until: '2026-11-18T00:00:00.000Z', active: true, renews_with_plan: false, retention_until: '2026-12-18T00:00:00.000Z', notice: { kind: 'expires_soon', funded_until: '2026-11-18T00:00:00.000Z', retention_until: '2026-12-18T00:00:00.000Z', days_left: 5, retention_days_left: 35 } },
	ended: { funded_until: '2026-11-03T00:00:00.000Z', active: false, renews_with_plan: false, retention_until: '2026-12-03T00:00:00.000Z', notice: { kind: 'expired', funded_until: '2026-11-03T00:00:00.000Z', retention_until: '2026-12-03T00:00:00.000Z', days_left: -10, retention_days_left: 20 } },
	voucher: { funded_until: '2026-11-20T10:15:00.000Z', active: true, renews_with_plan: false, retention_until: '2026-12-20T10:15:00.000Z', notice: { kind: 'expires_soon', funded_until: '2026-11-20T10:15:00.000Z', retention_until: '2026-12-20T10:15:00.000Z', days_left: 7, retention_days_left: 37 } },
	over: { funded_until: '2026-09-01T00:00:00.000Z', active: false, renews_with_plan: false, retention_until: '2026-10-01T00:00:00.000Z', notice: { kind: 'retention_over', funded_until: '2026-09-01T00:00:00.000Z', retention_until: '2026-10-01T00:00:00.000Z', days_left: -73, retention_days_left: -43 } }
};
const backup = () => (state.backup ? { payer: PAYER, signer: null, tag: 'mock', network: 'calibration', data_sets: [], ...BACKUPS[state.backup] } : null);
/** @type {{ method: string, path: string, body: any }[]} */
let requests = [];

// A voucher's period (le-space-credits#73): no renewal, ends by itself.
const VOUCHER_END = '2026-11-20T10:15:00.000Z';
const voucherPlan = () => ({ id: 'paperless-voucher', period_start: RECEIVED_AT, period_end: VOUCHER_END, hours_left: state.voucherGranted ? 168 : 0, billing: 'voucher', state: 'ending', renews_at: null, cancel_at_period_end: false });
const plan = () => (state.voucherRunning ? voucherPlan() : { id: 'paperless-30', period_start: '2026-11-01T00:00:00.000Z', period_end: RENEWS_AT, hours_left: 20, billing: 'stripe', renews_at: RENEWS_AT, cancel_at_period_end: state.cancelled });

/** @type {Record<string, (body: any) => [number, any]>} */
const routes = {
	'GET /v1/terms': () => [200, { current: null, pending: null, withdrawal: WITHDRAWAL }],
	'GET /v1/packages': () => [200, { network: null, backup: { ...OFFER, plan_offered: state.offered, included_in_plans: state.included }, voucher: { offered: state.vouchers, prefix: 'PA' }, packages: state.included ? PACKAGES_INCLUDED : [{ id: 'paperless-10', hours: 10, price_credits: 400 }, { id: 'paperless-30', hours: 30, price_credits: 600 }, { id: 'paperless-80', hours: 80, price_credits: 1000 }], topups: [] }],
	'GET /v1/balance': () => [200, { credits: 1234, reserved: 0, lines_this_month: {}, package: state.plan || state.voucherRunning ? plan() : null, terms: {}, backup: backup() }],
	'GET /v1/purchases': () => [200, { purchases: [] }],
	'POST /v1/checkout': () => [200, { client_secret: 'cs_test_mock_secret', session_id: 'cs_test_mock' }],
	'POST /v1/subscribe': () => [200, { client_secret: 'cs_test_mock_secret' }],
	// The backup line of the subscription and the year at once (le-space-credits#69).
	'POST /v1/backup/subscription': () => {
		if (!state.offered) return [409, { error: 'not sold yet', code: 'NOT_YET' }];
		if (!state.plan) return [409, { error: 'no running subscription', code: 'NO_SUBSCRIPTION' }];
		if (state.included) return [409, { error: 'the plan includes the backup', code: 'BACKUP_INCLUDED' }];
		state.backup = 'line';
		return [200, { added: true, funded_until: RENEWS_AT }];
	},
	'POST /v1/backup/checkout': () => (state.offered ? [200, { client_secret: 'cs_test_mock_year' }] : [409, { error: 'not sold yet', code: 'NOT_YET' }]),
	// The start asks for the delegation; the mock has none, so a start ends here.
	'POST /v1/vm/authorize': () => [503, { error: 'no VM account in the mock', code: 'VM_OFF' }],
	// Made-up codes: one that works, one already redeemed by this account, one
	// whose hours are still to come; anything else does not exist.
	'POST /v1/voucher/redeem': (body) => {
		if (!state.vouchers) return [409, { error: 'not yet', code: 'NOT_YET' }];
		if (state.termsDue) return [412, { error: 'terms', code: 'TERMS' }];
		if (state.plan || state.voucherRunning) return [409, { error: 'a period runs', code: 'PERIOD_RUNNING' }];
		if (!/^PA-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}$/.test(String(body?.code ?? ''))) return [400, { error: 'format', code: 'VOUCHER_FORMAT' }];
		if (body.code === 'PA-USED-USED-USED') return [409, { error: 'redeemed', code: 'VOUCHER_REDEEMED' }];
		if (body.code !== 'PA-ABCD-EFGH-JKLM' && body.code !== 'PA-WAIT-WAIT-WAIT') return [404, { error: 'unknown voucher', code: 'VOUCHER' }];
		state.voucherRunning = true;
		state.voucherGranted = body.code === 'PA-ABCD-EFGH-JKLM';
		state.backup = 'voucher';
		return [200, { redeemed: true, package: 'paperless-voucher', days: 7, hours: 168, always: true, period_start: RECEIVED_AT, period_end: VOUCHER_END, backup_until: VOUCHER_END, granted: state.voucherGranted }];
	},
	'POST /v1/portal': () => [200, { url: 'https://billing.stripe.com/p/session/test_mock' }],
	// The withdrawal function: a quote lists what can be withdrawn and changes
	// nothing; without `quote` it withdraws, ends the plan and names a refund.
	'POST /v1/withdrawal': (body) => {
		const listed = state.withdrawable && state.plan ? [{ subject: 'subscription', what: 'Paket 30 Stunden, Monatsabo', concluded_at: '2026-11-05T09:00:00.000Z', until: '2026-11-19T09:00:00.000Z' }] : [];
		if (body?.quote === true) return [200, { quote: true, withdrawable: listed }];
		if (!listed.length) return [409, { error: 'nothing to withdraw', code: 'NOTHING_TO_WITHDRAW' }];
		state.plan = false;
		state.withdrawable = false;
		return [200, { received_at: RECEIVED_AT, withdrawn: listed, refund: { refund_id: 'refund_mock_1', state: 'requested' } }];
	},
	'POST /v1/subscription/cancel': () => {
		if (!state.plan || state.cancelled) return [409, { error: 'no running subscription to cancel', code: 'NO_SUBSCRIPTION' }];
		state.cancelled = true;
		return [200, { kind: 'ordinary', received_at: RECEIVED_AT, effective_at: RENEWS_AT }];
	}
};

const server = createServer(async (req, res) => {
	const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`);
	res.setHeader('access-control-allow-origin', ORIGIN);
	res.setHeader('access-control-allow-methods', 'GET, POST, PUT, DELETE, OPTIONS');
	res.setHeader('access-control-allow-headers', 'content-type, x-ls-address, x-ls-timestamp, x-ls-signature');
	if (req.method === 'OPTIONS') return res.writeHead(204).end();
	let raw = '';
	for await (const chunk of req) raw += chunk;
	const body = raw ? JSON.parse(raw) : null;
	const send = (status, json) => res.writeHead(status, { 'content-type': 'application/json' }).end(JSON.stringify(json));
	if (url.pathname === '/__requests') return send(200, requests);
	if (url.pathname === '/__state' && req.method === 'POST') {
		state = { plan: Boolean(body?.plan), cancelled: false, withdrawable: Boolean(body?.withdrawable), backup: body?.backup in BACKUPS ? body.backup : null, offered: Boolean(body?.offered), included: Boolean(body?.included), vouchers: Boolean(body?.vouchers), termsDue: Boolean(body?.termsDue), voucherRunning: false, voucherGranted: false };
		requests = [];
		return send(200, state);
	}
	// The embedded Checkout's page: empty here, nothing is paid.
	if (url.pathname === '/pay') return res.writeHead(200, { 'content-type': 'text/html' }).end('<!doctype html><title>pay</title><p>Mock checkout</p>');
	const route = routes[`${req.method} ${url.pathname}`];
	if (!route) return send(404, { error: 'not found' });
	requests.push({ method: req.method ?? 'GET', path: url.pathname, body });
	const [status, json] = route(body);
	send(status, json);
});
server.listen(PORT, '127.0.0.1', () => console.log(`mock credits on http://127.0.0.1:${PORT}`));
