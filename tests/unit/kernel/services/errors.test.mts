import { describe, expect, it } from 'vitest';
import { isCodedError, LaunchwrightError } from '../../../../src/kernel/index.mts';

/** The LaunchwrightError of another kernel copy: the same shape, another class. */
class ForeignLaunchwrightError extends Error {
  constructor(
    readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

describe('isCodedError', () => {
  it('accepts a LaunchwrightError of this kernel and the same shape from another kernel copy', () => {
    expect(isCodedError(new LaunchwrightError('qa.target.act', 'x'))).toBe(true);
    const foreign = new ForeignLaunchwrightError('db.query', 'the query failed');
    expect(foreign instanceof LaunchwrightError).toBe(false);
    expect(isCodedError(foreign)).toBe(true);
    expect(isCodedError({ code: 'auth.signup.closed', message: 'closed' })).toBe(true);
  });

  it('refuses a Node system error, an error without a code and a value that is not an object', () => {
    expect(isCodedError(Object.assign(new Error('no file'), { code: 'ENOENT' }))).toBe(false);
    expect(isCodedError(Object.assign(new Error('bad'), { code: 'ERR_INVALID_ARG_TYPE' }))).toBe(false);
    expect(isCodedError(new Error('plain'))).toBe(false);
    expect(isCodedError({ code: 'qa.x' })).toBe(false);
    expect(isCodedError({ code: 400, message: 'rpc' })).toBe(false);
    expect(isCodedError('qa.x')).toBe(false);
    expect(isCodedError(null)).toBe(false);
  });
});
