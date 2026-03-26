const http = require("http");
const fs = require("fs");
const path = require("path");

const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || "0.0.0.0";
const PUBLIC_DIR = path.join(__dirname, "public");
const BACKGROUND_IMAGE_URL = "/runner.jpg?v=20260326";
const WEBHOOK_URL = "https://n8n.ceci.chat/webhook/form";
const REDIRECT_URL = "https://instagram.com/7dfotos";

const LOCATION_OPTIONS = [
  "Parque dos Poderes",
  "Parque das Nações",
  "Orla do Aeroporto",
];

const DAY_OPTIONS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const PERIOD_OPTIONS = ["Manhã", "Tarde", "Noite"];

function onlyDigits(value) {
  return String(value || "")
    .replace(/\D/g, "")
    .slice(0, 11);
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

function json(res, statusCode, payload) {
  const body = JSON.stringify(payload);

  res.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function sendText(res, statusCode, body, contentType = "text/plain; charset=utf-8") {
  res.writeHead(statusCode, {
    "Content-Type": contentType,
    "Content-Length": Buffer.byteLength(body),
  });
  res.end(body);
}

function serveFile(res, filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const contentTypes = {
    ".css": "text/css; charset=utf-8",
    ".js": "application/javascript; charset=utf-8",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".webp": "image/webp",
    ".html": "text/html; charset=utf-8",
  };

  const contentType = contentTypes[ext] || "application/octet-stream";
  fs.readFile(filePath, (error, data) => {
    if (error) {
      json(res, 404, { error: "Arquivo nao encontrado." });
      return;
    }

    res.writeHead(200, {
      "Content-Type": contentType,
      "Content-Length": data.length,
    });
    res.end(data);
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function buildPage() {
  const locationButtons = LOCATION_OPTIONS.map(
    (option) => `
      <button type="button" class="choice-chip" data-group="locais" data-value="${escapeHtml(option)}" aria-pressed="false">
        ${escapeHtml(option)}
      </button>`
  ).join("");

  const dayButtons = DAY_OPTIONS.map(
    (option) => `
      <button type="button" class="choice-chip" data-group="dias" data-value="${escapeHtml(option)}" aria-pressed="false" aria-label="Selecionar ${escapeHtml(option)}">
        ${escapeHtml(option)}
      </button>`
  ).join("");

  return `<!doctype html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Foco Radical | Receba suas fotos</title>
  <meta name="description" content="Cadastre seu WhatsApp para receber o link das fotos oficiais direto no celular." />
  <style>
    :root {
      --bg: #050607;
      --bg-panel: rgba(7, 8, 10, 0.62);
      --panel-border: rgba(255, 209, 0, 0.18);
      --panel-accent: rgba(255, 209, 0, 0.14);
      --yellow: #ffd100;
      --yellow-strong: #ffbf00;
      --text: #f7f7f7;
      --muted: rgba(247, 247, 247, 0.72);
      --danger: #ff9a9a;
      --ok: #baffb2;
      --loading: #ffe79c;
      --shadow: 0 20px 48px rgba(0, 0, 0, 0.24);
    }

    * { box-sizing: border-box; }

    html, body {
      margin: 0;
      min-height: 100%;
    }

    body {
      min-height: 100vh;
      font-family: "Arial", "Helvetica", sans-serif;
      color: var(--text);
      background:
        linear-gradient(115deg, rgba(4, 4, 5, 0.78) 0%, rgba(4, 4, 5, 0.58) 44%, rgba(4, 4, 5, 0.88) 100%),
        radial-gradient(circle at 15% 15%, rgba(255, 209, 0, 0.12), transparent 28%),
        radial-gradient(circle at 85% 20%, rgba(255, 191, 0, 0.09), transparent 25%),
        url(${JSON.stringify(BACKGROUND_IMAGE_URL)}) center 18% / cover no-repeat fixed,
        linear-gradient(180deg, #111214 0%, #070809 54%, #040405 100%);
      overflow-x: hidden;
    }

    body::before {
      content: "";
      position: fixed;
      inset: 0;
      background:
        linear-gradient(115deg, rgba(0, 0, 0, 0.12) 0%, rgba(0, 0, 0, 0.42) 52%, rgba(0, 0, 0, 0.82) 100%),
        radial-gradient(circle at top left, rgba(255, 209, 0, 0.12), transparent 32%),
        linear-gradient(180deg, rgba(0, 0, 0, 0.24), rgba(0, 0, 0, 0.42));
      pointer-events: none;
      z-index: 0;
    }

    .lp-shell {
      position: relative;
      z-index: 1;
      min-height: 100vh;
      display: grid;
      grid-template-rows: auto 1fr auto;
    }

    .topbar {
      display: flex;
      justify-content: center;
      padding: 22px 16px 8px;
    }

    .brand-logo {
      width: min(300px, 48vw);
      filter: drop-shadow(0 0 12px rgba(255, 209, 0, 0.18));
    }

    .hero-split {
      display: grid;
      grid-template-columns: minmax(0, 1.45fr) minmax(360px, 0.75fr);
      min-height: 0;
      align-items: stretch;
    }

    .hero-left {
      display: grid;
      align-content: center;
      padding: 48px clamp(24px, 5vw, 84px) 28px;
    }

    .hero-copy {
      display: grid;
      gap: 16px;
      max-width: 760px;
    }

    .kicker {
      margin: 0;
      color: var(--yellow);
      text-transform: uppercase;
      letter-spacing: 0.24em;
      font-size: 0.72rem;
      font-weight: 700;
    }

    .kicker-large {
      font-size: 0.85rem;
    }

    h1 {
      margin: 0;
      font-family: "Aptos", "Segoe UI", "Helvetica Neue", Arial, sans-serif;
      font-size: clamp(2.15rem, 3.4vw, 4.1rem);
      line-height: 1.08;
      letter-spacing: -0.045em;
      font-weight: 800;
      max-width: 720px;
      text-wrap: balance;
    }

    .subtitle {
      margin: 0;
      color: var(--muted);
      font-size: clamp(1rem, 1.25vw, 1.12rem);
      line-height: 1.5;
      max-width: 720px;
    }

    .proof {
      margin: 0;
      display: inline-flex;
      width: fit-content;
      align-items: center;
      gap: 8px;
      padding: 8px 14px;
      border-radius: 999px;
      border: 1px solid rgba(255, 209, 0, 0.34);
      background: rgba(255, 209, 0, 0.08);
      font-weight: 700;
    }

    .hero-right {
      display: grid;
      place-items: center;
      padding: 28px clamp(18px, 4vw, 52px);
    }

    .lead-form {
      width: min(100%, 520px);
      display: grid;
      gap: 16px;
      padding: 32px;
      border-radius: 18px;
      border: 1px solid rgba(255, 209, 0, 0.1);
      background: var(--bg-panel);
      backdrop-filter: blur(14px);
      -webkit-backdrop-filter: blur(14px);
      box-shadow: var(--shadow);
    }

    label,
    legend {
      font-size: 0.92rem;
      font-weight: 700;
      letter-spacing: 0.01em;
    }

    input[type="tel"],
    input[type="text"] {
      width: 100%;
      min-height: 60px;
      border: 1px solid var(--panel-border);
      border-radius: 12px;
      background: rgba(8, 8, 8, 0.72);
      color: var(--text);
      font: inherit;
      padding: 18px 16px;
      outline: none;
      transition: border-color 140ms ease, box-shadow 140ms ease, transform 140ms ease;
    }

    input::placeholder { color: #8f8f8f; }

    input:focus-visible {
      border-color: var(--yellow);
      box-shadow: 0 0 0 3px rgba(255, 209, 0, 0.16);
      transform: translateY(-1px);
    }

    fieldset {
      border: 0;
      margin: 0;
      padding: 0;
    }

    .choice-grid {
      display: grid;
      gap: 10px;
      margin-top: 8px;
    }

    .choice-grid:not(.days-grid) {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .days-grid {
      grid-template-columns: repeat(4, minmax(0, 1fr));
    }

    .periods-grid {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }

    .choice-chip {
      border: 1px solid rgba(255, 209, 0, 0.18);
      border-radius: 12px;
      min-height: 52px;
      padding: 12px 10px;
      background: rgba(10, 10, 10, 0.6);
      color: var(--text);
      font: inherit;
      font-weight: 700;
      cursor: pointer;
      transition: border-color 140ms ease, background 140ms ease, transform 140ms ease, box-shadow 140ms ease;
    }

    .choice-chip:hover {
      transform: translateY(-1px);
      border-color: rgba(255, 209, 0, 0.32);
    }

    .choice-chip.selected {
      border-color: var(--yellow);
      background: var(--panel-accent);
      box-shadow: 0 0 0 1px rgba(255, 209, 0, 0.12) inset;
    }

    .cta {
      margin-top: 8px;
      border: 1px solid var(--yellow);
      border-radius: 12px;
      min-height: 62px;
      padding: 18px 20px;
      background: linear-gradient(180deg, var(--yellow), var(--yellow-strong));
      color: #121212;
      font: inherit;
      font-size: 1.05rem;
      font-weight: 800;
      cursor: pointer;
      transition: transform 140ms ease, box-shadow 140ms ease, opacity 140ms ease;
    }

    .cta:hover:not(:disabled) {
      transform: translateY(-2px);
      box-shadow: 0 10px 18px rgba(255, 209, 0, 0.26);
    }

    .cta:disabled {
      opacity: 0.75;
      cursor: not-allowed;
    }

    .feedback {
      margin: 0;
      min-height: 1.1em;
      font-size: 0.9rem;
      font-weight: 600;
    }

    .feedback.loading { color: var(--loading); }
    .feedback.success { color: var(--ok); }
    .feedback.error { color: var(--danger); }

    .site-footer {
      padding: 12px 16px 14px;
      color: rgba(255, 255, 255, 0.78);
      font-size: 0.75rem;
      font-weight: 700;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      text-align: center;
      white-space: nowrap;
    }

    @media (max-width: 960px) {
      .hero-split {
        grid-template-columns: 1fr;
      }

      .brand-logo {
        width: min(260px, 64vw);
      }

      .hero-left {
        padding-top: 20px;
      }

      h1 {
        max-width: 680px;
        line-height: 1.08;
      }

      .hero-right {
        padding-top: 0;
        padding-bottom: 20px;
      }

      .choice-grid:not(.days-grid) {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .days-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .periods-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .site-footer {
        white-space: normal;
        line-height: 1.2;
      }
    }

    @media (max-width: 640px) {
      .topbar {
        padding: 18px 12px 8px;
      }

      .hero-left,
      .hero-right {
        padding-left: 14px;
        padding-right: 14px;
      }

      h1 {
        font-size: clamp(2rem, 9vw, 3.2rem);
        line-height: 1.06;
        letter-spacing: -0.04em;
      }

      .lead-form {
        width: 100%;
        padding: 20px;
        border-radius: 16px;
      }

      input[type="tel"],
      input[type="text"] {
        min-height: 56px;
        padding: 16px 14px;
      }

      .choice-grid:not(.days-grid),
      .days-grid {
        grid-template-columns: repeat(2, minmax(0, 1fr));
      }

      .periods-grid {
        grid-template-columns: repeat(3, minmax(0, 1fr));
      }

      .choice-chip {
        min-height: 48px;
        padding: 11px 10px;
        font-size: 0.92rem;
      }
    }
  </style>
</head>
<body>
  <main class="lp-shell">
    <header class="topbar">
      <img class="brand-logo" src="/logo.png" alt="Foco Radical" />
    </header>

    <section class="hero-split" aria-label="Receba o link das fotos">
      <div class="hero-left">
        <div class="hero-copy">
          <p class="kicker kicker-large">Campo Grande - MS</p>
          <h1>Receba automaticamente o link das fotos no seu WhatsApp assim que forem liberadas</h1>
          <p class="subtitle">Sem precisar procurar. Liberou, você recebe automaticamente.</p>
          <p class="proof">📸 Fotógrafo oficial da Foco Radical</p>
        </div>
      </div>

      <div class="hero-right">
        <form class="lead-form" id="leadForm" novalidate>
          <label for="whatsapp">WhatsApp</label>
          <input
            id="whatsapp"
            name="whatsapp"
            type="tel"
            inputmode="numeric"
            autocomplete="tel"
            placeholder="(65) 99999-0000"
            required
          />

          <fieldset>
            <legend>Onde você treina</legend>
            <div class="choice-grid">
              ${locationButtons}
            </div>
          </fieldset>

          <fieldset>
            <legend>Quais dias você vai?</legend>
            <div class="choice-grid days-grid">
              ${dayButtons}
            </div>
          </fieldset>

          <fieldset>
            <legend>Qual período você treina?</legend>
            <div class="choice-grid periods-grid">
              ${PERIOD_OPTIONS.map(
                (option) => `
                  <button type="button" class="choice-chip" data-group="periodos" data-value="${escapeHtml(option)}" aria-pressed="false">
                    ${escapeHtml(option)}
                  </button>`
              ).join("")}
            </div>
          </fieldset>

          <button type="submit" class="cta" id="submitBtn">🔥 Quero receber automaticamente</button>

          <p class="feedback" id="feedback" role="status" aria-live="polite"></p>
        </form>
      </div>
    </section>

    <footer class="site-footer">criado por lucas barbosa</footer>
  </main>

  <script>
    const SUBMIT_ENDPOINT = "/api/form";
    const REDIRECT_URL = ${JSON.stringify(REDIRECT_URL)};
    const LOCATION_OPTIONS = ${JSON.stringify(LOCATION_OPTIONS)};
    const DAY_OPTIONS = ${JSON.stringify(DAY_OPTIONS)};

    const form = document.getElementById("leadForm");
    const whatsappInput = document.getElementById("whatsapp");
    const feedback = document.getElementById("feedback");
    const submitBtn = document.getElementById("submitBtn");
    const selected = {
      locais: new Set(),
      dias: new Set(),
      periodos: new Set(),
    };

    function onlyDigits(value) {
      return String(value || "").replace(/\\D/g, "").slice(0, 11);
    }

    function formatWhatsapp(value) {
      const digits = onlyDigits(value);

      if (digits.length <= 2) {
        return digits;
      }

      if (digits.length <= 7) {
        return "(" + digits.slice(0, 2) + ") " + digits.slice(2);
      }

      return "(" + digits.slice(0, 2) + ") " + digits.slice(2, 7) + "-" + digits.slice(7);
    }

    function setFeedback(type, message) {
      feedback.className = "feedback" + (type ? " " + type : "");
      feedback.textContent = message;
    }

    function syncButtonState(button) {
      const group = button.dataset.group;
      const value = button.dataset.value;
      const isSelected = selected[group].has(value);
      button.classList.toggle("selected", isSelected);
      button.setAttribute("aria-pressed", String(isSelected));
    }

    document.querySelectorAll(".choice-chip").forEach((button) => {
      syncButtonState(button);

      button.addEventListener("click", () => {
        const group = button.dataset.group;
        const value = button.dataset.value;

        if (selected[group].has(value)) {
          selected[group].delete(value);
        } else {
          selected[group].add(value);
        }

        syncButtonState(button);
      });
    });

    whatsappInput.addEventListener("input", (event) => {
      const formatted = formatWhatsapp(event.target.value);
      event.target.value = formatted;
    });

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const normalizedWhatsapp = onlyDigits(whatsappInput.value);

      if (normalizedWhatsapp.length < 10) {
        setFeedback("error", "Digite um WhatsApp valido para continuar.");
        return;
      }

      submitBtn.disabled = true;
      setFeedback("loading", "Enviando seus dados...");

      try {
        const response = await fetch(SUBMIT_ENDPOINT, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            whatsapp: normalizedWhatsapp,
            local: Array.from(selected.locais).join(", "),
            locais: Array.from(selected.locais),
            days: Array.from(selected.dias),
            periodos: Array.from(selected.periodos),
          }),
        });

        if (!response.ok) {
          const payload = await response.json().catch(() => null);
          throw new Error((payload && payload.error) || "Falha ao enviar o formulario");
        }

        setFeedback("success", "Perfeito! Redirecionando para o Instagram...");

        window.setTimeout(() => {
          window.location.href = REDIRECT_URL;
        }, 700);
      } catch (error) {
        setFeedback(
          "error",
          error && error.message
            ? error.message
            : "Nao foi possivel enviar agora. Tente novamente em instantes."
        );
      } finally {
        submitBtn.disabled = false;
      }
    });
  </script>
</body>
</html>`;
}

async function readBody(request) {
  const chunks = [];

  for await (const chunk of request) {
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

async function handleApiForm(req, res) {
  try {
    const body = await readBody(req);
    const whatsapp = onlyDigits(body?.whatsapp);
    const locais = normalizeList(body?.locais ?? body?.local);
    const days = normalizeList(body?.days ?? body?.dias);
    const periodos = normalizeList(body?.periodos ?? body?.periodo);
    const tipo = String(body?.tipo || "").trim();

    if (whatsapp.length < 10) {
      json(res, 400, {
        error: "Digite um WhatsApp valido para continuar.",
      });
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
          tipo,
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
}

function isPublicAsset(requestPath) {
  const normalized = path.normalize(requestPath).replace(/^([.][.][/\\])+/, "");
  const filePath = path.join(PUBLIC_DIR, normalized);
  return filePath.startsWith(PUBLIC_DIR) ? filePath : null;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url || "/", `http://${req.headers.host || "localhost"}`);
  const pathname = url.pathname;

  if (req.method === "GET" && pathname === "/") {
    sendText(res, 200, buildPage(), "text/html; charset=utf-8");
    return;
  }

  if (req.method === "POST" && pathname === "/api/form") {
    await handleApiForm(req, res);
    return;
  }

  if (req.method === "GET") {
    const publicPath = isPublicAsset(pathname.replace(/^\//, ""));
    if (publicPath && fs.existsSync(publicPath) && fs.statSync(publicPath).isFile()) {
      serveFile(res, publicPath);
      return;
    }
  }

  json(res, 404, { error: "Rota nao encontrada." });
});

server.listen(PORT, HOST, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
