// Can a V-PROGRAM reach out? (#202: the builder uploading the sealed image
// itself.) Answers on 127.0.0.1:8080, which Aleph's attestation agent
// forwards, with what it found: name lookups and HTTPS requests to Aleph's
// API and two neutral hosts. Nothing but these requests goes out; the answer
// holds no secret.
import { createServer } from 'node:http';
import { lookup } from 'node:dns/promises';

const HOSTS = ['api2.aleph.im', 'api3.aleph.im', 'example.com'];
const timeout = (ms) => AbortSignal.timeout(ms);

async function probe() {
	const result = { at: new Date().toISOString(), dns: {}, https: {} };
	for (const host of HOSTS) {
		try {
			result.dns[host] = (await lookup(host, { all: true })).map((a) => a.address);
		} catch (error) {
			result.dns[host] = `error: ${error.code ?? error.message}`;
		}
		const t = Date.now();
		try {
			const res = await fetch(`https://${host}/`, { signal: timeout(10_000) });
			result.https[host] = { status: res.status, ms: Date.now() - t };
		} catch (error) {
			result.https[host] = { error: String(error.cause?.code ?? error.cause?.message ?? error.message), ms: Date.now() - t };
		}
	}
	return result;
}

createServer(async (req, res) => {
	const body = req.url === '/' ? { service: 'egress probe', ...(await probe()) } : { error: 'no such route' };
	res.writeHead(req.url === '/' ? 200 : 404, { 'content-type': 'application/json' });
	res.end(JSON.stringify(body));
}).listen(8080, '127.0.0.1', () => console.log('egress probe on 127.0.0.1:8080'));
