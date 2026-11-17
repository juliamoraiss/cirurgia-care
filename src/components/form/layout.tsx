import { ReactNode, useEffect, useState } from "react";
import { Check, ChevronDown, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useFieldVariant } from "@/components/form/FieldRow";
import type { EffectKey, SaveEffect } from "@/lib/patientActions";
import { isIOS } from "@/lib/platform";
import { cn } from "@/lib/utils";

// ------------------------------------------------------------------ seção recolhível

interface FormSectionProps {
  id: string;
  title: string;
  open: boolean;
  onToggle: () => void;
  /** Resumo quando fechada (ex.: "Rinoplastia · ter, 17 nov"). */
  summary?: ReactNode;
  /** Destaque de pendência/erro na seção. */
  alert?: boolean;
  children: ReactNode;
}

export function FormSection({ id, title, open, onToggle, summary, alert, children }: FormSectionProps) {
  const variant = useFieldVariant();
  return (
    <section id={`section-${id}`} className={cn("scroll-mt-28", variant === "desktop" && "rounded-xl border bg-card")}>
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={open}
        aria-controls={`section-body-${id}`}
        className={cn(
          "w-full flex items-center gap-2 text-left min-h-11",
          variant === "desktop" ? "px-5 py-3" : "px-4 py-1.5"
        )}
      >
        <span className="flex-1 min-w-0">
          <span
            className={cn(
              "block",
              // Celular: título pequeno em caixa alta cinza (iOS e Android)
              variant !== "desktop" && "text-[13px] uppercase tracking-wide text-muted-foreground",
              variant === "desktop" && "text-base font-semibold"
            )}
          >
            {title}
            {alert && <span className="ml-1.5 inline-block h-2 w-2 rounded-full bg-destructive align-middle" aria-label="tem pendência" />}
          </span>
          {!open && summary && <span className="block text-[13px] text-muted-foreground normal-case tracking-normal">{summary}</span>}
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", open && "rotate-180")} />
      </button>
      {open && (
        <div id={`section-body-${id}`} className={cn(variant === "desktop" ? "px-5 pb-5" : "pb-2")}>
          {children}
        </div>
      )}
    </section>
  );
}

/** Cabeçalho pequeno de um grupo de campos: "PACIENTE", "CIRURGIA"… */
export function GroupHeading({ children }: { children: ReactNode }) {
  return <h3 className="px-4 md:px-0 pt-1 pb-1.5 text-[13px] font-normal uppercase tracking-wide text-muted-foreground">{children}</h3>;
}

// ------------------------------------------------------------------ teclado

/** Altura do teclado virtual (visualViewport), para a barra de salvar ficar acima dele. */
export function useKeyboardInset() {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => setInset(Math.max(0, window.innerHeight - vv.height - vv.offsetTop));
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);
  return inset;
}

// ------------------------------------------------------------------ barra de salvar

export type SaveState = "idle" | "saving" | "saved";

interface SaveBarProps {
  label: string;
  dirty: boolean;
  state: SaveState;
  onSave: () => void;
  secondary?: ReactNode;
}

/**
 * Botão "Salvar" fixo no rodapé (acima do teclado e da barra de abas no
 * celular). Desabilitado enquanto nada mudou; "Salvando…" → "Salvo".
 */
export function SaveBar({ label, dirty, state, onSave, secondary }: SaveBarProps) {
  const keyboard = useKeyboardInset();
  const variant = useFieldVariant();
  const content = (
    <div className="flex items-center gap-2">
      {secondary}
      <Button
        type="button"
        onClick={onSave}
        disabled={!dirty || state === "saving"}
        className={cn(
          "flex-1 h-12 text-base",
          // Desabilitado: cinza com texto legível (contraste AA), sem transparência
          "disabled:opacity-100 disabled:bg-muted disabled:text-muted-foreground",
          variant === "desktop" && "flex-none min-w-40 h-10 text-sm"
        )}
      >
        {state === "saving" ? (
          <>
            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            Salvando…
          </>
        ) : state === "saved" && !dirty ? (
          <>
            <Check className="h-4 w-4 mr-2" />
            Salvo
          </>
        ) : (
          label
        )}
      </Button>
    </div>
  );

  if (variant === "desktop") {
    return <div className="sticky bottom-0 z-30 -mx-6 border-t bg-background/95 backdrop-blur px-6 py-3 flex justify-end">{content}</div>;
  }

  return (
    <>
      {/* Espaço para a barra não cobrir o último campo */}
      <div className="h-24" aria-hidden />
      <div
        className="fixed inset-x-0 z-[46] border-t bg-page-background/95 backdrop-blur px-4 py-2"
        style={{
          // Com teclado aberto fica logo acima dele; sem teclado, acima da barra de abas
          bottom: keyboard > 0 ? keyboard : `calc(env(safe-area-inset-bottom) + ${isIOS ? 49 : 80}px)`,
        }}
      >
        {content}
      </div>
    </>
  );
}

// ------------------------------------------------------------------ descartar alterações

