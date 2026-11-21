<script>
	import RefreshBalances from '$lib/RefreshBalances.svelte';
	import FirstStart from '$lib/FirstStart.svelte';
	import Storage from '$lib/Storage.svelte';
	import HourQuote from '$lib/HourQuote.svelte';
	import BackupExport from '$lib/BackupExport.svelte';
	import BackupNow from '$lib/BackupNow.svelte';
	import TrialRestore from '$lib/TrialRestore.svelte';
	import ProviderHealth from '$lib/ProviderHealth.svelte';
	import BackupChain from '$lib/BackupChain.svelte';
	import Evidence from '$lib/Evidence.svelte';
	import StartPanel from '$lib/StartPanel.svelte';
	import { createLifecycleCard } from '$lib/lifecycle-card.svelte.js';
	import { backupListing, loadProfile } from '$lib/profile.js';
	import { BUILDER, hasOwnImage } from '$lib/own-image.js';
	import { CREDITS_URL } from '$lib/credits.js';
	import { purchaseLocked } from '$lib/purchase.js';
	import { backupSize, place } from '$lib/backups.js';
	import { format, lang as appLanguage, t as i18n } from '$lib/i18n/index.js';
	import { httpsUrl } from '$lib/evidence.js';

	/** @type {{ master: Uint8Array, simple?: boolean, version?: number, onchange?: () => void, onadvanced?: () => void, onmissing?: (missing: string[]) => void, onglance?: (g: Glance) => void, onbusy?: (busy: boolean) => void, oncopies?: (c: { network: string, copies: { providerId: number, url?: string }[], wanted: number | null }) => void, reach?: import('$lib/backup-status.js').Level, onpackage?: () => void }} onpackage: shows the package where it is not on the same page; reach: the "Sicherungen erreichbar" light; oncopies: the newest backup's copies, for the lights */
	let { master, simple = false, version = 0, onchange = () => {}, onadvanced = () => {}, onmissing = () => {}, onglance = () => {}, onbusy = () => {}, oncopies = () => {}, reach = 'unknown', onpackage = undefined } = $props();
	/** @typedef {{ phase: string, host: string | null, lastGood: { at: string, copies: number | null } | null, backupsOn: boolean, pays: 'lespace' | 'app' | 'wallet' | null, fixedHost: boolean }} Glance */

	// What happens is in lifecycle-card.svelte.js; this component draws it.
	const k = createLifecycleCard({
		get master() { return master; },
		get version() { return version; },
		onchange: () => onchange(),
		onmissing: (m) => onmissing(m),
		onglance: (g) => onglance(g),
		onbusy: (b) => onbusy(b),
		oncopies: (c) => oncopies(c),
		get onpackage() { return onpackage; }
	});
	const { showCertificate, STEPS, typicalOf, minutes, goodWhen, rememberGood, checkAgain, pick, unmarkedPick, whenOf, wherePlaces, sizePart, copyPassword, startFromPackage, purchase, askToBuy, start, startWithoutBackup, startOnOldImage, rebuildBeforeStart, toPackage, rebuildImage, resume, startPrevious, discard, checkPlacesThen, acceptPlaces, placesAnyway, stop, discardFailed, answer, eraseAnyway, keepVm } = k;
	const profile = $derived(k.profile);
	const progress = $derived(k.progress);
	const ceremony = $derived(k.ceremony);
	const times = $derived(k.times);
	const error = $derived(k.error);
	const goneNote = $derived(k.goneNote);
	const nodeNote = $derived(k.nodeNote);
	const errorRaw = $derived(k.errorRaw);
	const again = $derived(k.again);
	const errorLog = $derived(k.errorLog);
	const fromStop = $derived(k.fromStop);
	const lastGood = $derived(k.lastGood);
	const newerOnChain = $derived(k.newerOnChain);
	const goodStale = $derived(k.goodStale);
	const evidenceT = $derived(k.evidenceT);
	const evidence = $derived(k.evidence);
	const panelT = $derived(k.panelT);
	const startShown = $derived(k.startShown);
	const stopShown = $derived(k.stopShown);
	const panel = $derived(k.panel);
	const panelShownT = $derived(k.panelShownT);
	const stopEvidence = $derived(k.stopEvidence);
	const healthIds = $derived(k.healthIds);
	const partial = $derived(k.partial);
	const busy = $derived(k.busy);
	const backingUp = $derived(k.backingUp);
	const backups = $derived(k.backups);
	const backupsError = $derived(k.backupsError);
	const choice = $derived(k.choice);
	const split = $derived(k.split);
	const unmarkedAccepted = $derived(k.unmarkedAccepted);
	const production = $derived(k.production);
	const chosenBackup = $derived(k.chosenBackup);
	const unmarkedOpen = $derived(k.unmarkedOpen);
	const chainBackup = $derived(k.chainBackup);
	const known = $derived(k.known);
	const gap = $derived(k.gap);
	const gapKey = $derived(k.gapKey);
	const gapAccepted = $derived(k.gapAccepted);
	const gapOpen = $derived(k.gapOpen);
	const showPassword = $derived(k.showPassword);
	const adminPassword = $derived(k.adminPassword);
	const short = $derived(k.short);
	const fundHours = $derived(k.fundHours);
	const packageHours = $derived(k.packageHours);
	const fromPackage = $derived(k.fromPackage);
	const buying = $derived(k.buying);
	const bought = $derived(k.bought);
	const unpaidBackup = $derived(k.unpaidBackup);
	const oldImage = $derived(k.oldImage);
	const stopChecking = $derived(k.stopChecking);
	const placesAsk = $derived(k.placesAsk);
	const restoreFailed = $derived(k.restoreFailed);
	const periodEnded = $derived(k.periodEnded);
	const image = $derived(k.image);
	const missing = $derived(k.missing);
	const c = $derived(k.c);
	const phase = $derived(k.phase);
	const CHIPS = $derived(k.CHIPS);
	const TITLES = $derived(k.TITLES);
	const backupsPending = $derived(k.backupsPending);
	const panelTook = $derived(k.panelTook);
	const panelTotal = $derived(k.panelTotal);
	const share = $derived(k.share);
	const leftMinutes = $derived(k.leftMinutes);
	const stepLabel = $derived(k.stepLabel);
