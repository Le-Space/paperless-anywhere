<script>
	// A question with two answers, in place of the browser's own confirm():
	// a modal dialog that keeps the focus, closes with Esc (which answers "no"),
	// and names what each button does. The safe answer is the one focused first.
	/** @type {{ open: boolean, title: string, text: string, yes: string, no: string, danger?: boolean, onanswer: (yes: boolean) => void }} */
	let { open, title, text, yes, no, danger = false, onanswer } = $props();
	/** @type {HTMLDialogElement | undefined} */
	let dialog = $state();
	$effect(() => {
		if (!dialog) return;
		if (open && !dialog.open) dialog.showModal();
		else if (!open && dialog.open) dialog.close();
	});
</script>

<dialog bind:this={dialog} aria-labelledby="v2-confirm-title" oncancel={(e) => { e.preventDefault(); onanswer(false); }} data-testid="v2-confirm">
	<h2 id="v2-confirm-title">{title}</h2>
	<p>{text}</p>
	<div class="row">
		<!-- svelte-ignore a11y_autofocus -->
		<button class="sec" autofocus onclick={() => onanswer(false)} data-testid="v2-confirm-no">{no}</button>
		<button class="cta" class:danger onclick={() => onanswer(true)} data-testid="v2-confirm-yes">{yes}</button>
	</div>
</dialog>

<style>
	dialog { border: 1px solid var(--line); border-radius: var(--radius); padding: 1.25rem; max-width: min(28rem, calc(100vw - 2rem)); box-shadow: var(--shadow); }
	dialog::backdrop { background: rgba(15, 27, 45, 0.55); }
	h2 { margin: 0 0 0.5rem; font-size: 1.25rem; }
	p { margin: 0 0 1rem; }
	.row { display: flex; flex-wrap: wrap; gap: 0.6rem; }
	button { flex: 1 1 10rem; min-height: 3.25rem; padding: 0.6rem 1rem; font-size: 1.05rem; font-weight: 600; }
	.sec { background: transparent; color: var(--text); border-color: var(--text-2); }
	.danger { background: var(--danger); border-color: var(--danger); color: var(--surface); }
</style>
