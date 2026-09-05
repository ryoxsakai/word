export const MAX_PNG_BYTES = 8 * 1024 * 1024;
export const MAX_IMAGE_BASE64 = 4 * Math.ceil(MAX_PNG_BYTES / 3);
const fail = message => { throw Object.assign(new Error(message), { status: 400 }); };

// Check the PNG container before accepting a file for public distribution.
const crcTable = Uint32Array.from({ length: 256 }, (_, n) => {
  for (let i = 0; i < 8; i++) n = n & 1 ? 0xedb88320 ^ (n >>> 1) : n >>> 1;
  return n >>> 0;
});
export function decodeIllustrationPng(base64) {
  if (typeof base64 !== 'string' || !base64.length || base64.length > MAX_IMAGE_BASE64
    || base64.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) fail('PNGを8MB以下のBase64で指定してください');
  let binary;
  try { binary = atob(base64); } catch { fail('画像データが不正です'); }
  const bytes = Uint8Array.from(binary, c => c.charCodeAt(0));
  if (bytes.length > MAX_PNG_BYTES || bytes.length < 45
    || ![137,80,78,71,13,10,26,10].every((b, i) => bytes[i] === b)) fail('PNG画像を指定してください');
  const view = new DataView(bytes.buffer);
  let offset = 8, width, height, hasData = false, ended = false;
  while (offset + 12 <= bytes.length) {
    const length = view.getUint32(offset);
    if (offset + 12 + length > bytes.length) fail('PNGが途中で切れています');
    const type = String.fromCharCode(...bytes.subarray(offset + 4, offset + 8));
    let crc = 0xffffffff;
    for (let i = offset + 4; i < offset + 8 + length; i++) crc = crcTable[(crc ^ bytes[i]) & 255] ^ (crc >>> 8);
    if ((crc ^ 0xffffffff) >>> 0 !== view.getUint32(offset + 8 + length)) fail('PNGのチェックサムが不正です');
    if (offset === 8) {
      if (type !== 'IHDR' || length !== 13) fail('PNGのヘッダーが不正です');
      width = view.getUint32(offset + 8); height = view.getUint32(offset + 12);
      if (width < 32 || height < 32 || width > 4096 || height > 4096) fail('画像の縦横は32〜4096pxにしてください');
    } else if (type === 'IHDR') fail('PNGのヘッダーが重複しています');
    if (type === 'acTL') fail('アニメーションPNGは使用できません');
    if (type === 'IDAT' && length) hasData = true;
    offset += length + 12;
    if (type === 'IEND') {
      if (length || offset !== bytes.length || !hasData) fail('PNGの終端が不正です');
      ended = true; break;
    }
  }
  if (!ended) fail('PNGの画像データが不完全です');
  return { bytes, width, height };
}
