// Runs at build time only (the site is static): the prerendered English pages
// get lang="en" on <html>, which the shell otherwise fixes to German; the app
// (a vault behind a passkey, nothing to find) tells search engines to leave it out.
// The v0.2 preview also loads the script that puts a chosen light or dark on
// <html> before the first paint: a file of this build beside the icon, since the
// page is rendered in the browser only and the policy allows no inline script.
/** @param {string} html @param {string} path */
export function pageChunk(html, path) {
	if (path.startsWith('/en')) return html.replace('<html lang="de">', '<html lang="en">');
	if (path.startsWith('/v0.2')) {
		const assets = html.match(/href="([^"]*)\/favicon\.svg"/)?.[1] ?? '';
		// After the content security policy, which stands before every script.
		return html.replace('<head>', '<head>\n\t\t<meta name="robots" content="noindex" />').replace('</head>', `\t<script src="${assets}/theme.js"></script>\n\t</head>`);
	}
	if (path.startsWith('/app')) return html.replace('<head>', '<head>\n\t\t<meta name="robots" content="noindex" />');
	return html;
}
/** @type {import('@sveltejs/kit').Handle} */
export const handle = ({ event, resolve }) => resolve(event, { transformPageChunk: ({ html }) => pageChunk(html, event.url.pathname) });
