import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { AlertTriangle, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { AutoTextarea } from "@/components/form/fields";
import { describeError } from "@/lib/errors";
import { formatPhone, normalizePhoneDigits } from "@/lib/phone";
import { PROCEDURE_OPTIONS } from "@/lib/patientOptions";
import { nameSimilarity, toTitleCaseName } from "@/lib/surgeryList";
import { cn } from "@/lib/utils";

// ------------------------------------------------------------------ duplicados

interface DuplicateMatch {
  id: string;
  name: string;
  phone: string | null;
  reason: "telefone" | "nome";
}

/**
 * Avisa, enquanto a usuária digita, se já existe paciente com o mesmo telefone
 * ou nome muito parecido — antes de criar um cadastro duplicado.
 */
export function DuplicateWarning({ name, phone, excludeId }: { name: string; phone: string; excludeId?: string }) {
  const navigate = useNavigate();
  const [matches, setMatches] = useState<DuplicateMatch[]>([]);

  useEffect(() => {
    const digits = normalizePhoneDigits(phone);
    const trimmed = name.trim();
    if (trimmed.length < 5 && digits.length < 10) {
      setMatches([]);
      return;
    }
    let cancelled = false;
    // Espera a usuária parar de digitar
    const timer = setTimeout(async () => {
      const tokens = trimmed
        .split(/\s+/)
        .filter((t) => t.length >= 3)
        .slice(0, 3);
      const filters = tokens.map((t) => `name.ilike.%${t}%`);
      if (digits.length >= 10) filters.push(`phone.ilike.%${digits.slice(-4)}%`);
      if (filters.length === 0) return;
      const { data } = await supabase.from("patients").select("id, name, phone").or(filters.join(",")).limit(30);
      if (cancelled) return;
      const found: DuplicateMatch[] = [];
      for (const p of data || []) {
        if (p.id === excludeId) continue;
        if (digits.length >= 10 && normalizePhoneDigits(p.phone || "") === digits) found.push({ ...p, reason: "telefone" });
        else if (trimmed.length >= 5 && nameSimilarity(trimmed, p.name) >= 0.85) found.push({ ...p, reason: "nome" });
      }
      setMatches(found.slice(0, 3));
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [name, phone, excludeId]);

  if (matches.length === 0) return null;
  return (
    <div role="status" className="mx-4 md:mx-0 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 space-y-1.5">
      <p className="flex items-center gap-1.5 text-sm font-medium text-amber-800 dark:text-amber-300">
        <AlertTriangle className="h-4 w-4 shrink-0" />
        Esse paciente pode já estar cadastrado
      </p>
      {matches.map((m) => (
        <button
          key={m.id}
          type="button"
          onClick={() => navigate(`/patients/${m.id}/exams`)}
          className="block w-full min-h-10 text-left text-sm underline-offset-2 hover:underline"
        >
          {m.name}
          {m.phone ? ` · ${m.phone}` : ""} <span className="text-muted-foreground">(mesmo {m.reason})</span> — abrir ficha
        </button>
      ))}
    </div>
  );
}

// ------------------------------------------------------------------ importar do WhatsApp

export interface ImportedPatientData {
  name?: string;
  phone?: string;
  birth_date?: string;
  insurance?: string;
  procedure?: string;
  hospital?: string;
  surgery_date?: string; // "AAAA-MM-DDTHH:mm" local
}

function toLocalInput(iso: string | null | undefined) {
  if (!iso) return undefined;
  const d = new Date(iso);
  if (isNaN(d.getTime())) return undefined;
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

/**
 * Cola o texto do WhatsApp e preenche o Novo paciente. Os campos reconhecidos
 * ficam destacados no formulário para conferência antes de criar.
 */
export function ImportWhatsAppSheet({
  open,
  onOpenChange,
  onImported,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onImported: (data: ImportedPatientData) => void;
}) {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) setText("");
  }, [open]);

  async function handleRead() {
    if (!text.trim()) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("parse-surgery-message", { body: { text } });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || "Não foi possível ler a mensagem");
      const ex = data.data as Record<string, string | null>;
      const procedure = (ex.procedure || "").toLowerCase();
      const knownProcedure = PROCEDURE_OPTIONS.find((p) => procedure.includes(p.value))?.value;
      const result: ImportedPatientData = {
        name: ex.patient_name ? toTitleCaseName(ex.patient_name) : undefined,
        phone: ex.phone ? formatPhone(ex.phone) : undefined,
        birth_date: ex.birth_date && /^\d{4}-\d{2}-\d{2}$/.test(ex.birth_date) ? ex.birth_date : undefined,
        insurance: ex.insurance || undefined,
        procedure: knownProcedure ?? (procedure ? undefined : undefined),
        hospital: ex.hospital || undefined,
        surgery_date: toLocalInput(ex.surgery_datetime),
      };
      const found = Object.values(result).filter(Boolean).length;
      if (found === 0) {
        toast.error("Não reconheci nenhum dado nessa mensagem");
        return;
      }
      onImported(result);
      onOpenChange(false);
      toast.success(`${found} campo(s) preenchido(s). Confira os destacados.`);
    } catch (error) {
      toast.error(describeError("Erro ao ler a mensagem", error));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
      <DrawerContent className="max-h-[90vh] max-h-[90dvh] z-[70]">
        <DrawerHeader className="text-left pb-2">
          <DrawerTitle>Importar do WhatsApp</DrawerTitle>
          <DrawerDescription>Cole a mensagem com os dados do paciente.</DrawerDescription>
        </DrawerHeader>
        <div className="px-4 pb-2">
          <AutoTextarea value={text} onChange={setText} minRows={5} autoFocus placeholder="Nome, telefone, convênio, procedimento…" />
        </div>
        <div className="grid grid-cols-2 gap-2 border-t bg-background p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <Button variant="outline" className="h-12" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancelar
          </Button>
          <Button className="h-12" onClick={handleRead} disabled={loading || !text.trim()}>
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4 mr-1.5" />}
            Preencher
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}

/** Destaque dos campos preenchidos pela importação. */
export function importedHighlight(active: boolean) {
  return cn(active && "bg-sky-500/10 ring-1 ring-inset ring-sky-500/40 rounded-md");
}
