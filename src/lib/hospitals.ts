// Lista canônica de hospitais usados no sistema, com utilitários para
// detectar duplicatas (mesmo nome com pequenas variações de digitação).
import { supabase } from "@/integrations/supabase/client";


export const HOSPITAL_OPTIONS = [
  "Hospital Brasília",
  "Hospital Anchieta",
  "Hospital Prontonorte",
  "Hospital Santa Lúcia Norte",
  "Hospital Mantevida",
  "Hospital Ceuta",
  "Hospital Alvorada",
  "Hospital DF Star",
];

// Palavras que permanecem em minúsculo no Title Case PT-BR
const LOWER_WORDS = new Set([
  "de", "da", "do", "das", "dos", "e", "em", "no", "na", "nos", "nas", "a", "o",
]);

/**
 * Formata o nome do hospital: trim, remove espaços duplicados e aplica Title Case PT-BR.
 * Ex.: "  hospital   santa  lucia " -> "Hospital Santa Lucia"
 */
export function formatHospitalName(s: string): string {
  const cleaned = (s || "").replace(/\s+/g, " ").trim();
  if (!cleaned) return "";
  return cleaned
    .split(" ")
    .map((word, idx) => {
      const lower = word.toLowerCase();
      if (idx > 0 && LOWER_WORDS.has(lower)) return lower;
      // Preserva siglas em caixa alta (ex.: "DF")
      if (word.length <= 3 && word === word.toUpperCase() && /^[A-ZÀ-Ú]+$/.test(word)) {
        return word;
      }
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

export function normalizeHospital(s: string): string {
  return (s || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\bhospital\b/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

// Distância de Levenshtein simples (suficiente para nomes curtos).
function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const dp: number[] = Array(b.length + 1)
    .fill(0)
    .map((_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = a[i - 1] === b[j - 1]
        ? prev
        : 1 + Math.min(prev, dp[j], dp[j - 1]);
      prev = tmp;
    }
  }
  return dp[b.length];
}

/**
 * Calcula similaridade entre dois nomes de hospital (0..1).
 * Considera substring + distância de edição normalizada.
 */
export function hospitalSimilarity(a: string, b: string): number {
  const na = normalizeHospital(a);
  const nb = normalizeHospital(b);
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  if (na.includes(nb) || nb.includes(na)) return 0.95;
  const dist = levenshtein(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  return 1 - dist / maxLen;
}

/**
 * Encontra um hospital existente parecido com o digitado.
 * Retorna o match canônico se a similaridade for >= threshold (default 0.8).
 */
export function findSimilarHospital(
  input: string,
  candidates: string[] = HOSPITAL_OPTIONS,
  threshold = 0.8,
): string | null {
  const trimmed = (input || "").trim();
  if (!trimmed) return null;
  // exato (case-insensitive)
  const exact = candidates.find((h) => h.toLowerCase() === trimmed.toLowerCase());
  if (exact) return exact;

  let best: { name: string; score: number } | null = null;
  for (const h of candidates) {
    const score = hospitalSimilarity(trimmed, h);
    if (!best || score > best.score) best = { name: h, score };
  }
  if (best && best.score >= threshold && best.name.toLowerCase() !== trimmed.toLowerCase()) {
    return best.name;
  }
  return null;
}

/**
 * Garante que o hospital esteja cadastrado na tabela `hospitals`.
 * - Normaliza o nome (Title Case + trim)
 * - Se já houver um existente parecido, usa o nome canônico
 * - Caso contrário, insere no banco (idempotente: ignora conflito de unicidade)
 *
 * Retorna o nome final a ser persistido no paciente.
 */
export async function ensureHospitalRegistered(
  rawName: string,
  createdBy?: string,
): Promise<string> {
  const formatted = formatHospitalName(rawName);
  if (!formatted) return "";

  // Carrega hospitais existentes para checar duplicidade aproximada
  const { data: existing, error: loadErr } = await supabase
    .from("hospitals")
    .select("name");
  if (loadErr) {
    console.warn("[ensureHospitalRegistered] load failed", loadErr);
    return formatted;
  }
  const names = (existing ?? []).map((h: { name: string }) => h.name);

  // Match exato (case/acento-insensitive)
  const exact = names.find((n) => normalizeHospital(n) === normalizeHospital(formatted));
  if (exact) return exact;

  // Match aproximado (typo)
  const similar = findSimilarHospital(formatted, names);
  if (similar) return similar;

  // Insere; em caso de conflito de unicidade, refaz o lookup
  const { data: inserted, error: insErr } = await supabase
    .from("hospitals")
    .insert({ name: formatted, name_normalized: "", created_by: createdBy ?? null })
    .select("name")
    .maybeSingle();

  if (insErr) {
    const msg = (insErr as any).message || "";

    // Trigger server-side bloqueou por duplicidade ou similaridade
    // Mensagens: HOSPITAL_DUPLICATE: ... "Nome" ...  /  HOSPITAL_SIMILAR: ... "Nome" ...
    const dupMatch = msg.match(/HOSPITAL_(?:DUPLICATE|SIMILAR):[^"]*"([^"]+)"/);
    if (dupMatch) {
      return dupMatch[1];
    }

    // Conflito de unicidade clássico
    if ((insErr as any).code === "23505") {
      const { data: again } = await supabase
        .from("hospitals")
        .select("name");
      const found = (again ?? [])
        .map((h: { name: string }) => h.name)
        .find((n) => normalizeHospital(n) === normalizeHospital(formatted));
      return found ?? formatted;
    }
    console.warn("[ensureHospitalRegistered] insert failed", insErr);
    return formatted;
  }

  return inserted?.name ?? formatted;
}
