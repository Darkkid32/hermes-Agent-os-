import crypto from "node:crypto";

const SAFE_BEARER = /^[A-Za-z0-9._\-]{16,256}$/;

function timingSafeEqual(a, b) {
  const aBuf = Buffer.from(a, "utf8");
  const bBuf = Buffer.from(b, "utf8");
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

function isLocalRequest(req) {
  const remote = req.socket?.remoteAddress || "";
  if (remote === "127.0.0.1" || remote === "::1") return true;
  const fwd = req.headers["x-forwarded-for"];
  if (typeof fwd === "string" && fwd.split(",")[0].trim() === "127.0.0.1") return true;
  return false;
}

const PUBLIC_PATHS = new Set([
  "/api/health",
  "/api/os/status",
  "/api/os/foundation",
  "/api/os/audit",
  "/api/modules",
  "/api/integrations",
  "/api/connections",
  "/api/connections/templates",
  "/api/self/:id",
  "/api/workflows",
  "/api/workflows/:id",
  "/api/builder/status"
]);

const STATE_CHANGING_PREFIXES = [
  "/api/llm/",
  "/api/edit/",
  "/api/modules/",
  "/api/terminal/",
  "/api/execute/",
  "/api/orchestrate/",
  "/api/verify/",
  "/api/installers/",
  "/api/workflows/",     // POST/PUT/DELETE handled by method check
  "/api/connections/",   // POST configure / test
  "/api/admin/"
];

const STATE_CHANGING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

function isStateChanging(req) {
  const path = req.path || req.url.split("?")[0];
  const method = req.method.toUpperCase();
  const startsWithProtected = STATE_CHANGING_PREFIXES.some((prefix) => path.startsWith(prefix));
  const targetsProtectedPath = [...PUBLIC_PATHS].some((p) => path === p || path.startsWith(p + "/"));
  return STATE_CHANGING_METHODS.has(method) && startsWithProtected && !targetsProtectedPath;
}

export function createAuthMiddleware() {
  return function authMiddleware(req, res, next) {
    if (!isStateChanging(req)) {
      return next();
    }

    const configuredToken = process.env.HERMES_API_TOKEN;
    const localDev = !configuredToken || configuredToken.trim().length === 0;

    if (localDev) {
      if (process.env.NODE_ENV === "production") {
        res.status(503).json({
          ok: false,
          error: "Authentication is disabled but the server is running in production. Set HERMES_API_TOKEN."
        });
        return;
      }
      if (isLocalRequest(req)) {
        return next();
      }
      res.status(401).json({ ok: false, error: "Authentication required for non-local requests." });
      return;
    }

    const header = req.headers["authorization"] || "";
    const query = req.query?.auth_token;
    const candidate = header.startsWith("Bearer ")
      ? header.slice("Bearer ".length).trim()
      : typeof query === "string"
        ? query.trim()
        : null;

    if (!candidate || !SAFE_BEARER.test(candidate)) {
      res.status(401).json({ ok: false, error: "Missing or invalid bearer token." });
      return;
    }

    if (!timingSafeEqual(candidate, configuredToken)) {
      res.status(403).json({ ok: false, error: "Forbidden." });
      return;
    }

    return next();
  };
}

export function createRateLimitMiddleware({ limit, windowMs } = {}) {
  const max = limit || Number(process.env.HERMES_LLM_RATE_LIMIT) || 60;
  const window = windowMs || (Number(process.env.HERMES_LLM_RATE_WINDOW) || 1) * 60 * 1000;
  const store = new Map();

  // Periodic eviction prevents the Map from leaking idle buckets.
  setInterval(() => {
    const now = Date.now();
    for (const [key, value] of store.entries()) {
      if (now - value.windowStart > window) {
        store.delete(key);
      }
    }
  }, window).unref?.();

  return function rateLimitMiddleware(req, res, next) {
    const key = (req.headers["x-forwarded-for"]?.toString().split(",")[0].trim()) || req.socket?.remoteAddress || "unknown";
    const now = Date.now();
    const record = store.get(key) || { count: 0, windowStart: now };

    if (now - record.windowStart > window) {
      record.count = 0;
      record.windowStart = now;
    }

    record.count += 1;
    store.set(key, record);

    res.setHeader("X-RateLimit-Limit", String(max));
    res.setHeader("X-RateLimit-Remaining", String(Math.max(0, max - record.count)));
    res.setHeader("X-RateLimit-Reset", String(Math.ceil((record.windowStart + window) / 1000)));

    if (record.count > max) {
      res.status(429).json({ ok: false, error: "Too many requests. Please slow down." });
      return;
    }

    next();
  };
}
