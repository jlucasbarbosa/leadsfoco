const { clearSessionCookie } = require("../_lib/auth");
const { applyCorsHeaders, isTrustedRequest, json, setSecurityHeaders } = require("../_lib/http");

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

  clearSessionCookie(req, res);
  json(res, 200, { ok: true });
};
