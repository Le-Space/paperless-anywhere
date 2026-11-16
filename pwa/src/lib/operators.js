// Whether two storage providers belong to the same operator, by what the
// FWSS ServiceProviderRegistry says of them. Two copies at one operator are
// not independent: one outage, one mistake or one decision can take both
// (2026-11-16: providers 36 "Cello" and 37 "Bass", both fidl.tech, refused
// connections at the same time). Same operator means any one of:
// - a payee or owner address in common (the registry's `payee` and
//   `serviceProvider`, compared crosswise);
// - the same registered domain (eTLD+1) of the service URL;
// - the same name prefix (the first word of the name, without trailing
//   digits, such as "ezpdpz" of "ezpdpz-main2").
// Each is a sign, not proof; any one makes the copies count as dependent.

// Public suffixes with two labels that providers are likely to sit under
// (a short excerpt of the Public Suffix List, enough for the registry today).
const TWO_LABEL_SUFFIXES = new Set([
	'co.uk', 'org.uk', 'ac.uk', 'gov.uk', 'ltd.uk', 'plc.uk', 'me.uk', 'net.uk',
	'com.au', 'net.au', 'org.au', 'co.nz', 'co.jp', 'ne.jp', 'or.jp', 'co.kr', 'com.cn', 'net.cn', 'com.hk', 'com.sg', 'com.tw',
	'com.br', 'com.ar', 'com.mx', 'co.za', 'co.in', 'co.il', 'com.tr', 'com.pl', 'com.ua',
	'dedyn.io', 'duckdns.org', 'github.io', 'netlify.app', 'vercel.app', 'pages.dev', 'workers.dev', 'herokuapp.com', 'ngrok.io', 'ngrok-free.app', 'nip.io', 'sslip.io'
]);

/** The registered domain (eTLD+1) of a URL, or null. @param {string | null | undefined} url */
export function registeredDomain(url) {
	let host;
	try {
		host = new URL(String(url ?? '')).hostname.toLowerCase().replace(/\.$/, '');
	} catch {
		return null;
	}
	if (!host || /^[\d.]+$/.test(host) || host.includes(':')) return host || null;
	const labels = host.split('.');
	if (labels.length <= 2) return host;
	const two = labels.slice(-2).join('.');
	return TWO_LABEL_SUFFIXES.has(two) ? labels.slice(-3).join('.') : two;
}

// Words that say what a provider is, not whose it is.
const GENERIC = new Set(['pdp', 'sp', 'filecoin', 'fil', 'storage', 'mainnet', 'calibration', 'node', 'provider', 'the', 'main', 'test']);

/** The first word of a provider's name, lower case and without trailing digits; null when too short or generic. @param {string | null | undefined} name */
export function namePrefix(name) {
	const word = String(name ?? '').trim().toLowerCase().split(/[\s\-_.:/]+/)[0]?.replace(/\d+$/, '') ?? '';
	return word.length >= 3 && !GENERIC.has(word) ? word : null;
}

/** @typedef {{ id: number, name?: string, owner?: string | null, payee?: string | null, url?: string | null }} RegistryEntry */

/**
 * Why two providers count as one operator: the signs they share, [] when none.
 * @param {RegistryEntry} a @param {RegistryEntry} b
 * @returns {{ kind: 'address' | 'domain' | 'name', value: string }[]}
 */
export function sharedSigns(a, b) {
	const signs = [];
	const addrs = (p) => [p.owner, p.payee].filter((x) => /^0x[0-9a-fA-F]{40}$/.test(String(x ?? ''))).map((x) => String(x).toLowerCase());
	const common = addrs(a).find((x) => addrs(b).includes(x));
	if (common) signs.push({ kind: /** @type {const} */ ('address'), value: common });
	const da = registeredDomain(a.url);
	if (da && da === registeredDomain(b.url)) signs.push({ kind: /** @type {const} */ ('domain'), value: da });
	const na = namePrefix(a.name);
	if (na && na === namePrefix(b.name)) signs.push({ kind: /** @type {const} */ ('name'), value: na });
	return signs;
}

/** Whether two providers belong to the same operator. @param {RegistryEntry} a @param {RegistryEntry} b */
export const sameOperator = (a, b) => a.id === b.id || sharedSigns(a, b).length > 0;

/**
 * The pairs among `providers` that share an operator, with the signs.
 * @template {RegistryEntry} P
 * @param {P[]} providers
 * @returns {{ a: P, b: P, signs: ReturnType<typeof sharedSigns> }[]}
 */
export function dependentPairs(providers) {
	const pairs = [];
	for (let i = 0; i < providers.length; i++)
		for (let j = i + 1; j < providers.length; j++) {
			const signs = sharedSigns(providers[i], providers[j]);
			if (signs.length) pairs.push({ a: providers[i], b: providers[j], signs });
		}
	return pairs;
}

/**
 * How many independent operators hold the copies: providers joined by any
 * shared sign (also through a third) count once.
 * @param {RegistryEntry[]} providers
 */
export function operatorCount(providers) {
	const group = providers.map((_, i) => i);
	const root = (i) => (group[i] === i ? i : (group[i] = root(group[i])));
	for (const { a, b } of dependentPairs(providers)) group[root(providers.indexOf(a))] = root(providers.indexOf(b));
	return new Set(providers.map((_, i) => root(i))).size;
}
