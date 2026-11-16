import { describe, expect, it } from 'vitest';
import { dependentPairs, namePrefix, operatorCount, registeredDomain, sameOperator, sharedSigns } from './operators.js';

// Shaped like the FWSS ServiceProviderRegistry's mainnet entries (public).
const a = (n) => '0x' + String(n).repeat(40);
const cello = { id: 36, name: 'Cello', owner: a('d'), payee: a('d'), url: 'https://cello.fidl.tech' };
const bass = { id: 37, name: 'Bass', owner: a('e'), payee: a('e'), url: 'https://bass.fidl.tech' };
const probe = { id: 43, name: 'ProbeLab', owner: a('f'), payee: a('f'), url: 'https://mainnet.pdp.probelab.io' };
const ez1 = { id: 1, name: 'ezpdpz-main', owner: a('1'), payee: a('1'), url: 'https://main.ezpdpz.net' };
const ez2 = { id: 32, name: 'ezpdpz-main2', owner: a('2'), payee: a('2'), url: 'https://main2.ezpdpz.net' };

describe('registeredDomain', () => {
	it('is the eTLD+1 of the service URL', () => {
		expect(registeredDomain('https://cello.fidl.tech/')).toBe('fidl.tech');
		expect(registeredDomain('https://mainnet.pdp.probelab.io')).toBe('probelab.io');
		expect(registeredDomain('https://filecoin.brown-storage.uk')).toBe('brown-storage.uk');
		expect(registeredDomain('https://pdp.example.co.uk')).toBe('example.co.uk');
		expect(registeredDomain('https://pdp.lotus.dedyn.io')).toBe('lotus.dedyn.io');
		expect(registeredDomain('not a url')).toBeNull();
		expect(registeredDomain(null)).toBeNull();
	});
});

describe('namePrefix', () => {
	it('is the first word without trailing digits, never a generic one', () => {
		expect(namePrefix('ezpdpz-main2')).toBe('ezpdpz');
		expect(namePrefix('Brown Storage UK')).toBe('brown');
		expect(namePrefix('Cello')).toBe('cello');
		expect(namePrefix('PDP node 3')).toBeNull();
		expect(namePrefix('ab')).toBeNull();
	});
});

describe('sameOperator', () => {
	it('sees one operator by the domain (36 and 37: fidl.tech, other addresses)', () => {
		expect(sharedSigns(cello, bass)).toEqual([{ kind: 'domain', value: 'fidl.tech' }]);
		expect(sameOperator(cello, bass)).toBe(true);
	});
	it('by a payee or owner address in common, crosswise', () => {
		const other = { id: 99, name: 'Other', owner: a('9'), payee: a('d').toUpperCase().replace('0X', '0x'), url: 'https://x.example' };
		expect(sharedSigns(cello, other)).toEqual([{ kind: 'address', value: a('d') }]);
	});
	it('by the name prefix', () => {
		expect(sharedSigns(ez1, ez2).map((s) => s.kind)).toEqual(['domain', 'name']);
		expect(sharedSigns({ ...ez1, url: 'https://a.one' }, { ...ez2, url: 'https://b.two' })).toEqual([{ kind: 'name', value: 'ezpdpz' }]);
	});
	it('and not for different operators', () => {
		expect(sameOperator(cello, probe)).toBe(false);
		expect(sameOperator(probe, ez1)).toBe(false);
	});
});

describe('operatorCount', () => {
	it('counts providers joined by any sign once', () => {
		expect(operatorCount([cello, bass])).toBe(1);
		expect(operatorCount([cello, probe, ez1])).toBe(3);
		expect(operatorCount([cello, bass, probe])).toBe(2);
		expect(dependentPairs([cello, bass, probe]).map((p) => [p.a.id, p.b.id])).toEqual([[36, 37]]);
	});
});
