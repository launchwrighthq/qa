/** The run record of the dev module that the worktree command reads. */
interface RunRecord {
    checkout: string;
    surfaces: Array<{
        name: string;
        url?: string;
    }>;
}
/** The `fetch` of the Bot API client. A local copy of the telegram module's FetchFn. */
type FetchFn = (url: string, init?: RequestInit) => Promise<Response>;

export type { FetchFn as F, RunRecord as R };