</script>

{#snippet placesBox()}
	{#if placesAsk}
		<div class="warn-box" role="alert" data-testid="places-ask">
			{#if placesAsk.blocked}<p data-testid="places-blocked">{c.places.blocked(placesAsk.blocked.names.join(', '), placesAsk.blocked.why)}</p>{/if}
			{#if placesAsk.names.length}<p>{c.places.down(placesAsk.names.join(', '))}</p>{/if}
			{#if placesAsk.plan}
				<ul>{#each placesAsk.plan.replaced as r (r.from.id)}<li>{r.to ? c.places.instead(`${r.from.id} ${r.from.name ?? ''}`.trim(), `${r.to.id} ${r.to.name}${r.to.place ? `, ${r.to.place}` : ''}`) : c.places.none(`${r.from.id} ${r.from.name ?? ''}`.trim())}</li>{/each}</ul>
				<p class="hint">{placesAsk.blocked && !placesAsk.names.length ? c.places.blockedHint : c.places.hint}</p>
			{:else}
				<p class="hint">{c.places.noReplacement}</p>
			{/if}
			<div class="row">
				{#if placesAsk.blocked && !placesAsk.names.length}
					{#if placesAsk.plan}<button onclick={acceptPlaces} disabled={busy} data-testid="places-accept">{c.places.acceptOnly}</button>{/if}
					<button class="quiet" onclick={() => (k.placesAsk = null)} data-testid="places-cancel">{c.places.later}</button>
				{:else}
					{#if placesAsk.plan}<button onclick={acceptPlaces} disabled={busy} data-testid="places-accept">{c.places.accept}</button>{/if}
					<button class="secondary" onclick={placesAnyway} disabled={busy} data-testid="places-anyway">{placesAsk.allDown ? c.places.tryAnyway : c.places.goOn}</button>
					<button class="quiet" onclick={() => (k.placesAsk = null)} data-testid="places-cancel">{c.places.cancel}</button>
				{/if}
			</div>
		</div>
	{/if}
{/snippet}

{#snippet errorBox()}
	<div class="error" role="alert" data-testid="start-error">
		<p class="error-text">{error}</p>
		{#if errorRaw}<details class="raw"><summary>{$i18n.net.details}</summary><pre>{errorRaw}</pre></details>{/if}
		{#if again}<div class="row"><button onclick={() => again?.()} disabled={busy} data-testid="error-again">{$i18n.net.again}</button></div>{/if}
	</div>
{/snippet}

{#snippet fundOffer()}
	{@const locked = busy || purchaseLocked(buying)}
	<p class="hint"><RefreshBalances label={$i18n.funds.toppedUp} testid="short-refresh" /></p>
	{#if fromPackage}
		<div class="fund" data-testid="package-offer">
			<p class="hint">{c.fund.inPackage(packageHours ?? 0)}</p>
			<button onclick={startFromPackage} disabled={locked} data-testid="start-from-package">{c.fund.startFromPackage(packageHours ?? 0)}</button>
		</div>
	{:else}
	<div class="fund" data-testid="fund-offer">
		<label>{c.fund.buyLabel}
			<select bind:value={k.fundHours} disabled={locked} data-testid="fund-hours">{#each [5, 10, 30] as h (h)}<option value={h}>{h} h</option>{/each}</select></label>
		<button onclick={askToBuy} disabled={locked} data-testid="fund-start">{buying.phase === 'quoting' ? c.fund.quoting : c.fund.buyAndStart}</button>
	</div>
	<HourQuote quote={buying.phase === 'open' ? buying.quote : null} short={buying.phase === 'short'} hoursAsked={buying.hours} topUpHint={c.fund.topUpHint} confirmLabel={c.fund.buyAndStart} disabled={busy || buying.phase === 'buying'} onconfirm={() => purchase.confirm()} oncancel={() => purchase.cancel()} />
	{#if buying.error}<p class="error" role="alert" data-testid="fund-error">{buying.error}</p>{/if}
	{/if}
{/snippet}

{#snippet oldImageQuestion()}
	{#if oldImage}
		<div class="warn gap" role="alertdialog" aria-label={c.oldImage.label} data-testid="start-old-image">
			<p><strong>{c.oldImage.strong}</strong> {c.oldImage.text}</p>
			<p class="row">
				<button class="secondary" onclick={rebuildBeforeStart} disabled={busy} data-testid="start-rebuild-first">{c.oldImage.rebuild}</button>
				<button class="quiet" onclick={startOnOldImage} disabled={busy} data-testid="start-old-image-anyway">{c.oldImage.anyway}</button>
				<button class="quiet" onclick={() => (k.oldImage = false)}>{c.oldImage.cancel}</button>
			</p>
		</div>
	{/if}
{/snippet}

{#snippet unpaidQuestion()}
	{#if unpaidBackup}
		<div class="warn gap" role="alertdialog" aria-label={c.unpaid.label} data-testid="start-unpaid-backup">
			<p><strong>{c.unpaid.strong}</strong> {c.unpaid.text}</p>
			<p class="row">
				<button class="secondary" onclick={toPackage} data-testid="start-book-backup">{c.unpaid.book}</button>
				<button class="quiet" onclick={startWithoutBackup} disabled={busy} data-testid="start-without-backup">{c.unpaid.without}</button>
				<button class="quiet" onclick={() => (k.unpaidBackup = false)}>{c.unpaid.cancel}</button>
			</p>
		</div>
	{/if}
{/snippet}

{#snippet superusersWarning()}
	{#if profile.running?.restore?.empty === true}<p class="warn" role="alert" data-testid="restore-empty">{c.restoreEmpty}</p>{/if}
	{#if Number(profile.running?.restore?.superusers) > 0}<p class="warn" data-testid="restore-superusers">{c.superusers(Number(profile.running?.restore?.superusers))}</p>{/if}
{/snippet}

{#snippet unmarkedWarning()}
	{#if k.chosenUnmarked && chosenBackup}
		<div class="warn gap" data-testid="restore-unmarked">
			<p>{c.unmarked.text(chosenBackup.pieceCid.slice(-12), whenOf(chosenBackup))}</p>
			<label><input type="checkbox" data-testid="restore-unmarked-accept" checked={!unmarkedOpen} onchange={(e) => (k.unmarkedAccepted = e.currentTarget.checked ? (chosenBackup?.pieceCid ?? '') : '')} /> {c.unmarked.accept}</label>
		</div>
	{/if}
{/snippet}

{#snippet gapWarning()}
	{#if gap}
		<div class="warn gap" data-testid="restore-gap">
			<p>
				{#if gap === 'missing'}{c.gap.missing(known?.slice(-12) ?? '', lastGood?.pieceCid === known && lastGood?.at ? c.dated(format.dateTime(lastGood.at, undefined, $appLanguage)) : '', Boolean(chosenBackup))}
				{:else}{c.gap.older(known?.slice(-12) ?? '')}{/if}
				{c.gap.later}
			</p>
			<label><input type="checkbox" data-testid="restore-gap-accept" checked={!gapOpen} onchange={(e) => (k.gapAccepted = e.currentTarget.checked ? gapKey : '')} /> {c.gap.accept}</label>
		</div>
	{/if}
{/snippet}

{#if ceremony}
	<FirstStart
		view={ceremony}
		startTypical={STEPS.start.reduce((a, s) => a + typicalOf(s), 0)}
		host={profile.running?.host ?? null}
		ownImage={profile.ownImage ?? null}
		imageHash={profile.rootfsItemHash ?? null}
		plain={BUILDER?.plain ?? null}
		onminimize={() => (k.ceremony = ceremony && { ...ceremony, minimized: true })}
		onexpand={() => (k.ceremony = ceremony && { ...ceremony, minimized: false })}
		oncertificate={(show) => (k.ceremony = !ceremony ? null : !show && ceremony.only ? null : { ...ceremony, certificate: show })}
		onclose={() => (k.ceremony = null)}
	/>
{/if}
<section class="lifecycle" class:simple data-testid="lifecycle">
	{#if simple}
		<div class="status is-{phase}" data-testid="simple-status">
			<span class="dot" aria-hidden="true"></span>
			<div>
				<h1>{TITLES[phase]}</h1>
				{#if phase === 'off'}<p class="sub">{c.simple.startTakes(minutes(STEPS.start.reduce((a, s) => a + typicalOf(s), 0)))}</p>
				{:else if phase === 'starting'}<p class="sub">{c.simple.keepOpenStart}</p>
				{:else if phase === 'stopping' || phase === 'discarding'}<p class="sub">{c.simple.keepOpenStop}</p>
				{:else if phase === 'running'}<p class="sub data">{profile.running.host}</p>
				{:else if phase === 'interrupted'}<p class="sub">{c.simple.interruptedCosts}</p>{/if}
				{#if BUILDER}
					<!-- Which image: the vault's own (and whether a newer version is there), built at the first start, or the public one. -->
					<p class="image-line" data-testid="image-line">
						{#if image.own}{$i18n.ownImage.overview.built(format.date(image.builtAt ?? Date.now(), undefined, $appLanguage))}
							{#if image.newer}{' '}<span data-testid="image-newer">{$i18n.ownImage.overview.newer}</span>
								{#if phase === 'off'}{' '}<button class="link" onclick={rebuildImage} disabled={busy} data-testid="image-rebuild">{$i18n.ownImage.overview.rebuild}</button>
								{:else}{' '}<span class="hint">{$i18n.ownImage.overview.rebuildStopped}</span>{/if}
							{/if}
						{:else if image.buildsAtStart}<span data-testid="first-build">{c.simple.firstBuild}</span>
						{:else}{$i18n.ownImage.overview.publicImage}{/if}
					</p>
				{/if}
				{#if profile.backupConfig}
					<!-- The answer people look for first: when the documents were last safe. -->
					<p class="good" class:stale={goodStale} data-testid="last-good-backup">{#if lastGood}{fromStop ? c.simple.lastAtStop : c.simple.lastGood}: <strong>{goodWhen(lastGood.at)}</strong>{lastGood.copies ? ` · ${c.simple.copies(lastGood.copies)}` : ''}{#if newerOnChain}<br /><span data-testid="newer-on-chain">{c.simple.newerOnChain(c.simple.copies(backups?.[0]?.copies.length ?? 0))}</span>{/if}{:else}{c.simple.noneKnown}{/if}</p>
				{/if}
			</div>
		</div>

		{#if phase === 'starting' || phase === 'stopping' || phase === 'discarding'}
			<div class="meter" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow={Math.round(share * 100)} aria-label={TITLES[phase]}><span style="width: {Math.round(share * 100)}%"></span></div>
			<p class="calm" data-testid="simple-progress">{c.simple.left(stepLabel, leftMinutes)}</p>
			{#if startShown || stopShown}<StartPanel rows={panel} t={panelShownT} times={panelTook} total={panelTotal} testid={stopShown ? 'stop-panel' : 'start-panel'} />{/if}
		{:else if phase === 'running'}
			<a class="cta" href={`https://${profile.running.host}/`} target="_blank" rel="noopener" data-testid="simple-open">{c.simple.open}</a>
			{@render superusersWarning()}
			{#if profile.running.restore?.status === 'failed'}<p class="error">{c.simple.restoreFailed}</p>{/if}
			<div class="login" data-testid="simple-login">
				<p class="label">{c.simple.login}</p>
				<p>{c.simple.user} <code>admin</code></p>
				<p>{c.simple.password} {#if showPassword}<code data-testid="simple-password">{adminPassword}</code>{:else}<code>••••••••</code>{/if}</p>
				<div class="row">
					<button type="button" class="small" onclick={() => (k.showPassword = !showPassword)}>{showPassword ? c.simple.hide : c.simple.show}</button>
					<button type="button" class="small" onclick={copyPassword}>{c.simple.copy}</button>
				</div>
			</div>
			{#if profile.backupConfig && !restoreFailed}<BackupNow {master} {profile} known={lastGood} disabled={busy || stopChecking} guard={checkPlacesThen} onbusy={(b) => (k.backingUp = b)} ongood={rememberGood} />{/if}
			<Evidence rows={evidence} t={evidenceT} onagain={busy ? null : checkAgain} />
			{#if restoreFailed}<button class="secondary stop" onclick={discardFailed} disabled={busy} data-testid="simple-discard">{c.simple.discard}</button>
			{:else}
				{#if reach === 'bad'}<p class="warn" role="status" data-testid="stop-reach-bad">{c.simple.stopReachBad}</p>{/if}
				<button class="secondary stop" onclick={stop} disabled={busy || backingUp || stopChecking} data-testid="simple-stop">{c.simple.stop}</button>
				{#if stopChecking}<p class="hint" role="status" data-testid="stop-checking">{c.simple.stopChecking}</p>{/if}
			{/if}
			<Storage {master} {profile} />
			{#if profile.ageIdentity && backupListing(profile)}<TrialRestore {master} {profile} listing={backupListing(profile)} onchange={async () => { k.profile = await loadProfile(master); onchange(); }} />{/if}
		{:else if phase === 'interrupted'}
			<button class="cta" onclick={resume} disabled={busy} data-testid="simple-resume">{c.simple.resume}</button>
			<button class="quiet" onclick={discard} disabled={busy} data-testid="simple-discard-start">{c.advanced.discard}</button>
		{:else if phase === 'off'}
			{#if missing.length}
				<p class="hint">{c.simple.notSetUp}</p>
				<button class="secondary" onclick={onadvanced}>{c.simple.openSetup}</button>
			{:else}
				<button class="cta" onclick={start} disabled={busy || backupsPending || Boolean(backupsError) || gapOpen || unmarkedOpen} data-testid="start">{c.simple.start}</button>
				{@render oldImageQuestion()}
				{@render unpaidQuestion()}
				{#if backupsPending}<p class="hint">{c.simple.readingBackups}</p>
				{:else if backupsError}<p class="warn">{backupsError} {c.simple.tryAgain}</p>
				{:else if profile.ageIdentity}<p class="hint" data-testid="simple-restore">{chosenBackup ? c.simple.startsWith(chosenBackup.pieceCid.slice(-12), whenOf(chosenBackup)) : c.simple.startsEmpty}</p>{/if}
				{@render gapWarning()}
				{@render unmarkedWarning()}
				<Storage {master} {profile} />
			{/if}
		{/if}
		<!-- A stop's or an erase's panel stays once it is over, with where the backup went. -->
		{#if stopShown && !busy}<StartPanel rows={panel} t={panelShownT} times={panelTook} total={panelTotal} testid="stop-panel" />{/if}
		{#if stopEvidence.length}<Evidence rows={stopEvidence} t={{ ...evidenceT, title: evidenceT.stopTitle }} />{/if}
		{#if chainBackup}<BackupChain network={profile.network ?? 'calibration'} backup={chainBackup} />{/if}
		{#if phase !== 'running' && profile.trial}<TrialRestore {master} {profile} listing={backupListing(profile)} onchange={async () => { k.profile = await loadProfile(master); onchange(); }} />{/if}
		{#if profile.backupRevokePending && !profile.running}<p class="hint" data-testid="revoke-pending">{c.revokePending}</p>{/if}
		{#if goneNote}<p class="hint" role="status" data-testid="start-gone">{goneNote}</p>{/if}
		{#if nodeNote}<p class="hint" role="status" data-testid="node-refused">{nodeNote}</p>{/if}
		{#if periodEnded}<p class="hint" role="status" data-testid="period-end-stopped">{c.periodEnd.stopped}</p>{/if}
		{@render placesBox()}
		{#if error}{@render errorBox()}{/if}
		{#if error && !busy && !profile.running && profile.ownImage?.previous}<p class="hint" data-testid="previous-image"><button class="secondary" onclick={startPrevious} disabled={busy} data-testid="start-previous">{$i18n.ownImage.previousStart}</button> {$i18n.ownImage.previousHint}</p>{/if}
		{#if partial}
			<div class="partial" role="alert" data-testid="stop-partial">
				<p class="warn">{partial.message}</p>
				<p class="hint">{c.partial.hint(partial.requested - partial.copies)}</p>
				<div class="row">
					<button onclick={eraseAnyway} disabled={busy} data-testid="stop-partial-erase">{c.partial.erase}</button>
					<button class="secondary" onclick={keepVm} disabled={busy} data-testid="stop-partial-keep">{c.partial.keep}</button>
				</div>
			</div>
		{/if}
		{#if errorLog.length}<details class="log" data-testid="simple-backup-log"><summary>{c.simple.vmDetails}</summary><pre>{errorLog.join('\n')}</pre><ProviderHealth network={profile.network ?? 'calibration'} ids={healthIds} /></details>{/if}
		{#if short && CREDITS_URL && (profile.appPays || profile.leSpacePays)}{@render fundOffer()}{/if}
		{#if bought}<p class="hint" role="status" data-testid="fund-bought">{bought}</p>{/if}
	{:else}
		<header class="head">
			<h2>Paperless-ngx</h2>
			<span class="chip" class:on={phase === 'running'} data-testid="paperless-chip">{CHIPS[phase]}</span>
		</header>
		<p class="purpose">{c.advanced.purpose}</p>
		{#if profile.running}
			<a class="cta" href={`https://${profile.running.host}/`} target="_blank" rel="noopener">{c.simple.open}</a>
			<p>{c.advanced.runs} <a href={`https://${profile.running.host}/`} target="_blank" rel="noopener" data-testid="paperless-link">{profile.running.host}</a></p>
			{@render superusersWarning()}
			{#if profile.running.restore?.status === 'failed'}<p class="error" data-testid="restore-failed">{c.advanced.restoreFailed(`${profile.running.restore.reason ?? c.advanced.noReason}${profile.running.restore.error ? `: ${profile.running.restore.error}` : ''}`)}</p>{/if}
			{#if profile.running.dataDisk === 'encrypted'}<p class="hint" data-testid="data-disk">{c.advanced.diskEncrypted}</p>
			{:else if profile.running.dataDisk === 'plain'}<p class="warn" data-testid="data-disk">{c.advanced.diskPlain}</p>{/if}
			<Evidence rows={evidence} t={evidenceT} onagain={busy ? null : checkAgain} />
			<p data-testid="paperless-login">{c.advanced.login} <code>admin</code>,
				{#if showPassword}<code data-testid="admin-password">{adminPassword}</code>{:else}<span>••••••••</span>{/if}
				<button type="button" class="small" onclick={() => (k.showPassword = !showPassword)}>{showPassword ? c.simple.hide : c.simple.show}</button>
				<button type="button" class="small" onclick={copyPassword}>{c.simple.copy}</button>
			</p>
			{#if restoreFailed}<button class="secondary stop" onclick={discardFailed} disabled={busy} data-testid="discard">{c.simple.discard}</button>
			{:else}
				{#if reach === 'bad'}<p class="warn" role="status">{c.simple.stopReachBad}</p>{/if}
				<button class="secondary stop" onclick={stop} disabled={busy || stopChecking} data-testid="stop">{c.simple.stop}</button>
				{#if stopChecking}<p class="hint" role="status">{c.simple.stopChecking}</p>{/if}
			{/if}
		{:else}
			{#if profile.ageIdentity}
				<fieldset class="restore">
					<legend>{c.advanced.atStart}</legend>
					{#if production && split.own.length}
						<label><input type="radio" bind:group={k.choice} value="latest" data-testid="restore-latest" />
							{c.advanced.restoreLatest}
							<small data-testid="latest-backup">({pick(split.own).pieceCid.slice(-12)}{whenOf(pick(split.own))}{sizePart(pick(split.own))}, {c.advanced.copiesAt(pick(split.own).copies.length, wherePlaces(pick(split.own)))})</small>
						</label>
					{/if}
					<label><input type="radio" bind:group={k.choice} value="own" disabled={!split.own.length} />
						{c.advanced.restoreOwn}
						{#if split.own.length}<small data-testid="newest-backup">({pick(split.own).pieceCid.slice(-12)}{whenOf(pick(split.own))}{sizePart(pick(split.own))}, {c.advanced.copiesAt(pick(split.own).copies.length, wherePlaces(pick(split.own)))})</small>
						{:else if backups}<small>{c.advanced.noneOwn}</small>{:else}<small>{c.advanced.reading}</small>{/if}
					</label>
					{#if split.other.length}
						<label><input type="radio" bind:group={k.choice} value="any" />
							{c.advanced.restoreOther} ({unmarkedPick(split.other).pieceCid.slice(-12)}{sizePart(unmarkedPick(split.other))}, {wherePlaces(unmarkedPick(split.other))})
							<small>{c.advanced.otherHint(split.other.length)}</small>
						</label>
					{/if}
					{#if backups?.length}
						<label><input type="radio" bind:group={k.choice} value="pick" data-testid="restore-pick" /> {c.advanced.pickOne}</label>
						{#if k.choice === 'pick'}
							<ul class="backup-pick" data-testid="backup-pick-list">
								{#each backups.slice(0, 12) as b, i (b.pieceCid)}
									<li><label><input type="radio" name="backup-pick" value={b.pieceCid} checked={k.pickedCid === b.pieceCid} onchange={() => (k.pickedCid = b.pieceCid)} data-testid="backup-pick-{i}" />
										<code>…{b.pieceCid.slice(-12)}</code>{whenOf(b)}{sizePart(b)}{b.parts?.length > 1 ? `, ${c.advanced.parts(b.parts.length)}` : ''}, {c.advanced.copiesAt(b.copies.length, wherePlaces(b))}, {k.marked(b) ? c.advanced.sealYes : c.advanced.sealNo}</label></li>
								{/each}
							</ul>
						{/if}
					{/if}
					<label><input type="radio" bind:group={k.choice} value="empty" /> {c.advanced.empty}</label>
					{#if k.choice === 'empty' && backups?.length}
						<div class="warn" data-testid="empty-over-backups">
							<p>{c.advanced.emptyOverBackups(backups.length)}</p>
							<label><input type="checkbox" bind:checked={k.freshConfirmed} data-testid="empty-fresh-confirm" /> {c.advanced.emptyFresh}</label>
						</div>
					{/if}
					{#if k.tinyNewest && k.choice !== 'pick'}<p class="warn" data-testid="tiny-newest">{c.advanced.tinyNewest(backupSize(k.tinyNewest.newest.size), backupSize(k.tinyNewest.before.size), k.tinyNewest.before.pieceCid.slice(-12))} <button class="link" onclick={() => k.pickBackup(k.tinyNewest.before.pieceCid)} data-testid="tiny-pick-before">{c.advanced.pickBefore}</button></p>{/if}
					{#if backupsError}<small class="hint">{backupsError}</small>{/if}
					{#each k.backupHints as h (h.id)}<p class="hint" data-testid="backups-hint-{h.id.split('-')[0]}">{h.text}</p>{/each}
				</fieldset>
				{@render gapWarning()}
				{@render unmarkedWarning()}
				{#if chosenBackup}<BackupExport backup={chosenBackup} identity={profile.ageIdentity} />{/if}
				{#if chainBackup}<BackupChain network={profile.network ?? 'calibration'} backup={chainBackup} />{/if}
			{/if}
			{#if profile.starting && !busy}
				<div class="interrupted" data-testid="start-interrupted">
					<p>{c.advanced.interrupted.before} <code>{profile.starting.instanceHash.slice(0, 12)}</code>{c.advanced.interrupted.requested(format.dateTime(profile.starting.at, { dateStyle: 'short', timeStyle: 'short' }, $appLanguage))}</p>
					<button class="cta" onclick={resume} disabled={busy}>{c.simple.resume}</button>
					<button class="quiet" onclick={discard} disabled={busy}>{c.advanced.discard}</button>
				</div>
			{:else}
				<p class="role-line" data-testid="role-line">{profile.role === 'primary' ? c.advanced.rolePrimary : c.advanced.roleTest}</p>
				<button class="cta" onclick={start} disabled={busy || missing.length > 0 || gapOpen || unmarkedOpen} data-testid="start">{c.simple.start}</button>
				{@render oldImageQuestion()}
				{@render unpaidQuestion()}
				{#if missing.length}<p class="hint">{c.advanced.stillMissing(missing.join(', '))}</p>{/if}
			{/if}
			{#if BUILDER && hasOwnImage(profile, BUILDER.plain.sha256)}<button class="quiet" onclick={showCertificate} data-testid="open-certificate">{$i18n.first.cert.open}</button>{/if}
		{/if}
		{#if startShown}<StartPanel rows={panel} t={panelT} times={panelTook} total={panelTotal} />{/if}
		<!-- A start, a stop and an erase each show their panel only, with the times per row. -->
		{#if stopShown}<StartPanel rows={panel} t={panelShownT} times={panelTook} total={panelTotal} testid="stop-panel" />{/if}
		{#if stopEvidence.length}<Evidence rows={stopEvidence} t={{ ...evidenceT, title: evidenceT.stopTitle }} />{/if}
		{#if progress}<p data-testid="progress">{progress} …</p>{/if}
		{#if profile.backupRevokePending && !profile.running}<p class="hint" data-testid="revoke-pending">{c.revokePending}</p>{/if}
		{#if goneNote}<p class="hint" role="status" data-testid="start-gone">{goneNote}</p>{/if}
		{#if nodeNote}<p class="hint" role="status" data-testid="node-refused">{nodeNote}</p>{/if}
		{#if periodEnded}<p class="hint" role="status" data-testid="period-end-stopped">{c.periodEnd.stopped}</p>{/if}
		{@render placesBox()}
		{#if error}{@render errorBox()}{/if}
		{#if error && !busy && !profile.running && profile.ownImage?.previous}<p class="hint" data-testid="previous-image"><button class="secondary" onclick={startPrevious} disabled={busy} data-testid="start-previous">{$i18n.ownImage.previousStart}</button> {$i18n.ownImage.previousHint}</p>{/if}
		{#if partial}
			<div class="partial" role="alert" data-testid="stop-partial">
				<p class="warn">{partial.message}</p>
				<p class="hint">{c.partial.hint(partial.requested - partial.copies)}</p>
				<div class="row">
					<button onclick={eraseAnyway} disabled={busy} data-testid="stop-partial-erase">{c.partial.erase}</button>
					<button class="secondary" onclick={keepVm} disabled={busy} data-testid="stop-partial-keep">{c.partial.keep}</button>
				</div>
			</div>
		{/if}
		{#if short && CREDITS_URL && profile.appPays}{@render fundOffer()}{/if}
		{#if bought}<p class="hint" role="status" data-testid="fund-bought">{bought}</p>{/if}
		{#if errorLog.length}
			<details open class="log"><summary>{c.advanced.vmSays}</summary><pre data-testid="backup-log">{errorLog.join('\n')}</pre><ProviderHealth network={profile.network ?? 'calibration'} ids={healthIds} /></details>
		{/if}
		{#if !profile.running && profile.lastBackup}
			{@const b = profile.lastBackup}
			<details class="backup-card" data-testid="last-backup">
				<summary>{c.last.title(b.date ? format.dateTime(b.date, undefined, $appLanguage) : b.name, b.copies?.length ?? 0, b.requestedCopies ?? b.copies?.length, Boolean(b.complete))}</summary>
				<dl>
					<dt>{c.last.network}</dt><dd>Filecoin {b.network === 'mainnet' ? 'Mainnet' : c.last.testnet}</dd>
					<dt>{c.last.paidBy}</dt><dd><code>{b.payer}</code></dd>
					<dt>Piece CID</dt><dd><code>{b.pieceCid}</code></dd>
					{#if b.size}<dt>{c.last.size}</dt><dd>{format.number(b.size / 1048576, { minimumFractionDigits: 1, maximumFractionDigits: 1 }, $appLanguage)} MiB {c.last.encrypted}{b.parts?.length > 1 ? c.last.inParts(b.parts.length) : ''}</dd>{/if}
					{#if b.seconds}<dt>{c.last.duration}</dt><dd>{b.seconds} s</dd>{/if}
				</dl>
				<ul>
					{#each b.copies ?? [] as copy (copy.providerId + copy.dataSetId)}
						<li>{c.last.copy({ provider: copy.providerId, place: copy.location ? place(copy.location) : '', dataSet: copy.dataSetId, piece: copy.pieceId, isNew: Boolean(copy.isNewDataSet) })}
							{#if httpsUrl(copy.retrievalUrl)}<br /><a href={httpsUrl(copy.retrievalUrl)} target="_blank" rel="noopener">{c.last.fetch}</a> <small>{c.last.fetchHint}</small>{/if}</li>
					{/each}
				</ul>
				{#if b.failedAttempts}<p class="hint">{c.last.failed(b.failedAttempts)}</p>{/if}
			</details>
		{/if}
	{/if}
</section>

<style>
	.good { margin: 0.4rem 0 0; font-size: 0.9rem; color: var(--text-2); }
	.good strong { color: var(--text); }
	.good.stale { color: var(--warn); }
	.simple { padding: 1.5rem 1.25rem; }
	.status { display: flex; gap: 1rem; align-items: flex-start; }
	.status h1 { font-size: 1.6rem; margin: 0; line-height: 1.2; }
	.status .sub { margin: 0.3rem 0 0; color: var(--text-2); }
	.status .sub.data { font-family: var(--mono); font-size: 0.875rem; word-break: break-all; }
	.dot { flex: none; width: 0.9rem; height: 0.9rem; margin-top: 0.5rem; border-radius: 50%; background: var(--line); }
	.is-running .dot { background: var(--ok); box-shadow: 0 0 0 5px var(--ok-bg); }
	.is-starting .dot, .is-stopping .dot, .is-interrupted .dot { background: var(--accent); box-shadow: 0 0 0 5px var(--warn-bg); }
	@media (prefers-reduced-motion: no-preference) {
		.is-starting .dot, .is-stopping .dot { animation: pulse 1.6s ease-in-out infinite; }
		@keyframes pulse { 50% { opacity: 0.35; } }
	}
	.meter { height: 6px; margin: 1.25rem 0 0.5rem; background: var(--surface-2); border-radius: 999px; overflow: hidden; }
	.meter span { display: block; height: 100%; background: var(--accent); border-radius: 999px; transition: width 1s linear; }
	.calm { color: var(--text-2); font-size: 0.9rem; margin: 0; }
	.cta { display: block; width: 100%; margin: 1.25rem 0 0.75rem; padding: 0.85rem 1.25rem; text-align: center; font-weight: 600; font-size: 1.05rem; color: var(--cta-text); background: var(--cta-bg); border: 1px solid var(--cta-bg); border-radius: 999px; text-decoration: none; }
	.secondary { display: block; width: 100%; margin: 0.75rem 0 0; background: transparent; color: var(--text); border-color: var(--line); }
	/* Ends the paid VM: the style guide's warning colour (amber), so it stands out without competing with the one lime CTA. */
	.secondary.stop { background: var(--warn-bg); color: var(--warn); border-color: var(--warn); font-weight: 600; }
	.secondary.stop:hover:not(:disabled) { background: color-mix(in srgb, var(--warn) 16%, var(--warn-bg)); }
	.login { margin: 1rem 0 0; padding: 0.9rem 1rem; background: var(--surface-2); border-radius: var(--radius-sm); }
	.login p { margin: 0.15rem 0; }
	.login .label { color: var(--text-2); font-size: 0.85rem; margin-bottom: 0.35rem; }
	.login code { word-break: break-all; }
	.warn-box { margin: 0.75rem 0; padding: 0.6rem 0.8rem; border: 1px solid var(--warn); border-left-width: 4px; border-radius: var(--radius-sm, 6px); background: var(--warn-bg); }
	.warn-box ul { margin: 0.3rem 0; padding-left: 1.2rem; }
	.error-text { margin: 0; }
	.raw { margin-top: 0.4rem; font-size: 0.85rem; color: var(--dim); }
	.raw pre { white-space: pre-wrap; word-break: break-word; margin: 0.3rem 0 0; }
	.row { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.6rem; }
	.small { padding: 0.35rem 0.85rem; font-size: 0.875rem; background: var(--surface); color: var(--text); border-color: var(--line); }
	.simple .hint { margin: 0.5rem 0 0; font-size: 0.9rem; }
	.simple .warn, .simple .error { margin: 0.75rem 0 0; padding: 0.5rem 0.75rem; border-radius: var(--radius-sm); font-size: 0.9rem; }
	.simple .warn { background: var(--warn-bg); }
	.simple .error { background: var(--danger-bg); }
	.warn { color: var(--warn); }
	.gap { margin: 0.75rem 0 0; padding: 0.5rem 0.75rem; border-radius: var(--radius-sm); background: var(--warn-bg); font-size: 0.9rem; }
	.gap p { margin: 0 0 0.4rem; }
	.log pre { white-space: pre-wrap; font-size: 0.8rem; background: var(--surface-2); padding: 0.5rem; }
	.backup-card { margin-top: 1rem; }
	.backup-card dl { display: grid; grid-template-columns: max-content 1fr; gap: 0.2rem 0.8rem; }
	.backup-card dt { color: var(--text-2); }
	.backup-card ul { padding-left: 1.2rem; }
	@media (max-width: 480px) { .backup-card dl { grid-template-columns: 1fr; } }
	.head { display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; }
	.head h2 { margin: 0; font-size: 1.15rem; }
	.purpose { color: var(--text-2); font-size: 0.9rem; margin: 0.25rem 0 0.75rem; }
	.chip { font-size: 0.8rem; padding: 0.1rem 0.6rem; border-radius: 999px; background: var(--surface-2); color: var(--text-2); white-space: nowrap; }
	.chip.on { background: var(--ok-bg); color: var(--ok); }
	.cta:disabled { opacity: 0.5; }
	.lifecycle { margin: 0 0 1rem; padding: 1.25rem; background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--shadow); }
	button { padding: 0.6rem 1.1rem; font-size: 1rem; margin: 0.25rem 0.25rem 0.25rem 0; }
	.hint { color: var(--text-2); }
	.restore { border: none; padding: 0; margin: 0 0 0.75rem; }
	.restore label { display: block; }
	.error { color: var(--danger); }
	.role-line { font-size: 0.9rem; color: var(--text-2); margin: 0.25rem 0; }
	.fund { display: flex; flex-wrap: wrap; gap: 0.5rem 0.75rem; align-items: end; margin: 0.5rem 0; }
	.fund select { margin-left: 0.4rem; }
	.interrupted { padding: 0.5rem 0.75rem; background: var(--warn-bg); border-radius: 4px; }
	.quiet { background: none; border: none; color: var(--text-2); text-decoration: underline; padding: 0; }
	.image-line { margin: 0.35rem 0 0; font-size: 0.9rem; color: var(--text-2); }
	.backup-pick { list-style: none; margin: 0.25rem 0 0.5rem 1.4rem; padding: 0; display: grid; gap: 0.2rem; font-size: 0.88rem; }
	.backup-pick input { width: auto; margin-right: 0.4rem; }
	.warn .link { background: none; border: none; padding: 0; color: inherit; text-decoration: underline; cursor: pointer; font: inherit; }
	.image-line .link { background: none; border: none; padding: 0; color: var(--accent-2-text); text-decoration: underline; cursor: pointer; font: inherit; }
</style>
