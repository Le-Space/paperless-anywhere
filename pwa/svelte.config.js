import adapter from '@sveltejs/adapter-static';

// The credits service this build talks to (its API, and the page with the
// payment form that is framed): named in the policy below. Unset in a build
// without a credits service.
const credits = (() => {
	try {
		return new URL(process.env.VITE_CREDITS_URL ?? '').origin;
	} catch {
		return null;
	}
})();

// A test build may also talk to services on this machine without TLS (the
// live test runs its relay on 127.0.0.1): CSP_CONNECT_LOCAL lists them.
// Anything that is not a loopback address is refused, so a release build
// cannot be widened this way.
const local = (process.env.CSP_CONNECT_LOCAL ?? '').split(/\s+/).filter(Boolean).map((source) => {
	const url = new URL(source);
	if (!['ws:', 'http:'].includes(url.protocol) || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) throw new Error(`CSP_CONNECT_LOCAL takes loopback addresses only, not ${source}`);
	return url.origin.replace(/^null$/, `${url.protocol}//${url.host}`);
});

/** @type {import('@sveltejs/kit').Config} */
export default {
	kit: {
		// Everything happens in the browser; the site itself holds no secret.
		adapter: adapter({ fallback: '200.html' }),
		// A content security policy in every page (a <meta>, since the site is
		// static files on a gateway that sets no headers of ours). The page that
		// holds the open vault runs only this build's own scripts: no inline
		// script but SvelteKit's start-up (by hash), no eval, no script, style,
		// font or plugin from elsewhere, and nothing may be framed but the
		// credits service's payment page.
		csp: {
			mode: 'hash',
			directives: {
				'default-src': ['self'],
				// WebAssembly: the attestation verifier.
				'script-src': ['self', 'wasm-unsafe-eval'],
				// Style attributes in the markup (a meter's width); no stylesheet from elsewhere.
				'style-src': ['self', 'unsafe-inline'],
				'font-src': ['self'],
				'img-src': ['self', 'data:', 'blob:'],
				// Where the app talks to is decided at run time (the VM's own
				// address, Aleph nodes, relays, storage providers, an RPC), so any
				// host, but only over TLS.
				'connect-src': ['self', 'https:', 'wss:', ...(credits ? [credits] : []), ...local],
				'frame-src': credits ? [credits] : ['none'],
				'worker-src': ['self', 'blob:'],
				'manifest-src': ['self'],
				'object-src': ['none'],
				'base-uri': ['self'],
				'form-action': ['self']
			}
		}
	}
};
