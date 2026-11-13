// The runtime a new VM boots (firmware, kernel, initrd), by the hash of its
// Aleph message: the landing page links it for checking. It is the value
// pinned in runtime-pin.js, copied so the landing page does not load the
// attestation library; trust.spec.js keeps the two equal.
export const RUNTIME_ITEM_HASH = '5cd480a138c5969b18d1f6850a5fe0176e6f22e65a323ad9593e71165fb687bc';

// The same runtime as the evidence view names it (name, bundle, boot line),
// for the sample on the landing page; trust.spec.js keeps it equal to the pin.
export const RUNTIME_SAMPLE = Object.freeze({
	name: 'snp-1.2',
	itemHash: RUNTIME_ITEM_HASH,
	bundleSha256: '083630b3b5e22a95ab8f48fdf8a67d80d03420a075ccef97a25d73f8a46378bf',
	cmdlineTemplate: 'console=ttyS0 luks=1 owner={owner}'
});
