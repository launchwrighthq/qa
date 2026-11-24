import { s as QaIssue, w as RawMedia } from './contract-B9QWKAsv.cjs';

/** An issue before its media are files. */
interface IssueDraft extends Omit<QaIssue, 'attachments' | 'skipped'> {
    media: RawMedia[];
}
/** A record id from parts: `github-<owner>-<repo>-<n>` or `tg-<chat>-<first message id>`. */
declare function recordId(...parts: (string | number)[]): string;
/** The folder of one record. Throws `qa.intake.id` for an id that could leave the intake folder. */
declare function recordDir(root: string, id: string): string;
/** The `issue.md` of a record. */
declare function issueMarkdown(issue: QaIssue): string;
/** Writes one record and its media. A record with the same id is replaced. */
declare function writeIssue(root: string, draft: IssueDraft): Promise<QaIssue>;
/** Reads one record. Throws `qa.intake.missing` when it does not exist. */
declare function readIssue(root: string, id: string): Promise<QaIssue>;
/** Every record, sorted by id. Folders without `issue.json` (the Telegram staging folder) do not count. */
declare function listIssues(root: string): Promise<QaIssue[]>;

export { type IssueDraft as I, recordDir as a, recordId as b, issueMarkdown as i, listIssues as l, readIssue as r, writeIssue as w };
