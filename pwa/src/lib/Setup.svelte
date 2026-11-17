<script>
	import Addr from '$lib/Addr.svelte';
	import BackupPlaces from '$lib/BackupPlaces.svelte';
	import { createSetupCard } from '$lib/setup-card.svelte.js';
	import { refreshBalances } from '$lib/balance-refresh.js';
	import { fixedHostLabel } from '$lib/keys/derive.js';
	import { FIXED_HOST_DOMAIN } from '$lib/vm.js';
	import { BACKUP_LABEL, supportsIncremental } from '$lib/backups.js';
	import { CREDITS_URL } from '$lib/credits.js';
	import { buildsImageFirst } from '$lib/lifecycle.js';
	import { BUILDER, sources } from '$lib/own-image.js';
	import { format, lang, t } from '$lib/i18n/index.js';

	/** @type {{ master: Uint8Array, onsaved?: () => void }} */
	let { master, version = 0, onsaved = () => {} } = $props();

	// What happens is in setup-card.svelte.js; this component draws it.
	const k = createSetupCard({
		get master() { return master; },
		get version() { return version; },
		onsaved: (...a) => onsaved(...a)
	});
	const { pwaAddress, sessionAddress, backupKey, connect, changeNetwork, setPays, setRole, authorize, session, setBackupsByCredits, payBackups, authorizeBackupKey, saveRelay, saveAge, useVaultAge, toggleBackups, savePlaces, pushPlaces, saveOwner, saveImage, choosePublic, buildImage, removeOldImages, saveDns, titled, fundedUntil, until, goTo } = k;
	const x = $derived(k.x);
	const backupState = $derived(k.backupState);
	const profile = $derived(k.profile);
	const loaded = $derived(k.loaded);
	const alephOk = $derived(k.alephOk);
	const sessionUntil = $derived(k.sessionUntil);
	const relayInput = $derived(k.relayInput);
	const foundRelays = $derived(k.foundRelays);
	const ageInput = $derived(k.ageInput);
	const imageInput = $derived(k.imageInput);
	const ownerInput = $derived(k.ownerInput);
	const passInput = $derived(k.passInput);
	const crnInput = $derived(k.crnInput);
	const dnsInput = $derived(k.dnsInput);
	const error = $derived(k.error);
	const busy = $derived(k.busy);
	const errorKey = $derived(k.errorKey);
	const savedKey = $derived(k.savedKey);
	const vaultAge = $derived(k.vaultAge);
	const placesPending = $derived(k.placesPending);
	const recipient = $derived(k.recipient);
	const ownStep = $derived(k.ownStep);
	const imageKind = $derived(k.imageKind);
	const publicImage = $derived(k.publicImage);
	const affordable = $derived(k.affordable);
	const ownBuilt = $derived(k.ownBuilt);
	const showAleph = $derived(k.showAleph);
	const showFilecoin = $derived(k.showFilecoin);
	const devSteps = $derived(k.devSteps);
	const step = $derived(k.step);
	const backupCoins = $derived(k.backupCoins);
	const o = $derived(k.o);
	const status = $derived(k.status);
	const opened = $derived(k.opened);
	const devOpen = $derived(k.devOpen);
</script>

