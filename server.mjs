import { createReadStream, existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, normalize, resolve } from "node:path";

const root = resolve("dist");
const host = process.env.HOST || "0.0.0.0";
const port = Number(process.env.PORT || 4173);
const sessions = new Map();
const riskModelArtifact = JSON.parse(readFileSync(join(process.cwd(), "src/lib/clinical-extraction/ml/riskModelArtifact.json"), "utf8"));

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

const server = createServer(async (request, response) => {
  const url = new URL(request.url || "/", "http://localhost");

  if (url.pathname.startsWith("/api/")) {
    await handleApiRequest(request, response, url);
    return;
  }

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

// AUDIT FIX (PHI): `Access-Control-Allow-Origin: *` plus guessable session ids
// (`session-${Date.now()}`) let any third-party page a clinician visits read
// /api/sessions/:id/export, which returns sourceText (raw note / PHI).
// Cross-origin access is now opt-in via CORS_ALLOW_ORIGIN.
// TODO(audit): add authn and unguessable session ids before any real notes
// touch these endpoints; the in-memory `sessions` Map is also unbounded.
const corsAllowOrigin = process.env.CORS_ALLOW_ORIGIN || "";

async function handleApiRequest(request, response, url) {
  if (corsAllowOrigin) {
    response.setHeader("Access-Control-Allow-Origin", corsAllowOrigin);
    response.setHeader("Access-Control-Allow-Methods", "GET,POST,PATCH,OPTIONS");
    response.setHeader("Access-Control-Allow-Headers", "content-type");
  }
  response.setHeader("Cache-Control", "no-cache");

  if (request.method === "OPTIONS") {
    response.writeHead(204);
    response.end();
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/health") {
    sendJson(response, 200, {
      ok: true,
      service: "clinical-entity-extraction-prototype",
      mode: "static-prototype",
      extraction: "browser-local",
      timestamp: new Date().toISOString()
    });
    return;
  }

  if (request.method === "GET" && url.pathname === "/api/providers") {
    sendJson(response, 200, {
      extractionProviders: [
        { id: "local-rules", label: "Local rule-based extractor", status: "client-side" },
        { id: "llm-extractor-placeholder", label: "LLM extractor placeholder", status: "disabled" },
        { id: "clinical-nlp-service-placeholder", label: "Clinical NLP service placeholder", status: "disabled" }
      ],
      terminologyProviders: [
        { id: "local-static", label: "Local static terminology map", status: "client-side" },
        { id: "mock-async-fhir-terminology", label: "Mock async FHIR Terminology adapter", status: "client-side-mock" },
        { id: "fhir-terminology-service", label: "FHIR Terminology service", status: "disabled" }
      ],
      warning: "Server API is an operational shell for deployment and integration planning; extraction remains browser-local in this prototype."
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/risk/predict") {
    const body = await readJsonBody(request, response);
    if (!body) return;
    if (!body.features || typeof body.features !== "object" || Array.isArray(body.features)) {
      sendJson(response, 400, { error: "Request body must include a features object." });
      return;
    }

    const features = sanitizeRiskFeatures(body.features, riskModelArtifact.featureNames);
    const prediction = scoreRiskFeatures(features, riskModelArtifact);
    sendJson(response, 200, {
      prediction,
      features,
      model: {
        id: riskModelArtifact.modelId,
        version: riskModelArtifact.version,
        trainedAt: riskModelArtifact.trainedAt,
        outcomeLabel: riskModelArtifact.outcomeLabel,
        trainingData: riskModelArtifact.trainingData,
        calibration: riskModelArtifact.calibration
      },
      warning: "Prototype risk prediction is trained only on mock labels and is not clinically validated."
    });
    return;
  }

  if (request.method === "POST" && url.pathname === "/api/sessions") {
    const body = await readJsonBody(request, response);
    if (!body) return;
    const id = typeof body.id === "string" && body.id.trim() ? body.id.trim() : `session-${Date.now()}`;
    const session = {
      id,
      schemaVersion: "prototype-1",
      specialty: typeof body.specialty === "string" ? body.specialty : "mixed",
      sourceText: typeof body.sourceText === "string" ? body.sourceText : "",
      status: "created",
      createdAt: new Date().toISOString()
    };
    sessions.set(id, session);
    sendJson(response, 201, session);
    return;
  }

  const extractMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/extract$/);
  if (request.method === "POST" && extractMatch) {
    const id = decodeURIComponent(extractMatch[1]);
    const body = await readJsonBody(request, response);
    if (!body) return;
    const session = sessions.get(id) ?? { id, schemaVersion: "prototype-1", specialty: "mixed", sourceText: "", createdAt: new Date().toISOString() };
    const updated = {
      ...session,
      sourceText: typeof body.sourceText === "string" ? body.sourceText : session.sourceText,
      specialty: typeof body.specialty === "string" ? body.specialty : session.specialty,
      providerId: typeof body.providerId === "string" ? body.providerId : "local-rules",
      status: "client-extraction-required",
      warnings: [
        "Server-side extraction is not bundled in the static Railway prototype.",
        "Use the browser local-rules extractor or wire this endpoint to extractionProviders before production use."
      ],
      entities: []
    };
    sessions.set(id, updated);
    sendJson(response, 200, updated);
    return;
  }

  const exportMatch = url.pathname.match(/^\/api\/sessions\/([^/]+)\/export\/([^/]+)$/);
  if (request.method === "GET" && exportMatch) {
    const id = decodeURIComponent(exportMatch[1]);
    const type = decodeURIComponent(exportMatch[2]);
    const session = sessions.get(id);
    if (!session) {
      sendJson(response, 404, { error: "Session not found." });
      return;
    }
    sendJson(response, 200, {
      id,
      type,
      session,
      warning: "Export endpoint returns in-memory prototype session metadata only until backend persistence is added."
    });
    return;
  }

  sendJson(response, 404, { error: "API route not found." });
}

async function readJsonBody(request, response) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw.trim()) return {};
  try {
    return JSON.parse(raw);
  } catch {
    sendJson(response, 400, { error: "Request body must be valid JSON." });
    return null;
  }
}

function sendJson(response, status, payload) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "X-Content-Type-Options": "nosniff"
  });
  response.end(JSON.stringify(payload, null, 2));
}

