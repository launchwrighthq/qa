// The host proxy of `ingress: host-proxy` (spec 2.9). A gateway that does not hairpin sends a
// device inside the LAN nowhere when it resolves the public tunnel hostname. The proxy runs on the
// machine of the adb server and dials one hostname at another address. Everything else passes
// through. The device reaches it through `adb reverse` and its own `http_proxy` setting.
//
// The script is a string, because it runs under `node` on a rig that has no copy of this package.
// `/__ingress` answers the hostname and the upstream, so a later run can tell a stale proxy.

/** The proxy script. Arguments: `<port> <hostname> <upstream>`. It binds 127.0.0.1 only. */
export const HOST_PROXY_SCRIPT = `import http from 'node:http';
import net from 'node:net';

const [, , portArg, HOST, UPSTREAM] = process.argv;
const PORT = Number(portArg);
if (!PORT || !HOST || !UPSTREAM) {
  console.error('usage: host-proxy.mjs <port> <hostname> <upstream>');
  process.exit(2);
}
const dialFor = (name) => (name === HOST ? UPSTREAM : name);

const server = http.createServer((req, res) => {
  if (req.url === '/__ingress') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ host: HOST, upstream: UPSTREAM, port: PORT, pid: process.pid }));
    return;
  }
  let target;
  try {
    target = new URL(req.url);
  } catch {
    res.writeHead(400).end('absolute URL required');
    return;
  }
  const up = http.request(
    { host: dialFor(target.hostname), port: target.port || 80, path: target.pathname + target.search, method: req.method, headers: req.headers },
    (answer) => {
      res.writeHead(answer.statusCode || 502, answer.headers);
      answer.pipe(res);
    },
  );
  up.on('error', (err) => {
    console.error('upstream ' + target.hostname + ': ' + err.message);
    res.destroy();
  });
  req.pipe(up);
});

server.on('connect', (req, socket, head) => {
  const at = req.url.lastIndexOf(':');
  const name = at === -1 ? req.url : req.url.slice(0, at);
  const port = at === -1 ? 443 : Number(req.url.slice(at + 1)) || 443;
  const up = net.connect(port, dialFor(name), () => {
    socket.write('HTTP/1.1 200 Connection Established\\r\\n\\r\\n');
    if (head && head.length) up.write(head);
    up.pipe(socket);
    socket.pipe(up);
  });
  up.on('error', (err) => {
    console.error('connect ' + name + ': ' + err.message);
    socket.destroy();
  });
  socket.on('error', () => up.destroy());
});

server.listen(PORT, '127.0.0.1', () => console.log('host-proxy 127.0.0.1:' + PORT + ' ' + HOST + ' -> ' + UPSTREAM));
`;
