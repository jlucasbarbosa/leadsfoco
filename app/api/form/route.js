import { NextResponse } from "next/server";

const WEBHOOK_URL = "https://n8n.ceci.chat/webhook/form";

const normalizeWhatsapp = (value) => String(value || "").replace(/\D/g, "").slice(0, 11);
const normalizeList = (value) =>
  Array.isArray(value)
    ? value.map((item) => String(item || "").trim()).filter(Boolean)
    : String(value || "")
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean);

export async function POST(request) {
  try {
    const body = await request.json();
    const whatsapp = normalizeWhatsapp(body?.whatsapp);
    const locais = normalizeList(body?.locais ?? body?.local);
    const days = normalizeList(body?.days ?? body?.dias);
    const tipo = String(body?.tipo || "").trim();

    if (whatsapp.length < 10) {
      return NextResponse.json(
        {
          error: "Digite um WhatsApp valido para continuar.",
        },
        { status: 400 }
      );
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
        tipo,
      }),
      cache: "no-store",
    });

    if (!response.ok) {
      const details = await response.text().catch(() => "");
      return NextResponse.json(
        {
          error: "Nao foi possivel enviar para o webhook.",
          details: details.slice(0, 300),
        },
        { status: 502 }
      );
    }

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json(
      {
        error: "Nao foi possivel processar o envio.",
      },
      { status: 500 }
    );
  }
}
