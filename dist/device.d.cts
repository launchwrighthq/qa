import { z } from 'zod';
import { Q as QaConfig$1 } from './config-B-lxHEnb.cjs';
import { P as Provider, Q as QaExtension } from './extensions-BYuCo9KW.cjs';
import { Q as QaTarget } from './contract-braBVxB_.cjs';
import './app-KXgbRXYO.cjs';

/** The host proxy of a rig whose gateway does not hairpin (spec 2.9, `ingress: host-proxy`). */
declare const hostProxyConfig: z.ZodObject<{
    upstream: z.ZodString;
    port: z.ZodDefault<z.ZodNumber>;
}, z.core.$strip>;
/** The local tools. A name is looked up on PATH; a path is used as it is. */
declare const deviceToolsConfig: z.ZodObject<{
    adb: z.ZodDefault<z.ZodString>;
    ssh: z.ZodDefault<z.ZodString>;
    scrcpy: z.ZodDefault<z.ZodString>;
    scrcpyVersion: z.ZodDefault<z.ZodString>;
    ffmpeg: z.ZodDefault<z.ZodString>;
}, z.core.$strip>;
/** The Telegram app on an Android device (spec 2.8). */
declare const telegramDeviceConfig: z.ZodObject<{
    package: z.ZodDefault<z.ZodString>;
    apkUrl: z.ZodDefault<z.ZodString>;
    apkSha256: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
/** BrowserStack Automate (spec 2.8). The keys come from the secret store through the config. */
declare const browserstackConfig: z.ZodObject<{
    username: z.ZodOptional<z.ZodString>;
    accessKey: z.ZodOptional<z.ZodString>;
    hub: z.ZodDefault<z.ZodString>;
    api: z.ZodDefault<z.ZodString>;
    budgetMinutes: z.ZodDefault<z.ZodNumber>;
    idleTimeoutS: z.ZodDefault<z.ZodNumber>;
    project: z.ZodDefault<z.ZodString>;
    build: z.ZodDefault<z.ZodString>;
}, z.core.$strip>;
/** A rig: a host that holds devices (spec 2.9). */
declare const rigConfig: z.ZodObject<{
    transport: z.ZodEnum<{
        local: "local";
        ssh: "ssh";
        cloud: "cloud";
    }>;
    host: z.ZodOptional<z.ZodString>;
    adbPort: z.ZodOptional<z.ZodNumber>;
    webkitPorts: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
    ingress: z.ZodDefault<z.ZodEnum<{
        direct: "direct";
        "host-proxy": "host-proxy";
    }>>;
    hostProxy: z.ZodOptional<z.ZodObject<{
        upstream: z.ZodString;
        port: z.ZodDefault<z.ZodNumber>;
    }, z.core.$strip>>;
}, z.core.$strip>;
/** A device on a rig (spec 2.9). Driver-specific keys pass through. */
declare const deviceConfig: z.ZodObject<{
    rig: z.ZodString;
    kind: z.ZodString;
}, z.core.$loose>;
/** Key `qa.device` of config section `qa`. */
declare const qaDeviceConfig: z.ZodPrefault<z.ZodObject<{
    rigs: z.ZodPrefault<z.ZodRecord<z.ZodString, z.ZodObject<{
        transport: z.ZodEnum<{
            local: "local";
            ssh: "ssh";
            cloud: "cloud";
        }>;
        host: z.ZodOptional<z.ZodString>;
        adbPort: z.ZodOptional<z.ZodNumber>;
        webkitPorts: z.ZodOptional<z.ZodArray<z.ZodNumber>>;
        ingress: z.ZodDefault<z.ZodEnum<{
            direct: "direct";
            "host-proxy": "host-proxy";
        }>>;
        hostProxy: z.ZodOptional<z.ZodObject<{
            upstream: z.ZodString;
            port: z.ZodDefault<z.ZodNumber>;
        }, z.core.$strip>>;
    }, z.core.$strip>>>;
    devices: z.ZodDefault<z.ZodRecord<z.ZodString, z.ZodObject<{
        rig: z.ZodString;
        kind: z.ZodString;
    }, z.core.$loose>>>;
    tools: z.ZodPrefault<z.ZodObject<{
        adb: z.ZodDefault<z.ZodString>;
        ssh: z.ZodDefault<z.ZodString>;
        scrcpy: z.ZodDefault<z.ZodString>;
        scrcpyVersion: z.ZodDefault<z.ZodString>;
        ffmpeg: z.ZodDefault<z.ZodString>;
    }, z.core.$strip>>;
    telegram: z.ZodPrefault<z.ZodObject<{
        package: z.ZodDefault<z.ZodString>;
        apkUrl: z.ZodDefault<z.ZodString>;
        apkSha256: z.ZodOptional<z.ZodString>;
    }, z.core.$strip>>;
    browserstack: z.ZodPrefault<z.ZodObject<{
        username: z.ZodOptional<z.ZodString>;
        accessKey: z.ZodOptional<z.ZodString>;
        hub: z.ZodDefault<z.ZodString>;
        api: z.ZodDefault<z.ZodString>;
        budgetMinutes: z.ZodDefault<z.ZodNumber>;
        idleTimeoutS: z.ZodDefault<z.ZodNumber>;
        project: z.ZodDefault<z.ZodString>;
        build: z.ZodDefault<z.ZodString>;
    }, z.core.$strip>>;
}, z.core.$strip>>;
type RigConfig = z.infer<typeof rigConfig>;
type DeviceConfig = z.infer<typeof deviceConfig>;
type QaDeviceConfig = z.infer<typeof qaDeviceConfig>;
/** Config section `qa` with key `device` parsed by `qaDeviceConfig`. */
type QaConfig = Omit<QaConfig$1, 'device'> & {
    device: QaDeviceConfig;
};
/** `cfg` with key `device` parsed. Fails with `qa.device.config` and every issue. */
declare function withDevice(cfg: QaConfig$1): QaConfig;
/** Config section `qa` of `sections`, parsed, with the app folders and key `device` parsed. */
declare function qaConfigOf(sections?: Record<string, unknown>): QaConfig;
/** Keys of a device of kind `android`: a phone on USB, local or on a rig. */
declare const androidDeviceKeys: z.ZodObject<{
    serial: z.ZodString;
    recorder: z.ZodDefault<z.ZodEnum<{
        scrcpy: "scrcpy";
        screenrecord: "screenrecord";
    }>>;
    browserPackage: z.ZodDefault<z.ZodString>;
}, z.core.$strip>;
/** Keys of a device of kind `android-emulator`: an AVD on a rig. */
declare const emulatorDeviceKeys: z.ZodObject<{
    avd: z.ZodString;
    port: z.ZodDefault<z.ZodNumber>;
    gpu: z.ZodDefault<z.ZodString>;
    recorder: z.ZodDefault<z.ZodEnum<{
        scrcpy: "scrcpy";
        screenrecord: "screenrecord";
    }>>;
    browserPackage: z.ZodDefault<z.ZodString>;
}, z.core.$strip>;
/** Keys of a device of kind `ios`: an iPhone on a rig, through `ios_webkit_debug_proxy`. */
declare const iosDeviceKeys: z.ZodObject<{
    udid: z.ZodOptional<z.ZodString>;
    match: z.ZodOptional<z.ZodString>;
}, z.core.$strip>;
/** Keys of a device of kind `ios-simulator`. */
declare const simulatorDeviceKeys: z.ZodObject<{
    udid: z.ZodOptional<z.ZodString>;
    inputTool: z.ZodOptional<z.ZodString>;
    inspectorPort: z.ZodOptional<z.ZodNumber>;
}, z.core.$strip>;
/** Keys of a BrowserStack device (`ios-safari`, `android-chrome`). */
declare const cloudDeviceKeys: z.ZodObject<{
    model: z.ZodString;
    os: z.ZodString;
}, z.core.$strip>;

/**
 * Adds the device targets to `QA_TARGETS` of the `qa` module at boot. Boot fails with the cause
 * `qa.device.config` when key `qa.device` of config section `qa` is not valid.
 */
declare const qaDeviceProvider: Provider;

/** How lw reaches a device: adb, the WebKit inspector of iOS, or WebDriver on a cloud phone. */
type DeviceAccess = 'adb' | 'webkit' | 'webdriver';
/** The traits of one device kind. */
interface DeviceKind {
    readonly access: DeviceAccess;
    /** The `qa.target` driver that runs a QA leg on a device of the kind. */
    readonly target: string;
    /** `adb` only: an AVD on a rig, with the keys `emulatorDeviceKeys`, that lw boots and stops. */
    readonly emulator?: boolean;
    /** `webkit` only: an iOS simulator on a rig, with the keys `simulatorDeviceKeys`. `simctl` takes its screenshots and video. */
    readonly simulator?: boolean;
    /** `webdriver` only: the browser of the cloud phone. */
    readonly browser?: 'chrome' | 'safari';
    /** `webdriver` only: the WebDriver session reads the page console. */
    readonly console?: boolean;
}
/** Adds or replaces a device kind. A config names it in `qa.device.devices.<name>.kind`. */
declare function registerDeviceKind(name: string, kind: DeviceKind): void;
/** The name of every registered kind, sorted. */
declare function deviceKindNames(): string[];
/** The traits of `kind`. Throws `qa.device.kind` for a kind that no one registered. */
declare function deviceKind(kind: string): DeviceKind;

/** The outcome of one process. A non-zero exit is data, not an exception. */
interface ProcessResult {
    code: number;
    /** Bytes, because `screencap` and `cat` of a video return binary output. */
    stdout: Buffer;
    stderr: string;
}
/** The milliseconds that `run` gives a process when the caller names no `timeoutMs`. */
declare const DEFAULT_RUN_TIMEOUT_MS = 120000;
/** The `timeoutMs` of a started process that runs until its owner signals it, such as a mirror window. */
declare const NO_TIMEOUT = "none";
interface RunOptions {
    /** Written to stdin, then stdin closes. */
    input?: string | Buffer;
    /** SIGKILL after this many milliseconds. `run` uses `DEFAULT_RUN_TIMEOUT_MS` without it. */
    timeoutMs?: number;
    /** Added to the environment of the child. */
    env?: Record<string, string>;
}
/** The options of `start`. Each call states its limit: milliseconds, or `NO_TIMEOUT` with the reason at the call. */
interface StartOptions extends Omit<RunOptions, 'timeoutMs'> {
    timeoutMs: number | typeof NO_TIMEOUT;
    detached?: boolean;
}
/** A process that runs until it exits or gets a signal. */
interface RunningProcess {
    readonly done: Promise<ProcessResult>;
    signal(sig: NodeJS.Signals): void;
}
interface ProcessRunner {
    run(cmd: string, args: string[], opts?: RunOptions): Promise<ProcessResult>;
    start(cmd: string, args: string[], opts: StartOptions): RunningProcess;
}
/** The part of a WebSocket that the CDP and WebKit clients use. Node 22's global WebSocket has it. */
interface SocketLike {
    send(data: string): void;
    close(): void;
    onopen: ((ev: unknown) => void) | null;
    onmessage: ((ev: {
        data: unknown;
    }) => void) | null;
    onerror: ((ev: unknown) => void) | null;
    onclose: ((ev: {
        code?: number;
        reason?: string;
    }) => void) | null;
}
type SocketFactory = (url: string, opts?: {
    origin?: string;
}) => SocketLike;
/** The clock of the device submodule. A test clock moves `now` forward in `sleep` and never waits. */
interface DeviceClock {
    now(): number;
    sleep(ms: number): Promise<void>;
}
interface DeviceDeps {
    /** The project root. State and the APK cache live under `<root>/.lw/qa/device/`. */
    root: string;
    run: ProcessRunner;
    socket: SocketFactory;
    fetch: typeof fetch;
    clock: DeviceClock;
    /** A loopback TCP port that nothing listens on. */
    freePort(): Promise<number>;
}
/** The deps of a real run in the project at `root`. */
declare function systemDeviceDeps(root: string): DeviceDeps;

interface Rig {
    readonly name: string;
    readonly config: RigConfig;
    /** True for an ssh rig: its loopback ports are not this machine's. */
    readonly remote: boolean;
    /** The folder of QA files on the rig: the host proxy, its log, AVD snapshots. Relative to home on an ssh rig. */
    readonly stateDir: string;
    /** Opens the ssh master. Nothing for a local rig. */
    ensure(): Promise<void>;
    /** Runs one shell command on the rig. */
    exec(command: string, opts?: RunOptions): Promise<ProcessResult>;
    /**
     * Makes a loopback port of the rig reachable on this machine. Returns the local port: `localPort`
     * when given, a free port otherwise. A local rig returns the rig port.
     */
    forward(remotePort: number, localPort?: number): Promise<number>;
    /** Removes a forward that `forward` made. */
    unforward(remotePort: number): Promise<void>;
    /** The adb arguments that select the adb server of the rig: `-L tcp:127.0.0.1:<port>`, or none. */
    adbServer(): Promise<string[]>;
    /** The adb server port as this machine sees it, for tools that read `ANDROID_ADB_SERVER_PORT`. */
    adbPort(): Promise<number>;
    /** Writes a file on the rig. The content goes through stdin, so no quoting can change it. */
    writeFile(path: string, content: string): Promise<void>;
    /** Closes the master and every forward on it. */
    down(): Promise<void>;
}
/** A device with its rig, resolved from config. */
interface ResolvedDevice {
    name: string;
    device: DeviceConfig;
    rigName: string;
    rig: RigConfig;
}
/** The device `name`, or `qa.device.unknown` with the configured names. */
declare function resolveDevice(config: QaConfig, name: string | undefined): ResolvedDevice;
/** What drivers and commands share: the config, the seams and one rig pool. */
interface DeviceContext {
    config: QaConfig;
    deps: DeviceDeps;
    rigs: RigPool;
}
declare function createDeviceContext(config: QaConfig, deps: DeviceDeps): DeviceContext;
/** One rig per name for the whole process, so each ssh rig has exactly one master. */
interface RigPool {
    get(name: string): Rig;
    downAll(): Promise<void>;
}

interface DoctorCheck {
    /** `tool`, `rig <name>` or `device <name>`. */
    scope: string;
    name: string;
    ok: boolean;
    detail: string;
    /** The step that fixes a failure. */
    fix?: string;
    /** A failure that blocks no configured device: the doctor still exits 0. */
    optional?: boolean;
}
/** Every check for one device, or for every configured device. */
declare function collectDoctor(ctx: DeviceContext, deviceName?: string): Promise<DoctorCheck[]>;
/** The report lines. A failure gets a second line with its fix. */
declare function formatDoctor(checks: DoctorCheck[]): string[];

declare const qaExtension: QaExtension;

/**
 * The device targets by driver name. They share one rig pool, so each ssh rig has one master.
 * `deps` defaults to real processes, sockets and fetch in the project at `root` (default: cwd).
 */
declare function deviceTargets(config: QaConfig, deps?: DeviceDeps): Record<string, QaTarget>;

export { DEFAULT_RUN_TIMEOUT_MS, type DeviceAccess, type DeviceClock, type DeviceConfig, type DeviceContext, type DeviceDeps, type DeviceKind, type DoctorCheck, NO_TIMEOUT, type ProcessResult, type ProcessRunner, type QaConfig, type QaDeviceConfig, type Rig, type RigConfig, type RunningProcess, type SocketFactory, type SocketLike, type StartOptions, androidDeviceKeys, browserstackConfig, cloudDeviceKeys, collectDoctor, createDeviceContext, deviceConfig, deviceKind, deviceKindNames, deviceTargets, deviceToolsConfig, emulatorDeviceKeys, formatDoctor, hostProxyConfig, iosDeviceKeys, qaConfigOf, qaDeviceConfig, qaDeviceProvider, qaExtension, registerDeviceKind, resolveDevice, rigConfig, simulatorDeviceKeys, systemDeviceDeps, telegramDeviceConfig, withDevice };
