import { createContext, ReactNode, useContext, useId } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { isIOS } from "@/lib/platform";
import { cn } from "@/lib/utils";

export type FieldVariant = "ios" | "android" | "desktop";

/** Estilo dos campos: lista agrupada (iOS), outlined M3 (Android) ou padrão (computador). */
export function useFieldVariant(): FieldVariant {
  const isMobile = useIsMobile();
  if (!isMobile) return "desktop";
  return isIOS ? "ios" : "android";
}

/** Classe do <input> para cada estilo. */
export function inputClass(variant: FieldVariant, hasError?: boolean) {
  if (variant === "ios")
    return cn(
      "w-full min-w-0 h-11 border-0 bg-transparent px-0 text-right text-[16px] text-foreground placeholder:text-muted-foreground/70 focus:outline-none",
      hasError && "text-destructive"
    );
  if (variant === "android")
    return cn(
      "w-full h-14 rounded-md border bg-transparent px-3 text-base text-foreground placeholder:text-muted-foreground/70 focus:outline-none focus:border-2 focus:border-primary",
      hasError ? "border-destructive" : "border-input"
    );
  return cn(
    "w-full h-10 rounded-md border bg-background px-3 text-sm focus:outline-none focus:ring-2 focus:ring-ring",
    hasError ? "border-destructive" : "border-input"
  );
}

const FieldIdContext = createContext<string | undefined>(undefined);
/** id do controle, para ligar <label htmlFor>. */
export function useFieldId() {
  return useContext(FieldIdContext);
}

interface FieldRowProps {
  label: string;
  required?: boolean;
  error?: string | null;
  hint?: ReactNode;
  /** Controle ocupa a largura toda, com o rótulo em cima (chips, textos longos). */
  stacked?: boolean;
  /** Algo ao lado do rótulo (ex.: idade, "vence em X dias"). */
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}

/**
 * Linha de formulário. Rótulo sempre visível (nunca só placeholder) e erro em
 * linguagem simples logo abaixo do campo.
 */
export function FieldRow({ label, required, error, hint, stacked, aside, children, className }: FieldRowProps) {
  const variant = useFieldVariant();
  const id = useId();
  const labelText = (
    <>
      {label}
      {required && <span className="text-destructive"> *</span>}
    </>
  );
  const messages = (error || hint) && (
    <p className={cn("text-[13px] leading-snug", error ? "text-destructive" : "text-muted-foreground")} role={error ? "alert" : undefined}>
      {error || hint}
    </p>
  );

  if (variant === "ios") {
    return (
      <FieldIdContext.Provider value={id}>
        <div className={cn("field-row ml-4 pr-4 border-b border-border/60 last:border-b-0", className)}>
          {stacked ? (
            <div className="py-2.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <label htmlFor={id} className="text-[15px] text-foreground">
                  {labelText}
                </label>
                {aside}
              </div>
              {children}
            </div>
          ) : (
            <div className="flex items-center gap-3 min-h-11">
              <label htmlFor={id} className="shrink-0 max-w-[45%] text-[15px] text-foreground">
                {labelText}
              </label>
              <div className="flex-1 min-w-0 flex items-center justify-end gap-2">{children}</div>
            </div>
          )}
          {aside && !stacked && <div className="-mt-1 pb-1.5 text-right">{aside}</div>}
          {messages && <div className="pb-2 -mt-0.5 text-right">{messages}</div>}
        </div>
      </FieldIdContext.Provider>
    );
  }

  if (variant === "android") {
    return (
      <FieldIdContext.Provider value={id}>
        <div className={cn("px-4 py-2 space-y-1", className)}>
          <div className="relative">
            {/* Rótulo "na borda" do campo outlined */}
            <label
              htmlFor={id}
              className={cn(
                "z-10 px-1 text-xs",
                stacked ? "block mb-1 text-muted-foreground" : "absolute -top-2 left-2 bg-card",
                error ? "text-destructive" : "text-muted-foreground"
              )}
            >
              {labelText}
            </label>
            {children}
          </div>
          {aside && <div className="px-1 text-xs">{aside}</div>}
          {messages && <div className="px-1">{messages}</div>}
        </div>
      </FieldIdContext.Provider>
    );
  }

  return (
    <FieldIdContext.Provider value={id}>
      <div className={cn("space-y-1.5", className)}>
        <div className="flex items-center justify-between gap-2">
          <label htmlFor={id} className="text-sm font-medium">
            {labelText}
          </label>
          {aside && <span className="text-xs">{aside}</span>}
        </div>
        {children}
        {messages}
      </div>
    </FieldIdContext.Provider>
  );
}

/** Grupo de linhas: cartão "inset grouped" no iOS. */
export function FieldGroup({ children, className }: { children: ReactNode; className?: string }) {
  const variant = useFieldVariant();
  return (
    <div
      className={cn(
        variant === "ios" && "bg-card rounded-xl overflow-hidden",
        variant === "android" && "bg-card rounded-lg py-2",
        variant === "desktop" && "grid gap-4 sm:grid-cols-2 [&>.col-span-full]:sm:col-span-2",
        className
      )}
    >
      {children}
    </div>
  );
}
