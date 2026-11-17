import { KeyboardEvent, ReactNode, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { differenceInCalendarDays, differenceInYears, format, isValid, parse } from "date-fns";
import { Check, ChevronRight, MessageCircle, Plus, Search, X } from "lucide-react";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { FieldRow, inputClass, useFieldId, useFieldVariant } from "@/components/form/FieldRow";
import { longDate, longDateTime } from "@/lib/dates";
import { formatPhone, normalizePhoneDigits, phoneError } from "@/lib/phone";
import { COMMON_SURGERY_TIMES, STATUS_FLOW, statusInfo } from "@/lib/patientOptions";
import { createWhatsAppUrl, safeWindowOpen } from "@/lib/urlSecurity";
import { isIOS } from "@/lib/platform";
import { cn, normalizeSearch } from "@/lib/utils";

/** Teclado: "Enter/Próximo" pula para o próximo campo do formulário. */
export function focusNextOnEnter(e: KeyboardEvent<HTMLInputElement>) {
  if (e.key !== "Enter") return;
  e.preventDefault();
  const form = e.currentTarget.closest("[data-form-root]");
  if (!form) return;
  const fields = Array.from(form.querySelectorAll<HTMLElement>("input:not([type=hidden]):not([disabled]), textarea, [data-field-button]"));
  const next = fields[fields.indexOf(e.currentTarget) + 1];
  if (next) next.focus();
  else e.currentTarget.blur();
}

// ------------------------------------------------------------------ texto

interface TextFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  error?: string | null;
  placeholder?: string;
  autoCapitalize?: string;
  autoComplete?: string;
  hint?: ReactNode;
  className?: string;
}

function TextInput(props: Omit<TextFieldProps, "label" | "required" | "hint" | "className"> & { inputMode?: "text" | "tel" | "numeric"; maxLength?: number }) {
  const id = useFieldId();
  const variant = useFieldVariant();
  return (
    <input
      id={id}
      value={props.value}
      onChange={(e) => props.onChange(e.target.value)}
      placeholder={props.placeholder}
      inputMode={props.inputMode}
      maxLength={props.maxLength}
      autoCapitalize={props.autoCapitalize}
      autoComplete={props.autoComplete}
      enterKeyHint="next"
      onKeyDown={focusNextOnEnter}
      aria-invalid={!!props.error}
      className={inputClass(variant, !!props.error)}
    />
  );
}

export function TextField({ label, required, hint, className, ...rest }: TextFieldProps) {
  return (
    <FieldRow label={label} required={required} error={rest.error} hint={hint} className={className}>
      <TextInput {...rest} />
    </FieldRow>
  );
}

// ------------------------------------------------------------------ telefone

export function PhoneField({
  value,
  onChange,
  required,
  error,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  error?: string | null;
  className?: string;
}) {
  const [touched, setTouched] = useState(false);
  const shownError = error ?? (touched ? phoneError(value) : null);
  const digits = normalizePhoneDigits(value);
  const variant = useFieldVariant();

  return (
    <FieldRow label="WhatsApp" required={required} error={shownError} className={className}>
      <PhoneInput
        value={value}
        onChange={onChange}
        onBlur={() => setTouched(true)}
        invalid={!!shownError}
      />
      {digits.length >= 10 && (
        <button
          type="button"
          onClick={() => safeWindowOpen(createWhatsAppUrl(digits, ""))}
          aria-label="Abrir conversa no WhatsApp"
          className={cn(
            "shrink-0 flex items-center justify-center text-[#25D366]",
            variant === "android" ? "absolute right-1 top-1 h-12 w-12" : "h-11 w-11"
          )}
        >
          <MessageCircle className="h-5 w-5" />
        </button>
      )}
    </FieldRow>
  );
}

function PhoneInput({ value, onChange, onBlur, invalid }: { value: string; onChange: (v: string) => void; onBlur: () => void; invalid: boolean }) {
  const id = useFieldId();
  const variant = useFieldVariant();
  return (
    <input
      id={id}
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      enterKeyHint="next"
      placeholder="(61) 99999-9999"
      value={value}
      // Aceita colar "+55 61 9 9999-9999" e normaliza
      onChange={(e) => onChange(formatPhone(e.target.value))}
      onBlur={onBlur}
      onKeyDown={focusNextOnEnter}
      aria-invalid={invalid}
      className={cn(inputClass(variant, invalid), variant === "android" && "pr-14")}
    />
  );
}

// ------------------------------------------------------------------ nascimento

