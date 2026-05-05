export interface ShareIntentPayload {
  text: string;
  title: string;
  url: string;
}

const TEXT_KEYS = ["text", "message", "input", "body", "content"];
const TITLE_KEYS = ["title", "subject"];
const URL_KEYS = ["url", "link"];

function firstNonEmpty(params: URLSearchParams, keys: string[]) {
  for (const key of keys) {
    const value = params.get(key)?.trim();
    if (value) return value;
  }
  return "";
}

export function readShareIntentFromSearch(search: string): ShareIntentPayload {
  const params = new URLSearchParams(search);

  return {
    text: firstNonEmpty(params, TEXT_KEYS),
    title: firstNonEmpty(params, TITLE_KEYS),
    url: firstNonEmpty(params, URL_KEYS),
  };
}

export function hasShareIntent(payload: ShareIntentPayload) {
  return Boolean(payload.text || payload.title || payload.url);
}

export function buildShareIntentQuery(payload: Partial<ShareIntentPayload>) {
  const params = new URLSearchParams();
  if (payload.text) params.set("text", payload.text);
  if (payload.title) params.set("title", payload.title);
  if (payload.url) params.set("url", payload.url);
  return params.toString();
}

export function getShareIntentRawText(payload: ShareIntentPayload) {
  return [payload.text, payload.title, payload.url].filter(Boolean).join("\n").trim();
}

const STORAGE_KEY = "pending_share_surgery";

/** Lê (sem apagar) o share pendente do sessionStorage. */
export function peekPendingShareIntent(): ShareIntentPayload | null {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<ShareIntentPayload>;
    const payload: ShareIntentPayload = {
      text: data.text ?? "",
      title: data.title ?? "",
      url: data.url ?? "",
    };
    return hasShareIntent(payload) ? payload : null;
  } catch {
    return null;
  }
}

/** Remove o share pendente — só deve ser chamado pela página que consumiu. */
export function clearPendingShareIntent() {
  try {
    sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    /* ignore */
  }
}

/** Constrói o caminho /share-cirurgia preservando o payload na query string. */
export function buildShareRedirectPath(payload: Partial<ShareIntentPayload>) {
  const query = buildShareIntentQuery(payload);
  return query ? `/share-cirurgia?${query}` : "/share-cirurgia";
}
