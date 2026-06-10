export function createEngineHealth({ pythonBin = process.env.ENGINE_PYTHON || "python3" } = {}) {
  const state = {
    status: "unknown",
    pythonBin,
    schemaVersion: null,
    pythonVersion: null,
    package: "clinical_nlp",
    mode: null,
    startedAt: new Date().toISOString(),
    lastCheckedAt: null,
    lastAvailableAt: null,
    lastLatencyMs: null,
    startupLatencyMs: null,
    lastErrorCode: null
  };

  function snapshot() {
    return { ...state };
  }

  async function check(engine, { startup = false } = {}) {
    const started = Date.now();
    state.lastCheckedAt = new Date().toISOString();
    try {
      const result = await engine.ping();
      const latency = Date.now() - started;
      state.status = "available";
      state.schemaVersion = result.schema_version ?? null;
      state.pythonVersion = result.python_version ?? null;
      state.package = result.package ?? "clinical_nlp";
      state.mode = result.mode ?? null;
      state.lastAvailableAt = new Date().toISOString();
      state.lastLatencyMs = latency;
      state.lastErrorCode = null;
      if (startup || state.startupLatencyMs === null) state.startupLatencyMs = latency;
    } catch (error) {
      const latency = Date.now() - started;
      state.status = "unavailable";
      state.lastLatencyMs = latency;
      state.lastErrorCode = safeErrorCode(error);
      if (startup || state.startupLatencyMs === null) state.startupLatencyMs = latency;
    }
    return snapshot();
  }

  return { check, snapshot };
}

function safeErrorCode(error) {
  const code = error?.code;
  if (typeof code !== "string") return "engine-error";
  return /^[a-z0-9._-]{1,64}$/i.test(code) ? code : "engine-error";
}
