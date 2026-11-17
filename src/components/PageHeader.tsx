import { ReactNode } from "react";
import { ArrowLeft, ChevronLeft } from "lucide-react";
import { useMainScroll } from "@/hooks/useMainScroll";
import { isIOS } from "@/lib/platform";
import { cn } from "@/lib/utils";

interface PageHeaderProps {
  title: string;
  /** Ações no canto direito (ícones/textos). Use HeaderAction. */
  actions?: ReactNode;
  /** Botão voltar: no iOS mostra "‹ rótulo", no Android a seta ←. */
  back?: { label: string; onClick: () => void };
  /** Conteúdo logo abaixo do título (busca, chips, seletor...). */
  children?: ReactNode;
  /** iOS: título grande que encolhe ao rolar (padrão). false = só título pequeno. */
  largeTitle?: boolean;
  /** Substitui o "voltar" (ex.: "Cancelar" em texto, sem seta, num modal). */
  leading?: ReactNode;
}

/**
 * Cabeçalho nativo das telas no celular (some no computador, onde a página
 * mantém o próprio título). Pinta também a área da barra de status.
 *  - iOS: large title que encolhe para título pequeno centralizado ao rolar,
 *    fundo translúcido com blur, voltar "‹ Pacientes", ações à direita.
 *  - Android: top app bar Material 3 (título à esquerda, seta ←, ações à direita).
 */
export function PageHeader({ title, actions, back, children, largeTitle = true, leading }: PageHeaderProps) {
  const { scrolled } = useMainScroll(isIOS && largeTitle ? 36 : 4);

  if (isIOS) {
    const showSmallTitle = !largeTitle || scrolled;
    return (
      <>
        <div
          className={cn(
            "md:hidden sticky top-0 z-40 pt-[env(safe-area-inset-top)] transition-colors",
            scrolled
              ? "bg-page-background/95 backdrop-blur-xl backdrop-saturate-150 border-b border-border/60"
              : "bg-page-background"
          )}
        >
          <div className="relative h-11 flex items-center justify-between px-2">
            <div className="min-w-[44px] flex items-center z-10">
              {leading}
              {!leading && back && (
                <button
                  type="button"
                  onClick={back.onClick}
                  className="flex items-center h-11 pr-2 -ml-1 text-primary text-[17px] active:opacity-50"
                >
                  <ChevronLeft className="h-7 w-7 -mr-0.5" strokeWidth={2.2} />
                  <span className="truncate max-w-[110px]">{back.label}</span>
                </button>
              )}
            </div>
            <h1
              className={cn(
                "absolute inset-x-24 text-center text-[17px] font-semibold text-foreground truncate transition-opacity duration-200 pointer-events-none",
                showSmallTitle ? "opacity-100" : "opacity-0"
              )}
              aria-hidden={!showSmallTitle}
            >
              {title}
            </h1>
            <div className="min-w-[44px] flex items-center justify-end gap-1 z-10">{actions}</div>
          </div>
        </div>
        {largeTitle && (
          <h1 className="md:hidden px-4 pt-1 pb-2 text-[34px] leading-[41px] font-bold tracking-tight text-foreground">
            {title}
          </h1>
        )}
        {children && <div className="md:hidden px-4 pb-3 space-y-2">{children}</div>}
      </>
    );
  }

  // Android — Material 3 top app bar
  return (
    <>
      <div
        className={cn(
          "md:hidden sticky top-0 z-40 pt-[env(safe-area-inset-top)] transition-colors",
          scrolled ? "bg-secondary dark:bg-card shadow-sm" : "bg-page-background"
        )}
      >
        <div className="h-16 flex items-center gap-1 px-1">
          {leading ? (
            <div className="pl-2">{leading}</div>
          ) : back ? (
            <button
              type="button"
              onClick={back.onClick}
              aria-label={`Voltar para ${back.label}`}
              className="h-12 w-12 flex items-center justify-center rounded-full active:bg-foreground/10"
            >
              <ArrowLeft className="h-6 w-6" />
            </button>
          ) : (
            <span className="w-3" />
          )}
          <h1 className="flex-1 min-w-0 truncate text-[22px] font-normal text-foreground">{title}</h1>
          <div className="flex items-center">{actions}</div>
        </div>
      </div>
      {children && <div className="md:hidden px-4 pt-1 pb-3 space-y-2">{children}</div>}
    </>
  );
}

interface HeaderActionProps {
  icon?: ReactNode;
  /** Texto (ex.: "Editar"). No iOS aparece como texto; no Android vira o ícone, se houver. */
  label: string;
  onClick: () => void;
  /** Força mostrar o texto também no Android. */
  textOnly?: boolean;
  /** No iOS mostra o texto (ex.: "Editar") em vez do ícone; no Android mantém o ícone. */
  iosText?: boolean;
}

/** Botão do cabeçalho com área de toque de 44pt (iOS) / 48dp (Android). */
export function HeaderAction({ icon, label, onClick, textOnly, iosText }: HeaderActionProps) {
  const showText = textOnly || !icon || (isIOS && !!iosText);
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        "flex items-center justify-center text-primary active:opacity-50",
        isIOS ? "h-11 min-w-11 px-2 text-[17px]" : "h-12 min-w-12 px-3 rounded-full active:bg-foreground/10 text-foreground"
      )}
    >
      {showText ? <span className={cn(!isIOS && "text-sm font-medium text-primary")}>{label}</span> : icon}
    </button>
  );
}
