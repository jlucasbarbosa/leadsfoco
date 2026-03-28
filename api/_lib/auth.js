const crypto = require("crypto");

const SESSION_COOKIE_NAME = process.env.AUTH_COOKIE_NAME || "foco_session";
const SESSION_MAX_AGE_SECONDS = Number(process.env.AUTH_SESSION_MAX_AGE_SECONDS || 60 * 60 * 12);
const SESSION_SECRET = process.env.AUTH_SESSION_SECRET || "change-this-session-secret";
const ADMIN_USERNAME = String(process.env.ADMIN_USERNAME || "").trim();
const ADMIN_PASSWORD = String(process.env.ADMIN_PASSWORD || "").trim();

function appendSetCookie(res, value) {
  const current = res.getHeader("Set-Cookie");
  if (!current) {
    res.setHeader("Set-Cookie", [value]);
    return;
  }

  if (Array.isArray(current)) {
    res.setHeader("Set-Cookie", [...current, value]);
    return;
  }

  res.setHeader("Set-Cookie", [current, value]);
}

function shouldUseSecureCookie(req) {
  const forwardedProto = String(req.headers["x-forwarded-proto"] || "").toLowerCase();
  if (forwardedProto.includes("https")) return true;

  const host = String(req.headers.host || "").toLowerCase();
  if (!host) return true;

  return !(host.includes("localhost") || host.startsWith("127.0.0.1"));
}

function base64UrlEncode(value) {
  return Buffer.from(value, "utf8").toString("base64url");
}

function base64UrlDecode(value) {
  return Buffer.from(value, "base64url").toString("utf8");
}

function sign(value) {
  return crypto.createHmac("sha256", SESSION_SECRET).update(value).digest("base64url");
}

function createSessionToken(username) {
  const payload = {
    sub: username,
    exp: Math.floor(Date.now() / 1000) + SESSION_MAX_AGE_SECONDS,
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(encodedPayload);
  return `${encodedPayload}.${signature}`;
}

function verifySessionToken(token) {
  const [encodedPayload, providedSignature] = String(token || "").split(".");
  if (!encodedPayload || !providedSignature) return null;

  const expectedSignature = sign(encodedPayload);
  const provided = Buffer.from(providedSignature);
  const expected = Buffer.from(expectedSignature);
  if (provided.length !== expected.length) return null;

  if (!crypto.timingSafeEqual(provided, expected)) {
    return null;
  }

  try {
    const payload = JSON.parse(base64UrlDecode(encodedPayload));
    if (!payload || typeof payload !== "object") return null;
    if (typeof payload.exp !== "number" || payload.exp < Math.floor(Date.now() / 1000)) return null;
    if (typeof payload.sub !== "string" || !payload.sub) return null;
    return payload;
  } catch {
    return null;
  }
}

function parseCookies(req) {
  const raw = String(req.headers.cookie || "");
  const cookies = {};

  for (const chunk of raw.split(";")) {
    const [key, ...valueParts] = chunk.trim().split("=");
    if (!key) continue;
    cookies[key] = decodeURIComponent(valueParts.join("="));
  }

  return cookies;
}

function getSessionFromRequest(req) {
  const cookies = parseCookies(req);
  return verifySessionToken(cookies[SESSION_COOKIE_NAME]);
}

function setSessionCookie(req, res, username) {
  const token = createSessionToken(username);
  const secure = shouldUseSecureCookie(req) ? "; Secure" : "";
  appendSetCookie(
    res,
    `${SESSION_COOKIE_NAME}=${encodeURIComponent(
      token
    )}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE_SECONDS}${secure}`
  );
}

function clearSessionCookie(req, res) {
  const secure = shouldUseSecureCookie(req) ? "; Secure" : "";
  appendSetCookie(
    res,
    `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secure}`
  );
}

function safeEqual(valueA, valueB) {
  const left = Buffer.from(String(valueA || ""));
  const right = Buffer.from(String(valueB || ""));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

function isLoginValid(username, password) {
  if (!ADMIN_USERNAME || !ADMIN_PASSWORD) return false;
  return safeEqual(username, ADMIN_USERNAME) && safeEqual(password, ADMIN_PASSWORD);
}

function isAuthConfigured() {
  return Boolean(ADMIN_USERNAME && ADMIN_PASSWORD);
}

module.exports = {
  clearSessionCookie,
  getSessionFromRequest,
  isAuthConfigured,
  isLoginValid,
  setSessionCookie,
};
