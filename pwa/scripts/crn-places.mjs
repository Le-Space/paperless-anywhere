// Where the confidential Aleph nodes stand, roughly: Aleph publishes no
// location, so each node's host name is resolved and its address looked up in
// DB-IP's free city database (IP to City Lite, CC BY 4.0). Runs before a
// release build (pwa-deploy.yml) and writes src/lib/landing/crn-places.json;
// visitors of the page contact no geo service. An address says where it is
// registered or routed, not always where the machine stands, so the page
// shows these places as approximate.
//
//   node scripts/crn-places.mjs
import { lookup } from 'node:dns/promises';
import { readFile, writeFile } from 'node:fs/promises';
import { gunzipSync } from 'node:zlib';
import { Reader } from 'mmdb-lib';
import { CRN_LIST } from '../src/lib/landing/tee-nodes.js';

const OUT = new URL('../src/lib/landing/crn-places.json', import.meta.url);

/** The DB-IP City Lite database of this month, or of last month early on. */
async function database() {
	const now = new Date();
	const months = [0, 1].map((back) => {
		const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - back, 1));
		return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`;
	});
	for (const month of months) {
		const res = await fetch(`https://download.db-ip.com/free/dbip-city-lite-${month}.mmdb.gz`);
		if (res.ok) return { month, reader: new Reader(gunzipSync(Buffer.from(await res.arrayBuffer()))) };
	}
	throw new Error(`no DB-IP City Lite database for ${months.join(' or ')}`);
}

/** @param {any} record */
const placeOf = (record) => ({
	country: record?.country?.iso_code ?? null,
	city: record?.city?.names?.en ?? null
});

async function main() {
	const res = await fetch(CRN_LIST);
	if (!res.ok) throw new Error(`CRN list ${res.status}`);
	const nodes = ((await res.json())?.crns ?? []).filter((n) => n?.confidential_support === true && n?.address);
	const { month, reader } = await database();

	/** @type {Record<string, { country: string | null, city: string | null }>} */
	const places = {};
	for (const node of nodes) {
		try {
			const { address } = await lookup(new URL(node.address).hostname);
			const place = placeOf(reader.get(address));
			if (place.country) places[node.hash] = place;
		} catch {
			/* no address, no place */
		}
	}
	const body = { source: `DB-IP IP to City Lite ${month} (CC BY 4.0)`, places };
	await writeFile(OUT, `${JSON.stringify(body, null, '\t')}\n`);
	console.log(`crn-places: ${Object.keys(places).length} of ${nodes.length} confidential nodes placed`);
}

main().catch(async (e) => {
	// A release still builds with the places of the last run.
	const kept = await readFile(OUT, 'utf8').catch(() => null);
	console.warn(`crn-places: ${e.message}; ${kept ? 'keeping the previous places' : 'no places'}`);
	if (!kept) await writeFile(OUT, `${JSON.stringify({ source: null, places: {} }, null, '\t')}\n`);
});
