const { getSessionFromRequest } = require("../_lib/auth");
const { applyCorsHeaders, json, setSecurityHeaders } = require("../_lib/http");

module.exports = async (req, res) => {
  setSecurityHeaders(res);
  applyCorsHeaders(req, res, "GET, OPTIONS");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "GET") {
    json(res, 405, { error: "Method not allowed" });
    return;
  }

  const session = getSessionFromRequest(req);
  if (!session) {
    json(res, 401, { authenticated: false });
    return;
  }

  json(res, 200, { authenticated: true, user: session.sub });
};
