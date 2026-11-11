<script module>
	export const NGX_URL = 'https://github.com/paperless-ngx/paperless-ngx';
</script>

<script>
	// A text that names Paperless-ngx, with the name linked to the project when
	// `link` is set: the first mention on a page links there. Plain text and an
	// <a>, no {@html}.
	/** @type {{ text: string, link?: boolean }} */
	let { text, link = false } = $props();
	const NAME = 'Paperless-ngx';
	const at = $derived(link ? text.indexOf(NAME) : -1);
</script>

{#if at < 0}{text}{:else}{text.slice(0, at)}<a href={NGX_URL} rel="noopener">{NAME}</a>{text.slice(at + NAME.length)}{/if}
