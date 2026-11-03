<script>
	// Fonts come with the app (no font service), then the Belege look.
	import '@fontsource-variable/sora';
	import '@fontsource/ibm-plex-mono/400.css';
	import '@fontsource/ibm-plex-mono/500.css';
	import '$lib/theme.css';

	let { children } = $props();
</script>

{@render children()}
