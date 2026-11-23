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
var BootError = class extends LaunchwrightError {
};
function messageOf(err) {
  return err instanceof Error ? err.message : String(err);
}

export {
  LaunchwrightError,
  BootError,
  messageOf
};
//# sourceMappingURL=chunk-L57WEOVE.js.map