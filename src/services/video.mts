// Video checks (spec 2.11.2): duration through `ffprobe`, black time through `ffmpeg -vf
// blackdetect`. The tools arrive as functions, so a test gives recorded output and runs no binary.
import { execFile } from 'node:child_process';
import { LaunchwrightError } from '@launchwrighthq/kernel';
import type { QaConfig } from '../config.mts';
import type { RowFailure } from './types.mts';

/** The result of one tool run. */
export interface ToolResult {
  code: number;
  stdout: string;
  stderr: string;
}

/** Runs one tool with these arguments. */
export type ToolRun = (args: readonly string[]) => Promise<ToolResult>;

export interface VideoTools {
  ffprobe: ToolRun;
  ffmpeg: ToolRun;
}

/** What a video measures. */
export interface VideoMeasure {
  durationS: number;
  blackS: number;
}

/** The longest frame run that blackdetect reports, and the darkness of a black pixel. */
export const BLACKDETECT_FILTER = 'blackdetect=d=0.1:pix_th=0.10';

/** The milliseconds that one tool run may take. A QA clip is minutes long, and blackdetect decodes it once. */
export const VIDEO_TOOL_TIMEOUT_MS = 300_000;

function runFile(bin: string, timeoutMs: number): ToolRun {
  return (args) =>
    new Promise((resolve, reject) => {
      execFile(bin, [...args], { maxBuffer: 16 * 1024 * 1024, timeout: timeoutMs, killSignal: 'SIGKILL' }, (error, stdout, stderr) => {
        // Node also kills a child whose output passes maxBuffer; that case stays a tool error.
        if (error?.killed && error.code !== 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') {
          reject(new LaunchwrightError('qa.video.timeout', `${bin} ran past ${timeoutMs} ms and was stopped.`, { cause: error, context: { bin, timeoutMs } }));
          return;
        }
        if (error && typeof error.code !== 'number') {
          reject(new LaunchwrightError('qa.video.tool', `Cannot run ${bin}. Install ffmpeg, or check the doctor.`, { cause: error, context: { bin } }));
          return;
        }
        resolve({ code: typeof error?.code === 'number' ? error.code : 0, stdout, stderr });
      });
    });
}

/** The tools on this machine, by binary name or path. `timeoutMs` bounds each run. */
export function systemVideoTools(bins: { ffprobe?: string; ffmpeg?: string; timeoutMs?: number } = {}): VideoTools {
  const timeoutMs = bins.timeoutMs ?? VIDEO_TOOL_TIMEOUT_MS;
  return { ffprobe: runFile(bins.ffprobe ?? 'ffprobe', timeoutMs), ffmpeg: runFile(bins.ffmpeg ?? 'ffmpeg', timeoutMs) };
}

/** The `ffprobe` arguments that print the container duration in seconds. */
export function probeArgs(path: string): string[] {
  return ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', path];
}

/** The `ffmpeg` arguments that decode the video and log each black run. */
export function blackdetectArgs(path: string): string[] {
  return ['-hide_banner', '-nostdin', '-i', path, '-vf', BLACKDETECT_FILTER, '-an', '-f', 'null', '-'];
}

/** The duration that `ffprobe` printed, or null for `N/A` and empty output. */
export function parseProbeDuration(stdout: string): number | null {
  const value = Number.parseFloat(stdout.trim());
  return Number.isFinite(value) && value >= 0 ? value : null;
}

const hms = (h: string, m: string, s: string): number => Number(h) * 3600 + Number(m) * 60 + Number(s);

/**
 * The black seconds and the decoded duration from the `ffmpeg` log. The duration is the
 * `Duration:` header line, else the last progress `time=`; a browser `.webm` often has no header
 * duration.
 */
export function parseBlackdetect(stderr: string): { blackS: number; durationS: number | null } {
  let blackS = 0;
  for (const m of stderr.matchAll(/black_duration:\s*([\d.]+)/g)) blackS += Number(m[1]);
  const header = /Duration:\s*(\d+):(\d+):([\d.]+)/.exec(stderr);
  let durationS: number | null = header ? hms(header[1] as string, header[2] as string, header[3] as string) : null;
  if (durationS === null) {
    const times = [...stderr.matchAll(/time=(\d+):(\d+):([\d.]+)/g)];
    const last = times.at(-1);
    if (last) durationS = hms(last[1] as string, last[2] as string, last[3] as string);
  }
  return { blackS, durationS };
}

/** Measures one video. Fails with `qa.video.measure` when neither tool gives a duration. */
export async function measureVideo(path: string, tools: VideoTools): Promise<VideoMeasure> {
  const probe = await tools.ffprobe(probeArgs(path));
  const decoded = await tools.ffmpeg(blackdetectArgs(path));
  if (decoded.code !== 0) {
    throw new LaunchwrightError('qa.video.measure', `ffmpeg cannot decode ${path} (exit ${decoded.code})`, {
      context: { path, stderr: decoded.stderr.slice(-2000) },
    });
  }
  const black = parseBlackdetect(decoded.stderr);
  const durationS = (probe.code === 0 ? parseProbeDuration(probe.stdout) : null) ?? black.durationS;
  if (durationS === null) {
    throw new LaunchwrightError('qa.video.measure', `Neither ffprobe nor ffmpeg gives a duration for ${path}`, { context: { path } });
  }
  return { durationS, blackS: black.blackS };
}

/** The shortest video that counts as evidence, in seconds (spec 2.11.2). */
export const MIN_VIDEO_S = 1;

/**
 * The failures of a measured video: `blank-video` under 1 s or with black over `blackRatio` of
 * its time, `over-budget` over `videoCapS`.
 */
export function videoFailures(m: VideoMeasure, evidence: Pick<QaConfig['evidence'], 'videoCapS' | 'blackRatio'>): RowFailure[] {
  const out: RowFailure[] = [];
  if (m.durationS < MIN_VIDEO_S || m.blackS / m.durationS > evidence.blackRatio) out.push('blank-video');
  if (m.durationS > evidence.videoCapS) out.push('over-budget');
  return out;
}

/** Measures a video and returns its failures. */
export async function checkVideo(
  path: string,
  tools: VideoTools,
  evidence: Pick<QaConfig['evidence'], 'videoCapS' | 'blackRatio'>,
): Promise<{ measure: VideoMeasure; failures: RowFailure[] }> {
  const measure = await measureVideo(path, tools);
  return { measure, failures: videoFailures(measure, evidence) };
}
