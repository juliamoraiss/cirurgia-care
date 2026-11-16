/** A aba fica ativa também nas sub-telas (ex.: /patients/123 → Pacientes). */
export function isNavItemActive(itemPath: string, pathname: string) {
  if (itemPath === "/") return pathname === "/";
  return pathname === itemPath || pathname.startsWith(`${itemPath}/`);
}
