// Runs at build time only (the site is static): the prerendered English pages
// get lang="en" on <html>, which the shell otherwise fixes to German; the app
// (a vault behind a passkey, nothing to find) tells search engines to leave it out.
/** @param {string} html @param {string} path */
export function pageChunk(html, path) {
	if (path.startsWith('/en')) return html.replace('<html lang="de">', '<html lang="en">');
	if (path.startsWith('/app')) return html.replace('<head>', '<head>\n\t\t<meta name="robots" content="noindex" />');
	return html;
}
/** @type {import('@sveltejs/kit').Handle} */
export const handle = ({ event, resolve }) => resolve(event, { transformPageChunk: ({ html }) => pageChunk(html, event.url.pathname) });
