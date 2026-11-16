import { isIOS } from "@/lib/platform";
import { cn } from "@/lib/utils";
import { Check } from "lucide-react";

interface Segment {
  value: string;
  label: string;
  count?: number;
  /** Destaca a contagem (ex.: atrasadas em vermelho). */
  alert?: boolean;
}

interface SegmentedControlProps {
  segments: Segment[];
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
}

/**
 * Seletor de segmentos nativo:
 *  - iOS: UISegmentedControl (trilho cinza, segmento ativo branco com sombra).
 *  - Android: segmented buttons do Material 3 (contorno, ativo preenchido com ✓).
 */
export function SegmentedControl({ segments, value, onChange, ariaLabel }: SegmentedControlProps) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        "grid w-full",
        isIOS ? "rounded-[9px] bg-muted/80 p-0.5 gap-0.5" : "rounded-full border border-border overflow-hidden divide-x divide-border"
      )}
      style={{ gridTemplateColumns: `repeat(${segments.length}, minmax(0, 1fr))` }}
    >
      {segments.map((s) => {
        const active = s.value === value;
        return (
          <button
            key={s.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(s.value)}
            className={cn(
              "min-w-0 flex items-center justify-center gap-1 px-1 text-[13px] leading-tight transition-colors",
              isIOS
                ? cn("h-8 rounded-[7px]", active ? "bg-card shadow-sm font-semibold text-foreground" : "text-foreground/80")
                : cn("h-10", active ? "bg-primary/15 font-medium text-foreground" : "text-muted-foreground")
            )}
          >
            {!isIOS && active && <Check className="h-3.5 w-3.5 shrink-0" />}
            <span className="truncate">{s.label}</span>
            {s.count !== undefined && (
              <span className={cn("shrink-0 tabular-nums", s.alert && s.count > 0 ? "text-destructive font-semibold" : "text-muted-foreground")}>
                {s.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
