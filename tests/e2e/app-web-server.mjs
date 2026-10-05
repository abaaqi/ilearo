/**
 * Serves the mobile app's web build (mobile/dist-web) for the browser tests,
 * and passes /api/* through to the website, so the app talks to the real API
 * exactly as it does on a phone. Build it first with `npm run build:app-web`.
 */
import http from "node:http";
import { createReadStream, existsSync, statSync } from "node:fs";
import path from "node:path";

const PORT = Number(process.env.APP_WEB_PORT ?? 3200);
const API = new URL(process.env.APP_WEB_API ?? "http://localhost:3100");
const DIST = path.resolve(process.env.APP_WEB_DIST ?? "mobile/dist-web");

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".json": "application/json",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".ttf": "font/ttf",
  ".svg": "image/svg+xml",
};

function proxy(req, res) {
  const upstream = http.request(
    { hostname: API.hostname, port: API.port, path: req.url, method: req.method, headers: { ...req.headers, host: API.host } },
    (answer) => {
      res.writeHead(answer.statusCode ?? 502, answer.headers);
      answer.pipe(res);
    },
  );
  upstream.on("error", () => {
    res.writeHead(502, { "Content-Type": "text/plain" });
    res.end("The website isn't running");
  });
  req.pipe(upstream);
}

function serveFile(res, file) {
  res.writeHead(200, { "Content-Type": TYPES[path.extname(file)] ?? "application/octet-stream" });
  createReadStream(file).pipe(res);
}

http
  .createServer((req, res) => {
    const url = new URL(req.url ?? "/", `http://localhost:${PORT}`);
    if (url.pathname === "/__health") return res.end("ok");
    if (url.pathname.startsWith("/api/")) return proxy(req, res);

    const index = path.join(DIST, "index.html");
    if (!existsSync(index)) {
      res.writeHead(503, { "Content-Type": "text/plain" });
      return res.end("The app's web build is missing. Run npm run build:app-web.");
    }
    const file = path.join(DIST, decodeURIComponent(url.pathname));
    if (file.startsWith(DIST) && existsSync(file) && statSync(file).isFile()) return serveFile(res, file);
    // A single-page app: every other path is the app itself.
    serveFile(res, index);
  })
  .listen(PORT, () => console.log(`Mobile app (web build) on http://localhost:${PORT}, API from ${API.origin}`));
