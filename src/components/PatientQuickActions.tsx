import { ReactNode, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { CalendarClock, Check, Loader2, Paperclip, StickyNote, Tag, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { FieldGroup } from "@/components/form/FieldRow";
import { AutoTextarea, SelectSheetField, SurgeryDateTimeField, SwitchField } from "@/components/form/fields";
import { SaveEffectsSheet } from "@/components/form/layout";
import { describeError } from "@/lib/errors";
import { HOSPITAL_OPTIONS, ensureHospitalRegistered } from "@/lib/hospitals";
import {
  createSurgeryTasks,
  deletePatientCompletely,
  detectSaveEffects,
  runSaveEffects,
  type EffectKey,
  type PatientSnapshot,
  type SaveEffect,
} from "@/lib/patientActions";
import { STATUS_FLOW } from "@/lib/patientOptions";
import { isIOS } from "@/lib/platform";
import { cn } from "@/lib/utils";

export interface QuickPatient {
  id: string;
  name: string;
  phone?: string | null;
  procedure: string;
  hospital: string | null;
  surgery_date: string | null;
  surgery_to_confirm?: boolean;
  status: string;
  responsible_user_id: string | null;
  google_calendar_event_id?: string | null;
  is_oncology?: boolean;
  oncology_stage?: string | null;
}

function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function snapshotOf(p: QuickPatient, overrides: Partial<PatientSnapshot> = {}): PatientSnapshot {
  return {
    id: p.id,
    name: p.name,
    phone: p.phone || "",
    procedure: p.procedure,
    hospital: p.hospital || "",
    surgery_date: p.surgery_date || "",
    surgery_to_confirm: !!p.surgery_to_confirm,
    status: p.status,
    responsible_user_id: p.responsible_user_id,
    is_oncology: p.is_oncology,
    oncology_stage: p.oncology_stage || "",
    ...overrides,
  };
}

/** Folha pequena com um campo só e "Salvar". */
function QuickSheet({
  open,
  onOpenChange,
  title,
  children,
  onSave,
  saving,
  canSave,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  children: ReactNode;
  onSave: () => void;
  saving: boolean;
  canSave: boolean;
}) {
  return (
    <Drawer open={open} onOpenChange={(o) => !saving && onOpenChange(o)} shouldScaleBackground={false}>
      <DrawerContent className="max-h-[90vh] max-h-[90dvh] z-[70]">
        <DrawerHeader className={cn("py-2 px-2", isIOS ? "flex items-center justify-between" : "text-left px-4")}>
          {isIOS && (
            <button type="button" className="min-h-11 px-3 text-[17px] text-primary" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </button>
          )}
          <DrawerTitle className="text-[17px] font-semibold">{title}</DrawerTitle>
          <DrawerDescription className="sr-only">{title}</DrawerDescription>
          {isIOS && (
            <button
              type="button"
              className="min-h-11 px-3 text-[17px] font-semibold text-primary disabled:opacity-40"
              onClick={onSave}
              disabled={!canSave || saving}
            >
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </button>
          )}
        </DrawerHeader>
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-3">{children}</div>
        {!isIOS && (
          <div className="grid grid-cols-2 gap-2 border-t p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
            <Button variant="outline" className="h-12" onClick={() => onOpenChange(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button className="h-12" onClick={onSave} disabled={!canSave || saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
            </Button>
          </div>
        )}
        {isIOS && <div className="pb-[env(safe-area-inset-bottom)]" />}
      </DrawerContent>
    </Drawer>
  );
}

type Sheet = "status" | "date" | "note" | "file" | null;

/**
 * Ações rápidas da ficha, sem abrir o formulário inteiro:
 * Mudar status · Marcar data · Adicionar nota · Anexar arquivo.
 */
export function PatientQuickActions({ patient, onChanged }: { patient: QuickPatient; onChanged: () => void }) {
  const { user } = useAuth();
  const [sheet, setSheet] = useState<Sheet>(null);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(patient.status);
  const [date, setDate] = useState(toLocalInput(patient.surgery_date));
  const [hospital, setHospital] = useState(patient.hospital || "");
  const [toConfirm, setToConfirm] = useState(!!patient.surgery_to_confirm);
  const [note, setNote] = useState("");
  const [hospitals, setHospitals] = useState<string[]>(HOSPITAL_OPTIONS);
  const [effects, setEffects] = useState<SaveEffect[] | null>(null);
  const pendingUpdate = useRef<{ update: Record<string, unknown>; after: PatientSnapshot } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Reabre com os valores atuais
  useEffect(() => {
    if (!sheet) return;
    setStatus(patient.status);
    setDate(toLocalInput(patient.surgery_date));
    setHospital(patient.hospital || "");
    setToConfirm(!!patient.surgery_to_confirm);
    setNote("");
    if (sheet === "status" || sheet === "date") {
      supabase
        .from("hospitals")
        .select("name")
        .then(({ data }) => setHospitals(Array.from(new Set([...HOSPITAL_OPTIONS, ...(data || []).map((h) => h.name)])).sort()));
    }
  }, [sheet, patient]);

  const needsDateAndHospital = status === "surgery_scheduled";
  const statusError =
    needsDateAndHospital && (!date || !hospital) ? 'Para "Cirurgia agendada", informe data, hora e hospital' : null;

  /** Salva no banco e executa os efeitos marcados (mensagens só com confirmação). */
  async function commit(update: Record<string, unknown>, after: PatientSnapshot, selected: Set<EffectKey>) {
    setSaving(true);
    try {
      if (typeof update.hospital === "string" && update.hospital) {
        update.hospital = await ensureHospitalRegistered(update.hospital as string, user!.id);
        after = { ...after, hospital: update.hospital as string };
      }
      const { error } = await supabase.from("patients").update(update).eq("id", patient.id);
      if (error) throw error;
      if (after.surgery_date && after.surgery_date !== (patient.surgery_date || "")) {
        await createSurgeryTasks(patient.id, after.surgery_date, patient.name, patient.procedure, user!.id);
      }
      const res = await runSaveEffects(selected, { ...after, id: patient.id }, patient.google_calendar_event_id || null);
      if (res.calendarWarning) toast.warning(`Salvo, mas ${res.calendarWarning}.`);
      else toast.success("Salvo");
      setEffects(null);
      setSheet(null);
      onChanged();
    } catch (error) {
      toast.error(describeError("Erro ao salvar", error));
    } finally {
      setSaving(false);
    }
  }

  function saveWithConfirmation(update: Record<string, unknown>, overrides: Partial<PatientSnapshot>) {
    const after = snapshotOf(patient, overrides);
    const found = detectSaveEffects(snapshotOf(patient), after);
    if (found.length > 0) {
      pendingUpdate.current = { update, after };
      setEffects(found);
    } else {
      void commit(update, after, new Set());
    }
  }

  const saveStatus = (value: string = status) => {
    if (value === "surgery_scheduled" && (!date || !hospital)) return;
    const update: Record<string, unknown> = { status: value };
    const overrides: Partial<PatientSnapshot> = { status: value };
    if (value === "surgery_scheduled") {
      const iso = new Date(date).toISOString();
      Object.assign(update, { surgery_date: iso, hospital, surgery_to_confirm: toConfirm });
      Object.assign(overrides, { surgery_date: iso, hospital, surgery_to_confirm: toConfirm });
    }
    saveWithConfirmation(update, overrides);
  };

  const saveDate = () => {
    const iso = date ? new Date(date).toISOString() : "";
    const update: Record<string, unknown> = {
      surgery_date: iso || null,
      surgery_to_confirm: iso ? toConfirm : false,
      hospital: hospital || null,
    };
    // Data num paciente autorizado → agendado
    if (iso && (patient.status === "authorized" || patient.status === "pending_scheduling")) update.status = "surgery_scheduled";
    saveWithConfirmation(update, { surgery_date: iso, surgery_to_confirm: iso ? toConfirm : false, hospital });
  };

  const saveNote = async () => {
    if (!note.trim()) return;
    setSaving(true);
    try {
      const { error } = await supabase.from("patient_notes").insert({ patient_id: patient.id, note: note.trim(), created_by: user?.id });
      if (error) throw error;
      toast.success("Nota salva");
      setSheet(null);
      onChanged();
    } catch (error) {
      toast.error(describeError("Erro ao salvar nota", error));
    } finally {
      setSaving(false);
    }
  };

  const uploadFiles = async (list: FileList | null) => {
    if (!list || list.length === 0 || !user) return;
    setSaving(true);
    try {
      for (const file of Array.from(list)) {
        const ext = file.name.split(".").pop();
        const path = `${patient.id}/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
        const { error: upErr } = await supabase.storage.from("patient-files").upload(path, file);
        if (upErr) throw upErr;
        const { error } = await supabase.from("patient_files").insert({
          patient_id: patient.id,
          file_path: path,
          file_name: file.name,
          file_type: file.type,
          file_size: file.size,
          uploaded_by: user.id,
        });
        if (error) throw error;
      }
      toast.success(list.length === 1 ? "Arquivo anexado" : `${list.length} arquivos anexados`);
      setSheet(null);
      onChanged();
    } catch (error) {
      toast.error(describeError("Erro ao anexar", error));
    } finally {
      setSaving(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  const actions = [
    { key: "status" as const, label: "Mudar status", icon: <Tag className="h-5 w-5" /> },
    { key: "date" as const, label: patient.surgery_date ? "Mudar data" : "Marcar data", icon: <CalendarClock className="h-5 w-5" /> },
    { key: "note" as const, label: "Nota", icon: <StickyNote className="h-5 w-5" /> },
    { key: "file" as const, label: "Anexar", icon: <Paperclip className="h-5 w-5" /> },
  ];

  return (
    <>
      <div className="grid grid-cols-4 gap-2">
        {actions.map((a) => (
          <button
            key={a.key}
            type="button"
            onClick={() => (a.key === "file" ? fileRef.current?.click() : setSheet(a.key))}
            className="flex flex-col items-center justify-center gap-1 min-h-16 rounded-xl bg-card text-primary text-xs font-medium active:bg-muted"
          >
            {a.icon}
            <span className="text-foreground">{a.label}</span>
          </button>
        ))}
        <input
          ref={fileRef}
          type="file"
          multiple
          accept="application/pdf,image/jpeg,image/jpg,image/png,image/gif,image/webp"
          className="hidden"
          onChange={(e) => uploadFiles(e.target.files)}
        />
      </div>

      {/* Mudar status */}
      <QuickSheet open={sheet === "status"} onOpenChange={(o) => !o && setSheet(null)} title="Mudar status" onSave={() => saveStatus()} saving={saving} canSave={!statusError && status !== patient.status}>
        <ul role="radiogroup" className="rounded-xl bg-card overflow-hidden divide-y divide-border/60">
          {STATUS_FLOW.map((s, i) => (
            <li key={s.value}>
              <button
                type="button"
                role="radio"
                aria-checked={status === s.value}
                onClick={() => {
                  setStatus(s.value);
                  // Sem dados extras: salva no toque (3 toques a partir da lista)
                  if (s.value !== "surgery_scheduled" && s.value !== patient.status) saveStatus(s.value);
                }}
                className="w-full min-h-12 flex items-center gap-3 px-4 text-left active:bg-muted"
              >
                <span className={cn("h-2.5 w-2.5 rounded-full", s.dot)} />
                <span className="flex-1 text-[16px]">
                  {i + 1}. {s.label}
                </span>
                {status === s.value && <Check className="h-5 w-5 text-primary" />}
              </button>
            </li>
          ))}
        </ul>
        {needsDateAndHospital && (
          <div className="mt-3 space-y-1">
            <p className="text-[13px] text-muted-foreground px-1">Cirurgia agendada precisa de data, hora e hospital:</p>
            <FieldGroup>
              <SurgeryDateTimeField value={date} onChange={setDate} required />
              <SelectSheetField label="Hospital" required value={hospital} onChange={setHospital} options={hospitals.map((h) => ({ value: h, label: h }))} searchable onAddOption={(v) => setHospitals((l) => [...l, v])} />
            </FieldGroup>
            {statusError && <p className="text-[13px] text-destructive px-1">{statusError}</p>}
          </div>
        )}
      </QuickSheet>

      {/* Marcar/mudar data */}
      <QuickSheet
        open={sheet === "date"}
        onOpenChange={(o) => !o && setSheet(null)}
        title={patient.surgery_date ? "Mudar data da cirurgia" : "Marcar data da cirurgia"}
        onSave={saveDate}
        saving={saving}
        canSave={date !== toLocalInput(patient.surgery_date) || hospital !== (patient.hospital || "") || toConfirm !== !!patient.surgery_to_confirm}
      >
        <FieldGroup>
          <SurgeryDateTimeField value={date} onChange={setDate} />
          <SelectSheetField label="Hospital" value={hospital} onChange={setHospital} options={hospitals.map((h) => ({ value: h, label: h }))} searchable onAddOption={(v) => setHospitals((l) => [...l, v])} />
          {date && <SwitchField label="Data a confirmar" checked={toConfirm} onChange={setToConfirm} />}
        </FieldGroup>
      </QuickSheet>

      {/* Nota */}
      <QuickSheet open={sheet === "note"} onOpenChange={(o) => !o && setSheet(null)} title="Adicionar nota" onSave={saveNote} saving={saving} canSave={!!note.trim()}>
        <AutoTextarea value={note} onChange={setNote} minRows={4} autoFocus placeholder="Escreva a nota…" />
      </QuickSheet>

      {/* Confirmação do que será enviado */}
      <SaveEffectsSheet
        open={!!effects}
        effects={effects ?? []}
        saving={saving}
        onCancel={() => setEffects(null)}
        onConfirm={(sel) => pendingUpdate.current && void commit(pendingUpdate.current.update, pendingUpdate.current.after, sel)}
      />
    </>
  );
}

/**
 * "Excluir paciente" no fim da ficha, em vermelho, com confirmação digitando o
 * nome (não dá para desfazer).
 */
export function DeletePatientCard({ patient }: { patient: QuickPatient }) {
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const matches = typed.trim().toLowerCase() === patient.name.trim().toLowerCase();

  const handleDelete = async () => {
    setDeleting(true);
    try {
      await deletePatientCompletely(patient.id, patient.google_calendar_event_id || null, patient.responsible_user_id);
      toast.success("Paciente excluído");
      navigate("/patients", { replace: true });
    } catch (error) {
      toast.error(describeError("Erro ao excluir paciente", error));
      setDeleting(false);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          setTyped("");
          setOpen(true);
        }}
        className="w-full min-h-12 rounded-xl bg-card text-destructive text-[16px] flex items-center justify-center gap-2 active:bg-muted"
      >
        <Trash2 className="h-4 w-4" />
        Excluir paciente
      </button>
      <AlertDialog open={open} onOpenChange={(o) => !deleting && setOpen(o)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir {patient.name}?</AlertDialogTitle>
            <AlertDialogDescription>
              Apaga o paciente, os arquivos, as tarefas e o histórico. <strong>Não dá para desfazer.</strong> Para confirmar, digite o nome do
              paciente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder={patient.name} className="h-11 text-base" autoCapitalize="words" />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Cancelar</AlertDialogCancel>
            <Button variant="destructive" disabled={!matches || deleting} onClick={handleDelete}>
              {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : "Excluir definitivamente"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
