import { useState } from "react";
import { Check, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import {
  EMPTY_FILTERS,
  HOSPITAL_FILTER_OPTIONS,
  PROCEDURE_FILTER_OPTIONS,
  STATUS_FILTER_OPTIONS,
  type PatientFilters,
  countFilters,
  shortHospital,
  toggleValue,
} from "@/lib/patientFilters";

interface PatientFiltersSheetProps {
  value: PatientFilters;
  onApply: (filters: PatientFilters) => void;
  /** Quantos pacientes aparecem com os filtros do rascunho (para o botão Aplicar). */
  previewCount: (filters: PatientFilters) => number;
}

/**
 * Filtros da tela Pacientes no celular: botão "Filtros (N)" que abre um painel
 * de baixo para cima, com rolagem própria e rodapé fixo "Limpar" / "Aplicar".
 * As escolhas só valem ao tocar em "Aplicar".
 */
export function PatientFiltersSheet({ value, onApply, previewCount }: PatientFiltersSheetProps) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<PatientFilters>(value);
  const activeCount = countFilters(value);
  const draftCount = countFilters(draft);

  const handleOpenChange = (next: boolean) => {
    if (next) setDraft(value); // começa do que está aplicado
    setOpen(next);
  };

  const sections: {
    key: keyof PatientFilters;
    title: string;
    options: { value: string; label: string }[];
  }[] = [
    {
      key: "procedures",
      title: "Procedimento",
      options: PROCEDURE_FILTER_OPTIONS.map((p) => ({ value: p, label: p.charAt(0).toUpperCase() + p.slice(1) })),
    },
    {
      key: "hospitals",
      title: "Hospital",
      options: HOSPITAL_FILTER_OPTIONS.map((h) => ({ value: h, label: shortHospital(h) })),
    },
    { key: "statuses", title: "Status", options: STATUS_FILTER_OPTIONS },
  ];

  const resultCount = previewCount(draft);

  return (
    <Drawer open={open} onOpenChange={handleOpenChange} shouldScaleBackground={false}>
      <DrawerTrigger asChild>
        <Button
          variant={activeCount > 0 ? "default" : "outline"}
          className="shrink-0 h-10 px-3"
          aria-label={activeCount > 0 ? `Filtros, ${activeCount} ativos` : "Filtros"}
        >
          <SlidersHorizontal className="h-4 w-4 mr-1.5" />
          Filtros{activeCount > 0 ? ` (${activeCount})` : ""}
        </Button>
      </DrawerTrigger>

      <DrawerContent className="max-h-[90vh] max-h-[90dvh] z-[70]">
        <DrawerHeader className="pb-2 text-left">
          <DrawerTitle>Filtros</DrawerTitle>
          <DrawerDescription>
            {draftCount > 0 ? `${draftCount} selecionado(s)` : "Nenhum filtro: mostra todos os pacientes"}
          </DrawerDescription>
        </DrawerHeader>

        {/* Só esta área rola; a página por trás fica parada */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-2">
          {sections.map((section) => {
            const selected = draft[section.key];
            return (
              <section key={section.key} className="py-3 border-b last:border-b-0">
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-semibold">{section.title}</h3>
                  {selected.length > 0 && (
                    <button
                      type="button"
                      className="text-xs text-primary min-h-11 px-2 -mr-2"
                      onClick={() => setDraft((d) => ({ ...d, [section.key]: [] }))}
                    >
                      Limpar {section.title.toLowerCase()}
                    </button>
                  )}
                </div>
                <ul role="group" aria-label={section.title}>
                  {section.options.map((option) => {
                    const isSelected = selected.includes(option.value);
                    return (
                      <li key={option.value}>
                        <button
                          type="button"
                          role="checkbox"
                          aria-checked={isSelected}
                          onClick={() =>
                            setDraft((d) => ({ ...d, [section.key]: toggleValue(d[section.key], option.value) }))
                          }
                          className={cn(
                            "w-full min-h-11 flex items-center justify-between gap-3 px-3 rounded-md text-left text-sm transition-colors",
                            isSelected ? "bg-primary/10 text-primary font-medium" : "active:bg-muted"
                          )}
                        >
                          <span>{option.label}</span>
                          <span
                            className={cn(
                              "h-5 w-5 shrink-0 rounded border flex items-center justify-center",
                              isSelected ? "bg-primary border-primary text-primary-foreground" : "border-muted-foreground/40"
                            )}
                          >
                            {isSelected && <Check className="h-3.5 w-3.5" />}
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </section>
            );
          })}
        </div>

        {/* Rodapé fixo */}
        <div className="grid grid-cols-2 gap-2 border-t bg-background p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <Button variant="outline" className="h-11" onClick={() => setDraft(EMPTY_FILTERS)} disabled={draftCount === 0}>
            Limpar
          </Button>
          <Button
            className="h-11"
            onClick={() => {
              onApply(draft);
              setOpen(false);
            }}
          >
            Aplicar ({resultCount})
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
