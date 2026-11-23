import { ZodType } from 'zod';
import { A as App } from './app-KXgbRXYO.js';
import { Q as QaConfig } from './config-B-lxHEnb.js';
import { Q as QaTarget } from './contract-DSRjkOLo.js';

/** A module's service provider: it binds services in register() and starts them in boot(). */
interface Provider {
    name: string;
    /** Provider names that must register and boot first. */
    requires?: string[];
    /** The config section of the module. createApp validates it and throws BootError on a bad key. */
    config?: {
        section: string;
        schema: ZodType;
    };
    register(app: App): void;
    boot?(app: App): void | Promise<void>;
    shutdown?(app: App): void | Promise<void>;
}

/** The options the CLI gives a module command, plus test overrides. */
interface QaCommandOptions {
    /** The project root. */
    cwd: string;
    out: (line: string) => void;
    err: (line: string) => void;
    /** The project config sections. */
    config?: Record<string, unknown>;
    /** The kernel environment name. */
    env?: string;
    /** The booted app, when the CLI gives one. */
    app?: unknown;
    /** The process environment. Default: `process.env`. */
    processEnv?: Record<string, string | undefined>;
    /** Stops a long-running subcommand (`lw qa telegram`, `lw qa sink`). */
    signal?: AbortSignal;
    /**
     * The command the user typed: `lw qa` (the default, the framework CLI) or `lw-qa` (the bin of the
     * library). Every usage, hint and error line prints it.
     */
    commandName?: string;
    /**
     * `qa.target` drivers that a run adds or uses in place of a built-in one, for example
     * `playwright` with a browser binary. `lw qa` adds the targets of the extension modules here.
     */
    targets?: Record<string, QaTarget>;
    /**
     * Extension modules the CLI always has. The `lw-qa` bin gives the intake and device extensions of
     * the library, which have no `qa-<x>` package to load. An enabled config section of the same name wins.
     */
    extensions?: readonly QaExtension[];
}
/** A `lw qa <sub>` module: `./qa-<sub>.mts` with this default export. */
interface QaSubcommand {
    name: string;
    summary: string;
    run(args: string[], opts: QaCommandOptions): Promise<number>;
}
declare const SUBCOMMANDS: readonly ["changes", "session", "sweep", "report", "publish", "gc", "check", "world", "fixture", "worktree", "job", "states", "paths", "telegram", "sink", "comments", "consent"];
declare const qaCommand: {
    name: string;
    summary: string;
    run(args: string[], given: QaCommandOptions): Promise<number>;
};

/** What an extension module exports as `qaExtension`. */
interface QaExtension {
    /** The module name, for example `qa-device`. */
    name: string;
    /** The `lw qa <sub>` subcommands of the module, by name. Each loads on first use. */
    subcommands?: Readonly<Record<string, () => Promise<QaSubcommand>>>;
    /** The `qa.target` drivers of the module, built from config section `qa` and the project root. */
    targets?(config: QaConfig, root: string): Record<string, QaTarget>;
}
/** The prefix of an extension module name. */
declare const EXTENSION_PREFIX = "qa-";
/** The extension modules that the config sections enable: each section named `qa-<x>`, sorted. */
declare function extensionNames(sections?: Record<string, unknown>): string[];
/**
 * Loads `qaExtension` of each enabled extension module from the project at `root`. A module that
 * is not installed or exports no extension fails with `qa.extension`.
 */
declare function loadExtensions(root: string, sections?: Record<string, unknown>): Promise<QaExtension[]>;
/** The targets of every extension, later extensions over earlier ones. */
declare function extensionTargets(extensions: readonly QaExtension[], config: QaConfig, root: string): Record<string, QaTarget>;

export { EXTENSION_PREFIX as E, type Provider as P, type QaExtension as Q, SUBCOMMANDS as S, type QaSubcommand as a, type QaCommandOptions as b, extensionTargets as c, extensionNames as e, loadExtensions as l, qaCommand as q };
