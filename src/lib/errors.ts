/**
 * Monta a mensagem de erro mostrada ao usuário: o texto base ("Erro ao salvar
 * nota") seguido do motivo real, quando houver ("…: sem conexão com a internet").
 */
export function describeError(base: string, error?: unknown): string {
  const reason = errorReason(error);
  return reason ? `${base}: ${reason}` : base;
}

/** Extrai um motivo legível de erros do Supabase, fetch, Error, etc. */
export function errorReason(error: unknown): string {
  if (!error) return "";

  let message = "";
  if (typeof error === "string") {
    message = error;
  } else if (typeof error === "object") {
    const e = error as { message?: unknown; error_description?: unknown; details?: unknown };
    message = String(e.message || e.error_description || e.details || "");
  }

  message = message.trim();
  if (!message) return "";

  const lower = message.toLowerCase();
  if (lower.includes("failed to fetch") || lower.includes("network") || lower.includes("load failed")) {
    return "sem conexão com a internet ou servidor indisponível";
  }
  if (lower.includes("jwt expired") || lower.includes("invalid jwt")) {
    return "sua sessão expirou, entre novamente";
  }
  if (lower.includes("row-level security") || lower.includes("permission denied")) {
    return "você não tem permissão para esta ação";
  }

  // Remove prefixos técnicos como "SURGERY_COLLISION: "
  return message.replace(/^[A-Z_]{3,}:\s*/, "");
}
