import http from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(fileURLToPath(new URL("../frontend1/dist-online/", import.meta.url)));
const types = { ".html": "text/html; charset=utf-8", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".png": "image/png", ".jpeg": "image/jpeg", ".jpg": "image/jpeg", ".mp3": "audio/mpeg", ".woff2": "font/woff2" };
http.createServer(async (req, res) => {
  if (req.url.startsWith("/api/") || req.url.startsWith("/media/")) {
    const proxy = http.request({ hostname: "127.0.0.1", port: 8000, path: req.url, method: req.method,
      headers: { ...req.headers, host: "127.0.0.1:8000" } }, (upstream) => {
      const headers = { ...upstream.headers };
      delete headers["transfer-encoding"];
      if (upstream.statusCode >= 400 && (headers["content-type"] || "").includes("text/html")) {
        upstream.resume();
        res.writeHead(upstream.statusCode, { "content-type": "application/json" });
        res.end(JSON.stringify({ detail: "Ошибка сервера. Повторите попытку позже." }));
        return;
      }
      if ((headers["content-type"] || "").includes("application/json")) {
        const chunks = [];
        upstream.on("data", (chunk) => chunks.push(chunk));
        upstream.on("end", () => {
          const body = Buffer.from(Buffer.concat(chunks).toString().replaceAll("http://127.0.0.1:8000/media/", "/media/").replaceAll("https://127.0.0.1:8000/media/", "/media/"));
          headers["content-length"] = body.length;
          res.writeHead(upstream.statusCode, headers); res.end(body);
        });
      } else { res.writeHead(upstream.statusCode, headers); upstream.pipe(res); }
    });
    proxy.on("error", () => { if (!res.headersSent) res.writeHead(502); res.end("Backend unavailable"); });
    proxy.setTimeout(120000, () => proxy.destroy());
    req.pipe(proxy); return;
  }
  if (req.method !== "GET" && req.method !== "HEAD") { res.writeHead(405); res.end(); return; }
  try {
    const pathname = decodeURIComponent(new URL(req.url, "http://localhost").pathname);
    if (pathname.startsWith("/admin")) { res.writeHead(404); res.end(); return; }
    let file = path.resolve(root, "." + pathname);
    if (file !== root && !file.startsWith(root + path.sep)) { res.writeHead(403); res.end(); return; }
    try { if (!(await stat(file)).isFile()) file = path.join(root, "index.html"); }
    catch { file = path.join(root, "index.html"); }
    const body = await readFile(file);
    res.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream", "cache-control": "no-cache" });
    res.end(req.method === "HEAD" ? undefined : body);
  } catch { res.writeHead(500); res.end("Preview error"); }
}).listen(4173, "127.0.0.1", () => console.log("Online preview origin: http://127.0.0.1:4173"));
