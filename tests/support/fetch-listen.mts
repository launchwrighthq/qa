// A `ListenQaApp` on node:http for the tests: the fallback of `listenQaApp` when the http module is
// not installed, named so a test passes it on purpose.
import type { ListenQaApp } from '../../src/world/services/api.mts';
import { nodeListen } from '../../src/world/services/node-listen.mts';

export const fetchListen: ListenQaApp = (handler, _app, port) => nodeListen(handler, port);