/** "Descartar alterações?" — action sheet no iPhone, diálogo no Android/computador. */
export function DiscardChangesDialog({
  open,
  onOpenChange,
  onDiscard,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onDiscard: () => void;
}) {
  if (isIOS) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
        <DrawerContent className="z-[80] bg-transparent border-0 px-2 pb-[calc(0.5rem+env(safe-area-inset-bottom))]">
          <DrawerTitle className="sr-only">Descartar alterações?</DrawerTitle>
          <DrawerDescription className="sr-only">As alterações não salvas serão perdidas.</DrawerDescription>
          <div className="rounded-[14px] bg-card overflow-hidden text-center">
            <p className="px-4 py-3 text-[13px] text-muted-foreground">As alterações que você não salvou serão perdidas.</p>
            <button type="button" className="w-full h-14 border-t text-[20px] text-destructive" onClick={onDiscard}>
              Descartar alterações
            </button>
          </div>
          <button type="button" className="mt-2 w-full h-14 rounded-[14px] bg-card text-[20px] font-semibold text-primary" onClick={() => onOpenChange(false)}>
            Continuar editando
          </button>
        </DrawerContent>
      </Drawer>
    );
  }
  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Descartar alterações?</AlertDialogTitle>
          <AlertDialogDescription>As alterações que você não salvou serão perdidas.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Continuar editando</AlertDialogCancel>
          <AlertDialogAction onClick={onDiscard} className="bg-destructive hover:bg-destructive/90">
            Descartar
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

/** "Continuar de onde parou?" — rascunho encontrado ao abrir o formulário. */
export function ResumeDraftDialog({
  open,
  savedAt,
  onResume,
  onDiscard,
}: {
  open: boolean;
  savedAt?: number;
  onResume: () => void;
  onDiscard: () => void;
}) {
  const when = savedAt ? new Date(savedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }) : null;
  return (
    <AlertDialog open={open}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Continuar de onde parou?</AlertDialogTitle>
          <AlertDialogDescription>
            Encontramos alterações que não foram salvas{when ? ` (${when})` : ""}.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel onClick={onDiscard}>Começar de novo</AlertDialogCancel>
          <AlertDialogAction onClick={onResume}>Continuar</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

// ------------------------------------------------------------------ confirmação dos efeitos

interface SaveEffectsSheetProps {
  open: boolean;
  effects: SaveEffect[];
  saving: boolean;
  onCancel: () => void;
  onConfirm: (selected: Set<EffectKey>) => void;
}

/**
 * "Ao salvar, vamos: ☑ enviar confirmação ao paciente ☑ avisar no Google Agenda".
 * Cada item pode ser desmarcado; nada é enviado sem passar por aqui.
 */
export function SaveEffectsSheet({ open, effects, saving, onCancel, onConfirm }: SaveEffectsSheetProps) {
  const [selected, setSelected] = useState<Set<EffectKey>>(new Set());
  const [expanded, setExpanded] = useState<EffectKey | null>(null);

  useEffect(() => {
    if (open) {
      setSelected(new Set(effects.filter((e) => e.defaultChecked).map((e) => e.key)));
      setExpanded(null);
    }
  }, [open, effects]);

  const toggle = (k: EffectKey) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });

  const sendsMessage = [...selected].some((k) => k === "patient_whatsapp" || k === "doctor_whatsapp");

  return (
    <Drawer open={open} onOpenChange={(o) => !o && !saving && onCancel()} shouldScaleBackground={false}>
      <DrawerContent className="max-h-[90vh] max-h-[90dvh] z-[75]">
        <DrawerHeader className="text-left pb-2">
          <DrawerTitle>Ao salvar, vamos:</DrawerTitle>
          <DrawerDescription>Desmarque o que não quiser fazer agora.</DrawerDescription>
        </DrawerHeader>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 space-y-2 pb-2">
          {effects.map((e) => (
            <div key={e.key} className="rounded-lg border bg-card">
              <label className="flex items-start gap-3 p-3 min-h-12 cursor-pointer">
                <Checkbox checked={selected.has(e.key)} onCheckedChange={() => toggle(e.key)} className="mt-0.5 h-5 w-5" />
                <span className="flex-1 text-[15px] leading-snug">{e.label}</span>
              </label>
              {e.preview && (
                <div className="px-3 pb-3 -mt-1">
                  <button type="button" className="text-[13px] text-primary min-h-9" onClick={() => setExpanded(expanded === e.key ? null : e.key)}>
                    {expanded === e.key ? "Esconder mensagem" : "Ver mensagem"}
                  </button>
                  {expanded === e.key && (
                    <pre className="mt-1 whitespace-pre-wrap rounded-md bg-muted/60 p-3 font-sans text-[13px] leading-snug">{e.preview}</pre>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-2 gap-2 border-t bg-background p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <Button variant="outline" className="h-12" disabled={saving} onClick={() => onConfirm(new Set())}>
            Só salvar
          </Button>
          <Button className="h-12" disabled={saving} onClick={() => onConfirm(selected)}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : sendsMessage ? "Salvar e enviar" : "Salvar"}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
