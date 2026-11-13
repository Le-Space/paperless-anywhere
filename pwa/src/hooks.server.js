// Runs at build time only (the site is static): the prerendered English pages
// get lang="en" on <html>, which the shell otherwise fixes to German.
/** @type {import('@sveltejs/kit').Handle} */
export const handle = ({ event, resolve }) =>
	resolve(event, { transformPageChunk: ({ html }) => (event.url.pathname.startsWith('/en') ? html.replace('<html lang="de">', '<html lang="en">') : html) });
