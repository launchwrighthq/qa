// The sink submodule of @launchwrighthq/qa (spec 2.17): `lw qa sink` and the recording HTTP sink.
export {
  type FaultKind,
  FaultPlan,
  type FaultRule,
  OK_REPLY,
  parseFault,
  parseFaults,
  type Reply,
  replyOf,
  RETRY_AFTER_S,
  seededSource,
} from './services/faults.mts';
export {
  ADDRESS_HEADER,
  MASK,
  maskHeaders,
  MAX_BODY_BYTES,
  SECRET_HEADER,
  type Sink,
  type SinkOptions,
  type SinkRecord,
  startSink,
} from './services/server.mts';
