// The image versions whose own-image build Le Space includes, for Le Space
// Credits to read (src/lib/own-image-versions.js). Written at build time.
import { json } from '@sveltejs/kit';
import { ownImageVersions } from '$lib/own-image-versions.js';

export const prerender = true;

export function GET() {
	return json(ownImageVersions());
}
