const baseUrl = process.argv[2] || process.env.SMOKE_BASE_URL || "http://127.0.0.1:4173";

const checks = [
  {
    label: "root HTML",
    run: async () => {
      const response = await fetch(baseUrl);
      const body = await response.text();
      assert(response.ok, `Expected root to return 2xx, got ${response.status}`);
      assert(body.includes("<!doctype html>") || body.includes("<div id=\"root\">"), "Root response does not look like the Vite app shell.");
    }
  },
  {
    label: "API health",
    run: async () => {
      const response = await fetch(`${baseUrl}/api/health`);
      const body = await response.json();
      assert(response.ok, `Expected /api/health to return 2xx, got ${response.status}`);
      assert(body.ok === true, "Health response did not include ok=true.");
    }
  },
  {
    label: "provider manifest",
    run: async () => {
      const response = await fetch(`${baseUrl}/api/providers`);
      const body = await response.json();
      assert(response.ok, `Expected /api/providers to return 2xx, got ${response.status}`);
      assert(Array.isArray(body.extractionProviders), "Provider manifest is missing extractionProviders.");
      const engineProvider = body.extractionProviders.find((provider) => provider.id === "clinical-nlp-engine");
      assert(engineProvider, "Provider manifest does not include clinical-nlp-engine.");
      assert(
        engineProvider.status === "available",
        `clinical-nlp-engine must be available; got ${engineProvider.status || "missing status"}.`
      );
      assert(body.extractionProviders.some((provider) => provider.id === "local-rules"), "Provider manifest does not include local-rules.");
    }
  },
  {
    label: "engine health",
    run: async () => {
      const response = await fetch(`${baseUrl}/api/engine/health`);
      const body = await response.json();
      assert(response.ok, `Expected /api/engine/health to return 2xx, got ${response.status}`);
      assert(body.ok === true, "Engine health response did not include ok=true.");
      assert(body.engine?.status === "available", `Expected available engine, got ${body.engine?.status || "missing status"}.`);
      assert(body.engine?.schemaVersion === "engine-1", "Engine health response is missing schemaVersion=engine-1.");
      assert(typeof body.engine?.pythonVersion === "string" && body.engine.pythonVersion.startsWith("3."), "Engine health is missing Python version.");
    }
  },
  {
    label: "server extraction engine",
    run: async () => {
      const response = await fetch(`${baseUrl}/api/sessions/test/extract`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ specialty: "mixed", sourceText: "BP 120/80. Denies SI." })
      });
      const body = await response.json();
      assert(response.ok, `Expected engine extract to return 2xx, got ${response.status}`);
      assert(body.providerId === "clinical-nlp-engine", "Extraction did not use clinical-nlp-engine.");
      assert(body.status === "extracted", `Expected extracted session status, got ${body.status || "missing status"}.`);
      assert(body.extraction?.schema_version === "engine-1", "Extraction response is missing the engine envelope.");
      assert(Array.isArray(body.extraction.mentions), "Engine envelope is missing mentions.");
      assert(Array.isArray(body.extraction.entities), "Engine envelope is missing entities.");
    }
  },
  {
    label: "session create",
    run: async () => {
      const response = await fetch(`${baseUrl}/api/sessions`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ specialty: "mixed", sourceText: "BP 120/80. Denies SI." })
      });
      const body = await response.json();
      assert(response.status === 201, `Expected session create to return 201, got ${response.status}`);
      assert(typeof body.id === "string" && body.id, "Session create response is missing id.");
    }
  }
];

for (const check of checks) {
  try {
    await check.run();
    console.log(`ok - ${check.label}`);
  } catch (error) {
    console.error(`not ok - ${check.label}`);
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
    break;
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
