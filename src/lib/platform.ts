/**
 * Detecta a plataforma para dar "cara de app nativo" no celular.
 * iPhone/iPad (inclusive iPad que se apresenta como Mac) → "ios"; o resto → "android".
 * A classe platform-ios / platform-android é aplicada no <html> (ver main.tsx)
 * e habilita as variantes `ios:` e `android:` do Tailwind.
 */
export type Platform = "ios" | "android";

export function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "android";
  const ua = navigator.userAgent || "";
  const isIOS =
    /iPhone|iPad|iPod/i.test(ua) ||
    // iPadOS 13+ se identifica como Mac, mas tem toque
    (/Macintosh/i.test(ua) && typeof document !== "undefined" && "ontouchend" in document);
  return isIOS ? "ios" : "android";
}

export const platform: Platform = detectPlatform();
export const isIOS = platform === "ios";
export const isAndroid = platform === "android";

/** Aplica classes de plataforma e segue o modo claro/escuro do sistema. */
export function applyPlatformClasses() {
  const root = document.documentElement;
  root.classList.add(`platform-${platform}`);

  const media = window.matchMedia("(prefers-color-scheme: dark)");
  const applyTheme = () => {
    root.classList.toggle("dark", media.matches);
  };
  applyTheme();
  media.addEventListener("change", applyTheme);
}
