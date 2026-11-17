// The look chosen under "Mehr" in v0.2, put on <html> before the first paint
// (loaded in the head of /v0.2/ only). Key and values as in src/lib/v2/theme.js.
try {
	var chosen = localStorage.getItem('paperless-anywhere.theme');
	if (chosen === 'light' || chosen === 'dark') document.documentElement.setAttribute('data-theme', chosen);
} catch (e) {
	/* storage blocked: the system decides */
}
