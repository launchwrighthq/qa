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
  '@launchwrighthq/tunnel',
  '@playwright/test',
  // GramJS, the optional peer of the MTProto user client under src/telegram.
  'telegram',
  'telegram/sessions',
  // vitest is a test-time peer of the contract suites, never part of the shipped bundle.
  'vitest',
  // The states host: the Vite plugin and the UI mounts. Each mount loads only its own UI library.
  'vite',
  'solid-js',
  'react',
  'react-dom',
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
    'states-host': 'src/states-host/index.mts',
    // The Vite plugin serves these three files to the browser by their path beside states-host.js.
    'states-host/page': 'src/states-host/page.mts',
    'states-host/solid': 'src/states-host/solid.mts',
    'states-host/react': 'src/states-host/react.mts',
    'telegram-fake': 'src/telegram-fake/index.mts',
  },
  format: ['esm', 'cjs'],
  dts: true,
  sourcemap: true,
  clean: true,
  // `import.meta.url` in the CommonJS build: the Vite plugin of the states host finds its page by it.
  shims: true,
  external: optionalPeers,
});
