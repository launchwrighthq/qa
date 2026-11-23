// PNG reading for the evidence checks (spec 2.11.2): the size from the IHDR chunk, and a decoder
// for the luminance spread that finds a blank frame. Node `zlib` only, no dependency.
import { deflateSync, inflateSync } from 'node:zlib';
import { LaunchwrightError } from '../kernel/index.mts';

const MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

export interface PngSize {
  width: number;
  height: number;
}

/** The pixel size from the IHDR chunk, or null when the bytes are not a PNG header. */
export function pngSize(bytes: Uint8Array): PngSize | null {
  if (bytes.length < 24) return null;
  for (let i = 0; i < MAGIC.length; i += 1) if (bytes[i] !== MAGIC[i]) return null;
  if (String.fromCharCode(bytes[12] as number, bytes[13] as number, bytes[14] as number, bytes[15] as number) !== 'IHDR') return null;
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const width = view.getUint32(16);
  const height = view.getUint32(20);
  return width > 0 && height > 0 ? { width, height } : null;
}

/** A decoded PNG as one luminance value (0 to 255) per pixel. */
export interface PngLuma extends PngSize {
  luma: Float32Array;
}

/** Channels per color type: 0 gray, 2 RGB, 3 palette, 4 gray and alpha, 6 RGBA. */
const CHANNELS: Record<number, number> = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 };

function bad(message: string, cause?: unknown): LaunchwrightError {
  return new LaunchwrightError('qa.png.unsupported', `PNG decode: ${message}`, cause === undefined ? {} : { cause });
}

function paeth(a: number, b: number, c: number): number {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) return a;
  return pb <= pc ? b : c;
}

/**
 * Decodes a non-interlaced PNG of bit depth 8 or 16 (palette: 8) into luminance, with the
 * Rec. 601 weights. Alpha is ignored. Fails with `qa.png.unsupported` on any other form.
 */
export function decodePngLuma(bytes: Uint8Array): PngLuma {
  const size = pngSize(bytes);
  if (!size) throw bad('not a PNG');
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let depth = 0;
  let colorType = -1;
  let palette: Uint8Array | null = null;
  const idat: Uint8Array[] = [];
  let at = 8;
  while (at + 8 <= bytes.length) {
    const length = view.getUint32(at);
    const type = String.fromCharCode(...bytes.subarray(at + 4, at + 8));
    const data = bytes.subarray(at + 8, at + 8 + length);
    if (type === 'IHDR') {
      depth = data[8] as number;
      colorType = data[9] as number;
      if (data[12] !== 0) throw bad('interlaced images are not supported');
    } else if (type === 'PLTE') palette = data;
    else if (type === 'IDAT') idat.push(data);
    else if (type === 'IEND') break;
    at += 12 + length;
  }
  const channels = CHANNELS[colorType];
  if (channels === undefined) throw bad(`color type ${colorType}`);
  if (!(depth === 8 || (depth === 16 && colorType !== 3))) throw bad(`bit depth ${depth} with color type ${colorType}`);
  if (colorType === 3 && !palette) throw bad('a palette image without PLTE');

  let raw: Buffer;
  try {
    raw = inflateSync(Buffer.concat(idat));
  } catch (cause) {
    throw bad('the image data does not inflate', cause);
  }
  const bpp = (channels * depth) / 8;
  const stride = size.width * bpp;
  if (raw.length < (stride + 1) * size.height) throw bad('the image data is shorter than the header says');

  const luma = new Float32Array(size.width * size.height);
  let prev = new Uint8Array(stride);
  let line = new Uint8Array(stride);
  for (let y = 0; y < size.height; y += 1) {
    const offset = y * (stride + 1);
    const filter = raw[offset] as number;
    for (let x = 0; x < stride; x += 1) {
      const value = raw[offset + 1 + x] as number;
      const a = x >= bpp ? (line[x - bpp] as number) : 0;
      const b = prev[x] as number;
      const c = x >= bpp ? (prev[x - bpp] as number) : 0;
      let out: number;
      if (filter === 0) out = value;
      else if (filter === 1) out = value + a;
      else if (filter === 2) out = value + b;
      else if (filter === 3) out = value + ((a + b) >> 1);
      else if (filter === 4) out = value + paeth(a, b, c);
      else throw bad(`filter type ${filter} on row ${y}`);
      line[x] = out & 0xff;
    }
    const sample = (px: number, ch: number): number => (depth === 8 ? (line[px * bpp + ch] as number) : (line[px * bpp + ch * 2] as number));
    for (let px = 0; px < size.width; px += 1) {
      let r: number;
      let g: number;
      let bl: number;
      if (colorType === 3) {
        const i = (line[px] as number) * 3;
        r = (palette as Uint8Array)[i] ?? 0;
        g = (palette as Uint8Array)[i + 1] ?? 0;
        bl = (palette as Uint8Array)[i + 2] ?? 0;
      } else if (colorType === 0 || colorType === 4) {
        r = g = bl = sample(px, 0);
      } else {
        r = sample(px, 0);
        g = sample(px, 1);
        bl = sample(px, 2);
      }
      luma[y * size.width + px] = 0.299 * r + 0.587 * g + 0.114 * bl;
    }
    [prev, line] = [line, prev];
  }
  return { ...size, luma };
}

/** The standard deviation of the luminance, 0 to 255. */
export function lumaStdDev(bytes: Uint8Array): number {
  const { luma } = decodePngLuma(bytes);
  let mean = 0;
  let m2 = 0;
  for (let i = 0; i < luma.length; i += 1) {
    const v = luma[i] as number;
    const delta = v - mean;
    mean += delta / (i + 1);
    m2 += delta * (v - mean);
  }
  return Math.sqrt(m2 / luma.length);
}

/** `blank` when the luminance spread is below `blankStdDev` (spec 2.11.2), else null. */
export function blankFailure(bytes: Uint8Array, blankStdDev: number): 'blank' | null {
  return lumaStdDev(bytes) < blankStdDev ? 'blank' : null;
}

/**
 * Encodes 8-bit RGBA pixels as a PNG (filter 0). The `fake` target and the tests make their
 * images with it.
 */
export function encodePng(width: number, height: number, rgba: Uint8Array): Uint8Array {
  if (rgba.length !== width * height * 4) {
    throw new LaunchwrightError('qa.png.size', `encodePng: ${rgba.length} bytes is not ${width}x${height} RGBA`);
  }
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (width * 4 + 1)] = 0;
    Buffer.from(rgba.buffer, rgba.byteOffset + y * width * 4, width * 4).copy(raw, y * (width * 4 + 1) + 1);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr.set([8, 6, 0, 0, 0], 8);
  return Buffer.concat([Buffer.from(MAGIC), chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(bytes: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of bytes) c = (CRC_TABLE[(c ^ b) & 0xff] as number) ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type: string, data: Uint8Array): Buffer {
  const out = Buffer.alloc(12 + data.length);
  out.writeUInt32BE(data.length, 0);
  out.write(type, 4, 'ascii');
  Buffer.from(data).copy(out, 8);
  out.writeUInt32BE(crc32(out.subarray(4, 8 + data.length)), 8 + data.length);
  return out;
}
