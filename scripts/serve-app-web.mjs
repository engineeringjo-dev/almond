/**
 * Serves the Expo web export of the customer app (almond-app/dist) for the
 * Playwright suite: `node scripts/serve-app-web.mjs <dir> <port>`.
 *
 * The app is exported with `experiments.baseUrl: "/almond"` (app.json), so the
 * prefix is stripped before the lookup. It is a single-page export
 * (`web.output: "single"`): any path that is not a file gets index.html, and
 * expo-router resolves the route in the browser — which is what makes a cold
 * load of /almond/cart possible at all.
 */
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const [dirArg, portArg] = process.argv.slice(2);
if (!dirArg || !portArg) {
  console.error('usage: node scripts/serve-app-web.mjs <export-dir> <port>');
  process.exit(2);
}
const root = path.resolve(dirArg);
const index = path.join(root, 'index.html');
if (!fs.existsSync(index)) {
  console.error(`no index.html in ${root} — run \`npm run export:web --workspace almond-app\` first`);
  process.exit(2);
}

const BASE = '/almond';
const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.webp': 'image/webp',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ttf': 'font/ttf',
  '.ico': 'image/x-icon',
};

http
  .createServer((req, res) => {
    let url = decodeURIComponent((req.url ?? '/').split('?')[0]);
    if (url.startsWith(BASE)) url = url.slice(BASE.length) || '/';
    let file = path.join(root, url);
    // Never serve outside the export, whatever the path says.
    if (!file.startsWith(root + path.sep) && file !== root) file = index;
    if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = index;
    res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  })
  .listen(Number(portArg), () => console.log(`app web export on http://localhost:${portArg}${BASE}`));
