// The English web app manifest, written at build time from the catalogue
// (src/lib/web-manifest.js), linked by /en/ and by the app in English.
import { manifestResponse } from '$lib/web-manifest.js';

export const prerender = true;

export const GET = () => manifestResponse('en');
