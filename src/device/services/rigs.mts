// Rigs and devices from config (spec 2.9). A rig is `local`, `ssh` or `cloud`. An ssh rig has one
// multiplexed master (`ssh -M`), and every forward rides it: the adb server, WebView CDP ports,
// WebKit ports and the scrcpy video socket. No host, device or address is written here.
import { mkdir, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';
import { LaunchwrightError } from '../../kernel/index.mts';
import { sha256 } from '../../kernel/services/fs.mts';
import { shq } from '../../kernel/services/text.mts';
import type { DeviceConfig, QaConfig, RigConfig } from '../config.mts';
import { type DeviceDeps, orFail, type ProcessResult, type RunOptions, said } from './process.mts';

/** The folder of device state under the project root. */
export const DEVICE_STATE_DIR = '.lw/qa/device';

/** The folder of QA files on an ssh rig, relative to the home folder where an ssh command starts. */
export const RIG_STATE_DIR = '.lw-qa';

/**
 * The longest control socket path that binds. macOS takes 103 bytes and a NUL; ssh adds 17 bytes
 * (`.` and 16 random characters) to the path while it creates the socket.
 */
const MAX_SOCKET_PATH = 104 - 1 - 17;

/** The folder of ssh control sockets, under the home folder. A project path is too long for a socket. */
export const SSH_SOCKET_DIR = '.lw-qa/ssh';

/**
 * Homebrew and the Android SDK are not on the PATH of a non-login ssh shell on macOS, so every
 * rig command adds them. A missing folder on the PATH is harmless.
 */
export const REMOTE_PATH =
  'export PATH="$PATH:/opt/homebrew/bin:/usr/local/bin:$HOME/Library/Android/sdk/platform-tools:$HOME/Android/Sdk/platform-tools:$HOME/Library/Android/sdk/emulator:$HOME/Android/Sdk/emulator"';

/** The adb server port on the machine that runs it. */
export const ADB_SERVER_PORT = 5037;

export interface Rig {
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
export interface ResolvedDevice {
  name: string;
  device: DeviceConfig;
  rigName: string;
  rig: RigConfig;
}

/** The device `name`, or `qa.device.unknown` with the configured names. */
export function resolveDevice(config: QaConfig, name: string | undefined): ResolvedDevice {
  const devices = config.device.devices;
  const names = Object.keys(devices).sort();
  if (!name) {
    if (names.length === 1) return resolveDevice(config, names[0]);
    throw new LaunchwrightError(
      'qa.device.unknown',
      `Name a device with --device. Devices in qa.device.devices: ${names.join(', ') || 'none'}.`,
    );
  }
  const device = devices[name];
  if (!device) {
    throw new LaunchwrightError('qa.device.unknown', `No device ${name} in qa.device.devices. Devices: ${names.join(', ') || 'none'}.`, {
      context: { device: name },
    });
  }
  const rig = config.device.rigs[device.rig];
  if (!rig) {
    const rigs = Object.keys(config.device.rigs).sort().join(', ');
    throw new LaunchwrightError('qa.device.rig.unknown', `Device ${name} names rig ${device.rig}, which qa.device.rigs does not hold. Rigs: ${rigs}.`, {
      context: { device: name, rig: device.rig },
    });
  }
  return { name, device, rigName: device.rig, rig };
}

/**
 * The ssh control socket of a rig: `~/.lw-qa/ssh/<id>.sock`, where the id is a hash of the project
 * root and the rig name. A worktree path is too long for a unix socket, so the root is not in it.
 */
export function controlPath(root: string, rig: string, home: string = homedir()): string {
  const id = sha256(`${root}\0${rig}`).slice(0, 16);
  const path = join(home, SSH_SOCKET_DIR, `${id}.sock`);
  if (Buffer.byteLength(path) > MAX_SOCKET_PATH) {
    throw new LaunchwrightError(
      'qa.device.ssh.path',
      `The ssh control socket ${path} is longer than ${MAX_SOCKET_PATH} bytes, and ssh cannot bind it. Run with a shorter HOME.`,
      { context: { rig } },
    );
  }
  return path;
}

/** The arguments that open the master of a rig: one connection that every later call reuses. */
export function masterArgs(ctl: string, host: string): string[] {
  return [
    '-M',
    '-S',
    ctl,
    '-f',
    '-N',
    '-o',
    'BatchMode=yes',
    '-o',
    'ExitOnForwardFailure=yes',
    '-o',
    'ConnectTimeout=10',
    '-o',
    'ServerAliveInterval=30',
    host,
  ];
}

function sshRig(name: string, config: RigConfig, deps: DeviceDeps, ssh: string): Rig {
  const host = config.host;
  if (!host) {
    throw new LaunchwrightError('qa.device.rig.host', `Rig ${name} has transport ssh and no host. Set qa.device.rigs.${name}.host to its ssh alias.`, {
      context: { rig: name },
    });
  }
  const ctl = controlPath(deps.root, name);
  const forwards = new Map<number, number>();
  let opening: Promise<void> | null = null;
  let adbLocal: number | null = null;

  async function open(): Promise<void> {
    const check = await deps.run.run(ssh, ['-S', ctl, '-O', 'check', host as string]);
    if (check.code === 0) return;
    await mkdir(dirname(ctl), { recursive: true, mode: 0o700 });
    const res = await deps.run.run(ssh, masterArgs(ctl, host as string), { timeoutMs: 30_000 });
    if (res.code !== 0) {
      throw new LaunchwrightError(
        'qa.device.ssh',
        `ssh to rig ${name} (${host}) failed: ${said(res) || `exit ${res.code}`}. The rig needs a login without a prompt: BatchMode=yes refuses a password. Run ssh ${host} once by hand to accept the host key, and add your key with ssh-copy-id.`,
        { context: { rig: name, exit: res.code } },
      );
    }
  }

  const rig: Rig = {
    name,
    config,
    remote: true,
    stateDir: RIG_STATE_DIR,
    ensure() {
      opening ??= open().catch((err: unknown) => {
        opening = null;
        throw err;
      });
      return opening;
    },
    async exec(command, opts) {
      await rig.ensure();
      return deps.run.run(ssh, ['-S', ctl, '-o', 'BatchMode=yes', host, `${REMOTE_PATH}; ${command}`], { timeoutMs: 120_000, ...opts });
    },
    async forward(remotePort, localPort) {
      const held = forwards.get(remotePort);
      if (held !== undefined && (localPort === undefined || held === localPort)) return held;
      await rig.ensure();
      const local = localPort ?? (await deps.freePort());
      const res = await deps.run.run(ssh, ['-S', ctl, '-O', 'forward', '-L', `${local}:127.0.0.1:${remotePort}`, host]);
      orFail(res, 'qa.device.ssh.forward', `ssh forward :${local} to ${name}:${remotePort}`, { rig: name });
      forwards.set(remotePort, local);
      return local;
    },
    async unforward(remotePort) {
      const local = forwards.get(remotePort);
      if (local === undefined) return;
      forwards.delete(remotePort);
      const res = await deps.run.run(ssh, ['-S', ctl, '-O', 'cancel', '-L', `${local}:127.0.0.1:${remotePort}`, host]);
      orFail(res, 'qa.device.ssh.forward', `ssh cancel of the forward :${local} to ${name}:${remotePort}`, { rig: name });
    },
    async adbPort() {
      if (adbLocal !== null) return adbLocal;
      if (config.adbPort) {
        await rig.ensure();
        const res = await deps.run.run(ssh, ['-S', ctl, '-O', 'forward', '-L', `${config.adbPort}:127.0.0.1:${ADB_SERVER_PORT}`, host]);
        orFail(res, 'qa.device.ssh.forward', `ssh forward of the adb server to :${config.adbPort}`, { rig: name });
        forwards.set(ADB_SERVER_PORT, config.adbPort);
        adbLocal = config.adbPort;
      } else {
        adbLocal = await rig.forward(ADB_SERVER_PORT);
      }
      return adbLocal;
    },
    async adbServer() {
      return ['-L', `tcp:127.0.0.1:${await rig.adbPort()}`];
    },
    async writeFile(path, content) {
      const res = await rig.exec(`mkdir -p "$(dirname ${shq(path)})" && cat > ${shq(path)}`, { input: content });
      orFail(res, 'qa.device.rig.write', `writing ${path} on rig ${name}`, { rig: name });
    },
    async down() {
      opening = null;
      forwards.clear();
      adbLocal = null;
      const res = await deps.run.run(ssh, ['-S', ctl, '-O', 'exit', host]);
      // Exit 255 with "No such file" means no master was open, which is the state `down` wants.
      if (res.code !== 0 && !/No such file|Control socket connect/i.test(said(res))) {
        orFail(res, 'qa.device.ssh', `closing the ssh master of rig ${name}`, { rig: name });
      }
    },
  };
  return rig;
}

function localRig(name: string, config: RigConfig, deps: DeviceDeps): Rig {
  return {
    name,
    config,
    remote: false,
    stateDir: join(deps.root, DEVICE_STATE_DIR),
    ensure: async () => {},
    exec: (command, opts) => deps.run.run('sh', ['-c', command], { timeoutMs: 120_000, ...opts }),
    forward: async (remotePort) => remotePort,
    unforward: async () => {},
    adbServer: async () => [],
    adbPort: async () => ADB_SERVER_PORT,
    async writeFile(path, content) {
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, content);
    },
    down: async () => {},
  };
}

function cloudRig(name: string, config: RigConfig): Rig {
  const refuse = (): never => {
    throw new LaunchwrightError('qa.device.rig.cloud', `Rig ${name} is a cloud rig: it has no shell and no ports. Its devices run on the browserstack target.`, {
      context: { rig: name },
    });
  };
  return {
    name,
    config,
    remote: true,
    stateDir: '',
    ensure: async () => {},
    exec: async () => refuse(),
    forward: async () => refuse(),
    unforward: async () => refuse(),
    adbServer: async () => refuse(),
    adbPort: async () => refuse(),
    writeFile: async () => refuse(),
    down: async () => {},
  };
}

/** What drivers and commands share: the config, the seams and one rig pool. */
export interface DeviceContext {
  config: QaConfig;
  deps: DeviceDeps;
  rigs: RigPool;
}

export function createDeviceContext(config: QaConfig, deps: DeviceDeps): DeviceContext {
  return { config, deps, rigs: createRigPool(config, deps) };
}

/** One rig per name for the whole process, so each ssh rig has exactly one master. */
export interface RigPool {
  get(name: string): Rig;
  downAll(): Promise<void>;
}

export function createRigPool(config: QaConfig, deps: DeviceDeps): RigPool {
  const rigs = new Map<string, Rig>();
  return {
    get(name) {
      const held = rigs.get(name);
      if (held) return held;
      const cfg = config.device.rigs[name];
      if (!cfg) {
        throw new LaunchwrightError('qa.device.rig.unknown', `No rig ${name} in qa.device.rigs.`, { context: { rig: name } });
      }
      const rig =
        cfg.transport === 'ssh' ? sshRig(name, cfg, deps, config.device.tools.ssh) : cfg.transport === 'cloud' ? cloudRig(name, cfg) : localRig(name, cfg, deps);
      rigs.set(name, rig);
      return rig;
    },
    async downAll() {
      for (const rig of rigs.values()) await rig.down();
    },
  };
}
