// Development server for the unbundled game. Requires Node.js 20 or newer.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { dirname, extname, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../dist');
const flag = process.argv.indexOf('--port');
const port = Number(flag >= 0 ? process.argv[flag + 1] : process.env.PORT ?? 5173);
if (!Number.isInteger(port) || port < 0 || port > 65535) {
  console.error('Choose a valid port, for example: npm run dev -- --port 5174');
  process.exit(1);
}
const types = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png', '.svg': 'image/svg+xml',
  '.jpg': 'image/jpeg', '.webp': 'image/webp', '.woff2': 'font/woff2'
};
const server = http.createServer(async (req, res) => {
  if (!['GET', 'HEAD'].includes(req.method)) {
    res.writeHead(405, { Allow: 'GET, HEAD' });
    res.end();
    return;
  }
  try {
    const url = new URL(req.url, 'http://localhost');
    const pathname = decodeURIComponent(url.pathname);
    const filename = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (filename !== root && !filename.startsWith(root + sep)) {
      res.writeHead(403);res.end('Forbidden');return;
    }
    const data = await readFile(filename);
    res.writeHead(200, {
      'Content-Type': types[extname(filename)] ?? 'application/octet-stream',
      'Cache-Control': 'no-store',
      'X-Content-Type-Options': 'nosniff'
    });
    res.end(req.method === 'HEAD' ? undefined : data);
  } catch (error) {
    res.writeHead(error instanceof URIError ? 400 : 404, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(error instanceof URIError ? 'Bad request' : 'Not found');
  }
});
server.on('error', error => {
  console.error(error.code === 'EADDRINUSE'
    ? 'This port is busy. Try: npm run dev -- --port 5174'
    : error.message);
  process.exit(1);
});
server.listen(port, '127.0.0.1', () => {
  console.log(`Steel & Silence is ready: http://localhost:${server.address().port}`);
  console.log('Press Ctrl+C to stop. Refresh your browser after editing a file.');
});
