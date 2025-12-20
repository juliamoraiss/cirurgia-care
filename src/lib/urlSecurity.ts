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
 * Creates a safe WhatsApp URL
 * Only accepts phone numbers (digits only) and optional message
 */
export function createWhatsAppUrl(phoneNumber: string, message?: string): string {
  // Sanitize phone number - only digits allowed
  const sanitizedPhone = phoneNumber.replace(/\D/g, '');
  
  if (!sanitizedPhone || sanitizedPhone.length < 10) {
    return '#';
  }

  const baseUrl = `https://wa.me/55${sanitizedPhone}`;
  
  if (message) {
    return `${baseUrl}?text=${encodeURIComponent(message)}`;
  }
  
  return baseUrl;
}

/**
 * Creates a safe external link opener
 * Validates URL before opening in new tab
 */
export function safeWindowOpen(url: string, target: string = '_blank'): void {
  if (isSafeUrl(url)) {
    window.open(url, target);
  } else {
    console.warn('Blocked attempt to open unsafe URL:', url.substring(0, 50));
  }
}
