import { describe, expect, it } from 'vitest';
import { ageRecipient, newAgeIdentity } from './age.js';

// A throwaway identity made with age-encryption, the library the backup tool
// encrypts with, so the PWA's encoding is checked against it.
const VECTOR = { id: 'AGE-SECRET-KEY-1G2GYLTNDTG9KXEQJK6M86QFHR4FTPVRZEZVU7T3T9U0LRC4QG7UQ2PMSTU', recipient: 'age1npsw4s68sx9j2vttn3vxjywjuygj74fsaadlk74dqp2qkd6x84xsr7duc6' };

describe('age', () => {
	it('derives the recipient age-encryption derives', () => {
		expect(ageRecipient(VECTOR.id)).toBe(VECTOR.recipient);
	});
	it('makes identities in the age-keygen format', () => {
		const id = newAgeIdentity();
		expect(id).toMatch(/^AGE-SECRET-KEY-1[0-9A-Z]{58}$/);
		expect(ageRecipient(id)).toMatch(/^age1[0-9a-z]{58}$/);
	});
	it('refuses anything else', () => {
		expect(() => ageRecipient(VECTOR.recipient)).toThrow();
	});
});
