const WEBHOOK_URL = process.env.WEBHOOK_URL || "https://n8n.ceci.chat/webhook/form";
const RATE_LIMIT_WINDOW_MS = Number(process.env.RATE_LIMIT_WINDOW_MS || 60_000);
const RATE_LIMIT_MAX_REQUESTS = Number(process.env.RATE_LIMIT_MAX_REQUESTS || 10);
const TRUSTED_ORIGINS = String(process.env.TRUSTED_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
const rateLimitState = new Map();

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

function normalizeList(value) {
  if (Array.isArray(value)) {
    return value.map((item) => String(item || "").trim()).filter(Boolean);
  }

  return String(value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function onlyDigits(value) {
  return String(value || "").replace(/\D/g, "").slice(0, 11);
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

function isTrustedRequest(req) {
  const expectedOrigin = getExpectedOrigin(req);
  const allowlist = new Set([expectedOrigin, ...TRUSTED_ORIGINS].filter(Boolean));
  const origin = normalizeOrigin(req.headers.origin);

  if (origin) {
    return allowlist.has(origin);
  }

  const referer = req.headers.referer || req.headers.referrer;
  const refererOrigin = normalizeOrigin(referer);
  if (refererOrigin) {
    return allowlist.has(refererOrigin);
  }

  return false;
}

function getClientIp(req) {
  const forwardedFor = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  if (forwardedFor) return forwardedFor;
  return req.socket?.remoteAddress || "unknown";
}

function isRateLimited(req) {
  const now = Date.now();
  const ip = getClientIp(req);
  const current = rateLimitState.get(ip);

  if (!current || current.resetAt <= now) {
    rateLimitState.set(ip, {
      count: 1,
      resetAt: now + RATE_LIMIT_WINDOW_MS,
    });
    return false;
  }

  current.count += 1;
  rateLimitState.set(ip, current);

  if (rateLimitState.size > 1000) {
    for (const [key, value] of rateLimitState.entries()) {
      if (value.resetAt <= now) {
        rateLimitState.delete(key);
      }
    }
  }

  return current.count > RATE_LIMIT_MAX_REQUESTS;
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

module.exports = async (req, res) => {
  setSecurityHeaders(res);

  const expectedOrigin = getExpectedOrigin(req);
  const requestOrigin = normalizeOrigin(req.headers.origin);
  const trustedOrigins = new Set([expectedOrigin, ...TRUSTED_ORIGINS].filter(Boolean));
  const responseOrigin = trustedOrigins.has(requestOrigin)
    ? requestOrigin
    : expectedOrigin || TRUSTED_ORIGINS[0] || "";

  if (responseOrigin) {
    res.setHeader("Access-Control-Allow-Origin", responseOrigin);
    res.setHeader("Vary", "Origin");
  }

  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    if (!isTrustedRequest(req)) {
      json(res, 403, { error: "Origem nao autorizada." });
      return;
    }

    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "POST") {
    json(res, 405, { error: "Method not allowed" });
    return;
  }

  if (!isTrustedRequest(req)) {
    json(res, 403, { error: "Origem nao autorizada." });
    return;
  }

  if (isRateLimited(req)) {
    json(res, 429, {
      error: "Muitas tentativas. Aguarde alguns segundos e tente novamente.",
    });
    return;
  }

  try {
    const body = await readBody(req);
    const whatsapp = onlyDigits(body.whatsapp);
    const locais = normalizeList(body.locais ?? body.local);
    const days = normalizeList(body.days ?? body.dias);
    const periodos = normalizeList(body.periodos ?? body.periodo);
    const tipo = String(body.tipo || "").trim();

    if (whatsapp.length < 10) {
      json(res, 400, { error: "Digite um WhatsApp valido para continuar." });
      return;
    }

    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/plain, */*",
      },
      body: JSON.stringify({
        whatsapp,
        local: locais.join(", "),
        locais,
        days,
        periodos,
        tipo,
      }),
    });

    if (!response.ok) {
      const details = await response.text().catch(() => "");
      json(res, 502, {
        error: `Webhook retornou status ${response.status}.`,
        details: details.slice(0, 300),
      });
      return;
    }

    json(res, 200, { ok: true });
  } catch (error) {
    json(res, 500, {
      error: "Nao foi possivel processar o envio.",
    });
  }
};
