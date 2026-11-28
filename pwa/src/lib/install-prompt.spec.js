// When the install button or a hint shows (install-prompt.js).
import { get } from 'svelte/store';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { browserKind, installed, offer, promptEvent, showPrompt } from './install-prompt.js';

const UA = {
	chromeDesktop: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
	edge: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36 Edg/131.0.0.0',
	safariMac: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Safari/605.1.15',
	iphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1',
	chromeIphone: 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/131.0 Mobile/15E148 Safari/604.1',
	firefox: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:133.0) Gecko/20100101 Firefox/133.0',
	firefoxAndroid: 'Mozilla/5.0 (Android 14; Mobile; rv:133.0) Gecko/133.0 Firefox/133.0',
	chromeAndroid: 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36'
};

describe('the browser family', () => {
	it('tells Safari on the Mac, iOS (iPadOS too) and desktop Firefox from the rest', () => {
		expect(browserKind(UA.safariMac)).toBe('mac');
		expect(browserKind(UA.safariMac, 5)).toBe('ios');
		expect(browserKind(UA.iphone)).toBe('ios');
		expect(browserKind(UA.chromeIphone)).toBe('ios');
		expect(browserKind(UA.firefox)).toBe('firefox');
		for (const ua of [UA.chromeDesktop, UA.edge, UA.chromeAndroid, UA.firefoxAndroid]) expect(browserKind(ua)).toBe('other');
	});
});

describe('what is offered', () => {
	const base = { standalone: false, installed: false, prompt: false, kind: /** @type {const} */ ('other'), dismissed: false };
	it('is the button once the browser gave its prompt, whatever the family', () => {
		expect(offer({ ...base, prompt: true })).toBe('button');
		expect(offer({ ...base, prompt: true, kind: 'mac', dismissed: true })).toBe('button');
	});
	it('is nothing in the installed app or after an install', () => {
		expect(offer({ ...base, prompt: true, standalone: true })).toBe('none');
		expect(offer({ ...base, prompt: true, installed: true })).toBe('none');
		expect(offer({ ...base, kind: 'ios', standalone: true })).toBe('none');
	});
	it('is the hint of a browser without a prompt, until dismissed', () => {
		expect(offer({ ...base, kind: 'ios' })).toBe('ios');
		expect(offer({ ...base, kind: 'mac' })).toBe('mac');
		expect(offer({ ...base, kind: 'firefox' })).toBe('firefox');
		expect(offer({ ...base, kind: 'ios', dismissed: true })).toBe('none');
	});
	it('is nothing in Chromium before its prompt (it may never come: installed already, or not installable)', () => {
		expect(offer(base)).toBe('none');
	});
});

describe('the kept prompt', () => {
	afterEach(() => {
		promptEvent.set(null);
		installed.set(false);
	});
	it('is shown once and dropped, and an accepted install hides the button', async () => {
		const event = { prompt: vi.fn(async () => {}), userChoice: Promise.resolve({ outcome: 'accepted' }) };
		promptEvent.set(event);
		expect(await showPrompt()).toBe('accepted');
		expect(event.prompt).toHaveBeenCalledOnce();
		expect(get(promptEvent)).toBeNull();
		expect(get(installed)).toBe(true);
		expect(await showPrompt()).toBeNull();
		expect(event.prompt).toHaveBeenCalledOnce();
	});
	it('is dropped after a dismissal too, without counting as installed', async () => {
		promptEvent.set({ prompt: async () => {}, userChoice: Promise.resolve({ outcome: 'dismissed' }) });
		expect(await showPrompt()).toBe('dismissed');
		expect(get(promptEvent)).toBeNull();
		expect(get(installed)).toBe(false);
	});
});
