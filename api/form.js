const WEBHOOK_URL = "https://n8n.ceci.chat/webhook/form";

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
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return;
  }

  if (req.method !== "POST") {
    json(res, 405, { error: "Method not allowed" });
    return;
  }

  try {
    const body = await readBody(req);
    const whatsapp = onlyDigits(body.whatsapp);
    const locais = normalizeList(body.locais ?? body.local);
    const days = normalizeList(body.days ?? body.dias);
    const periodos = normalizeList(body.periodos ?? body.periodo);

    if (whatsapp.length < 10) {
      json(res, 400, { error: "Digite um WhatsApp valido para continuar." });
      return;
    }

    const response = await fetch(WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        whatsapp,
        local: locais.join(", "),
        locais,
        days,
        periodos,
        source: "vercel",
      }),
    });

    if (!response.ok) {
      const details = await response.text().catch(() => "");
      json(res, 502, {
        error: "Nao foi possivel enviar para o webhook.",
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
