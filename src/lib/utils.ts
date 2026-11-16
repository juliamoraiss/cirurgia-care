import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Capitaliza a primeira letra de uma string
 */
export function capitalizeFirst(str: string | null | undefined): string {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/**
 * Normaliza texto para busca: minúsculas, sem acentos e sem espaços extras.
 * Ex.: "  Lúcia  " → "lucia"
 */
export function normalizeSearch(str: string | null | undefined): string {
  if (!str) return "";
  return str
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .trim();
}
