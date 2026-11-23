/** The core of every driver. Optional abilities are named capabilities (spec 2.5). */
export interface Driver {
  readonly name: string;
  /** The version of the driver kind's interface. A breaking change bumps it. */
  readonly specVersion: string;
  readonly capabilities: ReadonlySet<string>;
  supports(cap: string): boolean;
  /**
   * True for a deliberate per-replica cache: each replica may hold its own copy, and a stale copy
   * changes no answer. A deployed environment then accepts it even when its name is in
   * `kernel.localDrivers` (spec D3).
   */
  readonly allowsReplicaLocal?: boolean;
}

export abstract class BaseDriver implements Driver {
  readonly capabilities: ReadonlySet<string>;

  constructor(
    readonly name: string,
    readonly specVersion: string,
    capabilities: string[],
  ) {
    this.capabilities = new Set(capabilities);
  }

  supports(cap: string): boolean {
    return this.capabilities.has(cap);
  }
}
