/**
 * Leitura de LISTAS de cirurgias coladas do WhatsApp, uma por linha, ex.:
 *
 *   *NOVEMBRO*
 *   MARIA DA SILVA- cirurgia 20/11/26 -07h- Hospital Brasília- Amil
 *   JOÃO SOUZA - rinoplastia 21/11 - 7h30 - Santa Lúcia - Bradesco
 *
 * E comparação de cada linha com os pacientes já cadastrados
 * (novo / mudou / repetido).
 */
import { findSimilarHospital, formatHospitalName, normalizeHospital } from "@/lib/hospitals";
import { normalizeSearch } from "@/lib/utils";

// ---------------------------------------------------------------------------
// Utilitários de nome (compartilhados com a importação de mensagem única)
// ---------------------------------------------------------------------------

export function normalizeName(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Semelhança 0..1 entre dois nomes, tolerante a nomes do meio faltando. */
export function nameSimilarity(a: string, b: string): number {
  const ta = new Set(normalizeName(a).split(" ").filter((t) => t.length >= 2));
  const tb = new Set(normalizeName(b).split(" ").filter((t) => t.length >= 2));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  ta.forEach((t) => {
    if (tb.has(t)) inter++;
  });
  // Favorece o conjunto menor: "Maria Silva" casa forte com "Maria Silva Souza"
  const minSize = Math.min(ta.size, tb.size);
  const containment = inter / minSize;
  const union = ta.size + tb.size - inter;
  const jaccard = inter / union;
  return Math.max(containment * 0.9, jaccard);
}

const LOWER_PARTICLES = new Set(["de", "da", "do", "das", "dos", "e", "di", "del", "della", "van", "von", "la", "le"]);

export function toTitleCaseName(input: string): string {
  if (!input) return "";
  return input
    .trim()
    .replace(/\s+/g, " ")
    .split(" ")
    .map((word, idx) => {
      const lower = word.toLowerCase();
      if (idx > 0 && LOWER_PARTICLES.has(lower)) return lower;
      return lower.charAt(0).toUpperCase() + lower.slice(1);
    })
    .join(" ");
}

// ---------------------------------------------------------------------------
// Leitura da lista
// ---------------------------------------------------------------------------

const MONTHS: Record<string, number> = {
  janeiro: 1, fevereiro: 2, marco: 3, abril: 4, maio: 5, junho: 6,
  julho: 7, agosto: 8, setembro: 9, outubro: 10, novembro: 11, dezembro: 12,
  jan: 1, fev: 2, mar: 3, abr: 4, mai: 5, jun: 6, jul: 7, ago: 8, set: 9, out: 10, nov: 11, dez: 12,
};

const DATE_RE = /(\d{1,2})\/(\d{1,2})(?:\/(\d{4}|\d{2}))?/;
// "07h", "7h30", "07:30", "7:30h", "14hs", "7 h"
const TIME_RE = /(?:^|[^\d/])(\d{1,2})\s*(?::\s*(\d{2})\s*(?:h|hs|hrs)?|h(?:s|rs|oras)?\s*(\d{2})?)(?![\d/])/i;
// Palavras que acompanham a data mas não são procedimento
const FILLER_WORDS = new Set(["cirurgia", "cx", "dia", "data", "as", "às", "a", "em", "no", "na", "para"]);

export const DEFAULT_SURGERY_HOUR = 7;
export const DEFAULT_PROCEDURE = "rinoplastia";

export interface ParsedSurgeryLine {
  lineNumber: number; // 1-based, no texto colado
  raw: string;
  name: string;
  procedure: string; // padrão: rinoplastia (mesmo padrão da importação única)
  procedureFromText: boolean;
  date: Date | null; // horário local
  hasTime: boolean; // false → usamos DEFAULT_SURGERY_HOUR
  hospital: string | null;
  insurance: string | null;
  error?: string; // linha que parece de paciente, mas não deu para ler
}

function cleanLine(line: string): string {
  return line
    .replace(/[*_~]/g, "") // formatação do WhatsApp
    .replace(/^\s*(?:\d{1,3}\s*[.)]|[•·▪➤►>]|-(?=\s))\s*/, "") // marcadores de lista
    .replace(/\s+/g, " ")
    .trim();
}

/** "*NOVEMBRO*", "Novembro 2026", "NOVEMBRO/26" → { month, year? } */
function parseMonthHeading(cleaned: string): { month: number; year?: number } | null {
  const norm = normalizeSearch(cleaned).replace(/[^a-z0-9/ ]/g, " ").replace(/\s+/g, " ").trim();
  const m = norm.match(/^([a-z]+)(?:\s*(?:de\s+)?\/?\s*(\d{2}|\d{4}))?$/);
  if (!m || !(m[1] in MONTHS)) return null;
  const year = m[2] ? (m[2].length === 2 ? 2000 + Number(m[2]) : Number(m[2])) : undefined;
  return { month: MONTHS[m[1]], year };
}

