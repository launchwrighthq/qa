import {
  LaunchwrightError
} from "./chunk-KK6DCU3O.js";

// src/world/services/clock.mts
var UNIT_MS = { ms: 1, s: 1e3, m: 6e4, h: 36e5, d: 864e5, w: 6048e5 };
function parseShift(shift) {
  if (typeof shift === "number" && Number.isFinite(shift)) return Math.trunc(shift);
  const match = typeof shift === "string" ? /^([+-]?)(\d+)(ms|s|m|h|d|w)$/.exec(shift.trim()) : null;
  if (!match) throw new LaunchwrightError("qa.clock.shift", `Shift ${JSON.stringify(shift)} is not a duration such as +2d, -3h, 90m or a number of ms.`);
  return (match[1] === "-" ? -1 : 1) * Number(match[2]) * UNIT_MS[match[3]];
}
var ShiftClock = class {
  constructor(base) {
    this.base = base;
  }
  base;
  offsetMs = 0;
  now() {
    return this.base.now() + this.offsetMs;
  }
  date() {
    return new Date(this.now());
  }
  sleep(ms, signal) {
    return this.base.sleep(ms, signal);
  }
  /** Moves the clock by `ms`. A negative shift moves it back. */
  shift(ms) {
    this.offsetMs += ms;
  }
  /** Puts the clock back on its base. */
  reset() {
    this.offsetMs = 0;
  }
};

export {
  parseShift,
  ShiftClock
};
//# sourceMappingURL=chunk-ZYIHPZ3V.js.map