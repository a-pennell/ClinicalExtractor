import { createReadStream, existsSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve("dist");
const host = process.env.HOST || "0.0.0.0";
const port = Number(process.env.PORT || 4173);

const mimeTypes = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".map": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp"
};

if (!existsSync(join(root, "index.html"))) {
  console.error("Missing dist/index.html. Run `npm run build` before `npm start`.");
  process.exit(1);
}

const server = createServer((request, response) => {
  const requestedPath = getSafePath(request.url || "/");
  const staticPath = join(root, requestedPath);
  const filePath = resolveStaticFile(staticPath);

  response.setHeader("X-Content-Type-Options", "nosniff");
  response.setHeader("Cache-Control", filePath.includes("/assets/") ? "public, max-age=31536000, immutable" : "no-cache");
  response.setHeader("Content-Type", mimeTypes[extname(filePath)] || "application/octet-stream");

  createReadStream(filePath)
    .on("error", () => {
      response.writeHead(500);
      response.end("Internal server error");
    })
    .pipe(response);
});

server.on("error", (error) => {
  console.error(`Unable to start server on ${host}:${port}.`);
  console.error(error);
  process.exit(1);
});

server.listen(port, host, () => {
  console.log(`ClinicalExtractor serving dist on http://${host}:${port}`);
});

function getSafePath(url) {
  const pathname = new URL(url, "http://localhost").pathname;
  const decodedPath = decodeURIComponent(pathname);
  const normalizedPath = normalize(decodedPath).replace(/^(\.\.[/\\])+/, "");
  return normalizedPath === "/" ? "index.html" : normalizedPath.slice(1);
}

function resolveStaticFile(staticPath) {
  const resolvedPath = resolve(staticPath);
  const isInsideRoot = resolvedPath === root || resolvedPath.startsWith(`${root}/`);
  if (isInsideRoot && existsSync(resolvedPath) && statSync(resolvedPath).isFile()) {
    return resolvedPath;
  }
  return join(root, "index.html");
}