/** "AAAA-MM-DD" ⇄ "DD/MM/AAAA" com máscara e idade ao lado. */
export function BirthDateField({ value, onChange, className }: { value: string; onChange: (isoDate: string) => void; className?: string }) {
  const variant = useFieldVariant();
  const toText = (iso: string) => (iso ? format(new Date(`${iso}T12:00:00`), "dd/MM/yyyy") : "");
  const [text, setText] = useState(toText(value));
  const [error, setError] = useState<string | null>(null);

  // Atualiza quando o valor muda por fora (rascunho, importação)
  useEffect(() => {
    if (value && toText(value) !== text) setText(toText(value));
    if (!value && text.length === 10) setText("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  const handle = (raw: string) => {
    const d = raw.replace(/\D/g, "").slice(0, 8);
    const masked = d.length > 4 ? `${d.slice(0, 2)}/${d.slice(2, 4)}/${d.slice(4)}` : d.length > 2 ? `${d.slice(0, 2)}/${d.slice(2)}` : d;
    setText(masked);
    if (d.length === 0) {
      setError(null);
      onChange("");
      return;
    }
    if (d.length < 8) {
      setError(null);
      return;
    }
    const parsed = parse(masked, "dd/MM/yyyy", new Date());
    if (!isValid(parsed) || parsed > new Date() || parsed.getFullYear() < 1900) {
      setError("Data inválida");
      return;
    }
    setError(null);
    onChange(format(parsed, "yyyy-MM-dd"));
  };

  const age = value ? differenceInYears(new Date(), new Date(`${value}T12:00:00`)) : null;

  return (
    <FieldRow label="Nascimento" error={error} className={className} aside={age !== null && !error ? <span className="text-muted-foreground">{age} anos</span> : undefined}>
      <BirthInput text={text} onText={handle} invalid={!!error} variant={variant} />
    </FieldRow>
  );
}

function BirthInput({ text, onText, invalid, variant }: { text: string; onText: (v: string) => void; invalid: boolean; variant: ReturnType<typeof useFieldVariant> }) {
  const id = useFieldId();
  return (
    <input
      id={id}
      inputMode="numeric"
      placeholder="DD/MM/AAAA"
      value={text}
      enterKeyHint="next"
      onKeyDown={focusNextOnEnter}
      onChange={(e) => onText(e.target.value)}
      aria-invalid={invalid}
      className={inputClass(variant, invalid)}
    />
  );
}

// ------------------------------------------------------------------ seletores nativos

/**
 * Input nativo (date/time) transparente por cima de um "botão": tocar abre o
 * seletor do sistema. O valor só muda quando a usuária escolhe algo — um
 * campo vazio nunca aparece com a data de hoje (como o iPhone faz).
 */
function NativePickerOverlay({
  type,
  value,
  onChange,
  label,
}: {
  type: "date" | "time";
  value: string;
  onChange: (v: string) => void;
  label: string;
}) {
  return (
    <input
      type={type}
      value={value}
      aria-label={label}
      onChange={(e) => e.target.value && onChange(e.target.value)}
      onClick={(e) => {
        // Computador: abre o seletor ao clicar em qualquer parte
        try {
          (e.currentTarget as HTMLInputElement & { showPicker?: () => void }).showPicker?.();
        } catch {
          /* alguns navegadores não permitem */
        }
      }}
      className="absolute inset-0 h-full w-full cursor-pointer opacity-0 [color-scheme:light_dark]"
    />
  );
}

// ------------------------------------------------------------------ data/hora da cirurgia

/** value = "AAAA-MM-DDTHH:mm" (hora local). Começa VAZIO ("Adicionar data"). */
export function SurgeryDateTimeField({
  value,
  onChange,
  error,
  required,
  className,
  suggestion,
}: {
  value: string;
  onChange: (v: string) => void;
  error?: string | null;
  required?: boolean;
  className?: string;
  /** Ex.: "Mais comum neste hospital: 07:00 · Usar". */
  suggestion?: ReactNode;
}) {
  const datePart = value ? value.slice(0, 10) : "";
  const timePart = value ? value.slice(11, 16) : "";
  const isCustomTime = !!timePart && !COMMON_SURGERY_TIMES.includes(timePart);

  if (!value) {
    return (
      <FieldRow label="Data da cirurgia" required={required} error={error} className={className}>
        <span className="relative inline-flex items-center min-h-11 text-[16px] text-primary font-medium">
          + Adicionar data
          <NativePickerOverlay type="date" value="" label="Escolher a data da cirurgia" onChange={(d) => onChange(`${d}T07:00`)} />
        </span>
      </FieldRow>
    );
  }

  return (
    <FieldRow
      label="Data da cirurgia"
      required={required}
      error={error}
      stacked
      className={className}
      aside={
        <button type="button" onClick={() => onChange("")} className="text-[13px] text-destructive min-h-11 px-1">
          Remover
        </button>
      }
    >
      <div className="space-y-2">
        {/* Dia: toque para trocar (seletor nativo) */}
        <span className="relative flex items-center justify-between min-h-11 rounded-lg bg-muted/60 px-3 text-[16px]">
          <span className="first-letter:uppercase">{longDate(`${datePart}T12:00:00`)}</span>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <NativePickerOverlay type="date" value={datePart} label="Trocar o dia da cirurgia" onChange={(d) => onChange(`${d}T${timePart || "07:00"}`)} />
        </span>
        {/* Hora: atalhos + "Outro…" */}
        <div role="radiogroup" aria-label="Horário" className="flex flex-wrap gap-1.5">
          {COMMON_SURGERY_TIMES.map((t) => (
            <button
              key={t}
              type="button"
              role="radio"
              aria-checked={timePart === t}
              onClick={() => onChange(`${datePart}T${t}`)}
              className={cn(
                "h-10 min-w-[64px] rounded-full border px-3 text-[15px] tabular-nums",
                timePart === t ? "bg-primary text-primary-foreground border-primary font-semibold" : "bg-card text-foreground active:bg-muted"
              )}
            >
              {t}
            </button>
          ))}
          <span
            className={cn(
              "relative inline-flex items-center h-10 rounded-full border px-3 text-[15px]",
              isCustomTime ? "bg-primary text-primary-foreground border-primary font-semibold" : "bg-card text-foreground"
            )}
          >
            {isCustomTime ? timePart : "Outro…"}
            <NativePickerOverlay type="time" value={timePart} label="Outro horário" onChange={(t) => onChange(`${datePart}T${t}`)} />
          </span>
        </div>
        <p className="text-[13px] text-muted-foreground first-letter:uppercase">{longDateTime(new Date(value))}</p>
        {suggestion && <p className="text-[13px] text-muted-foreground">{suggestion}</p>}
      </div>
    </FieldRow>
  );
}

// ------------------------------------------------------------------ validade da guia

export function GuideValidityField({ value, onChange, className }: { value: string; onChange: (v: string) => void; className?: string }) {
  const days = value ? differenceInCalendarDays(new Date(`${value}T23:59:59`), new Date()) : null;
  const aside =
    days === null ? undefined : days < 0 ? (
      <span className="text-[13px] font-medium text-destructive">Vencida há {Math.abs(days)} dia(s)</span>
    ) : (
      <span className={cn("text-[13px]", days < 15 ? "font-medium text-amber-700 dark:text-amber-400" : "text-muted-foreground")}>
        {days === 0 ? "Vence hoje" : `Vence em ${days} dia(s)`}
      </span>
    );
  return (
    <FieldRow label="Validade da guia" aside={aside} className={className}>
      <span className="relative flex items-center justify-end gap-1 min-h-11 w-full text-[16px]">
        <span className={cn(!value && "text-muted-foreground")}>{value ? format(new Date(`${value}T12:00:00`), "dd/MM/yyyy") : "Escolher"}</span>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />
        <NativePickerOverlay type="date" value={value} label="Validade da guia" onChange={onChange} />
      </span>
    </FieldRow>
  );
}

// ------------------------------------------------------------------ chips

function Chip({ active, onClick, children, role }: { active: boolean; onClick: () => void; children: ReactNode; role: "radio" | "checkbox" }) {
  return (
    <button
      type="button"
      role={role}
      aria-checked={active}
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1 min-h-11 rounded-full border px-4 text-[15px] transition-colors",
        // Selecionado: preenchido + ✓ (contraste AA nos dois modos)
        active ? "bg-primary text-primary-foreground border-primary font-semibold" : "bg-card text-foreground border-border active:bg-muted"
      )}
    >
      {active && <Check className="h-4 w-4 -ml-1" strokeWidth={3} />}
      {children}
    </button>
  );
}

