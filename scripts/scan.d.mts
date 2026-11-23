// Types of scan.mjs for the TypeScript tests.
export interface Hit {
  kind: string;
  line: number;
  value: string;
}
export interface Finding {
  label: string;
  hit: Hit;
}
export interface ScanResult {
  files: number;
  commits: number;
  tags: number;
  findings: Finding[];
}

export declare const ALLOW_MARKER: string;
export declare function productWords(): string[];
export declare function scanText(text: string): Hit[];
export declare function checkIdentity(name: string, email: string): Hit[];
export declare function formatFinding(finding: Finding): string;
export declare function scanFiles(paths: readonly string[], root?: string): ScanResult;
export declare function scanTree(rev: string): ScanResult;
export declare function scanTag(oid: string, name: string): ScanResult;
export declare function scanCommits(revArgs: readonly string[]): ScanResult;
export declare function lastTag(rev: string): string | null;
export declare function sinceTagRange(rev: string): string[];
export declare function scanCurrentIdentity(): ScanResult;
export declare function scanPush(input: string, remote: string): ScanResult;
export declare function report(result: ScanResult, out?: (line: string) => void): 0 | 1;
