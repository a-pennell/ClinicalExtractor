import { spawn } from "node:child_process";

/**
 * Bridge to the Python clinical_nlp extraction engine (ADR-001).
 *
 * Spawns `python -m clinical_nlp.service` once (lazily) and speaks NDJSON over
 * stdio. Transport rationale lives in ADR-001's implementation notes.
 *
 * PHI discipline: the child's stderr is discarded, not logged — Python
 * tracebacks could embed note text. Engine errors surface as error codes.
 */
export function createEngineClient({
  pythonBin = process.env.ENGINE_PYTHON || "python3",
  cwd = process.cwd(),
  extraEnv = {},
  timeoutMs = Number(process.env.ENGINE_TIMEOUT_MS || 15000)
} = {}) {
  let child = null;
  let buffer = "";
  let counter = 0;
  const pending = new Map();

  function rejectAllPending(code) {
    for (const [, entry] of pending) {
      clearTimeout(entry.timer);
      entry.reject(new EngineError(code));
    }
    pending.clear();
  }

  function ensureChild() {
    if (child && child.exitCode === null) return child;
    child = spawn(pythonBin, ["-m", "clinical_nlp.service"], {
      cwd,
      env: { ...process.env, ...extraEnv },
      stdio: ["pipe", "pipe", "ignore"]
    });
    buffer = "";
    child.stdout.setEncoding("utf8");
    child.stdout.on("data", (chunk) => {
      buffer += chunk;
      let newlineIndex;
      while ((newlineIndex = buffer.indexOf("\n")) >= 0) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        if (!line) continue;
        let message;
        try {
          message = JSON.parse(line);
        } catch {
          continue;
        }
        const entry = pending.get(message.id);
        if (!entry) continue;
        pending.delete(message.id);
        clearTimeout(entry.timer);
        if (message.ok) entry.resolve(message.result);
        else entry.reject(new EngineError(message.error?.code || "engine-error"));
      }
    });
    child.on("exit", () => rejectAllPending("engine-exited"));
    child.on("error", () => rejectAllPending("engine-unavailable"));
    return child;
  }

  function request(op, payload = {}) {
    return new Promise((resolve, reject) => {
      let proc;
      try {
        proc = ensureChild();
      } catch {
        reject(new EngineError("engine-unavailable"));
        return;
      }
      const id = `req-${++counter}`;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new EngineError("engine-timeout"));
      }, timeoutMs);
      pending.set(id, { resolve, reject, timer });
      try {
        proc.stdin.write(`${JSON.stringify({ id, op, ...payload })}\n`);
      } catch {
        pending.delete(id);
        clearTimeout(timer);
        reject(new EngineError("engine-unavailable"));
      }
    });
  }

  return {
    extract: (text) => request("extract", { text }),
    ping: () => request("ping"),
    close: () => {
      if (child && child.exitCode === null) child.kill();
      child = null;
    }
  };
}

export class EngineError extends Error {
  constructor(code) {
    super(code);
    this.code = code;
  }
}
