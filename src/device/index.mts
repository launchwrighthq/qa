// The public API of @launchwrighthq/qa-device (QA spec 2.8, 2.9): rigs, devices, the device target
// drivers and `lw qa device`.
export {
  androidDeviceKeys,
  browserstackConfig,
  cloudDeviceKeys,
  type DeviceConfig,
  deviceConfig,
  deviceToolsConfig,
  emulatorDeviceKeys,
  hostProxyConfig,
  iosDeviceKeys,
  type QaConfig,
  qaConfigOf,
  type QaDeviceConfig,
  qaDeviceConfig,
  type RigConfig,
  rigConfig,
  simulatorDeviceKeys,
  telegramDeviceConfig,
  withDevice,
} from './config.mts';
export { qaDeviceProvider } from './provider.mts';
export { type DeviceAccess, type DeviceKind, deviceKind, deviceKindNames, registerDeviceKind } from './services/device-kinds.mts';
export { collectDoctor, type DoctorCheck, formatDoctor } from './services/doctor.mts';
export { qaExtension } from './services/extension.mts';
export type { DeviceClock, DeviceDeps, ProcessResult, ProcessRunner, RunningProcess, SocketFactory, SocketLike, StartOptions } from './services/process.mts';
export { DEFAULT_RUN_TIMEOUT_MS, NO_TIMEOUT, systemDeviceDeps } from './services/process.mts';
export { createDeviceContext, type DeviceContext, resolveDevice, type Rig } from './services/rigs.mts';
export { deviceTargets } from './services/targets.mts';