export function ChoiceChips({
  label,
  options,
  value,
  onChange,
  required,
  error,
  hint,
  className,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  required?: boolean;
  error?: string | null;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <FieldRow label={label} required={required} error={error} hint={hint} stacked className={className}>
      <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
        {options.map((o) => (
          <Chip key={o.value} role="radio" active={o.value === value} onClick={() => onChange(o.value)}>
            {o.label}
          </Chip>
        ))}
      </div>
    </FieldRow>
  );
}

/** Chips de múltipla escolha (ex.: procedimentos). */
export function MultiChoiceChips({
  label,
  options,
  values,
  onChange,
  required,
  error,
  hint,
  className,
}: {
  label: string;
  options: { value: string; label: string }[];
  values: string[];
  onChange: (v: string[]) => void;
  required?: boolean;
  error?: string | null;
  hint?: ReactNode;
  className?: string;
}) {
  return (
    <FieldRow label={label} required={required} error={error} hint={hint} stacked className={className}>
      <div role="group" aria-label={label} className="flex flex-wrap gap-2">
        {options.map((o) => {
          const active = values.includes(o.value);
          return (
            <Chip
              key={o.value}
              role="checkbox"
              active={active}
              onClick={() => onChange(active ? values.filter((v) => v !== o.value) : [...values, o.value])}
            >
              {o.label}
            </Chip>
          );
        })}
      </div>
    </FieldRow>
  );
}

