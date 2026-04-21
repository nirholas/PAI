/**
 * SHA256 Web Worker — streaming hash computation using hash-wasm.
 * Avoids blocking the main thread for multi-GB ISO files.
 *
 * Messages:
 *   IN:  { type: 'init' }
 *   IN:  { type: 'update', data: Uint8Array }
 *   IN:  { type: 'digest' }
 *   OUT: { type: 'ready' }
 *   OUT: { type: 'progress', bytes: number }
 *   OUT: { type: 'digest', hex: string }
 *   OUT: { type: 'error', message: string }
 */

// Minimal SHA-256 implementation (no external dependency needed at runtime)
// Uses the Web Crypto API's subtle.digest in chunked mode via an incremental hasher.
// Since SubtleCrypto.digest() doesn't support streaming, we implement SHA-256 in pure JS.
// This is fast enough for streaming at disk speed; for even better perf, hash-wasm can be
// imported as a module if bundled.

// SHA-256 constants
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

class Sha256Hasher {
  constructor() {
    this.h = new Uint32Array([
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
      0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
    ]);
    this.block = new Uint8Array(64);
    this.blockLen = 0;
    this.totalLen = 0;
    this.w = new Uint32Array(64);
  }

  update(data) {
    let offset = 0;
    this.totalLen += data.length;

    if (this.blockLen > 0) {
      const need = 64 - this.blockLen;
      const copy = Math.min(need, data.length);
      this.block.set(data.subarray(0, copy), this.blockLen);
      this.blockLen += copy;
      offset = copy;
      if (this.blockLen === 64) {
        this._compress(this.block);
        this.blockLen = 0;
      }
    }

    while (offset + 64 <= data.length) {
      this._compress(data.subarray(offset, offset + 64));
      offset += 64;
    }

    if (offset < data.length) {
      this.block.set(data.subarray(offset), 0);
      this.blockLen = data.length - offset;
    }
  }

  digest() {
    // Padding — work on a mutable copy of the block to avoid clobbering state
    const totalBits = this.totalLen * 8;
    // We may need to call _compress once or twice, so work directly on this.block
    this.block[this.blockLen] = 0x80;
    this.blockLen++;
    if (this.blockLen > 56) {
      this.block.fill(0, this.blockLen);
      this._compress(this.block);
      this.block.fill(0);
      this.blockLen = 0;
    }
    this.block.fill(0, this.blockLen, 56);
    // Length in bits as big-endian 64-bit
    const view = new DataView(this.block.buffer);
    view.setUint32(56, Math.floor(totalBits / 0x100000000), false);
    view.setUint32(60, totalBits >>> 0, false);
    this._compress(this.block);

    // Output
    const out = new Uint8Array(32);
    const outView = new DataView(out.buffer);
    for (let i = 0; i < 8; i++) {
      outView.setUint32(i * 4, this.h[i], false);
    }
    return Array.from(out).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  _compress(block) {
    const w = this.w;
    // Always use a fresh Uint8Array view to avoid byteOffset issues with subarrays
    const aligned = block.byteOffset === 0 && block.byteLength === 64
      ? block
      : new Uint8Array(block.buffer, block.byteOffset, 64);
    const view = new DataView(aligned.buffer, aligned.byteOffset, 64);
    for (let i = 0; i < 16; i++) {
      w[i] = view.getUint32(i * 4, false);
    }
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) | 0;
    }

    let [a, b, c, d, e, f, g, h] = this.h;

    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[i] + w[i]) | 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) | 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) | 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) | 0;
    }

    this.h[0] = (this.h[0] + a) | 0;
    this.h[1] = (this.h[1] + b) | 0;
    this.h[2] = (this.h[2] + c) | 0;
    this.h[3] = (this.h[3] + d) | 0;
    this.h[4] = (this.h[4] + e) | 0;
    this.h[5] = (this.h[5] + f) | 0;
    this.h[6] = (this.h[6] + g) | 0;
    this.h[7] = (this.h[7] + h) | 0;
  }
}

function rotr(x, n) {
  return (x >>> n) | (x << (32 - n));
}

// Worker state
let hasher = null;
let bytesProcessed = 0;

self.onmessage = function (e) {
  const { type, data } = e.data;

  try {
    switch (type) {
      case 'init':
        hasher = new Sha256Hasher();
        bytesProcessed = 0;
        self.postMessage({ type: 'ready' });
        break;

      case 'update':
        if (!hasher) {
          self.postMessage({ type: 'error', message: 'Hasher not initialized' });
          return;
        }
        hasher.update(new Uint8Array(data));
        bytesProcessed += data.byteLength;
        self.postMessage({ type: 'progress', bytes: bytesProcessed });
        break;

      case 'digest':
        if (!hasher) {
          self.postMessage({ type: 'error', message: 'Hasher not initialized' });
          return;
        }
        const hex = hasher.digest();
        self.postMessage({ type: 'digest', hex });
        hasher = null;
        break;

      default:
        self.postMessage({ type: 'error', message: `Unknown message type: ${type}` });
    }
  } catch (err) {
    self.postMessage({ type: 'error', message: err.message || String(err) });
  }
};
