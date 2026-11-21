import { describe, expect, it } from 'vitest';
import { BUILDER_VOLUME_MAX_BYTES, builderVolumesToForget, forgetRefusal, volumeRefs } from './forget-guard.js';

const account = '0x' + 'a'.repeat(40);
const h = (c) => c.repeat(64);
const store = (c, over = {}) => ({ hash: h(c), status: 'processed', type: 'STORE', sender: account, size: 300e6, ...over });
const o = (named, kept = []) => ({ account, named: new Set(named.map(h)), kept: new Set(kept.map(h)) });

describe('volumeRefs', () => {
	it('reads the workload, the volumes and their hash trees', () => {
		const content = { workload: { ref: h('1'), hash_tree: h('2') }, volumes: [{ ref: h('3'), hash_tree: h('4') }, { ref: h('3') }] };
		expect(volumeRefs(content)).toEqual([h('1'), h('2'), h('3'), h('4')]);
	});
});

describe('forgetRefusal', () => {
	it('lets a volume of the builder being deleted go', () => {
		expect(forgetRefusal(store('1'), o(['1']))).toBeNull();
	});
	it('refuses a STORE the builder does not name', () => {
		expect(forgetRefusal(store('9'), o(['1']))).toMatch(/not a volume/);
	});
	it('refuses an image, even when a builder names it', () => {
		expect(forgetRefusal(store('1', { size: 943718400 }), o(['1']))).toMatch(/an image/);
		expect(forgetRefusal(store('1', { size: BUILDER_VOLUME_MAX_BYTES + 1 }), o(['1']))).toMatch(/an image/);
	});
	it('refuses a STORE of unknown size', () => {
		expect(forgetRefusal(store('1', { size: null }), o(['1']))).toMatch(/size unknown/);
	});
	it('refuses what own-image.js or a release names', () => {
		expect(forgetRefusal(store('1'), o(['1'], ['1']))).toMatch(/own-image.js or in a release/);
	});
	it('refuses a STORE of another account or one not processed', () => {
		expect(forgetRefusal(store('1', { sender: '0x' + 'b'.repeat(40) }), o(['1']))).toMatch(/sent by/);
		expect(forgetRefusal(store('1', { status: 'forgotten' }), o(['1']))).toMatch(/not a processed STORE/);
	});
});

describe('builderVolumesToForget', () => {
	it('forgets nothing when one STORE is refused', () => {
		const r = builderVolumesToForget([store('1'), store('2', { size: 943718400 })], o(['1', '2']));
		expect(r.forget).toEqual([]);
		expect(r.refused).toHaveLength(1);
	});
	it('forgets the volumes when all may go', () => {
		expect(builderVolumesToForget([store('1'), store('2', { size: 2e6 })], o(['1', '2'])).forget).toEqual([h('1'), h('2')]);
	});
});

describe('leftovers of a refused publication', async () => {
	const { leftoverRefusal, leftoversToForget } = await import('./forget-guard.js');
	const left = (c, over = {}) => store(c, { file: `Qm${c.repeat(44)}`, ...over });
	const sets = ({ named = [], namedFiles = [], referenced = [] } = {}) => ({ account, named: new Set(named), namedFiles: new Set(namedFiles), referenced: new Set(referenced) });

	it('lets a STORE go that nothing names', () => {
		expect(leftoverRefusal(left('1'), sets())).toBeNull();
		expect(leftoversToForget([left('1'), left('2', { size: 2e6 })], sets())).toEqual({ forget: [h('1'), h('2')], refused: [] });
	});
	it('refuses what the repository, a version of own-image.js or a release names', () => {
		expect(leftoverRefusal(left('1'), sets({ named: [h('1')] }))).toMatch(/named in the repository/);
	});
	it('refuses a STORE whose file a named STORE holds too', () => {
		expect(leftoverRefusal(left('1'), sets({ namedFiles: [left('1').file] }))).toMatch(/also the file of a STORE that is named/);
		expect(leftoverRefusal(left('1', { file: h('7') }), sets({ named: [h('7')] }))).toMatch(/also the file/);
	});
	it("refuses what a program, an instance or an aggregate names: a running builder's volume, a deploy of the site", () => {
		expect(leftoverRefusal(left('1'), sets({ referenced: [h('1')] }))).toMatch(/aggregate of the account names it/);
		expect(leftoverRefusal(left('1'), sets({ referenced: [left('1').file] }))).toMatch(/names it/);
	});
	it('refuses an image, a STORE of another account, one not processed, one without file or size', () => {
		expect(leftoverRefusal(left('1', { size: 944766976 }), sets())).toMatch(/larger than any builder volume/);
		expect(leftoverRefusal(left('1', { sender: '0x' + 'b'.repeat(40) }), sets())).toMatch(/sent by/);
		expect(leftoverRefusal(left('1', { status: 'pending' }), sets())).toMatch(/not a processed STORE/);
		expect(leftoverRefusal(left('1', { type: 'PROGRAM' }), sets())).toMatch(/not a processed STORE/);
		expect(leftoverRefusal(left('1', { file: null }), sets())).toMatch(/file is unknown/);
		expect(leftoverRefusal(left('1', { size: null }), sets())).toMatch(/size unknown/);
		expect(leftoverRefusal({ ...left('1'), hash: 'abc' }, sets())).toMatch(/no item hash/);
	});
	it('one refusal forgets nothing; an empty list and a hash named twice are refused', () => {
		expect(leftoversToForget([left('1'), left('2')], sets({ named: [h('2')] })).forget).toEqual([]);
		expect(leftoversToForget([], sets()).refused).toEqual(['no STORE named']);
		expect(leftoversToForget([left('1'), left('1')], sets()).refused[0]).toMatch(/named twice/);
	});
	it('the workflow forgets only the list a dry run printed, and the script reads the aggregates', async () => {
		const { readFileSync } = await import('node:fs');
		const flow = readFileSync(new URL('../../../.github/workflows/forget-leftovers.yml', import.meta.url), 'utf8');
		expect(flow).toMatch(/\[ "\$ACTION" = forget \] && expect=\(--expect "\$LIST_ID"\)/);
		expect(flow).toMatch(/node scripts\/forget-leftovers\.mjs --account "\$ACCOUNT" --hashes "\$HASHES"/);
		expect(flow.match(/aleph message forget/g)).toHaveLength(1);
		expect(flow).toMatch(/- name: Forget them\n\s+if: inputs\.action == 'forget'/);
		// An input reaches a script only as an environment variable.
		for (const line of flow.split('\n').filter((l) => l.includes('${{ inputs.'))) expect(line).toMatch(/^\s+[A-Z_]+: \$\{\{ inputs\.[a-z_]+ \}\}$/);
		const script = readFileSync(new URL('../../scripts/forget-leftovers.mjs', import.meta.url), 'utf8');
		expect(script).toMatch(/aggregates\/\$\{account\}\.json/);
		expect(script).toMatch(/if \(refused\.length\) process\.exit\(1\);/);
	});
});
