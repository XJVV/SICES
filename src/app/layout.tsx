import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import { ThemeProvider } from "next-themes";
import "./globals.css";

// Fuentes auto-hospedadas (src/app/fonts): sin dependencia de Google Fonts,
// el diseño funciona idéntico con o sin conexión a internet.
const display = localFont({
  variable: "--font-display",
  display: "swap",
  src: [
    { path: "./fonts/orbitron-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/orbitron-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/orbitron-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/orbitron-700.woff2", weight: "700", style: "normal" },
    { path: "./fonts/orbitron-800.woff2", weight: "800", style: "normal" },
  ],
});

const body = localFont({
  variable: "--font-body",
  display: "swap",
  src: [
    { path: "./fonts/space-grotesk-300.woff2", weight: "300", style: "normal" },
    { path: "./fonts/space-grotesk-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/space-grotesk-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/space-grotesk-600.woff2", weight: "600", style: "normal" },
    { path: "./fonts/space-grotesk-700.woff2", weight: "700", style: "normal" },
  ],
});

const mono = localFont({
  variable: "--font-mono-data",
  display: "swap",
  src: [
    { path: "./fonts/jetbrains-mono-400.woff2", weight: "400", style: "normal" },
    { path: "./fonts/jetbrains-mono-500.woff2", weight: "500", style: "normal" },
    { path: "./fonts/jetbrains-mono-700.woff2", weight: "700", style: "normal" },
  ],
});

export const metadata: Metadata = {
  title: "SICES · Sistema de Investigaciones de Combustión Espacial | NASA PSI",
  description:
    "Sistema de gestión y consulta de experimentos de combustión en microgravedad basado en el repositorio NASA Physical Sciences Informatics (PSI): BASS, BASS-II, SAFFIRE, SAME, FLEX y estudios complementarios. Telemetría, comparador, clasificación y publicaciones.",
  keywords: [
    "NASA PSI",
    "microgravedad",
    "combustión espacial",
    "BASS",
    "SAFFIRE",
    "SAME",
    "FLEX",
    "telemetría",
  ],
};

export const viewport: Viewport = {
  themeColor: "#0a0f1c",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body
        className={`${display.variable} ${body.variable} ${mono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
          {children}
        </ThemeProvider>
      </body>
    </html>
  );
}
