import adapter from '@sveltejs/adapter-static';

/** @type {import('@sveltejs/kit').Config} */
export default {
	kit: {
		// Everything happens in the browser; the site itself holds no secret.
		adapter: adapter({ fallback: '200.html' })
	}
};
