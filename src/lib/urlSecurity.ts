/**
 * URL Security utilities to mitigate XSS vulnerabilities
 * Addresses CVE-2024-21668 in React 18.3.1
 */

const SAFE_PROTOCOLS = ['http:', 'https:', 'mailto:', 'tel:', 'blob:'];

/**
 * Validates if a URL is safe to use in href attributes
 * Blocks javascript:, data:, and other potentially dangerous protocols
 */
export function isSafeUrl(url: string): boolean {
  if (!url || typeof url !== 'string') {
    return false;
  }

  // Trim and lowercase for comparison
  const trimmedUrl = url.trim().toLowerCase();

  // Block javascript: protocol (main XSS vector)
  if (trimmedUrl.startsWith('javascript:')) {
    return false;
  }

  // Block data: protocol (can execute scripts)
  if (trimmedUrl.startsWith('data:') && !trimmedUrl.startsWith('data:image/')) {
    return false;
  }

  // Block vbscript: protocol (IE legacy)
  if (trimmedUrl.startsWith('vbscript:')) {
    return false;
  }

  try {
    const parsed = new URL(url, window.location.origin);
    return SAFE_PROTOCOLS.includes(parsed.protocol);
  } catch {
    // Relative URLs are generally safe
    return !trimmedUrl.includes(':') || trimmedUrl.startsWith('/');
  }
}

/**
 * Sanitizes a URL for safe use in href attributes
 * Returns the URL if safe, or '#' if potentially dangerous
 */
export function sanitizeUrl(url: string): string {
  if (isSafeUrl(url)) {
    return url;
  }
  console.warn('Blocked potentially unsafe URL:', url.substring(0, 50));
  return '#';
}

/**
 * Detecta se o app está rodando como PWA standalone no iOS.
 * Nesse modo, window.open() abre dentro do próprio webview e prende o usuário.
 */
function isIosStandalonePwa(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent || '';
  const isIos = /iPad|iPhone|iPod/.test(ua) || (ua.includes('Mac') && 'ontouchend' in document);
  const isStandalone =
    (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) ||
    (navigator as any).standalone === true;
  return isIos && isStandalone;
}

/**
 * Creates a safe WhatsApp URL
 * Only accepts phone numbers (digits only) and optional message
 */
export function createWhatsAppUrl(phoneNumber: string, message?: string): string {
  // Sanitize phone number - only digits allowed
  const sanitizedPhone = phoneNumber.replace(/\D/g, '');

  if (!sanitizedPhone || sanitizedPhone.length < 10) {
    return '#';
  }

  // Em PWA standalone no iOS, usa o esquema nativo whatsapp:// para
  // sair do app e abrir o WhatsApp nativo (wa.me ficaria preso no webview).
  if (isIosStandalonePwa()) {
    const base = `whatsapp://send?phone=55${sanitizedPhone}`;
    return message ? `${base}&text=${encodeURIComponent(message)}` : base;
  }

  const baseUrl = `https://wa.me/55${sanitizedPhone}`;
  return message ? `${baseUrl}?text=${encodeURIComponent(message)}` : baseUrl;
}

/**
 * Creates a safe external link opener
 * Validates URL before opening in new tab
 */
export function safeWindowOpen(url: string, target: string = '_blank'): void {
  if (!isSafeUrl(url) && !url.startsWith('whatsapp:')) {
    console.warn('Blocked attempt to open unsafe URL:', url.substring(0, 50));
    return;
  }

  // Em PWA standalone no iOS, window.open frequentemente fica preso no webview.
  // Usar um clique sintético em <a> permite ao iOS escalar pro app nativo
  // (whatsapp://, tel:, mailto:) ou abrir no Safari externo.
  if (isIosStandalonePwa()) {
    try {
      const a = document.createElement('a');
      a.href = url;
      a.rel = 'noopener noreferrer';
      // Para esquemas de app (whatsapp:, tel:, mailto:), iOS já sai do PWA.
      // Para http(s), forçar _blank faz abrir no Safari externo.
      if (/^https?:/i.test(url)) a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      a.remove();
      return;
    } catch (e) {
      console.warn('safeWindowOpen anchor fallback failed', e);
    }
  }

  window.open(url, target);
}

// Permite isSafeUrl reconhecer whatsapp:// como esquema válido para nossa lógica
const APP_SCHEMES = ['whatsapp:'];
const _origIsSafe = isSafeUrl;
export function isSafeAppUrl(url: string): boolean {
  if (!url) return false;
  const t = url.trim().toLowerCase();
  if (APP_SCHEMES.some((s) => t.startsWith(s))) return true;
  return _origIsSafe(url);
}
