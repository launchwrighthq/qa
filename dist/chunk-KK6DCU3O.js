// src/kernel/services/errors.mts
var LaunchwrightError = class extends Error {
  code;
  context;
  constructor(code, message, opts) {
    super(message, opts && "cause" in opts ? { cause: opts.cause } : void 0);
    this.name = new.target.name;
    this.code = code;
    this.context = opts?.context ?? {};
  }
};
var DOTTED_CODE = /^[a-z][a-z0-9_-]*(\.[a-z0-9_-]+)+$/i;
function isCodedError(e) {
  if (e instanceof LaunchwrightError) return true;
  if (typeof e !== "object" || e === null) return false;
  const { code, message } = e;
  return typeof message === "string" && typeof code === "string" && DOTTED_CODE.test(code);
}
var BootError = class extends LaunchwrightError {
};
function messageOf(err) {
  return err instanceof Error ? err.message : String(err);
}

export {
  LaunchwrightError,
  isCodedError,
  BootError,
  messageOf
};
//# sourceMappingURL=chunk-KK6DCU3O.js.map