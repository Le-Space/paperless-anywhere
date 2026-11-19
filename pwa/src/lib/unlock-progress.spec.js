// The attestation library's English progress becomes the app's own words; its
// text, with the browser's error in it, goes only to the diagnosis.
import { afterEach, describe, expect, it } from 'vitest';
import { unlockDetail } from './unlock-progress.js';
import { diagnosisText, resetDiagnosis } from './diagnosis.js';
import { setLang } from './i18n/index.js';

afterEach(() => {
	resetDiagnosis();
	setLang('de');
});

describe('the unlock’s progress in the app’s words', () => {
	it('says each phase of the library in German, never its English sentence', () => {
		setLang('de');
		expect(unlockDetail({ phase: 'attest', detail: 'Attesting the guest (3/12)' })).toBe('Die VM wird geprüft (AMD), Versuch 3 von 12');
		expect(unlockDetail({ phase: 'attest', detail: 'something else' })).toBe('Die VM wird geprüft (AMD)');
		expect(unlockDetail({ phase: 'unlock', detail: 'Sign the unlock in your wallet' })).toBe('Passphrase und Geheimnisse werden signiert übergeben');
		const wait = unlockDetail({ phase: 'wait', detail: 'The guest is not answering yet: WebSocket to wss://relay.example/attest?crn=ab&vm=cd failed' });
		expect(wait).toBe('Die VM antwortet noch nicht; die App fragt in 10 s wieder');
		expect(wait).not.toMatch(/WebSocket|guest/);
		// A phase the app does not know yet: its own words for the step.
		expect(unlockDetail({ phase: 'later', detail: 'New English text' })).toBe('VM prüfen (AMD) und entsperren');
	});

	it('in English too', () => {
		setLang('en');
		expect(unlockDetail({ phase: 'wait', detail: 'The guest is not answering yet: closed' })).toBe('The VM does not answer yet; the app asks again in 10 s');
		expect(unlockDetail({ phase: 'attest', detail: 'Attesting the guest (1/12)' })).toBe('Checking the VM (AMD), try 1 of 12');
	});

	it('keeps the library’s reason for the wait in the diagnosis, without the query', () => {
		unlockDetail({ phase: 'wait', detail: 'The guest is not answering yet: WebSocket to wss://relay.example/attest?crn=ab&vm=cd failed' });
		const text = diagnosisText({ build: {}, now: 0 });
		expect(text).toContain('last wait: The guest is not answering yet: WebSocket to wss://relay.example/attest failed');
		expect(text).not.toContain('crn=');
	});
});
