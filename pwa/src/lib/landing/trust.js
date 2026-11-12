// The runtime a new VM boots (firmware, kernel, initrd), by the hash of its
// Aleph message: the landing page links it for checking. It is the value
// pinned in runtime-pin.js, copied so the landing page does not load the
// attestation library; trust.spec.js keeps the two equal.
export const RUNTIME_ITEM_HASH = '5cd480a138c5969b18d1f6850a5fe0176e6f22e65a323ad9593e71165fb687bc';
