const { getSessionFromRequest } = require("../_lib/auth");
const {
  applyCorsHeaders,
  isTrustedRequest,
  json,
  readBody,
  setSecurityHeaders,
} = require("../_lib/http");

const WEBHOOK_URL = process.env.WEBHOOK_URL || "https://n8n.ceci.chat/webhook/form";
const DISPATCH_WEBHOOK_URL = process.env.DISPATCH_WEBHOOK_URL || WEBHOOK_URL;
const DEFAULT_TIMEZONE = process.env.DISPATCH_TIMEZONE || "America/Cuiaba";
const DAY_MAP = new Map([
  ["SEG", "Seg"],
  ["TER", "Ter"],
  ["QUA", "Qua"],
  ["QUI", "Qui"],
  ["SEX", "Sex"],
  ["SAB", "Sab"],
  ["SABADO", "Sab"],
  ["DOM", "Dom"],
  ["TODOS", "Todos"],
]);
const PERIOD_OPTIONS = new Set(["", "Manha", "Tarde", "Noite"]);

function normalizeText(value, maxLength = 1200) {
  return String(value || "").trim().slice(0, maxLength);
}

function normalizeDay(value) {
  const raw = normalizeText(value, 16);
  const sanitized = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\./g, "")
    .toUpperCase();
  return DAY_MAP.get(sanitized) || "";
}

function normalizeDate(value) {
  const raw = normalizeText(value, 20);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) return "";

  const [year, month, day] = raw.split("-").map((item) => Number(item));
  const parsed = new Date(Date.UTC(year, month - 1, day));

  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() + 1 !== month ||
    parsed.getUTCDate() !== day
  ) {
    return "";
  }

  return raw;
}

function normalizeTime(value) {
  const raw = normalizeText(value, 8);
  if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(raw)) return "";
  return raw;
}

function normalizeUrl(value) {
  const raw = normalizeText(value, 1200);
  if (!raw) return "";

  try {
    const parsed = new URL(raw);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return "";
    return parsed.toString();
  } catch {
    return "";
  }
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

  const session = getSessionFromRequest(req);
  if (!session) {
    json(res, 401, { error: "Sessao expirada. Faca login novamente." });
    return;
  }

  const body = await readBody(req);
  const diaTreino = normalizeDay(body.diaTreino);
  const dataEnvio = normalizeDate(body.dataEnvio);
  const horarioEnvio = normalizeTime(body.horarioEnvio);
  const horarioTreinoRaw = normalizeText(body.horarioTreino, 8);
  const horarioTreino = horarioTreinoRaw ? normalizeTime(horarioTreinoRaw) : "";
  const mensagem = normalizeText(body.mensagem, 2000);
  const linkDisparo = normalizeUrl(body.linkDisparo ?? body.link);
  const local = normalizeText(body.local, 120);
  const periodo = normalizeText(body.periodo, 16)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  if (!diaTreino) {
    json(res, 400, { error: "Selecione um dia de treino valido." });
    return;
  }

  if (!mensagem || mensagem.length < 5) {
    json(res, 400, { error: "Digite uma mensagem com pelo menos 5 caracteres." });
    return;
  }

  if (!linkDisparo) {
    json(res, 400, { error: "Informe um link valido para o disparo (http ou https)." });
    return;
  }

  if (!dataEnvio) {
    json(res, 400, { error: "Selecione uma data valida para o envio." });
    return;
  }

  if (!horarioEnvio) {
    json(res, 400, { error: "Selecione um horario valido para o envio." });
    return;
  }

  if (!PERIOD_OPTIONS.has(periodo)) {
    json(res, 400, { error: "Periodo invalido." });
    return;
  }

  if (horarioTreinoRaw && !horarioTreino) {
    json(res, 400, { error: "Horario de treino invalido." });
    return;
  }

  const payload = {
    tipo: "envio_programado",
    mensagem,
    linkDisparo,
    filtro: {
      diaTreino,
      periodo: periodo || null,
      local: local || null,
      horarioTreino: horarioTreino || null,
    },
    agendamento: {
      data: dataEnvio,
      horario: horarioEnvio,
      timezone: DEFAULT_TIMEZONE,
    },
    solicitadoPor: session.sub,
    solicitadoEm: new Date().toISOString(),
  };

  try {
    const response = await fetch(DISPATCH_WEBHOOK_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json, text/plain, */*",
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const details = await response.text().catch(() => "");
      json(res, 502, {
        error: `Webhook de envio retornou status ${response.status}.`,
        details: details.slice(0, 300),
      });
      return;
    }

    const raw = await response.text().catch(() => "");
    let webhookResponse = null;
    try {
      webhookResponse = raw ? JSON.parse(raw) : null;
    } catch {
      webhookResponse = raw ? { raw: raw.slice(0, 300) } : null;
    }

    json(res, 200, {
      ok: true,
      message: "Envio programado com sucesso.",
      webhook: webhookResponse,
    });
  } catch (error) {
    json(res, 500, { error: "Nao foi possivel acionar o fluxo de envio no n8n." });
  }
};
