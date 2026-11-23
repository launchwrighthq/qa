import { deflateSync } from 'node:zlib';
import { LaunchwrightError } from '../../../src/kernel/index.mts';
import { describe, expect, it } from 'vitest';
import { blankFailure, decodePngLuma, encodePng, lumaStdDev, pngSize } from '../../../src/services/png.mts';
import { patternPng, uniformPng } from '../../../src/testing/report-fixture.mts';

/** A PNG with one filter type on every line, built by hand so the decoder meets each filter. */
function filteredPng(width: number, height: number, colorType: number, depth: number, rows: number[][], filters: number[]): Uint8Array {
  const raw: number[] = [];
  rows.forEach((row, y) => raw.push(filters[y] as number, ...row));
  const base = encodePng(1, 1, new Uint8Array([0, 0, 0, 255]));
  const ihdr = Buffer.from(base.slice(8, 8 + 25));
  ihdr.writeUInt32BE(width, 8);
  ihdr.writeUInt32BE(height, 12);
  ihdr[16] = depth;
  ihdr[17] = colorType;
  // The decoder reads no CRC, so the IHDR CRC can stay stale.
  const idat = deflateSync(Buffer.from(raw));
  const idatChunk = Buffer.alloc(12 + idat.length);
  idatChunk.writeUInt32BE(idat.length, 0);
  idatChunk.write('IDAT', 4, 'ascii');
  idat.copy(idatChunk, 8);
  return Buffer.concat([base.slice(0, 8), ihdr, idatChunk, Buffer.from([0, 0, 0, 0, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82])]);
}

describe('pngSize', () => {
  it('reads width and height from IHDR', () => {
    expect(pngSize(encodePng(3, 2, new Uint8Array(24)))).toEqual({ width: 3, height: 2 });
  });

  it('returns null for bytes that are not a PNG', () => {
    expect(pngSize(new Uint8Array(40))).toBeNull();
    expect(pngSize(new Uint8Array([0x89, 0x50]))).toBeNull();
  });
});

describe('decodePngLuma', () => {
  it('round-trips an encoded RGBA image to Rec. 601 luminance', () => {
    const png = encodePng(2, 1, new Uint8Array([255, 0, 0, 255, 0, 0, 255, 255]));
    const { luma, width, height } = decodePngLuma(png);
    expect([width, height]).toEqual([2, 1]);
    expect(luma[0]).toBeCloseTo(0.299 * 255, 3);
    expect(luma[1]).toBeCloseTo(0.114 * 255, 3);
  });

  it('undoes the sub, up, average and paeth filters on gray rows', () => {
    // Rows of gray values 10 20 30, then the same values filtered with types 1 to 4.
    const plain = [10, 20, 30];
    const sub = [10, 10, 10];
    const up = [0, 0, 0];
    const avg = [10 - 5, 20 - ((10 + 20) >> 1), 30 - ((20 + 30) >> 1)];
    const paeth = [0, 0, 0];
    const png = filteredPng(3, 5, 0, 8, [plain, sub, up, avg, paeth], [0, 1, 2, 3, 4]);
    expect([...decodePngLuma(png).luma].map((v) => Math.round(v))).toEqual([10, 20, 30, 10, 20, 30, 10, 20, 30, 10, 20, 30, 10, 20, 30]);
  });

  it('reads 16-bit RGB by the high byte', () => {
    const png = filteredPng(1, 1, 2, 16, [[200, 1, 200, 1, 200, 1]], [0]);
    expect(decodePngLuma(png).luma[0]).toBeCloseTo(200, 3);
  });

  it('fails with qa.png.unsupported on an interlaced image', () => {
    const png = Buffer.from(encodePng(1, 1, new Uint8Array(4)));
    png[28] = 1;
    expect(() => decodePngLuma(png)).toThrow(LaunchwrightError);
    expect(() => decodePngLuma(png)).toThrow(/interlaced/);
  });
});

describe('blank frame check (spec 3.3 Blank frame, R16)', () => {
  it('fails a uniform PNG as blank', () => {
    expect(lumaStdDev(uniformPng(32, 32, 255))).toBe(0);
    expect(blankFailure(uniformPng(32, 32, 255), 2)).toBe('blank');
  });

  it('passes a PNG with content', () => {
    expect(lumaStdDev(patternPng(32, 32))).toBeGreaterThan(20);
    expect(blankFailure(patternPng(32, 32), 2)).toBeNull();
  });
});
