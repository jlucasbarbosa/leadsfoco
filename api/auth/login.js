const { isAuthConfigured, isLoginValid, setSessionCookie } = require("../_lib/auth");
const {
  applyCorsHeaders,
  isTrustedRequest,
  json,
  readBody,
  setSecurityHeaders,
} = require("../_lib/http");

const LOGIN_WINDOW_MS = Number(process.env.AUTH_LOGIN_WINDOW_MS || 10 * 60 * 1000);
const LOGIN_MAX_ATTEMPTS = Number(process.env.AUTH_LOGIN_MAX_ATTEMPTS || 20);
const loginRateLimit = new Map();

function getClientIp(req) {
  const forwarded = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || req.socket?.remoteAddress || "unknown";
}

function isRateLimited(req) {
  const now = Date.now();
  const ip = getClientIp(req);
  const current = loginRateLimit.get(ip);

  if (!current || current.resetAt <= now) {
    loginRateLimit.set(ip, { attempts: 1, resetAt: now + LOGIN_WINDOW_MS });
    return false;
  }

  current.attempts += 1;
  loginRateLimit.set(ip, current);
  return current.attempts > LOGIN_MAX_ATTEMPTS;
}

module.exports = async (req, res) => {
  setSecurityHeaders(res);
  applyCorsHeaders(req, res, "POST, OPTIONS");

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

  if (!isAuthConfigured()) {
    json(res, 503, {
      error: "Autenticacao nao configurada. Defina ADMIN_USERNAME e ADMIN_PASSWORD.",
    });
    return;
  }

  if (isRateLimited(req)) {
    json(res, 429, { error: "Muitas tentativas de login. Tente novamente em alguns minutos." });
    return;
  }

  const body = await readBody(req);
  const username = String(body.username || "").trim();
  const password = String(body.password || "");

  if (!isLoginValid(username, password)) {
    json(res, 401, { error: "Usuario ou senha invalidos." });
    return;
  }

  setSessionCookie(req, res, username);
  json(res, 200, { ok: true, user: username });
};