function extractTime(text: string): { hour: number; minute: number; rest: string } | null {
  const m = text.match(TIME_RE);
  if (!m) return null;
  const hour = Number(m[1]);
  const minute = Number(m[2] ?? m[3] ?? 0);
  if (hour > 23 || minute > 59) return null;
  return { hour, minute, rest: text.replace(m[0], " ").trim() };
}

function resolveYear(day: number, month: number, explicitYear: number | undefined, ctxYear: number | undefined, now: Date) {
  if (explicitYear) return explicitYear;
  if (ctxYear) return ctxYear;
  // Sem ano: assume o ano corrente, ou o próximo se a data já passou há mais de 2 meses
  const year = now.getFullYear();
  const candidate = new Date(year, month - 1, day);
  const twoMonthsAgo = new Date(now.getFullYear(), now.getMonth() - 2, now.getDate());
  return candidate < twoMonthsAgo ? year + 1 : year;
}

/** O texto parece uma lista (2+ linhas com data)? */
export function looksLikeSurgeryList(text: string): boolean {
  const lines = text.split(/\r?\n/).map(cleanLine).filter(Boolean);
  return lines.filter((l) => DATE_RE.test(l) && /[a-zA-ZÀ-ú]{3,}/.test(l)).length >= 2;
}

export function parseSurgeryList(text: string, now: Date = new Date()): ParsedSurgeryLine[] {
  const result: ParsedSurgeryLine[] = [];
  let ctxYear: number | undefined;

  text.split(/\r?\n/).forEach((rawLine, idx) => {
    const line = cleanLine(rawLine);
    if (!line) return;

    const heading = parseMonthHeading(line);
    if (heading) {
      ctxYear = heading.year ?? ctxYear;
      return;
    }

    const hasDate = DATE_RE.test(line);
    const hasSeparator = /[-–—]/.test(line);
    // Linhas soltas sem data nem separador ("Segue a lista:") são ignoradas
    if (!hasDate && !hasSeparator) return;

    const base: ParsedSurgeryLine = {
      lineNumber: idx + 1,
      raw: rawLine.trim(),
      name: "",
      procedure: DEFAULT_PROCEDURE,
      procedureFromText: false,
      date: null,
      hasTime: false,
      hospital: null,
      insurance: null,
    };

    const segments = line.split(/\s*[-–—]+\s*/).map((s) => s.trim()).filter(Boolean);
    let day: number | null = null;
    let month: number | null = null;
    let explicitYear: number | undefined;
    let time: { hour: number; minute: number } | null = null;
    const others: string[] = [];

    segments.forEach((segment, segIdx) => {
      let rest = segment;

      const dm = rest.match(DATE_RE);
      if (dm && day === null) {
        day = Number(dm[1]);
        month = Number(dm[2]);
        explicitYear = dm[3] ? (dm[3].length === 2 ? 2000 + Number(dm[3]) : Number(dm[3])) : undefined;
        rest = rest.replace(dm[0], " ").trim();
      }

      if (!time) {
        const t = extractTime(rest);
        // Só aceita horário em segmento que é "só horário" ou que também tinha a data
        if (t && (dm || t.rest === "" || segIdx > 0)) {
          const leftover = t.rest.replace(/\b(as|às|h)\b/gi, "").trim();
          if (dm || leftover === "") {
            time = { hour: t.hour, minute: t.minute };
            rest = leftover;
          }
        }
      }

      if (segIdx === 0) {
        base.name = rest;
        return;
      }

      if (dm) {
        // O que sobra ao lado da data, tirando "cirurgia", "dia"... é o procedimento
        const words = rest.split(" ").filter((w) => w && !FILLER_WORDS.has(normalizeSearch(w)));
        if (words.length > 0) {
          base.procedure = words.join(" ").toLowerCase();
          base.procedureFromText = true;
        }
        return;
      }

      if (rest) others.push(rest);
    });

    base.name = toTitleCaseName(base.name.replace(/\b(cirurgia|cx)\b/gi, "").trim());
    base.hospital = others[0] ? formatHospitalName(others[0]) : null;
    base.insurance = others.length > 1 ? others.slice(1).join(" - ") : null;

    if (day !== null && month !== null) {
      const d = day as number;
      const mo = month as number;
      if (mo < 1 || mo > 12 || d < 1 || d > 31) {
        base.error = "Data inválida";
      } else {
        const year = resolveYear(d, mo, explicitYear, ctxYear, now);
        const hour = time ? (time as { hour: number }).hour : DEFAULT_SURGERY_HOUR;
        const minute = time ? (time as { minute: number }).minute : 0;
        const date = new Date(year, mo - 1, d, hour, minute);
        if (date.getDate() !== d) base.error = "Data inválida";
        else {
          base.date = date;
          base.hasTime = !!time;
        }
      }
    } else {
      base.error = "Não encontrei a data (use DD/MM ou DD/MM/AA)";
    }

    if (!base.name || base.name.length < 3) {
      base.error = base.error ?? "Não encontrei o nome do paciente";
    }

    result.push(base);
  });

  return result;
}

