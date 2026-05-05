import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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
import { AlertCircle, Check, ChevronsUpDown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { findSimilarHospital, formatHospitalName, normalizeHospital } from "@/lib/hospitals";
import { toast } from "sonner";

interface HospitalFieldProps {
  value: string;
  onChange: (v: string) => void;
  label?: string;
  required?: boolean;
  error?: string;
}

export function HospitalField({
  value,
  onChange,
  label = "Hospital",
  required = false,
  error,
}: HospitalFieldProps) {
  const { user } = useAuth();
  const [hospitals, setHospitals] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [creating, setCreating] = useState(false);

  async function loadHospitals() {
    const { data, error } = await supabase
      .from("hospitals")
      .select("name")
      .order("name");
    if (error) {
      console.warn("[HospitalField] load failed", error);
      return;
    }
    setHospitals((data ?? []).map((h) => h.name));
  }

  useEffect(() => {
    loadHospitals();
  }, []);

  const isInList = hospitals.some(
    (h) => normalizeHospital(h) === normalizeHospital(value),
  );

  const suggestion = useMemo(() => {
    if (!value || isInList) return null;
    return findSimilarHospital(value, hospitals);
  }, [value, isInList, hospitals]);

  const trimmedSearch = search.trim();
  const showCreateOption =
    trimmedSearch.length > 0 &&
    !hospitals.some((h) => normalizeHospital(h) === normalizeHospital(trimmedSearch));

  async function handleCreate(name: string) {
    const trimmed = formatHospitalName(name);
    if (!trimmed || !user) return;
    // Antes de criar, checa se há um existente parecido — pede confirmação implícita usando o existente.
    const similar = findSimilarHospital(trimmed, hospitals);
    if (similar) {
      onChange(similar);
      toast.info(`Usando hospital existente "${similar}" para evitar duplicidade.`);
      setSearch("");
      setOpen(false);
      return;
    }
    setCreating(true);
    try {
      const { data, error } = await supabase
        .from("hospitals")
        .insert({ name: trimmed, name_normalized: "", created_by: user.id })
        .select("name")
        .single();
      if (error) {
        // Conflito de nome único: refaz a leitura e seleciona o existente
        if ((error as any).code === "23505") {
          await loadHospitals();
          onChange(trimmed);
        } else {
          throw error;
        }
      } else if (data) {
        setHospitals((prev) =>
          prev.some((h) => normalizeHospital(h) === normalizeHospital(data.name))
            ? prev
            : [...prev, data.name].sort((a, b) => a.localeCompare(b, "pt-BR")),
        );
        onChange(data.name);
        toast.success(`Hospital "${data.name}" cadastrado.`);
      }
      setSearch("");
      setOpen(false);
    } catch (err: any) {
      console.error(err);
      toast.error(err.message || "Não foi possível cadastrar o hospital.");
    } finally {
      setCreating(false);
    }
  }

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
                {hospitals.map((h) => (
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
                    disabled={creating}
                    onSelect={() => handleCreate(trimmedSearch)}
                  >
                    {creating ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <span className="mr-2">+</span>
                    )}
                    Cadastrar "{trimmedSearch}" como novo hospital
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
