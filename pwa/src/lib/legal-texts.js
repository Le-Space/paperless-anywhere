// The texts of cancelling (§ 312k BGB) and of withdrawing (§ 356a BGB): what
// the contract is called, who it is with, and the confirmations a person
// keeps. They are legal wording and exist in German only: the app shows them
// as they are in every language until Le Space has approved English ones.
// Nothing here is translated freely, and this file is the one place outside
// the catalogue where German text is at home (i18n/no-german.spec.js).

/** A month of round-the-clock running: a package this large is "Dauerbetrieb". */
const ALWAYS = 720;
/** A package's hours as the contract names them, in German. @param {{ hours: number }} plan */
const germanPlanHours = (plan) => (plan.hours >= ALWAYS ? 'Dauerbetrieb' : `${plan.hours} Stunden`);

/** The contract as the cancel page names it. @param {{ hours: number } | null} plan @param {string} [id] */
export const contractName = (plan, id = '') => `Paperless anywhere, Paket ${plan ? germanPlanHours(plan) : id}, Monatsabo`;
export const CANCEL_KIND = 'Ordentliche Kündigung zum Ende des bezahlten Monats';
/** Who the contract is with, as the cancel page and its confirmation name it. */
export const PROVIDER = 'Le Space UG (haftungsbeschränkt), info@le-space.de';
export const IMPRINT_URL = 'https://le-space.de/#impressum';

/** @param {string | null} iso @param {string} [timeZone] */
export const germanDate = (iso, timeZone) => (iso ? new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone }) : '–');
/** @param {string | null} iso @param {string} [timeZone] */
export const germanDateTime = (iso, timeZone) => (iso ? new Date(iso).toLocaleString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone, timeZoneName: 'short' }) : '–');

/**
 * The confirmation of a cancellation as a small text file: what the person
 * keeps as the durable record. Plain text, no remote resources.
 * @param {{ contract: string, receivedAt: string, effectiveAt: string | null, address: string, timeZone?: string }} c
 * @returns {{ filename: string, text: string }}
 */
export function cancellationRecord({ contract, receivedAt, effectiveAt, address, timeZone }) {
	const text = [
		'Bestätigung der Kündigung',
		'',
		`Vertrag: ${contract}`,
		`Art: ${CANCEL_KIND}`,
		`Kündigung eingegangen am: ${germanDateTime(receivedAt, timeZone)} (${receivedAt})`,
		`Wirksam zum: ${germanDate(effectiveAt, timeZone)}${effectiveAt ? ` (${effectiveAt})` : ''}`,
		`Konto (Adresse): ${address}`,
		'',
		`Anbieter: ${PROVIDER}`,
		`Impressum: ${IMPRINT_URL}`,
		''
	].join('\n');
	return { filename: `kuendigung-paperless-anywhere-${receivedAt.slice(0, 10)}.txt`, text };
}

/**
 * The way to cancel without the vault's key (§ 312k BGB): someone who cannot
 * unlock the app cannot sign a cancellation, so this opens a mail to Le Space
 * that says what is cancelled and asks for what identifies the contract. The
 * app fills in nothing about the person.
 */
export const CANCEL_MAIL = 'info@le-space.de';
export const cancelMailto = () =>
	`mailto:${CANCEL_MAIL}?${new URLSearchParams({
		subject: 'Kündigung Paperless anywhere',
		body: [
			'Ich kündige mein Abo von Paperless anywhere zum nächstmöglichen Zeitpunkt.',
			'',
			'E-Mail-Adresse, die bei der Zahlung angegeben wurde: ',
			'Rechnungsnummer (falls zur Hand): ',
			'',
			'Bitte bestätigt mir den Eingang der Kündigung und den Zeitpunkt, zu dem sie wirksam wird.',
			''
		].join('\n')
	})
		.toString()
		.replaceAll('+', '%20')}`;

/** What a withdrawable contract is called when the service names none. */
export const WITHDRAWAL_SUBJECTS = Object.freeze({ subscription: 'Paket im Monatsabo', credits: 'Guthaben-Kauf', backup: '1 Jahr Aufbewahrung der Sicherungen' });
export const withdrawableName = (/** @type {{ subject: 'subscription' | 'credits' | 'backup', what: string }} */ w) => w.what || WITHDRAWAL_SUBJECTS[w.subject];

/**
 * The confirmation of a withdrawal as a small text file: what the person
 * keeps as the durable record. Plain text, no remote resources.
 * @param {{ withdrawn: { subject: 'subscription' | 'credits' | 'backup', what: string, concludedAt: string | null }[], receivedAt: string, refundId?: string | null, address: string, timeZone?: string }} c
 * @returns {{ filename: string, text: string }}
 */
export function withdrawalRecord({ withdrawn, receivedAt, refundId = null, address, timeZone }) {
	const text = [
		'Bestätigung des Widerrufs',
		'',
		...withdrawn.map((w) => `Widerrufen: ${withdrawableName(w)}${w.concludedAt ? `, geschlossen am ${germanDate(w.concludedAt, timeZone)}` : ''}`),
		`Widerruf eingegangen am: ${germanDateTime(receivedAt, timeZone)} (${receivedAt})`,
		...(refundId ? [`Erstattung: ${refundId}`] : []),
		`Konto (Adresse): ${address}`,
		'',
		`Anbieter: ${PROVIDER}`,
		`Impressum: ${IMPRINT_URL}`,
		''
	].join('\n');
	return { filename: `widerruf-paperless-anywhere-${receivedAt.slice(0, 10)}.txt`, text };
}

