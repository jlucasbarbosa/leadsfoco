"use client";

import { useState } from "react";

const SUBMIT_ENDPOINT = "/api/form";
const REDIRECT_URL = "https://instagram.com/7dfotos";

const LOCATION_OPTIONS = [
  "Parque dos Poderes",
  "Parque das Nações",
  "Orla do Aeroporto",
];

const DAY_OPTIONS = [
  "Seg",
  "Ter",
  "Qua",
  "Qui",
  "Sex",
  "Sáb",
  "Dom",
];

const INITIAL_FORM = {
  whatsapp: "",
  locais: [],
  dias: [],
};

const onlyDigits = (value) => value.replace(/\D/g, "").slice(0, 11);

const formatWhatsapp = (value) => {
  const digits = onlyDigits(value);

  if (digits.length <= 2) {
    return digits;
  }

  if (digits.length <= 7) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }

  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
};

export default function HomePage() {
  const [formData, setFormData] = useState(INITIAL_FORM);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState({
    type: "idle",
    message: "",
  });

  const handleWhatsappChange = (event) => {
    setFormData((previous) => ({
      ...previous,
      whatsapp: formatWhatsapp(event.target.value),
    }));
  };

  const toggleChoice = (groupName, value) => {
    setFormData((previous) => {
      const current = previous[groupName];
      const next = current.includes(value)
        ? current.filter((item) => item !== value)
        : [...current, value];

      return {
        ...previous,
        [groupName]: next,
      };
    });
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const normalizedWhatsapp = onlyDigits(formData.whatsapp);

    if (normalizedWhatsapp.length < 10) {
      setFeedback({
        type: "error",
        message: "Digite um WhatsApp valido para continuar.",
      });
      return;
    }

    setIsSubmitting(true);
    setFeedback({
      type: "loading",
      message: "Enviando seus dados...",
    });

    try {
      const response = await fetch(SUBMIT_ENDPOINT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          whatsapp: normalizedWhatsapp,
          local: formData.locais.join(", "),
          locais: formData.locais,
          days: formData.dias,
        }),
      });

      if (!response.ok) {
        const errorResponse = await response.json().catch(() => null);
        throw new Error(errorResponse?.error || "Falha ao enviar o formulario");
      }

      setFeedback({
        type: "success",
        message: "Perfeito! Redirecionando para o Instagram...",
      });

      setTimeout(() => {
        window.location.href = REDIRECT_URL;
      }, 700);
    } catch (error) {
      setFeedback({
        type: "error",
        message:
          error instanceof Error && error.message
            ? error.message
            : "Nao foi possivel enviar agora. Tente novamente em instantes.",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="lp-shell">
      <header className="topbar">
        <img className="brand-logo" src="/logo.png" alt="Foco Radical" />
      </header>

      <section className="hero-split" aria-label="Receba o link das fotos">
        <div className="hero-left">
          <div className="hero-copy">
            <p className="kicker kicker-large">Campo Grande - MS</p>
            <h1>Receba automaticamente o link das fotos no seu WhatsApp assim que forem liberadas</h1>
            <p className="subtitle">Sem precisar procurar. Liberou, você recebe automaticamente.</p>
            <p className="proof">📸 Fotógrafo oficial da Foco Radical</p>
          </div>
        </div>

        <div className="hero-right">
          <form className="lead-form" onSubmit={handleSubmit} noValidate>
            <label htmlFor="whatsapp">WhatsApp</label>
            <input
              id="whatsapp"
              name="whatsapp"
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="(65) 99999-0000"
              value={formData.whatsapp}
              onChange={handleWhatsappChange}
              required
            />

            <fieldset>
              <legend>Onde você treina</legend>
              <div className="choice-grid">
                {LOCATION_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`choice-chip ${
                      formData.locais.includes(option) ? "selected" : ""
                    }`}
                    onClick={() => toggleChoice("locais", option)}
                    aria-pressed={formData.locais.includes(option)}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </fieldset>

            <fieldset>
              <legend>Quais dias você vai?</legend>
              <div className="choice-grid days-grid">
                {DAY_OPTIONS.map((option) => (
                  <button
                    key={option}
                    type="button"
                    className={`choice-chip ${formData.dias.includes(option) ? "selected" : ""}`}
                    onClick={() => toggleChoice("dias", option)}
                    aria-pressed={formData.dias.includes(option)}
                    aria-label={`Selecionar ${option}`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </fieldset>

            <button type="submit" className="cta" disabled={isSubmitting}>
              {isSubmitting ? "Enviando..." : "🔥 Quero receber automaticamente"}
            </button>

            <p className={`feedback ${feedback.type}`} role="status" aria-live="polite">
              {feedback.message}
            </p>
          </form>
        </div>
      </section>

      <footer className="site-footer">criado por lucas barbosa</footer>
    </main>
  );
}
