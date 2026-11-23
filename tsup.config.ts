import { defineConfig } from 'tsup';

// The optional-peer framework packages and Playwright load lazily at runtime only when present,
// so the bundle never includes them. The vendored kernel under src/kernel is not external: it
// bundles in.
const optionalPeers = [
  '@launchwrighthq/auth',
  '@launchwrighthq/client',
  '@launchwrighthq/db',
  '@launchwrighthq/dev',
  '@launchwrighthq/http',
  '@launchwrighthq/queue',
  '@launchwrighthq/storage',
  '@launchwrighthq/telegram',
  '@launchwrighthq/tunnel',
  '@playwright/test',
  // vitest is a test-time peer of the contract suites, never part of the shipped bundle.
  'vitest',
];

export default defineConfig({
  entry: {
    index: 'src/index.mts',
    world: 'src/world/index.mts',
    states: 'src/states/index.mts',
    testing: 'src/testing/index.mts',
    sink: 'src/sink/index.mts',
    render: 'src/render/index.mts',
    intake: 'src/intake/index.mts',
    device: 'src/device/index.mts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  external: optionalPeers,
});
