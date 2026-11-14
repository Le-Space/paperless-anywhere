// For #202, a builder started for each build: does a second V-PROGRAM on the
// very volumes of a published one get the same launch measurement? The
// measured boot line holds the runtime, the workload's and the volumes' root
// hashes and the resources, not the message's own hash, so it should. This
// copies the content of the V-PROGRAM `FROM` (which must still run, so its
// content is readable) with a new time, signs it with ALEPH_PRIVATE_KEY (the
// sender of `FROM`) and publishes it; Aleph's scheduler starts it. Nothing is
// uploaded: the volumes are the ones `FROM` names.
//
//   FROM=<hash> ALEPH_PRIVATE_KEY=… [AGAIN_RESULT=file] \
//     pnpm exec vite-node scripts/vprogram-again.mjs
//
// The new V-PROGRAM costs credits until it is deleted (workflow "Image builder
// on Aleph", action "delete").
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { privateKeyToAccount } from 'viem/accounts';
import { signAlephMessage } from '@le-space/core';
import { ALEPH_API, broadcast } from '../src/lib/aleph.js';

const { FROM = '', ALEPH_PRIVATE_KEY = '', AGAIN_RESULT = '' } = process.env;
if (!/^[0-9a-f]{64}$/.test(FROM)) throw new Error('FROM: 64 hex');
const key = ALEPH_PRIVATE_KEY.trim();
if (!key) throw new Error('ALEPH_PRIVATE_KEY is empty');
const account = privateKeyToAccount(key.startsWith('0x') ? key : `0x${key}`);

const original = await (await fetch(`${ALEPH_API}/api/v0/messages/${FROM}`)).json();
const message = original?.message;
if (original?.status !== 'processed' || message?.type !== 'V-PROGRAM') throw new Error(`${FROM} is no processed V-PROGRAM (${original?.status})`);
if (message.sender.toLowerCase() !== account.address.toLowerCase()) throw new Error(`${FROM} was sent by ${message.sender}, not by this key`);
const content = typeof message.item_content === 'string' ? JSON.parse(message.item_content) : message.content;
if (!content?.verification?.measurements?.length) throw new Error(`${FROM} names no measurements`);

const again = { ...content, time: Date.now() / 1000, metadata: { ...content.metadata, name: `${content.metadata?.name ?? 'builder'}-again` } };
const itemContent = JSON.stringify(again);
const unsigned = {
	sender: account.address,
	chain: 'ETH',
	type: 'V-PROGRAM',
	item_hash: createHash('sha256').update(itemContent).digest('hex'),
	item_type: 'inline',
	item_content: itemContent,
	time: again.time,
	channel: message.channel ?? null
};
const signed = await signAlephMessage(unsigned, (_sender, payload) => account.signMessage({ message: payload }));
const { httpStatus, response } = await broadcast(signed);
const result = {
	from: FROM,
	again: signed.item_hash,
	httpStatus,
	status: response?.message_status ?? response?.status ?? null,
	sameVolumes: JSON.stringify([content.runtime, content.workload, content.volumes]) === JSON.stringify([again.runtime, again.workload, again.volumes]),
	measurements: again.verification.measurements.map((m) => m?.registers?.launch)
};
console.log(JSON.stringify(result, null, 1));
if (AGAIN_RESULT) await writeFile(AGAIN_RESULT, JSON.stringify(result));
process.exit(httpStatus < 300 ? 0 : 1);
