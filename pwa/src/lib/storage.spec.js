import { describe, expect, it } from 'vitest';
import { storageView, STORAGE_INCLUDED_BYTES } from './storage.js';

describe('storageView', () => {
	it('shows the documents against the 8 GB included', () => {
		expect(STORAGE_INCLUDED_BYTES).toBe(8e9);
		expect(storageView(2.5e9, 'running')).toEqual({ share: 0.3125, level: 'ok', text: '2,5 GB von 8,0 GB', hint: 'Noch 5,5 GB frei.' });
	});
	it('says when it gets full, and when it is over', () => {
		expect(storageView(6.8e9, 'running')?.level).toBe('near');
		expect(storageView(6.8e9, 'running')?.hint).toContain('Noch 1,2 GB frei');
		const over = storageView(9e9, 'running');
		expect(over?.level).toBe('over');
		expect(over?.share).toBe(1);
	});
	it('names a stopped VM\'s figure as the last backup', () => {
		expect(storageView(1e9, 'backup')?.hint).toBe('Stand der letzten Sicherung.');
	});
	it('shows nothing without a figure', () => {
		expect(storageView(undefined, 'running')).toBeNull();
		expect(storageView(null, 'backup')).toBeNull();
		expect(storageView(Number.NaN, 'running')).toBeNull();
	});
});
