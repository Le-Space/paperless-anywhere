// The app lives at /app/ (the landing page has /): as app/index.html, which the
// IPFS gateway serves for /app/; anything else under the domain falls back to
// /200.html. Same origin as before, so passkeys and the vault stay where they were.
export const trailingSlash = 'always';
