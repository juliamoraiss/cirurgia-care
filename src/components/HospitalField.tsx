import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { AlertCircle, Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";
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
 * Campo de Hospital com autocomplete (combobox) + verificação anti-duplicado.
 * Carrega hospitais já cadastrados em `patients` e mistura com a lista canônica.
 * Permite digitar um nome novo se nenhum item for selecionado.
 */
export function HospitalField({
  value,
  onChange,
  label = "Hospital",
  required = false,
  error,
}: HospitalFieldProps) {
  const [extra, setExtra] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase
        .from("patients")
        .select("hospital")
        .not("hospital", "is", null)
        .limit(2000);
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
    (h) => normalizeHospital(h) === normalizeHospital(value),
  );

  const suggestion = useMemo(() => {
    if (!value || isInList) return null;
    return findSimilarHospital(value, allHospitals);
  }, [value, isInList, allHospitals]);

  const trimmedSearch = search.trim();
  const showCreateOption =
    trimmedSearch.length > 0 &&
    !allHospitals.some((h) => normalizeHospital(h) === normalizeHospital(trimmedSearch));

  return (
    <div className="space-y-1.5">
      {label && (
        <Label>
          {label}
          {required ? " *" : ""}
        </Label>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            type="button"
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className={cn(
              "w-full justify-between font-normal",
              !value && "text-muted-foreground",
              error && "border-destructive",
            )}
          >
            <span className="truncate">{value || "Buscar hospital..."}</span>
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent
          className="p-0 w-[--radix-popover-trigger-width]"
          align="start"
        >
          <Command
            filter={(itemValue, searchTerm) => {
              const a = normalizeHospital(itemValue);
              const b = normalizeHospital(searchTerm);
              if (!b) return 1;
              return a.includes(b) ? 1 : 0;
            }}
          >
            <CommandInput
              placeholder="Digite para buscar..."
              value={search}
              onValueChange={setSearch}
            />
            <CommandList>
              <CommandEmpty>Nenhum hospital encontrado.</CommandEmpty>
              <CommandGroup heading="Hospitais cadastrados">
                {allHospitals.map((h) => (
                  <CommandItem
                    key={h}
                    value={h}
                    onSelect={() => {
                      onChange(h);
                      setSearch("");
                      setOpen(false);
                    }}
                  >
                    <Check
                      className={cn(
                        "mr-2 h-4 w-4",
                        normalizeHospital(value) === normalizeHospital(h)
                          ? "opacity-100"
                          : "opacity-0",
                      )}
                    />
                    {h}
                  </CommandItem>
                ))}
              </CommandGroup>
              {showCreateOption && (
                <CommandGroup heading="Novo">
                  <CommandItem
                    value={`__create__${trimmedSearch}`}
                    onSelect={() => {
                      onChange(trimmedSearch);
                      setSearch("");
                      setOpen(false);
                    }}
                  >
                    + Usar "{trimmedSearch}" como novo hospital
                  </CommandItem>
                </CommandGroup>
              )}
            </CommandList>
          </Command>
        </PopoverContent>
      </Popover>

      {suggestion && (
        <div className="flex gap-2 p-2 bg-warning/10 border border-warning/30 rounded-md text-xs">
          <AlertCircle className="h-4 w-4 text-warning shrink-0 mt-0.5" />
          <div className="flex-1 space-y-1.5">
            <p>
              Já existe um hospital cadastrado parecido:{" "}
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