// ------------------------------------------------------------------ segmented / switch

export function SegmentedField({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <FieldRow label={label}>
      <div className={cn("inline-grid", isIOS ? "rounded-[9px] bg-muted/80 p-0.5" : "rounded-full border overflow-hidden")} style={{ gridTemplateColumns: `repeat(${options.length}, auto)` }}>
        {options.map((o) => {
          const active = o.value === value;
          return (
            <button
              key={o.value}
              type="button"
              aria-pressed={active}
              // Tocar no ativo de novo limpa (campo opcional)
              onClick={() => onChange(active ? "" : o.value)}
              className={cn(
                "h-9 px-3 text-[14px]",
                isIOS ? cn("rounded-[7px]", active && "bg-card shadow-sm font-semibold") : cn(active && "bg-primary/15 font-medium")
              )}
            >
              {o.label}
            </button>
          );
        })}
      </div>
    </FieldRow>
  );
}

export function SwitchField({ label, checked, onChange, hint, className }: { label: string; checked: boolean; onChange: (v: boolean) => void; hint?: ReactNode; className?: string }) {
  return (
    <FieldRow label={label} hint={hint} className={className}>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </FieldRow>
  );
}

// ------------------------------------------------------------------ seleção com busca (sheet)

interface SelectSheetFieldProps {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string; dot?: string; hint?: string }[];
  placeholder?: string;
  required?: boolean;
  error?: string | null;
  searchable?: boolean;
  /** Permite "Outro…": digitar um valor que não está na lista. */
  onAddOption?: (v: string) => void;
  className?: string;
}

/**
 * Seleção que abre uma folha de baixo para cima, com busca e "Cancelar / OK"
 * (iOS) — no Android, bottom sheet do Material.
 */
