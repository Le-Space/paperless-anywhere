// A page under /ipfs/… or /ipns/… is on a path-style gateway: the browser
// gives it the gateway's origin, which every other CID there shares – its
// storage and its passkeys. The vault opens only on an origin of its own: the
// domain, or a subdomain gateway (<cid>.ipfs.<host>), where the CID is the origin.

export const HOME = 'https://paperless.le-space.de/app/';

/** @param {string} [pathname] defaults to the page's */
export function sharedOrigin(pathname = globalThis.location?.pathname ?? '/') {
	return /^\/ip[fn]s\//.test(pathname);
}

/**
 * Whether the page is shown inside a frame of another page. The vault never
 * opens framed: a page around it could make clicks land on its buttons. A
 * frame the browser does not let us look past counts as framed.
 * @param {{ top: unknown, self: unknown } | undefined} [win] defaults to the page's window
 */
export function framed(win = /** @type {any} */ (globalThis.window)) {
	if (!win) return false;
	try {
		return win.top !== win.self;
	} catch {
		return true;
	}
}
