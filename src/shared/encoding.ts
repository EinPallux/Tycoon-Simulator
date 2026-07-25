/**
 * Pure base64 <-> typed-array codecs for save serialization.
 * No Buffer/btoa dependency so the code is identical in sim tests (node)
 * and the browser, and stays DOM-free per the sim purity rule.
 */

const B64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";

export function bytesToBase64(bytes: Uint8Array): string {
  let out = "";
  for (let i = 0; i < bytes.length; i += 3) {
    const b0 = bytes[i] ?? 0;
    const b1 = bytes[i + 1];
    const b2 = bytes[i + 2];
    out += B64[b0 >> 2];
    out += B64[((b0 & 3) << 4) | ((b1 ?? 0) >> 4)];
    out += b1 === undefined ? "=" : B64[((b1 & 15) << 2) | ((b2 ?? 0) >> 6)];
    out += b2 === undefined ? "=" : B64[b2 & 63];
  }
  return out;
}

const B64_LOOKUP: Record<string, number> = {};
for (let i = 0; i < B64.length; i++) B64_LOOKUP[B64.charAt(i)] = i;

export function base64ToBytes(s: string): Uint8Array {
  const clean = s.replace(/=+$/, "");
  const outLen = Math.floor((clean.length * 3) / 4);
  const out = new Uint8Array(outLen);
  let o = 0;
  for (let i = 0; i < clean.length; i += 4) {
    const n0 = B64_LOOKUP[clean.charAt(i)] ?? 0;
    const n1 = B64_LOOKUP[clean.charAt(i + 1)] ?? 0;
    const n2 = B64_LOOKUP[clean.charAt(i + 2)] ?? 0;
    const n3 = B64_LOOKUP[clean.charAt(i + 3)] ?? 0;
    if (o < outLen) out[o++] = (n0 << 2) | (n1 >> 4);
    if (o < outLen) out[o++] = ((n1 & 15) << 4) | (n2 >> 2);
    if (o < outLen) out[o++] = ((n2 & 3) << 6) | n3;
  }
  return out;
}

export function u32ToBase64(arr: Uint32Array): string {
  return bytesToBase64(new Uint8Array(arr.buffer, arr.byteOffset, arr.byteLength));
}

export function base64ToU32(s: string, expectedLength: number): Uint32Array {
  const bytes = base64ToBytes(s);
  const arr = new Uint32Array(bytes.buffer, 0, bytes.byteLength >> 2);
  if (arr.length !== expectedLength) {
    throw new Error(`decoded Uint32Array length ${arr.length}, expected ${expectedLength}`);
  }
  return arr.slice();
}

export function u8ToBase64(arr: Uint8Array): string {
  return bytesToBase64(arr);
}

export function base64ToU8(s: string, expectedLength: number): Uint8Array {
  const bytes = base64ToBytes(s);
  if (bytes.length !== expectedLength) {
    throw new Error(`decoded Uint8Array length ${bytes.length}, expected ${expectedLength}`);
  }
  return bytes;
}
