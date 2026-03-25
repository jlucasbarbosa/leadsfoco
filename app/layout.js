import { Bebas_Neue, Rajdhani } from "next/font/google";
import "./globals.css";

const headingFont = Bebas_Neue({
  weight: "400",
  subsets: ["latin"],
  variable: "--font-heading",
});

const bodyFont = Rajdhani({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-body",
});

export const metadata = {
  title: "Foco Radical | Receba suas fotos",
  description:
    "Cadastre seu WhatsApp para receber o link das fotos oficiais direto no celular.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="pt-BR">
      <body className={`${headingFont.variable} ${bodyFont.variable}`}>{children}</body>
    </html>
  );
}
