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
      assert(
        body.extractionProviders.some((provider) => provider.id === "local-rules"),
        "Provider manifest does not include local-rules."
      );
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