<section class="setup" data-testid="setup">
	<h2>{x.title}</h2>
	<details class="where" data-testid="setup-where">
		<summary>{x.where.summary}</summary>
		<p>{x.where.sealed.before}<strong>{x.where.sealed.here}</strong>{x.where.sealed.between}<strong>{x.where.sealed.there}</strong>{x.where.sealed.after}</p>
		<p>{x.where.holds}</p>
		<p>{x.where.sees}
			{x.where.more}<a href="https://github.com/Le-Space/paperless-anywhere/blob/main/docs/keys-and-recovery.md#where-the-setup-is-kept" target="_blank" rel="noopener">{x.where.moreLink}</a>{x.where.moreEnd}</p>
	</details>
	{#if busy === 'wallet'}<p class="waiting" data-testid="wallet-waiting">{x.walletWaiting}</p>{/if}
	{#if !loaded}
		<p>{x.loading}</p>
	{:else}
		<div class="overview" data-testid="setup-overview">
			<h4>{o.title}</h4>
			<ul>
				{#each status as row (row.key)}
					<li class:todo={!row.ok} data-testid={`overview-${row.key}`}>
						<span class="mark" aria-hidden="true">{row.ok ? '✓' : '•'}</span>
						<span class="what">{row.label}</span>
						<span class="value">{row.value}</span>
						<button type="button" class="link" onclick={() => goTo(row.key)}>{o.open}</button>
					</li>
				{/each}
			</ul>
		</div>
		{#if !devSteps}{@render networkRole()}{/if}

		<details class="step" id="setup-pays" data-testid="step-pays" bind:open={opened.pays}>
			<summary><h3>{x.pays.title(step.pays)}</h3></summary>
			<fieldset class="payer-choice" disabled={busy === 'pays'}>
				{#if CREDITS_URL}<label><input type="radio" name="pays" checked={Boolean(profile.leSpacePays)} onchange={() => setPays('lespace')} data-testid="pays-lespace" /> {x.pays.lespace}</label>{/if}
				<label><input type="radio" name="pays" checked={!profile.appPays && !profile.leSpacePays} onchange={() => setPays('wallet')} data-testid="pays-wallet" /> {x.pays.wallet}</label>
				<label><input type="radio" name="pays" checked={Boolean(profile.appPays) && !profile.leSpacePays} onchange={() => setPays('app')} data-testid="pays-app" /> {x.pays.app}</label>
			</fieldset>
			{#if CREDITS_URL}
				<details class="self-pay" data-testid="self-pay">
					<summary>{x.pays.self.summary}</summary>
					<p>{x.pays.self.intro}</p>
					<ul>
						<li><strong>{x.pays.self.walletStrong}</strong>{x.pays.self.wallet(step.aleph ?? 2)}</li>
						<li><strong>{x.pays.self.appStrong}</strong>{x.pays.self.app}</li>
					</ul>
					<p>{x.pays.self.after(step.backups)}</p>
				</details>
			{/if}
			{#if profile.leSpacePays}
				<p class="hint" data-testid="lespace-pays">{x.pays.lespaceHint}{profile.vmOwner ? x.pays.vmAccount : ''}{#if profile.vmOwner}<Addr value={profile.vmOwner} />{/if}</p>
			{:else if profile.appPays}
				<p>{x.pays.appAddress}<Addr value={pwaAddress} testid="app-payer" />
					<br /><small class="money">{x.pays.appMoney(Boolean(CREDITS_URL))}</small></p>
				<p class="hint">{x.pays.walletOnlyForBackups(CREDITS_URL ? step.backups : null)}</p>
			{/if}
			{#if profile.payer}
				<p>{profile.appPays ? x.pays.walletForBackups : x.pays.connected}: <Addr value={profile.payer} testid="payer" />
					<br /><small class="money">{profile.appPays ? x.pays.fundsBackups(backupCoins) : x.pays.fundsAll(backupCoins)}{x.pays.keyOnlyWallet}</small></p>
			{/if}
			{@render feedback('pays')}
			<button onclick={connect} disabled={busy === 'wallet'}>{profile.payer ? x.pays.connectOther : profile.appPays ? x.pays.connectForBackups : x.pays.connect}</button>
		</details>

		{#if showAleph}
			<details class="step" id="setup-aleph" data-testid="step-aleph" bind:open={opened.aleph}>
				<summary><h3>{x.aleph.title(step.aleph)}</h3></summary>
				<p>{x.aleph.appKey}<Addr value={pwaAddress} />
					<br /><small class="nomoney">{x.aleph.noFunds}</small></p>
				<p data-testid="aleph-status">{alephOk ? x.aleph.granted : x.aleph.notGranted}</p>
				{#if alephOk}
					<button onclick={() => authorize(true)} disabled={busy === 'wallet'}>{x.aleph.revoke}</button>
				{:else}
					<button onclick={() => authorize()} disabled={busy === 'wallet'}>{x.aleph.grant}</button>
				{/if}
			</details>
		{/if}

		{#if showFilecoin}
			<details class="step" id="setup-filecoin" data-testid="step-filecoin" bind:open={opened.filecoin}>
				<summary><h3>{x.filecoin.title(step.filecoin)}</h3></summary>
				<p>{x.filecoin.sessionKey}<Addr value={sessionAddress} />
					<br /><small class="nomoney">{x.filecoin.noFunds}</small></p>
				<p data-testid="session-status">{until(sessionUntil) ? x.filecoin.validUntil(until(sessionUntil)) : x.filecoin.notGranted}</p>
				{@render feedback('wallet')}
				<button onclick={() => session()} disabled={busy === 'wallet'}>{until(sessionUntil) ? x.filecoin.extend : x.filecoin.grant}</button>
				{#if until(sessionUntil)}<button onclick={() => session(true)} disabled={busy === 'wallet'}>{x.filecoin.revoke}</button>{/if}
			</details>
		{/if}

		{#if !devSteps}{@render relayAndBackups()}{/if}

		<details class="step" id="setup-image" data-testid="step-image" bind:open={opened.image}>
			<summary><h3>{x.image.title(step.image)}</h3></summary>
			{#if BUILDER}
				<fieldset class="image-choice" data-testid="image-choice">
					<legend>{$t.ownImage.choice.legend}</legend>
					<label><input type="radio" bind:group={k.imageKind} value="own" onchange={() => (k.imageKindPicked = true)} data-testid="image-own" /> {$t.ownImage.choice.own}<br /><small>{$t.ownImage.choice.ownHint}</small></label>
					<label><input type="radio" bind:group={k.imageKind} value="public" onchange={() => ((k.imageKindPicked = true), choosePublic())} data-testid="image-public" /> {$t.ownImage.choice.public}<br /><small>{$t.ownImage.choice.publicHint}</small></label>
					<details class="more"><summary>{x.more}</summary><p class="hint">{$t.ownImage.choice.publicWhy}</p></details>
				</fieldset>
			{/if}
			{#if BUILDER && publicImage}
				<p class="tip" data-testid="own-image-tip">{$t.ownImage.tip}</p>
				<p class="warn-line" data-testid="public-limits">{profile.role === 'primary' ? $t.ownImage.choice.primaryNeedsOwn : $t.ownImage.choice.publicLimits}</p>
			{/if}
			{#if publicImage}
				<label>{x.image.hash}<input bind:value={k.imageInput} placeholder={x.image.hashPlaceholder} data-testid="image-hash" /></label>
			{/if}
			<label>{x.image.node}<input bind:value={k.crnInput} placeholder={x.image.nodePlaceholder} /></label>
			{#if publicImage}
				<label>{x.image.pass}<input bind:value={k.passInput} type="password" autocomplete="off" data-testid="image-passphrase" placeholder={profile.luksPassphrase && !ownBuilt ? x.image.passKept(profile.luksPassphrase.length) : x.image.pass} /></label>
			{/if}
			<button onclick={saveImage} disabled={busy === 'image'}>{publicImage ? x.image.saveBoth : x.image.saveNode}</button>
			{@render feedback('image')}
			{#if BUILDER && !publicImage}
				<div class="own-image" data-testid="own-image">
					{#if !ownBuilt && buildsImageFirst(profile, BUILDER)}<p class="hint" data-testid="own-image-at-start">{$t.ownImage.choice.builtAtStart}</p>
					{:else if !ownBuilt}<p class="warn" data-testid="own-image-not-built">{$t.ownImage.choice.notBuilt}</p>{/if}
					<details class="more"><summary>{x.more}</summary><p class="hint">{$t.ownImage.intro.before}<Addr value={pwaAddress} />{$t.ownImage.intro.after}</p></details>
					<details class="sources" data-testid="own-image-sources">
						<summary>{$t.ownImage.sourcesFold}</summary>
						<p class="hint">{$t.ownImage.sourcesHint}</p>
						<dl>
							{#each sources(BUILDER, $t.ownImage.sources) as row}
								<dt>{row.label}</dt>
								<dd>{#if row.href}<a href={row.href} target="_blank" rel="noreferrer"><code>{row.value}</code></a>{:else}<code>{row.value}</code>{/if}</dd>
							{/each}
						</dl>
					</details>
					{#if ownBuilt}<p class="saved" data-testid="own-image-have">{$t.ownImage.have(format.date(profile.ownImage.builtAt, undefined, $lang))}</p>{/if}
					{#if profile.oldOwnImages?.length}<p class="hint" data-testid="old-images">{$t.ownImage.oldPending(profile.oldOwnImages.length)} <button class="link" onclick={removeOldImages} disabled={busy === 'old-images'} data-testid="old-images-remove">{$t.ownImage.oldRemove}</button></p>{/if}{@render feedback('old-images')}
					{#if affordable === null}<p class="hint" data-testid="own-image-checking">{$t.ownImage.choice.checking}</p>
					{:else if affordable.ok === false && affordable.reason}<p class="error alert" role="alert" data-testid="own-image-package-no">{affordable.reason}{#if affordable.short} <a href="#paket">{$t.ownImage.choice.toTopUp}</a>{/if} <button class="link" onclick={() => refreshBalances()} data-testid="own-image-recheck">{$t.ownImage.choice.recheck}</button></p>
					{:else if affordable.ok === false}<p class="error alert" role="alert" data-testid="own-image-needs-credits">{$t.ownImage.choice.needsCredits(format.number(affordable.need ?? 0, undefined, $lang), format.number(affordable.have ?? 0, undefined, $lang))} <button class="link" onclick={() => refreshBalances()} data-testid="own-image-recheck">{$t.ownImage.choice.recheck}</button></p>
					{:else}{#if affordable.included}<p class="hint" data-testid="own-image-price">{$t.ownImage.choice.included}</p>{:else if affordable.price != null}<p class="hint" data-testid="own-image-price">{$t.ownImage.choice.price(format.euro(affordable.price, $lang))}</p>{/if}<button onclick={buildImage} data-testid="own-image-build" disabled={busy === 'own-image' || Boolean(profile.running)}>{ownBuilt ? $t.ownImage.rebuild : $t.ownImage.build}</button>{/if}
					{#if profile.running}<p class="hint">{$t.ownImage.whileRunning}</p>{/if}
					{#if busy === 'own-image' && ownStep}<p class="hint" role="status" data-testid="own-image-step">{ownStep} …</p>{/if}
					{@render feedback('own-image')}
				</div>
			{/if}
		</details>

		<details class="step" id="setup-address" data-testid="step-address" bind:open={opened.address}>
			<summary><h3>{x.address.title(step.address)}</h3></summary>
			<p class="hint">{x.address.hint.before(FIXED_HOST_DOMAIN.split('.').slice(-2).join('.'))}<code>{fixedHostLabel(master)}.{FIXED_HOST_DOMAIN}</code>{x.address.hint.between}<code>*.2n6.me</code>{x.address.hint.after}</p>
			<label>{x.address.token}<input bind:value={k.dnsInput} type="password" autocomplete="off" data-testid="dns-token" placeholder={profile.dnsToken ? x.address.tokenKept : x.address.token} /></label>
			<button onclick={saveDns} disabled={busy === 'dns'}>{profile.dnsToken && !dnsInput.trim() ? x.address.remove : x.address.save}</button>
			{@render feedback('dns')}
		</details>
		{#if devSteps}
			<!-- Le Space pays: network, role, relay and backup details stay reachable, folded. -->
			<details class="dev" data-testid="dev-fold" bind:open={k.devOpen}>
				<summary>{x.devFold(profile.network === 'mainnet' ? x.network.main : x.network.test)}</summary>
				{@render networkRole()}
				{@render relayAndBackups()}
			</details>
		{/if}
	{/if}
	{#if error && !errorKey}<p class="error" role="alert">{error}</p>{/if}
</section>

{#snippet relayAndBackups()}
	<details class="step" id="setup-relay" data-testid="step-relay" bind:open={opened.relay}>
		<summary><h3>{titled(x.relay.title, step.relay)}</h3></summary>
	<details class="more"><summary>{x.more}</summary><p class="hint">{x.relay.hint}</p></details>
	<p data-testid="relays-found">{x.relay.found}{#if foundRelays === null}…{:else if foundRelays.length}{#each foundRelays as relay, i (relay)}{i ? ', ' : ''}<code>{relay}</code>{/each}{:else}{x.relay.none}{/if}</p>
	<label>{x.relay.own.before}<code>wss://…/attest</code>{x.relay.own.or}<code>/dns4/…/p2p/…</code>{x.relay.own.after}
		<textarea bind:value={k.relayInput} rows="3" autocomplete="off" spellcheck="false" placeholder={x.relay.placeholder} data-testid="relays"></textarea></label>
	<button onclick={saveRelay} disabled={busy === 'relay'}>{relayInput.trim() || !profile.attestRelay ? x.relay.save : x.relay.remove}</button>
	{@render feedback('relay')}
	</details>
	<details class="step" id="setup-backups" data-testid="step-backups" bind:open={opened.backups}>
		<summary><h3>{titled(x.backups.title, step.backups)}</h3></summary>
	{#if CREDITS_URL}
		<fieldset class="payer-choice" disabled={busy === 'bycredits'} data-testid="backups-paid-by">
			<label><input type="radio" name="bypay" checked={!profile.backupsByCredits} onchange={() => setBackupsByCredits(false)} data-testid="backups-wallet" /> {x.backups.byWallet(showFilecoin ? step.filecoin : null)}</label>
			<label><input type="radio" name="bypay" checked={Boolean(profile.backupsByCredits)} onchange={() => setBackupsByCredits(true)} data-testid="backups-credits" /> {x.backups.byCredits}</label>
		</fieldset>
		{#if profile.backupsByCredits}
			<p>{x.backups.vmKey}<Addr value={backupKey} testid="backup-key" />
				<br /><small class="nomoney">{x.backups.vmKeyHint}</small></p>
			<p data-testid="credits-backup-state">{#if backupState === undefined}…{:else if !backupState}{x.backups.notPaying}{:else}{fundedUntil(backupState.fundedUntil) ? x.backups.paidUntil(fundedUntil(backupState.fundedUntil)) : x.backups.notPaid} · {x.backups.dataSets(backupState.dataSets.length)} · {x.backups.vmKeyState(Boolean(profile.backupSigner?.payer))}{/if}</p>
			<button onclick={payBackups} disabled={busy === 'bycredits'} data-testid="pay-backups">{x.backups.payMonth}</button>
			<br /><small class="hint" data-testid="pay-backups-hint">{x.backups.payHint}</small>
			{#if !profile.backupSigner?.payer}<button onclick={authorizeBackupKey} disabled={busy === 'bycredits'} data-testid="authorize-backup-key">{x.backups.authorizeKey}</button>{/if}
			{@render feedback('bycredits')}
		{/if}
	{/if}
	<label>{x.backups.owner}<input bind:value={k.ownerInput} placeholder={x.backups.ownerPlaceholder(profile.payer ? profile.payer.slice(0, 10) : null)} /></label>
	<button onclick={saveOwner} disabled={busy === 'owner'}>{x.backups.saveOwner}</button>
	{@render feedback('owner')}
	<details class="more"><summary>{x.more}</summary><p>{x.backups.ageIntro}</p></details>
	<p data-testid="age-status">{!profile.ageIdentity ? x.backups.age.none : profile.ageIdentity === vaultAge ? x.backups.age.vault : x.backups.age.pasted}</p>
	{#if recipient}<p><small>{x.backups.recipient}<Addr value={recipient} testid="age-recipient" /></small></p>{/if}
	{#if profile.ageIdentity !== vaultAge}<button onclick={useVaultAge} disabled={busy === 'age'}>{x.backups.useVault}</button>{/if}
	<details>
		<summary>{x.backups.paste}</summary>
		<textarea bind:value={k.ageInput} rows="2" autocomplete="off" spellcheck="false" placeholder="AGE-SECRET-KEY-1…"></textarea>
		<button onclick={saveAge} disabled={busy === 'age' || !ageInput.trim()}>{x.backups.seal}</button>
	</details>
	{@render feedback('age')}
	<label class="check">
		<input type="checkbox" data-testid="backups-on" checked={!!profile.backupConfig} disabled={busy === 'backups' || (!profile.backupConfig && profile.network === 'mainnet' && profile.role !== 'primary')}
			onchange={(e) => toggleBackups(e.currentTarget.checked)} />
		<span>{x.backups.on.before(profile.network === 'mainnet')}<code>{BACKUP_LABEL[profile.network === 'mainnet' ? 'mainnet' : 'calibration']}</code>{x.backups.on.after}</span>
	</label>
	{#if profile.backupConfig}
		<BackupPlaces network={profile.network} payer={profile.backupOwner || (profile.backupsByCredits ? '' : profile.payer)} config={profile.backupConfig} busy={busy === 'places'} incrementalReady={supportsIncremental(profile)} onsave={savePlaces} />
		{#if profile.running}
			<div class="push-places" class:pending={placesPending} data-testid="places-push-box">
				<p>{placesPending ? $t.backup.places.pushPending : $t.backup.places.pushHint}</p>
				<button onclick={pushPlaces} disabled={busy === 'places-push'} data-testid="places-push">{$t.backup.places.push}</button>
			</div>
			{@render feedback('places-push')}
		{/if}
	{/if}
	{@render feedback('backups')}{@render feedback('places')}
	{#if profile.network === 'mainnet' && profile.role !== 'primary'}<p class="hint" data-testid="mainnet-backup-hint">{x.backups.mainnetHint}</p>
	{:else if profile.backupConfig && profile.backupsByCredits && (!profile.backupSigner?.payer || (backupState && !fundedUntil(backupState.fundedUntil)))}<p class="hint" data-testid="credits-backup-hint">{x.backups.creditsHint}</p>
	{:else if profile.backupConfig && !profile.backupsByCredits && !until(sessionUntil)}<p class="hint">{x.backups.sessionHint(step.filecoin)}</p>{/if}
	</details>
{/snippet}

{#snippet networkRole()}
	<label>
		{x.network.label}
		<select value={profile.network} onchange={(e) => changeNetwork(e.currentTarget.value)} disabled={busy === 'wallet'}>
			<option value="calibration">{x.network.test}</option>
			<option value="mainnet">{x.network.main}</option>
		</select>
	</label>

	<fieldset class="role" disabled={busy === 'role'} data-testid="role">
		<legend>{x.role.legend}</legend>
		<label><input type="radio" name="role" value="test" checked={profile.role !== 'primary'} onchange={() => setRole('test')} data-testid="role-test" /> {x.role.test}</label>
		<label><input type="radio" name="role" value="primary" checked={profile.role === 'primary'} onchange={(e) => setRole('primary', e.currentTarget)} data-testid="role-primary" /> {x.role.primary}</label>
		{#if profile.role === 'primary'}
			<p class="warn" data-testid="role-warning">{x.role.warning}{#if profile.network !== 'mainnet'}{x.role.needsMainnet}{/if}</p>
		{/if}
	</fieldset>
	{@render feedback('network')}{@render feedback('role')}
{/snippet}

{#snippet feedback(/** @type {string} */ key)}
	{#if error && errorKey === key}<p class="error alert" role="alert" data-testid={`error-${key}`}>{error}</p>
	{:else if savedKey === key}<p class="saved" data-testid={`saved-${key}`}>{x.saved}</p>{/if}
{/snippet}

<style>
	.sources { margin: 0.25rem 0 0.75rem; font-size: 0.9rem; }
	.sources summary { cursor: pointer; }
	.sources dt { color: var(--text-2); margin-top: 0.5rem; }
	.sources dd { margin: 0; overflow-wrap: anywhere; }
	.dev { margin: 0.25rem 0 0.75rem; }
	.dev summary { cursor: pointer; color: var(--text-2); }
	.image-choice { border: none; padding: 0; margin: 0 0 0.75rem; }
	.image-choice label { display: block; margin: 0.25rem 0; }
	/* The radio before its label, not stretched above it like the text inputs. */
	.image-choice input[type='radio'] { width: auto; margin: 0 0.4rem 0 0; vertical-align: middle; }
	.own-image { margin-top: 1rem; padding-top: 0.75rem; border-top: 1px solid var(--line); }
	.self-pay { margin: 0.25rem 0 0.75rem; font-size: 0.95rem; color: var(--text-2); }
	.self-pay summary { cursor: pointer; }
	.self-pay ul { padding-left: 1.2rem; }
	.setup { margin: 0 0 1rem; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow); padding: 1.25rem; }
	h3 { margin-top: 1.5rem; font-size: 1rem; }
	select, input, textarea { width: 100%; font-size: 1rem; }
	button { display: block; margin: 0.5rem 0; padding: 0.5rem 1rem; font-size: 1rem; }
	code { word-break: break-all; }
	label.check { display: flex; gap: 0.5rem; align-items: baseline; color: var(--text); font-size: 1rem; }
	label.check input { width: auto; }
	.money { color: var(--ok); }
	.nomoney { color: var(--warn); }
	.hint { color: var(--text-2); font-size: 0.9rem; }
	label { display: block; margin-top: 0.5rem; font-size: 0.9rem; color: var(--text-2); }
	.role { border: 1px solid var(--line); border-radius: 4px; padding: 0.4rem 0.75rem; margin: 0.5rem 0 1rem; display: grid; gap: 0.25rem; }
	.role input { width: auto; margin-right: 0.4rem; }
	.role .warn { color: var(--warn); margin: 0.25rem 0 0; font-size: 0.9rem; }
	.saved { color: var(--ok); font-size: 0.9rem; margin: 0.25rem 0; }
	.payer-choice { border: none; padding: 0; margin: 0 0 0.5rem; display: grid; gap: 0.25rem; }
	/* The page sizes inputs to full width; a radio keeps its own size beside its label. */
	.payer-choice input { width: auto; margin-right: 0.4rem; }
	.where { margin: 0.5rem 0 1rem; font-size: 0.9rem; color: var(--text-2); }
	.where summary { cursor: pointer; }
	.waiting { background: var(--warn-bg); padding: 0.5rem 0.75rem; border-radius: 4px; }
	.error { color: var(--danger); }
	/* A message that must not go unseen: framed, tinted, like a callout. */
	.alert { border: 1px solid var(--danger); border-left-width: 4px; border-radius: var(--radius-sm, 6px); padding: 0.6rem 0.8rem; background: color-mix(in srgb, var(--danger) 8%, transparent); }
	.overview { margin: 0.5rem 0 1rem; padding: 0.6rem 0.8rem; border: 1px solid var(--line); border-radius: var(--radius-sm, 6px); }
	.overview h4 { margin: 0 0 0.4rem; font-size: 0.95rem; }
	.overview ul { list-style: none; margin: 0; padding: 0; display: grid; gap: 0.25rem; }
	.overview li { display: grid; grid-template-columns: 1.2rem minmax(7rem, auto) 1fr auto; gap: 0.5rem; align-items: baseline; font-size: 0.92rem; }
	.overview .mark { color: var(--ok); }
	.overview li.todo .mark, .overview li.todo .value { color: var(--warn); }
	.overview .what { color: var(--text-2); }
	.overview .link { font-size: 0.85rem; color: var(--text-2); }
	@media (max-width: 480px) { .overview li { grid-template-columns: 1.2rem 1fr auto; } .overview .value { grid-column: 2 / 3; } }
	.step { border-top: 1px solid var(--line); padding: 0.25rem 0 0.5rem; }
	.step > summary { cursor: pointer; }
	.step > summary h3 { display: inline; margin: 0; font-size: 1rem; }
	.step[open] > summary { margin-bottom: 0.5rem; }
	.step > summary { padding: 0.6rem 0; }
	.more { margin: 0.25rem 0 0.5rem; font-size: 0.9rem; color: var(--text-2); }
	.more summary { cursor: pointer; }
	.tip { margin: 0 0 0.75rem; padding: 0.5rem 0.75rem; border-left: 3px solid var(--ok); background: color-mix(in srgb, var(--ok) 8%, transparent); border-radius: var(--radius-sm, 6px); font-size: 0.92rem; }
	.warn-line { color: var(--warn); font-size: 0.9rem; margin: 0 0 0.75rem; }
	.push-places { margin: 0.5rem 0; }
	.push-places p { margin: 0.25rem 0; font-size: 0.9rem; color: var(--text-2); }
	.push-places.pending { padding: 0.6rem 0.8rem; border: 1px solid var(--accent, var(--ok)); border-left-width: 4px; border-radius: var(--radius-sm, 6px); background: var(--warn-bg); }
	.push-places.pending p { color: var(--text); font-weight: 600; }
	.link { background: none; border: none; color: inherit; text-decoration: underline; padding: 0; font: inherit; cursor: pointer; }
</style>