export function SelectSheetField({ label, value, onChange, options, placeholder = "Escolher", required, error, searchable, onAddOption, className }: SelectSheetFieldProps) {
  const variant = useFieldVariant();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState(value);
  const [query, setQuery] = useState("");
  const [adding, setAdding] = useState(false);
  const selected = options.find((o) => o.value === value);

  const filtered = useMemo(() => {
    const q = normalizeSearch(query);
    return q ? options.filter((o) => normalizeSearch(o.label).includes(q)) : options;
  }, [options, query]);

  const openSheet = () => {
    setDraft(value);
    setQuery("");
    setAdding(false);
    setOpen(true);
  };

  const confirm = (v: string) => {
    onChange(v);
    setOpen(false);
  };

  const trigger = (
    <TriggerButton variant={variant} invalid={!!error} onClick={openSheet}>
      <span className={cn("truncate", !selected && !value && "text-muted-foreground/70")}>
        {selected?.dot && <span className={cn("inline-block h-2 w-2 rounded-full mr-1.5 align-middle", selected.dot)} />}
        {selected?.label ?? (value || placeholder)}
      </span>
      {variant === "ios" ? <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" /> : <span className="text-muted-foreground">▾</span>}
    </TriggerButton>
  );

  return (
    <>
      <FieldRow label={label} required={required} error={error} className={className}>
        {trigger}
      </FieldRow>
      <Drawer open={open} onOpenChange={setOpen} shouldScaleBackground={false}>
        <DrawerContent className="max-h-[85vh] max-h-[85dvh] z-[70]">
          <DrawerHeader className="flex items-center justify-between gap-2 py-2 px-2 text-left">
            {isIOS ? (
              <>
                <button type="button" className="min-h-11 px-3 text-[17px] text-primary" onClick={() => setOpen(false)}>
                  Cancelar
                </button>
                <DrawerTitle className="text-[17px] font-semibold">{label}</DrawerTitle>
                <button type="button" className="min-h-11 px-3 text-[17px] font-semibold text-primary" onClick={() => confirm(draft)}>
                  OK
                </button>
              </>
            ) : (
              <DrawerTitle className="px-2 text-lg">{label}</DrawerTitle>
            )}
            <DrawerDescription className="sr-only">Escolha uma opção</DrawerDescription>
          </DrawerHeader>

          {searchable && (
            <div className="relative px-4 pb-2">
              <Search className="absolute left-7 top-1/2 -translate-y-[60%] h-4 w-4 text-muted-foreground" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar"
                className="w-full h-10 rounded-[10px] bg-muted/80 pl-9 pr-3 text-base focus:outline-none"
              />
            </div>
          )}

          <ul className="flex-1 min-h-0 overflow-y-auto overscroll-contain pb-[calc(1rem+env(safe-area-inset-bottom))]" role="listbox">
            {filtered.map((o) => {
              const active = o.value === draft;
              return (
                <li key={o.value}>
                  <button
                    type="button"
                    role="option"
                    aria-selected={active}
                    // iOS confirma no "OK"; Android aplica ao tocar
                    onClick={() => (isIOS ? setDraft(o.value) : confirm(o.value))}
                    className="w-full min-h-12 flex items-center gap-3 px-4 text-left active:bg-muted"
                  >
                    {o.dot && <span className={cn("h-2.5 w-2.5 rounded-full shrink-0", o.dot)} />}
                    <span className="flex-1 min-w-0">
                      <span className="block text-[16px]">{o.label}</span>
                      {o.hint && <span className="block text-xs text-muted-foreground">{o.hint}</span>}
                    </span>
                    {active && <Check className="h-5 w-5 text-primary shrink-0" />}
                  </button>
                </li>
              );
            })}
            {onAddOption && (
              <li className="border-t">
                {adding ? (
                  <div className="flex gap-2 p-3">
                    <input
                      autoFocus
                      value={query}
                      onChange={(e) => setQuery(e.target.value)}
                      placeholder={`Novo ${label.toLowerCase()}`}
                      className="flex-1 h-11 rounded-md border px-3 text-base"
                    />
                    <Button
                      type="button"
                      className="h-11"
                      disabled={!query.trim()}
                      onClick={() => {
                        const v = query.trim();
                        onAddOption(v);
                        confirm(v);
                      }}
                    >
                      Adicionar
                    </Button>
                  </div>
                ) : (
                  <button type="button" onClick={() => setAdding(true)} className="w-full min-h-12 flex items-center gap-2 px-4 text-primary">
                    <Plus className="h-5 w-5" />
                    Outro…
                  </button>
                )}
              </li>
            )}
            {filtered.length === 0 && !onAddOption && <li className="px-4 py-3 text-sm text-muted-foreground">Nada encontrado</li>}
          </ul>
        </DrawerContent>
      </Drawer>
    </>
  );
}

function TriggerButton({ variant, invalid, onClick, children }: { variant: ReturnType<typeof useFieldVariant>; invalid: boolean; onClick: () => void; children: ReactNode }) {
  const id = useFieldId();
  return (
    <button
      id={id}
      type="button"
      data-field-button
      onClick={onClick}
      aria-invalid={invalid}
      className={cn(
        inputClass(variant, invalid),
        "flex items-center gap-2",
        variant === "ios" ? "justify-end" : "justify-between text-left"
      )}
    >
      {children}
    </button>
  );
}

/** Status com as etapas em ordem e cor. */
export function StatusField({ value, onChange, error }: { value: string; onChange: (v: string) => void; error?: string | null }) {
  return (
    <SelectSheetField
      label="Status"
      value={value}
      onChange={onChange}
      error={error}
      options={STATUS_FLOW.map((s) => ({ value: s.value, label: s.label, dot: s.dot }))}
    />
  );
}
export { statusInfo };

// ------------------------------------------------------------------ texto longo

/** Textarea que cresce com o conteúdo. */
export function AutoTextarea({
  value,
  onChange,
  placeholder,
  minRows = 2,
  className,
  autoFocus,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  minRows?: number;
  className?: string;
  autoFocus?: boolean;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [value]);
  return (
    <textarea
      ref={ref}
      value={value}
      autoFocus={autoFocus}
      rows={minRows}
      placeholder={placeholder}
      onChange={(e) => onChange(e.target.value)}
      className={cn(
        "w-full resize-none overflow-hidden rounded-md border border-input bg-transparent px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-ring",
        className
      )}
    />
  );
}

/** Ícone de "x" reutilizado em chips de arquivos etc. */
export { X as RemoveIcon };
