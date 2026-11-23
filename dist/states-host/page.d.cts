/** One mount: the adapter renders `component` with `props` in `target`, inside `wrapper`. */
interface StatesMountArgs<C> {
    name: string;
    component: C;
    props: Record<string, unknown>;
    target: HTMLElement;
    wrapper?: C;
    /** Draws the failure panel. The adapter calls it when the component throws while it renders. */
    fail: (reason: string) => void;
}
interface StatesPageOptions<C> {
    /** Component name to a function that imports its module. */
    components: Record<string, () => Promise<Record<string, unknown>>>;
    /** The project providers with fakes. It gets the subject as its children. */
    wrapper?: C;
    mount: (args: StatesMountArgs<C>) => void;
    /** The address query. Default `location.search`. */
    search?: string;
}
interface StatesRequest {
    name: string;
    props: Record<string, unknown>;
}
/** Reads `c` and `props` from the address, or says why it cannot. */
declare function readStatesRequest(search: string, names: readonly string[]): StatesRequest | string;
/**
 * Mounts the component that the address names. The subject element is
 * `<div data-qa-subject="<name>">`, the element a capture shoots. The page root keeps
 * `aria-busy="true"` until the mount call returns.
 */
declare function startStatesPage<C>(opts: StatesPageOptions<C>): Promise<void>;

export { type StatesMountArgs, type StatesPageOptions, type StatesRequest, readStatesRequest, startStatesPage };