function sanitizeRiskFeatures(input, featureNames) {
  return Object.fromEntries(
    featureNames.map((feature) => {
      const value = Number(input[feature]);
      return [feature, Number.isFinite(value) ? value : 0];
    })
  );
}

function scoreRiskFeatures(features, artifact) {
  const contributions = artifact.featureNames.map((feature) => {
    const normalizedValue = normalizeRiskFeature(feature, features, artifact.normalization[feature]);
    return {
      feature,
      contribution: normalizedValue * artifact.weights[feature],
      rawValue: features[feature]
    };
  });
  const logit = contributions.reduce((sum, item) => sum + item.contribution, artifact.intercept);
  const probability = Number(sigmoid(logit).toFixed(3));
  const band = probability >= artifact.thresholds.high ? "high" : probability >= artifact.thresholds.low ? "moderate" : "low";

  return {
    probability,
    band,
    decision: probability >= artifact.thresholds.decision ? "above-threshold" : "below-threshold",
    threshold: artifact.thresholds.decision,
    drivers: contributions
      .filter((item) => Math.abs(item.contribution) >= 0.08)
      .sort((a, b) => Math.abs(b.contribution) - Math.abs(a.contribution))
      .slice(0, 5)
      .map((item) => ({
        feature: item.feature,
        contribution: Number(item.contribution.toFixed(3)),
        rawValue: item.rawValue
      }))
  };
}

function normalizeRiskFeature(feature, features, spec) {
  const value = getRiskModelFeatureValue(feature, features, spec?.center ?? 0);
  if (!Number.isFinite(value) || !Number.isFinite(spec?.scale) || spec.scale === 0) return 0;
  return (value - spec.center) / spec.scale;
}

function getRiskModelFeatureValue(feature, features, neutralValue) {
  if (feature === "heart_rate__mean" && features.heart_rate__missing === 1) return neutralValue;
  if ((feature === "bp_systolic__last" || feature === "bp_diastolic__last") && features.bp_missing === 1) return neutralValue;
  return features[feature];
}

function sigmoid(value) {
  if (value >= 0) {
    const z = Math.exp(-value);
    return 1 / (1 + z);
  }
  const z = Math.exp(value);
  return z / (1 + z);
}
