// The German web app manifest, written at build time from the catalogue
// (src/lib/web-manifest.js). The shell links it; English pages link the other.
import { manifestResponse } from '$lib/web-manifest.js';

export const prerender = true;

export const GET = () => manifestResponse('de');
