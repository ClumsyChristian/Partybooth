/* PartyBooth — tiny animated GIF encoder (fixed 6x7x6 palette + ordered dithering, LZW) */
'use strict';
(function (PB) {
  const RL = 6, GL = 7, BL = 6;
  const PALETTE = (() => {
    const p = new Uint8Array(256 * 3); let i = 0;
    for (let r = 0; r < RL; r++) for (let g = 0; g < GL; g++) for (let b = 0; b < BL; b++) {
      p[i++] = Math.round(r * 255 / (RL - 1)); p[i++] = Math.round(g * 255 / (GL - 1)); p[i++] = Math.round(b * 255 / (BL - 1));
    }
    return p; // 252 colours used, rest black
  })();
  const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5].map(v => (v + 0.5) / 16 - 0.5);

  function quantize(imgData) {
    const { data, width, height } = imgData; const out = new Uint8Array(width * height);
    const sr = 255 / (RL - 1), sg = 255 / (GL - 1), sb = 255 / (BL - 1);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const i = y * width + x, j = i * 4; const t = BAYER[(y & 3) * 4 + (x & 3)];
        let r = Math.round(data[j] / sr + t), g = Math.round(data[j + 1] / sg + t), b = Math.round(data[j + 2] / sb + t);
        r = r < 0 ? 0 : r >= RL ? RL - 1 : r; g = g < 0 ? 0 : g >= GL ? GL - 1 : g; b = b < 0 ? 0 : b >= BL ? BL - 1 : b;
        out[i] = r * GL * BL + g * BL + b;
      }
    }
    return out;
  }

  function lzw(indices, minCodeSize, out) {
    const clear = 1 << minCodeSize, eoi = clear + 1;
    let codeSize = minCodeSize + 1, next = eoi + 1; let dict = new Map();
    let cur = 0, bits = 0; const bytes = [];
    const emit = code => { cur |= code << bits; bits += codeSize; while (bits >= 8) { bytes.push(cur & 255); cur >>>= 8; bits -= 8; } };
    emit(clear);
    let prefix = indices[0];
    for (let i = 1; i < indices.length; i++) {
      const k = indices[i]; const key = (prefix << 8) | k; const f = dict.get(key);
      if (f !== undefined) { prefix = f; continue; }
      emit(prefix);
      if (next >= 4096) { emit(clear); dict = new Map(); codeSize = minCodeSize + 1; next = eoi + 1; }
      else { if (next >= (1 << codeSize)) codeSize++; dict.set(key, next++); }
      prefix = k;
    }
    emit(prefix); emit(eoi);
    if (bits > 0) bytes.push(cur & 255);
    out.push(minCodeSize);
    for (let i = 0; i < bytes.length; i += 255) { const n = Math.min(255, bytes.length - i); out.push(n); for (let j = 0; j < n; j++) out.push(bytes[i + j]); }
    out.push(0);
  }

  /** frames: ImageData[] (same size). delay in ms. Returns Blob (image/gif). */
  PB.encodeGIF = function (frames, delayMs = 120) {
    const w = frames[0].width, h = frames[0].height; const out = [];
    const str = s => { for (let i = 0; i < s.length; i++) out.push(s.charCodeAt(i)); };
    const u16 = v => { out.push(v & 255, (v >> 8) & 255); };
    str('GIF89a'); u16(w); u16(h); out.push(0xF7, 0, 0);
    for (let i = 0; i < PALETTE.length; i++) out.push(PALETTE[i]);
    out.push(0x21, 0xFF, 0x0B); str('NETSCAPE2.0'); out.push(0x03, 0x01); u16(0); out.push(0);
    const cs = Math.max(2, Math.round(delayMs / 10));
    frames.forEach(f => {
      out.push(0x21, 0xF9, 0x04, 0x04); u16(cs); out.push(0, 0);
      out.push(0x2C); u16(0); u16(0); u16(w); u16(h); out.push(0);
      lzw(quantize(f), 8, out);
    });
    out.push(0x3B);
    return new Blob([new Uint8Array(out)], { type: 'image/gif' });
  };
})(window.PB);
