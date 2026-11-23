/** The base error of the framework. `code` is a stable, dotted identifier such as `kernel.unbound`. */
declare class LaunchwrightError extends Error {
    readonly code: string;
    readonly context: Record<string, unknown>;
    constructor(code: string, message: string, opts?: {
        cause?: unknown;
        context?: Record<string, unknown>;
    });
}
/**
 * True for a LaunchwrightError of any copy of the kernel: an object with a string `message` and a
 * dotted string `code`. `instanceof LaunchwrightError` holds only for the class of this copy, and a
 * framework app throws the class of its own kernel.
 */
declare function isCodedError(e: unknown): e is {
    code: string;
    message: string;
};

export { LaunchwrightError as L, isCodedError as i };
