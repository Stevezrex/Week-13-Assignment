// Local stand in for Netlify: static files with the toml headers, the five functions, an in memory Blobs store.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { AsyncLocalStorage } from 'node:async_hooks';
import { setStoreFactory } from '../netlify/lib/attempts.mjs';

// Each request runs with its own server's store registry, so several servers can share one process.
const als = new AsyncLocalStorage();
setStoreFactory(name => als.getStore()(name));

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2', '.svg': 'image/svg+xml' };

export function memoryBlobs() {
  const stores = new Map();   // name -> Map of key -> { data, etag }
  const apis = new Map();     // name -> store api
  let tag = 0;
  const make = name => {
    const m = new Map();
    stores.set(name, m);
    const put = (key, str, o = {}) => {
      const cur = m.get(key);
      if (o.onlyIfNew && cur) return { modified: false };
      if (o.onlyIfMatch !== undefined && (!cur || cur.etag !== o.onlyIfMatch)) return { modified: false };
      const etag = '"e' + (++tag) + '"';
      m.set(key, { data: str, etag });
      return { modified: true, etag };
    };
    const parse = (v, o) => (o && o.type === 'json') ? JSON.parse(v) : v;
    const api = {
      async get(key, o) { const c = m.get(key); return c ? parse(c.data, o) : null; },
      async getWithMetadata(key, o) { const c = m.get(key); return c ? { data: parse(c.data, o), etag: c.etag, metadata: {} } : null; },
      async set(key, data, o) { return put(key, String(data), o); },
      async setJSON(key, data, o) { return put(key, JSON.stringify(data), o); },
      async delete(key) { m.delete(key); },
      list(o = {}) {
        const blobs = [...m.entries()].filter(([k]) => !o.prefix || k.startsWith(o.prefix)).map(([key, v]) => ({ key, etag: v.etag }));
        if (o.paginate) return (async function* () { yield { blobs }; })();
        return Promise.resolve({ blobs });
      }
    };
    apis.set(name, api);
    return api;
  };
  return { stores, factory: name => apis.get(name) || make(name) };
}

function parseToml() {
  const t = fs.readFileSync(path.join(root, 'netlify.toml'), 'utf8');
  const rules = [];
  for (const block of t.split('[[headers]]').slice(1)) {
    const forM = /for\s*=\s*"([^"]+)"/.exec(block);
    const values = {};
    for (const m of block.matchAll(/^\s*([A-Za-z\-]+)\s*=\s*"([^"]*)"/gm)) if (m[1] !== 'for') values[m[1]] = m[2];
    rules.push({ pattern: forM[1], values });
  }
  return rules;
}
const matches = (pattern, p) => pattern === '/*' || (pattern.endsWith('/*') && p.startsWith(pattern.slice(0, -1)));

export async function startServer({ context = 'branch-deploy', port = 0, password = 'rehearsal-pass', blobs: shared } = {}) {
  process.env.ASSESSOR_PASSWORD = password;
  const blobs = shared || memoryBlobs();
  const rules = parseToml();
  const stats = { api: 0, calls: [] };
  const fnDir = path.join(root, 'netlify/functions');
  const fns = [];
  for (const f of fs.readdirSync(fnDir)) {
    const mod = await import(pathToFileURL(path.join(fnDir, f)).href);
    const paths = [].concat(mod.config.path);
    fns.push({ paths, handler: mod.default });
  }
  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, 'http://x');
    const fn = fns.find(f => f.paths.includes(url.pathname));
    if (url.pathname.startsWith('/api/')) {
      stats.api += 1; stats.calls.push(url.pathname);
      if (!fn) { res.writeHead(404); res.end('{}'); return; }
      const chunks = []; for await (const c of req) chunks.push(c);
      const body = chunks.length ? Buffer.concat(chunks) : undefined;
      const headers = Object.fromEntries(Object.entries(req.headers).map(([k, v]) => [k, String(v)]));
      const request = new Request('http://localhost' + req.url, { method: req.method, headers, body: req.method === 'GET' ? undefined : body });
      const out = await als.run(blobs.factory, () => fn.handler(request, { deploy: { context } }));
      const text = await out.text();
      res.writeHead(out.status, Object.fromEntries(out.headers));
      res.end(text);
      return;
    }
    let p = url.pathname === '/' ? '/index.html' : url.pathname;
    const file = path.join(root, 'public', p);
    if (!file.startsWith(path.join(root, 'public')) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) { res.writeHead(404); res.end('Not found'); return; }
    const h = { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream', 'cache-control': 'public, max-age=0, must-revalidate' };
    for (const r of rules) if (matches(r.pattern, p)) for (const [k, v] of Object.entries(r.values)) h[k.toLowerCase()] = v;
    stats.static = (stats.static || []);
    stats.static.push(p);
    res.writeHead(200, h);
    res.end(fs.readFileSync(file));
  });
  await new Promise(r => server.listen(port, r));
  return { url: 'http://localhost:' + server.address().port, stats, blobs, close: () => new Promise(r => server.close(r)), server };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const s = await startServer({ port: 8899 });
  console.log('Local rehearsal server at ' + s.url);
}