// ---------------------------------------------------------------------------
// Comparação com o que já existe
// ---------------------------------------------------------------------------

export interface ExistingPatient {
  id: string;
  name: string;
  procedure: string;
  hospital: string | null;
  insurance: string | null;
  surgery_date: string | null;
  surgery_to_confirm: boolean | null;
  status: string | null;
  responsible_user_id: string | null;
  google_calendar_event_id: string | null;
}

export type RowStatus = "new" | "changed" | "duplicate" | "invalid";
export type ChangeField = "data" | "hora" | "hospital" | "convênio";

export interface MatchCandidate {
  patient: ExistingPatient;
  score: number;
}

export interface ComparedRow {
  parsed: ParsedSurgeryLine;
  candidates: MatchCandidate[]; // pacientes com nome parecido, do mais para o menos
  match: ExistingPatient | null; // paciente que será atualizado (null = criar novo)
  status: RowStatus;
  changes: ChangeField[];
}

export const STRONG_MATCH = 0.85;
const WEAK_MATCH = 0.5;

function sameText(a: string | null, b: string | null) {
  return normalizeSearch(a) === normalizeSearch(b);
}

/** Compara uma linha com um paciente específico (ou nenhum). */
export function compareWithPatient(parsed: ParsedSurgeryLine, match: ExistingPatient | null): Pick<ComparedRow, "status" | "changes"> {
  if (parsed.error || !parsed.date) return { status: "invalid", changes: [] };
  if (!match) return { status: "new", changes: [] };

  const changes: ChangeField[] = [];
  if (!match.surgery_date) {
    changes.push("data");
  } else {
    const current = new Date(match.surgery_date);
    const sameDay =
      current.getFullYear() === parsed.date.getFullYear() &&
      current.getMonth() === parsed.date.getMonth() &&
      current.getDate() === parsed.date.getDate();
    if (!sameDay) changes.push("data");
    // Sem horário na linha não conta como mudança de hora
    if (parsed.hasTime && (current.getHours() !== parsed.date.getHours() || current.getMinutes() !== parsed.date.getMinutes())) {
      changes.push("hora");
    }
  }
  if (parsed.hospital && normalizeHospital(parsed.hospital) !== normalizeHospital(match.hospital || "")) {
    changes.push("hospital");
  }
  if (parsed.insurance && !sameText(parsed.insurance, match.insurance)) {
    changes.push("convênio");
  }

  return { status: changes.length > 0 ? "changed" : "duplicate", changes };
}

/** Troca o hospital lido pelo nome já cadastrado, quando houver um parecido. */
export function resolveHospitalNames(rows: ParsedSurgeryLine[], registeredHospitals: string[]): ParsedSurgeryLine[] {
  return rows.map((row) => {
    if (!row.hospital) return row;
    const exact = registeredHospitals.find((n) => normalizeHospital(n) === normalizeHospital(row.hospital!));
    const similar = exact || findSimilarHospital(row.hospital, registeredHospitals, 0.6);
    return similar ? { ...row, hospital: similar } : row;
  });
}

export function compareSurgeryList(rows: ParsedSurgeryLine[], existing: ExistingPatient[]): ComparedRow[] {
  return rows.map((parsed) => {
    if (parsed.error || !parsed.date) {
      return { parsed, candidates: [], match: null, status: "invalid" as const, changes: [] };
    }

    const candidates = existing
      .map((patient) => ({ patient, score: nameSimilarity(parsed.name, patient.name) }))
      .filter((c) => c.score >= WEAK_MATCH)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        // Empate: prefere quem tem cirurgia mais perto da data da linha
        const target = parsed.date!.getTime();
        const da = a.patient.surgery_date ? Math.abs(new Date(a.patient.surgery_date).getTime() - target) : Infinity;
        const db = b.patient.surgery_date ? Math.abs(new Date(b.patient.surgery_date).getTime() - target) : Infinity;
        return da - db;
      })
      .slice(0, 3);

    // Só associa sozinho quando o nome é praticamente igual
    const match = candidates[0] && candidates[0].score >= STRONG_MATCH ? candidates[0].patient : null;
    return { parsed, candidates, match, ...compareWithPatient(parsed, match) };
  });
}
