// Before a start that restores a backup: does any copy deliver? Asked from
// the browser with a one-byte range request in no-cors mode. The answer is
// opaque, so the app cannot read it, but any answer (even an error page)
// means the provider's host is up; a TypeError means it is not (refused,
// DNS, TLS, or no answer in time). A no-cors request never fails on CORS.
// Only whether a copy can be fetched is learnt, not whether its bytes are
// right: the VM checks those (piece CID) when it restores.

/**
 * @param {string} url a copy's retrieval URL
 * @param {{ fetch?: typeof fetch, timeoutMs?: number }} [o]
 * @returns {Promise<boolean>}
 */
export async function copyAnswers(url, { fetch: fetchImpl = fetch, timeoutMs = 10_000 } = {}) {
	if (!/^https:\/\//.test(String(url ?? ''))) return false;
	// Once the headers are in, the rest is cut off: should a browser drop the
	// range, the piece (up to a gigabyte) is not downloaded for this question.
	const stop = new AbortController();
	const timer = setTimeout(() => stop.abort(), timeoutMs);
	try {
		await fetchImpl(url, { mode: 'no-cors', cache: 'no-store', headers: { Range: 'bytes=0-0' }, signal: stop.signal });
		return true;
	} catch {
		return false;
	} finally {
		clearTimeout(timer);
		stop.abort();
	}
}

/**
 * How many copies of the backup a restore entry names answer, asked in
 * parallel. A copy in parts counts when its first part answers.
 * @param {{ copies?: { retrievalUrl?: string, retrievalUrls?: string[] }[] } | null | undefined} entry
 * @param {Parameters<typeof copyAnswers>[1]} [o]
 * @returns {Promise<{ answering: number, total: number }>}
 */
export async function answeringCopies(entry, o) {
	const copies = entry?.copies ?? [];
	const answers = await Promise.all(copies.map((c) => copyAnswers(c.retrievalUrls?.[0] ?? c.retrievalUrl ?? '', o)));
	return { answering: answers.filter(Boolean).length, total: copies.length };
}
