// The package card's flow control: plan, balance, purchases, cancel and withdraw, and every action on them.
// Moved here unchanged from Package.svelte, so that more than one interface can
// draw it: the component keeps the markup, this module keeps what happens.
// Call it while a component is set up (it uses effects).
import { balancesRound, refreshBalances } from '$lib/balance-refresh.js';
import { loadProfile } from '$lib/profile.js';
import { biggerPlan, planHours, creditsBalance, creditsCatalog, fewHoursLeft, hoursPerWeek, creditsPurchases, choosePlan, fundVm, planOf, PLANS, quoteVm, redeemVoucher, startSubscription, subscriptionPortal, waitForSubscription, creditsTerms, waiverOf, WaiverError } from '$lib/credits.js';
import { withdrawalQuote } from '$lib/credits.js';
import { hourPurchase } from '$lib/purchase.js';
import { preparing } from '$lib/purchase-step.js';
import { applyCustomerDefaults } from '$lib/customer-defaults.js';
import { format, lang, t, tr } from '$lib/i18n/index.js';
import { endWarning, paidUntil } from '$lib/period-end.js';
import { fromStore } from 'svelte/store';

/** @param {Record<string, any>} p the component's props: master, version through getters, so they follow; onglance, onprofile as functions */
export function createPackageCard(p) {
	// The stores, read as the component read them with `$`.
	const balancesRoundNow = fromStore(balancesRound);
	const langNow = fromStore(lang);
	const preparingNow = fromStore(preparing);
	const tNow = fromStore(t);
	// What a customer sees of money: the package, the balance in euros, topping
	// up and the invoices (Le Space Credits, belege#591). No crypto here: Aleph
	// credits, FIL and USDFC are under "Erweitert" (Balances).

	const master = $derived(p.master);
	const version = $derived(p.version);
	const { onglance, onprofile } = p;

	/** @type {Awaited<ReturnType<typeof creditsBalance>>} */
	let balance = $state(null);
	let balanceError = $state('');
	/** @type {Awaited<ReturnType<typeof creditsPurchases>>} */
	let purchases = $state(null);
	let appPays = $state(false);
	let ownBackups = $state(false);
	// Someone who pays the VM themselves and has no package: the card is one
	// line until they want to see Le Space's offer; the terms are asked for only there.
	let selfOpen = $state(false);
	// Who pays the running VM: the package (Le Space, model A), the app's own
	// address, or the person's wallet. Only for the package do its hours count.
	let pays = $state(/** @type {'lespace' | 'app' | 'wallet' | null} */ (null));
	let busy = $state(false);
	let error = $state('');
	let note = $state('');
	let choosing = $state(false);
	let purchasesError = $state('');
	// The actions stay folded until someone wants them; a short balance opens them.
	let moreOpen = $state(false);
	// The service's own list once it answered; until then the known one.
	let plans = $state(/** @type {{ id: string, hours: number, priceCredits: number, backupIncluded?: boolean }[]} */ ([...PLANS]));
	// What the service sells of backups beside the plan (le-space-credits#69).
	/** @type {ReturnType<typeof import('$lib/credits.js').backupOfferOf>} */
	let backupOffer = $state(null);
	creditsCatalog()
		.then((c) => {
			if (c?.plans.length) plans = c.plans;
			backupOffer = c?.backup ?? null;
			catalogNetwork = c?.network ?? null;
			voucherOffered = c?.voucherOffered === true;
		})
		.catch(() => {});
	// "mit Sicherung" at the plan choice: an extra that costs money, so it
	// starts unticked (§ 312a Abs. 3 BGB) and is never set by the app.
	let withBackup = $state(false);
	// Vouchers (le-space-credits#73): shown only when the service says it takes them.
	let voucherOffered = $state(false);
	let voucherInput = $state('');
	const backupSold = $derived(Boolean(backupOffer?.planOffered));
	// A package whose price includes the backup (le-space-credits#72): nothing
	// to tick and nothing to add. The box is left for packages without it.
	const included = (/** @type {{ backupIncluded?: boolean } | null | undefined} */ p) => p?.backupIncluded === true;
	const boxOffered = $derived(backupSold && plans.some((p) => !included(p)));
	const allIncluded = $derived(plans.length > 0 && plans.every(included));
	const planTotal = (/** @type {{ priceCredits: number, backupIncluded?: boolean }} */ p) => p.priceCredits + (!included(p) && withBackup && backupSold && backupOffer ? backupOffer.monthCents : 0);
	// The card's texts in the language shown.
	const x = $derived(tNow.current.pkg);
	const includedText = $derived(x.included(backupOffer));
	let ordering = $state('');
	// The declaration on withdrawal before a payment (le-space-credits#51):
	// null from an older service, which then gets no checkbox and no waiver.
	// The pay buttons wait until the terms were read.
	/** @type {{ version: string, de: string, en: string } | null} */
	let withdrawal = $state(null);
	let termsRead = $state(false);
	const readWithdrawal = () =>
		creditsTerms()
			.then((t) => (withdrawal = t?.withdrawal ?? null))
			.catch(() => (withdrawal = null))
			.finally(() => (termsRead = true));
	readWithdrawal();
	// Unticked for every subscription: it is the declaration for this one.
	let waivedPlan = $state(false);
	const planBlocked = $derived(!termsRead || (Boolean(withdrawal) && !waivedPlan));
	// The package chosen first; its declaration shows below the cards, then the payment.
	let pickedPlan = $state('');
	const pickPlan = (/** @type {string} */ id) => ((pickedPlan = id), (waivedPlan = false), preparing.set('plan'));
	const dropPlan = () => ((pickedPlan = ''), (waivedPlan = false), preparing.set(''));
	// Another purchase chosen: this one's declaration goes, unticked.
	$effect(() => {
		if (preparingNow.current !== 'plan') (pickedPlan = ''), (waivedPlan = false);
	});
	const payPlan = async () => {
		await subscribe(pickedPlan);
		if (!error) dropPlan();
	};
	// The app's own cancel page, open in place (§ 312k BGB). It keeps the plan
	// it was opened for, so the confirmation stays when the balance changes.
	/** @type {{ plan: NonNullable<NonNullable<typeof balance>['plan']>, current: typeof current } | null} */
	let cancelling = $state(null);

	// The withdrawal function (§ 356a BGB): what the service lists as
	// withdrawable right now. Empty, or a service without the route: no button.
	/** @type {Awaited<ReturnType<typeof withdrawalQuote>>} */
	let withdrawable = $state([]);
	let withdrawing = $state(false);

	// Prices and balances always with cents: "4,90 €", never "4,9 €".
	const euro = (/** @type {number} */ credits) => format.euro(credits, langNow.current);
	const day = (/** @type {string | null} */ iso) => (iso ? format.date(iso, { day: '2-digit', month: '2-digit' }, langNow.current) : '');
	const current = $derived(balance?.plan ? planOf(balance.plan.id, plans) : null);
	const hoursLeft = $derived(balance?.plan?.hoursLeft == null ? null : Math.max(0, Math.floor(balance.plan.hoursLeft)));
	// Few hours left in a package that is in use: say so, and name the next
	// larger package as the recommendation.
	const usesPackage = $derived(pays !== 'app' && pays !== 'wallet');
	const selfPays = $derived((pays === 'app' || pays === 'wallet') && !balance?.plan);
	const low = $derived(usesPackage && fewHoursLeft(hoursLeft, current));
	const bigger = $derived(biggerPlan(current, plans));
	const recommended = $derived(low && bigger ? bigger.id : null);
	const perWeek = (/** @type {number} */ hours) => x.perWeek(hoursPerWeek(hours));
	const share = $derived(current && hoursLeft != null ? Math.min(1, hoursLeft / current.hours) : null);

	// The network the service backs up on, for the defaults of a Paperless it pays for.
	/** @type {string | null} */
	let catalogNetwork = $state(null);
	// A plan or a voucher's period runs and nobody has set this Paperless up:
	// it gets the defaults (customer-defaults.js), once.
	let defaultsTried = false;
	$effect(() => {
		if (defaultsTried || !balance?.plan || !catalogNetwork) return;
		defaultsTried = true;
		applyCustomerDefaults(master, { network: catalogNetwork }).then((changed) => changed && onprofile()).catch(() => {});
	});
	async function read() {
		await Promise.all([
			creditsBalance(master).then((b) => ((balance = b), (balanceError = ''))).catch((e) => ((balance = null), (balanceError = e.message))),
			creditsPurchases(master).then((p) => ((purchases = p), (purchasesError = ''))).catch((e) => ((purchases = null), (purchasesError = e instanceof Error ? e.message : String(e)))),
			// While the withdrawal view is open its list stays as it was opened.
			withdrawing ? null : withdrawalQuote(master).then((w) => (withdrawable = w)).catch(() => (withdrawable = []))
		]);
	}

	let justBought = $state(false);
	async function act(/** @type {() => Promise<string>} */ fn) {
		busy = true;
		justBought = false;
		error = note = '';
		try {
			note = await fn();
			choosing = false;
			// A payment, a voucher or a package: every balance on the page anew.
			refreshBalances();
			await read();
		} catch (e) {
			error = e instanceof Error ? e.message : String(e);
		} finally {
			busy = false;
		}
	}
	// A question to the person: the host's own dialog where it has one (v0.2), else the browser's.
	const ask = async (/** @type {string} */ question) => (p.confirm ? p.confirm(question) : window.confirm(question));
	const plan = async (/** @type {string | null} */ id) => {
		if (id === null && !(await ask(tr().pkg.endConfirm))) return;
		// A change of package is asked first, with what it costs.
		const next = id === null ? null : planOf(id, plans);
		if (next && !(await ask(tr().pkg.changeConfirm(tr().pkg.upgrade(next.hours, next.hours >= 720, euro(next.priceCredits)))))) return;
		act(async () => {
			const r = await choosePlan(master, id);
			return id ? tr().pkg.chosen(day(r.periodEnd)) : tr().pkg.endsWithPeriod;
		});
	};
	/** @type {import("$lib/StripeCheckout.svelte").default | undefined} */
	let checkout = $state();
	// A package is a Stripe subscription: card, monthly invoice, cancel in the
	// portal. Until the service offers it (Stripe off, prices missing), the
	// package is paid from the balance as before.
	const subscribe = (/** @type {string} */ id) =>
		act(async () => {
			let secret;
			const waiver = waiverOf(withdrawal, waivedPlan);
			waivedPlan = false;
			const chosen = planOf(id, plans);
			const backup = !included(chosen) && withBackup && backupSold;
			// Plan, backup, total and the renewal in one line above the Checkout.
			ordering = chosen ? tr().pkg.order({ hours: planHours(chosen), price: euro(chosen.priceCredits), backup: included(chosen) ? 'included' : backup && backupOffer ? 'with' : backupSold ? 'without' : 'none', ...(backup && backupOffer ? { backupPrice: euro(backupOffer.monthCents), total: euro(chosen.priceCredits + backupOffer.monthCents) } : {}) }) : '';
			try {
				secret = await startSubscription(master, id, { ...waiver, backup });
			} catch (e) {
				if (e instanceof WaiverError) {
					readWithdrawal();
					throw e;
				}
				const msg = e instanceof Error ? e.message : String(e);
				// By the service's code, not by the words of its message: those follow the language.
				const failure = /** @type {{ code?: string, status?: number } | null} */ (e);
				if (!(failure?.code === 'PRICE_TAX' || failure?.code === 'STRIPE_OFF' || failure?.status === 404)) throw e;
				if (!(await ask(tr().pkg.fromBalanceConfirm(msg)))) return '';
				const r = await choosePlan(master, id);
				return tr().pkg.chosenFromBalance(day(r.periodEnd));
			}
			const outcome = await checkout?.pay(secret);
			if (outcome === 'closed') return tr().pkg.notSubscribed;
			if (outcome === 'failed') throw new Error(tr().pkg.payPageFailed);
			note = tr().pkg.settingUp;
			const { booked } = await waitForSubscription(master);
			return booked ? tr().pkg.subscribed : tr().pkg.subscribedSoon;
		});
	const portal = () =>
		act(async () => {
			location.href = await subscriptionPortal(master);
			return tr().pkg.stripeOpens;
		});
	const byStripe = $derived(balance?.plan?.billing === 'stripe');
	// A voucher's period: it runs out by itself, nothing to change, end or cancel.
	const byVoucher = $derived(balance?.plan?.billing === 'voucher');
	// During a voucher's period the backup ends with it by design: the service's
	// "runs out soon" from the first day on is shown as the plain paid-until
	// line, not as a warning. After the end the notices are shown as they come.
	const voucherBackup = $derived(byVoucher && balance?.backup?.notice?.kind === 'expires_soon' ? { ...balance.backup, notice: null } : null);
	const longDay = (/** @type {string | null} */ iso) => (iso ? format.date(iso, undefined, langNow.current) : '');
	const redeem = () =>
		act(async () => {
			const r = await redeemVoucher(master, voucherInput);
			voucherInput = '';
			const v = tr().pkg.voucher;
			const what = r.always ? v.always : r.hours != null ? tr().pkg.hours(r.hours) : '';
			return v.redeemed({ what, until: longDay(r.periodEnd), backupUntil: longDay(r.backupUntil) }) + (r.granted ? '' : v.pending);
		});
	// Extra hours: a quote first, the confirmation shows it, and only its
	// button buys – once (purchase.js). act() then re-reads the balance.
	/** @type {import('$lib/purchase.js').PurchaseState} */
	let buying = $state({ phase: 'idle', hours: null, quote: null, error: '' });
	const purchase = hourPurchase({
		quote: (hours) => quoteVm(master, hours),
		buy: async (hours) => {
			await act(async () => {
				const r = await fundVm(master, hours);
				return tr().pkg.boughtHours(hours, euro(r.chargedCredits), day(r.expiration));
			});
			justBought = !error;
		},
		onchange: (s) => (buying = s),
		// An older service may have bought on the quote: show what the balance is now.
		onquotefailed: () => read()
	});
	const buyHours = (/** @type {number} */ hours) => {
		error = note = '';
		purchase.ask(hours);
	};
	// What the balance and the package's hours are after a purchase.
	const after = $derived(balance ? x.after(euro(balance.credits), hoursLeft != null ? x.hours(hoursLeft) : null) : '');

	// Again whenever the profile changed (setup, start, stop).
	$effect(() => {
		version;
		balancesRoundNow.current;
		loadProfile(master)
			.then((p) => {
				appPays = Boolean(p.appPays);
				// Backups set up and paid from the person's own wallet: nothing of Le Space's to book.
				ownBackups = Boolean(p.backupConfig && !p.backupsByCredits);
				pays = p.leSpacePays ? 'lespace' : p.appPays ? 'app' : p.payer ? 'wallet' : null;
			})
			.catch(() => {});
		read();
	});
	// When the paid time ends without renewing (period-end.js), and the warning
	// shortly before; the clock moves on once a minute.
	let clock = $state(Date.now());
	$effect(() => {
		const id = setInterval(() => (clock = Date.now()), 60_000);
		return () => clearInterval(id);
	});
	const endsAt = $derived(paidUntil(balance, { pays, now: clock }));
	const ending = $derived(endWarning(endsAt, clock));
	// What "Auf einen Blick" shows of the package.
	$effect(() => onglance(balance ? { plan: Boolean(balance.plan), hoursLeft, pays, low, endsAt } : null));

	return {
		get balance() { return balance; },
		set balance(v) { balance = v; },
		get balanceError() { return balanceError; },
		set balanceError(v) { balanceError = v; },
		get purchases() { return purchases; },
		set purchases(v) { purchases = v; },
		get appPays() { return appPays; },
		set appPays(v) { appPays = v; },
		get ownBackups() { return ownBackups; },
		set ownBackups(v) { ownBackups = v; },
		get selfOpen() { return selfOpen; },
		set selfOpen(v) { selfOpen = v; },
		get pays() { return pays; },
		set pays(v) { pays = v; },
		get busy() { return busy; },
		set busy(v) { busy = v; },
		get error() { return error; },
		set error(v) { error = v; },
		get note() { return note; },
		set note(v) { note = v; },
		get choosing() { return choosing; },
		set choosing(v) { choosing = v; },
		get purchasesError() { return purchasesError; },
		set purchasesError(v) { purchasesError = v; },
		get moreOpen() { return moreOpen; },
		set moreOpen(v) { moreOpen = v; },
		get plans() { return plans; },
		set plans(v) { plans = v; },
		get backupOffer() { return backupOffer; },
		set backupOffer(v) { backupOffer = v; },
		get withBackup() { return withBackup; },
		set withBackup(v) { withBackup = v; },
		get voucherOffered() { return voucherOffered; },
		set voucherOffered(v) { voucherOffered = v; },
		get voucherInput() { return voucherInput; },
		set voucherInput(v) { voucherInput = v; },
		get backupSold() { return backupSold; },
		included,
		get boxOffered() { return boxOffered; },
		get allIncluded() { return allIncluded; },
		planTotal,
		get x() { return x; },
		get includedText() { return includedText; },
		get ordering() { return ordering; },
		set ordering(v) { ordering = v; },
		get withdrawal() { return withdrawal; },
		set withdrawal(v) { withdrawal = v; },
		get termsRead() { return termsRead; },
		set termsRead(v) { termsRead = v; },
		readWithdrawal,
		get waivedPlan() { return waivedPlan; },
		set waivedPlan(v) { waivedPlan = v; },
		get planBlocked() { return planBlocked; },
		get pickedPlan() { return pickedPlan; },
		set pickedPlan(v) { pickedPlan = v; },
		pickPlan,
		dropPlan,
		payPlan,
		get cancelling() { return cancelling; },
		set cancelling(v) { cancelling = v; },
		get withdrawable() { return withdrawable; },
		set withdrawable(v) { withdrawable = v; },
		get withdrawing() { return withdrawing; },
		set withdrawing(v) { withdrawing = v; },
		euro,
		day,
		get current() { return current; },
		get hoursLeft() { return hoursLeft; },
		get selfPays() { return selfPays; },
		get low() { return low; },
		get bigger() { return bigger; },
		get recommended() { return recommended; },
		perWeek,
		get share() { return share; },
		read,
		get justBought() { return justBought; },
		set justBought(v) { justBought = v; },
		plan,
		get checkout() { return checkout; },
		set checkout(v) { checkout = v; },
		portal,
		get byStripe() { return byStripe; },
		get byVoucher() { return byVoucher; },
		get voucherBackup() { return voucherBackup; },
		longDay,
		redeem,
		get buying() { return buying; },
		set buying(v) { buying = v; },
		purchase,
		buyHours,
		get after() { return after; },
		get endsAt() { return endsAt; },
		get ending() { return ending; },
	};
}
