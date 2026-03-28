const TRUSTED_ORIGINS = String(process.env.TRUSTED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

function setSecurityHeaders(res) {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  res.setHeader("Cache-Control", "no-store");
}

function json(res, statusCode, payload) {
  const body = JSON.stringify(payload);
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Length", Buffer.byteLength(body));
  res.end(body);
}

function normalizeOrigin(origin) {
  if (!origin) return "";

  try {
    return new URL(String(origin)).origin;
  } catch {
    return "";
  }
}

function getExpectedOrigin(req) {
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").trim();
  if (!host) return "";

  const protocolHeader = String(req.headers["x-forwarded-proto"] || "https");
  const protocol = protocolHeader.split(",")[0].trim() || "https";
  return `${protocol}://${host}`;
}

function getTrustedOrigins(req, extraOrigins = []) {
  return new Set([getExpectedOrigin(req), ...TRUSTED_ORIGINS, ...extraOrigins].filter(Boolean));
}

function isTrustedRequest(req, extraOrigins = []) {
  const trustedOrigins = getTrustedOrigins(req, extraOrigins);

  const origin = normalizeOrigin(req.headers.origin);
  if (origin) {
    return trustedOrigins.has(origin);
  }

  const referer = req.headers.referer || req.headers.referrer;
  const refererOrigin = normalizeOrigin(referer);
  if (refererOrigin) {
    return trustedOrigins.has(refererOrigin);
  }

  return false;
}

async function readBody(req) {
  if (req.body && typeof req.body === "object") {
    return req.body;
  }

  if (typeof req.body === "string") {
    try {
      return JSON.parse(req.body || "{}");
    } catch {
      return {};
    }
  }

  const chunks = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const raw = Buffer.concat(chunks).toString("utf8");
  if (!raw) {
    return {};
  }

  try {
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function applyCorsHeaders(req, res, methods = "GET, POST, OPTIONS") {
  const expectedOrigin = getExpectedOrigin(req);
  const requestOrigin = normalizeOrigin(req.headers.origin);
  const trustedOrigins = getTrustedOrigins(req);
  const responseOrigin = trustedOrigins.has(requestOrigin)
    ? requestOrigin
    : expectedOrigin || TRUSTED_ORIGINS[0] || "";

  if (responseOrigin) {
    res.setHeader("Access-Control-Allow-Origin", responseOrigin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Methods", methods);
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");
}

module.exports = {
  applyCorsHeaders,
  getExpectedOrigin,
  isTrustedRequest,
  json,
  readBody,
  setSecurityHeaders,
};
