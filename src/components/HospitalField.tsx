import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { AlertCircle } from "lucide-react";
import {
  HOSPITAL_OPTIONS,
  findSimilarHospital,
  normalizeHospital,
} from "@/lib/hospitals";

interface HospitalFieldProps {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  required?: boolean;
  error?: string;
}

/**
 * Campo de Hospital com autocomplete + verificação anti-duplicado.
 * - Mostra os hospitais cadastrados (lista canônica + nomes únicos já usados em pacientes).
 * - Permite "Outro" para digitar um nome novo.
 * - Se o nome digitado for muito parecido com algum existente, sugere usar o existente.
 */
export function HospitalField({
  value,
  onChange,
  label = "Hospital",
  required = false,
  error,
}: HospitalFieldProps) {
  const [extra, setExtra] = useState<string[]>([]);

  // Carrega hospitais únicos já usados em pacientes (para considerar como "existentes")
  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("patients")
        .select("hospital")
        .not("hospital", "is", null)
        .limit(1000);
      if (!active || !data) return;
      const set = new Set<string>();
      for (const row of data as { hospital: string | null }[]) {
        if (row.hospital && row.hospital.trim()) set.add(row.hospital.trim());
      }
      setExtra(Array.from(set));
    })();
    return () => {
      active = false;
    };
  }, []);

  // Lista combinada e dedupe-ada (canônicos + cadastrados), preservando o canônico quando há colisão de normalização.
  const allHospitals = useMemo(() => {
    const seen = new Map<string, string>();
    for (const h of HOSPITAL_OPTIONS) seen.set(normalizeHospital(h), h);
    for (const h of extra) {
      const key = normalizeHospital(h);
      if (!seen.has(key)) seen.set(key, h);
    }
    return Array.from(seen.values()).sort((a, b) => a.localeCompare(b, "pt-BR"));
  }, [extra]);

  const isInList = allHospitals.some(
    (h) => h.toLowerCase() === (value || "").toLowerCase(),
  );

  const suggestion = useMemo(() => {
    if (!value || isInList) return null;
    return findSimilarHospital(value, allHospitals);
  }, [value, isInList, allHospitals]);

  return (
    <div className="space-y-1.5">
      <Label htmlFor="hospital-field">
        {label}
        {required ? " *" : ""}
      </Label>
      <Select
        value={isInList ? value : value ? "__other__" : ""}
        onValueChange={(v) => {
          if (v === "__other__") {
            // muda para modo livre, preserva o que já está digitado se ainda não está na lista
            onChange(isInList ? "" : value);
          } else {
            onChange(v);
          }
        }}
      >
        <SelectTrigger className={error ? "border-destructive" : ""}>
          <SelectValue placeholder="Selecione o hospital" />
        </SelectTrigger>
        <SelectContent>
          {allHospitals.map((h) => (
            <SelectItem key={h} value={h}>
              {h}
            </SelectItem>
          ))}
          <SelectItem value="__other__">Outro (digitar nome)</SelectItem>
        </SelectContent>
      </Select>

      {!isInList && (
        <Input
          id="hospital-field"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Digite o nome do hospital"
          className={error ? "border-destructive" : ""}
        />
      )}

      {suggestion && (
        <div className="flex gap-2 p-2 bg-warning/10 border border-warning/30 rounded-md text-xs">
          <AlertCircle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1.5">
            <p>
              Já existe um hospital cadastrado com nome parecido:{" "}
              <strong>{suggestion}</strong>. Para evitar duplicidade, prefira usá-lo.
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 text-xs"
              onClick={() => onChange(suggestion)}
            >
              Usar "{suggestion}"
            </Button>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
