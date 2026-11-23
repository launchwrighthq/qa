#!/usr/bin/env node
// The `lw-qa` launcher. It registers the tsx loader, then runs the TypeScript entry over `src`.
// The package ships `src` and its `tsconfig.json`, so tsx resolves the vendored-kernel path alias
// at run time. A library consumer that imports `@launchwrighthq/qa` uses the compiled `dist`
// instead; this launcher is only the CLI.
import { register } from 'tsx/esm/api';

register();
await import(new URL('../src/bin/lw-qa.mts', import.meta.url).href);
