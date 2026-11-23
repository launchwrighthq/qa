import { describe, expect, it } from 'vitest';
import { blackdetectArgs, checkVideo, parseBlackdetect, parseProbeDuration, probeArgs, type ToolResult, type VideoTools, videoFailures } from '../../../src/services/video.mts';

// Recorded with ffmpeg 6.1: a 3 s black VP8 clip, `ffmpeg -hide_banner -nostdin -i black.webm -vf
// blackdetect=d=0.1:pix_th=0.10 -an -f null -`. The progress lines end with a carriage return.
const BLACK_STDERR = [
  "Input #0, matroska,webm, from 'black.webm':",
  '  Duration: 00:00:03.00, start: 0.000000, bitrate: 6 kb/s',
  '  Stream #0:0: Video: vp8, yuv420p(progressive), 64x48, SAR 1:1 DAR 4:3, 25 fps, 25 tbr, 1k tbn',
  "Output #0, null, to 'pipe:':",
  'frame=    0 fps=0.0 q=-0.0 size=       0kB time=00:00:00.00 bitrate=N/A speed=   0x    \r',
  '[out#0/null @ 0x60207ef1f480] video:35kB audio:0kB subtitle:0kB other streams:0kB global headers:0kB muxing overhead: unknown',
  'frame=   75 fps=0.0 q=-0.0 Lsize=N/A time=00:00:02.96 bitrate=N/A speed= 708x    ',
  '[blackdetect @ 0x7cbef4001540] black_start:0 black_end:2.96 black_duration:2.96',
].join('\n');

// The same command on a 3 s test pattern: no blackdetect line.
const LIVE_STDERR = [
  "Input #0, matroska,webm, from 'live.webm':",
  '  Duration: 00:00:03.00, start: 0.000000, bitrate: 31 kb/s',
  'frame=   75 fps=0.0 q=-0.0 Lsize=N/A time=00:00:02.96 bitrate=N/A speed= 420x    ',
].join('\n');

// A browser recording with no container duration: ffprobe prints N/A and ffmpeg has no Duration.
const NO_DURATION_STDERR = ['  Duration: N/A, start: 0.000000, bitrate: N/A', 'frame=  12 time=00:00:00.48 bitrate=N/A', 'frame=  24 time=00:00:00.96 bitrate=N/A'].join('\n');

const ok = (stdout: string, stderr = ''): ToolResult => ({ code: 0, stdout, stderr });

function recorded(probe: ToolResult, decode: ToolResult): VideoTools & { calls: string[][] } {
  const calls: string[][] = [];
  return {
    calls,
    ffprobe: async (args) => (calls.push(['ffprobe', ...args]), probe),
    ffmpeg: async (args) => (calls.push(['ffmpeg', ...args]), decode),
  };
}

const EVIDENCE = { videoCapS: 170, blackRatio: 0.95 };

describe('video checks (spec 2.11.2, R16)', () => {
  it('parses the ffprobe duration and refuses N/A', () => {
    expect(parseProbeDuration('3.000000\n')).toBe(3);
    expect(parseProbeDuration('N/A\n')).toBeNull();
  });

  it('sums the black time and reads the Duration line', () => {
    expect(parseBlackdetect(BLACK_STDERR)).toEqual({ blackS: 2.96, durationS: 3 });
    expect(parseBlackdetect(LIVE_STDERR)).toEqual({ blackS: 0, durationS: 3 });
  });

  it('falls back to the last progress time when there is no duration', () => {
    expect(parseBlackdetect(NO_DURATION_STDERR).durationS).toBeCloseTo(0.96, 5);
  });

  it('fails a black video as blank-video through recorded ffmpeg output (spec 3.3 Blank frame)', async () => {
    const tools = recorded(ok('3.000000\n'), ok('', BLACK_STDERR));
    const result = await checkVideo('assets/s/desktop-a.b.webm', tools, EVIDENCE);
    expect(result).toEqual({ measure: { durationS: 3, blackS: 2.96 }, failures: ['blank-video'] });
    expect(tools.calls).toEqual([
      ['ffprobe', ...probeArgs('assets/s/desktop-a.b.webm')],
      ['ffmpeg', ...blackdetectArgs('assets/s/desktop-a.b.webm')],
    ]);
  });

  it('passes a video with content', async () => {
    expect((await checkVideo('v.webm', recorded(ok('3.0\n'), ok('', LIVE_STDERR)), EVIDENCE)).failures).toEqual([]);
  });

  it('fails a video under 1 s as blank-video, and one over the cap as over-budget', async () => {
    expect((await checkVideo('v.webm', recorded(ok('N/A\n'), ok('', NO_DURATION_STDERR)), EVIDENCE)).failures).toEqual(['blank-video']);
    expect(videoFailures({ durationS: 171, blackS: 0 }, EVIDENCE)).toEqual(['over-budget']);
  });

  it('fails with qa.video.measure when ffmpeg cannot decode the file', async () => {
    await expect(checkVideo('v.webm', recorded(ok(''), { code: 1, stdout: '', stderr: 'Invalid data' }), EVIDENCE)).rejects.toMatchObject({ code: 'qa.video.measure' });
  });
});
