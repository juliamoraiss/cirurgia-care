import { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Check, Copy, FileText, Link2, MessageCircle, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { useIsMobile } from "@/hooks/use-mobile";
import { useProfessionals } from "@/hooks/useProfessionals";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader, HeaderAction } from "@/components/PageHeader";
import { PatientNotesSection } from "@/components/PatientNotesSection";
import { PatientFeedbacksSection } from "@/components/PatientFeedbacksSection";
import { PatientSurgeryTimeline } from "@/components/PatientSurgeryTimeline";
import { PatientSurgeriesHistory } from "@/components/PatientSurgeriesHistory";
import { FieldGroup } from "@/components/form/FieldRow";
import {
  BirthDateField,
  ChoiceChips,
  GuideValidityField,
  PhoneField,
  SegmentedField,
  SelectSheetField,
  StatusField,
  SurgeryDateTimeField,
  SwitchField,
  TextField,
} from "@/components/form/fields";
import { DiscardChangesDialog, FormSection, ResumeDraftDialog, SaveBar, SaveEffectsSheet, type SaveState } from "@/components/form/layout";
import { DuplicateWarning, ImportWhatsAppSheet, importedHighlight, type ImportedPatientData } from "@/components/form/PatientAssist";
import { DEFAULT_RESPONSIBLE_DOCTOR_ID } from "@/lib/defaults";
import { describeError } from "@/lib/errors";
import { HOSPITAL_OPTIONS, ensureHospitalRegistered } from "@/lib/hospitals";
import { getExamsForProcedure } from "@/lib/patientAlerts";
import { createSurgeryTasks, detectSaveEffects, runSaveEffects, type EffectKey, type PatientSnapshot, type SaveEffect } from "@/lib/patientActions";
import { DEFAULT_INSURANCES, ONCOLOGY_STAGES, ORIGEM_OPTIONS, PROCEDURE_OPTIONS, type PatientStatusValue } from "@/lib/patientOptions";
import { normalizePhoneDigits, phoneError } from "@/lib/phone";
import { longDateTime } from "@/lib/dates";

// ---------------------------------------------------------------------------
// Tipos e utilitários
// ---------------------------------------------------------------------------

type FormState = {
  name: string;
  phone: string;
  birth_date: string;
  gender: string;
  procedure: string;
  hospital: string;
  insurance: string;
  status: PatientStatusValue;
  surgery_date: string; // "AAAA-MM-DDTHH:mm" local
  surgery_to_confirm: boolean;
  guide_validity_date: string;
  origem: string;
  responsible_user_id: string;
  is_oncology: boolean;
  oncology_stage: string;
};

const EMPTY_FORM: FormState = {
  name: "",
  phone: "",
  birth_date: "",
  gender: "",
  procedure: "",
  hospital: "",
  insurance: "",
  status: "awaiting_authorization",
  surgery_date: "",
  surgery_to_confirm: false,
  guide_validity_date: "",
  origem: "",
  responsible_user_id: "",
  is_oncology: false,
  oncology_stage: "",
};

type Draft = { form: FormState; checkedExams: string[]; savedAt: number };

const SECTION_IDS = ["dados", "cirurgia", "autorizacao", "exames", "notas", "feedback", "historico"] as const;
type SectionId = (typeof SECTION_IDS)[number];

/** UTC do banco → "AAAA-MM-DDTHH:mm" local. */
function toLocalInput(iso: string | null | undefined) {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "";
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

function toIso(local: string) {
  return local ? new Date(local).toISOString() : "";
}

function titleCase(name: string) {
  return name
    .split(" ")
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(" ");
}

function readDraft(key: string): Draft | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

/** Erros em linguagem simples, campo a campo. */
function validate(f: FormState, isNew: boolean, needsProfessional: boolean): Partial<Record<keyof FormState, string>> {
  const e: Partial<Record<keyof FormState, string>> = {};
  if (f.name.trim().length < 3) e.name = "Digite o nome completo";
  const pErr = phoneError(f.phone);
  if (pErr) e.phone = pErr;
  else if (isNew && !normalizePhoneDigits(f.phone)) e.phone = "Informe o telefone";
  if (!f.procedure) e.procedure = "Escolha o procedimento";
  if (needsProfessional && !f.responsible_user_id) e.responsible_user_id = "Escolha o profissional";
  if (f.status === "surgery_scheduled") {
    if (!f.surgery_date) e.surgery_date = 'Para "Cirurgia agendada", informe a data e a hora';
    if (!f.hospital) e.hospital = 'Para "Cirurgia agendada", informe o hospital';
  }
  if (f.surgery_date && f.guide_validity_date && new Date(f.surgery_date) > new Date(`${f.guide_validity_date}T23:59:59`)) {
    e.surgery_date = "A cirurgia está depois da validade da guia";
  }
  return e;
}

const FIELD_SECTION: Partial<Record<keyof FormState, SectionId>> = {
  name: "dados",
  phone: "dados",
  responsible_user_id: "dados",
  procedure: "cirurgia",
  hospital: "cirurgia",
  surgery_date: "cirurgia",
  status: "autorizacao",
};

// ---------------------------------------------------------------------------

const PatientForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const isNew = !id;
  const { isAdmin, loading: roleLoading } = useUserRole();
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const { professionals } = useProfessionals();

  const draftKey = isNew ? "patient-form-draft:new" : `patient-form-draft:${id}`;

  // "+" da Agenda: ?surgery_date=AAAA-MM-DDTHH:mm já preenche a data
  const presetDate = (() => {
    const v = searchParams.get("surgery_date") || "";
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(v) ? v : "";
  })();

  const [loadingData, setLoadingData] = useState(!isNew);
  const [form, setForm] = useState<FormState>(() => ({
    ...EMPTY_FORM,
    surgery_date: presetDate,
    status: presetDate ? "surgery_scheduled" : EMPTY_FORM.status,
  }));
  // Último estado salvo (para saber o que mudou e o que disparar ao salvar)
  const [baseline, setBaseline] = useState<FormState | null>(null);
  const [checkedExams, setCheckedExams] = useState<string[]>([]);
  const [baselineExams, setBaselineExams] = useState<string[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [existingFiles, setExistingFiles] = useState<
    { id: string; file_name: string; file_path: string; file_size: number; created_at: string }[]
  >([]);
  const [eventId, setEventId] = useState<string | null>(null);
  const [touched, setTouched] = useState<Set<string>>(new Set());
  const [submitted, setSubmitted] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [pendingEffects, setPendingEffects] = useState<SaveEffect[] | null>(null);
  const [discardOpen, setDiscardOpen] = useState(false);
  const [resumeDraft, setResumeDraft] = useState<Draft | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const [imported, setImported] = useState<Set<string>>(new Set());
  const [moreOpen, setMoreOpen] = useState(!!presetDate);
  const [hospitalNames, setHospitalNames] = useState<string[]>(HOSPITAL_OPTIONS);
  const [insurances, setInsurances] = useState<string[]>(DEFAULT_INSURANCES);
  const [commonTime, setCommonTime] = useState<string | null>(null);
  const [viewingFile, setViewingFile] = useState<{ url: string; name: string } | null>(null);
  const [schedulingLink, setSchedulingLink] = useState<string | null>(null);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [linkCopied, setLinkCopied] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Seções abertas: ?section=autorizacao (ou ?step=2 antigo → exames)
  const [openSections, setOpenSections] = useState<Set<SectionId>>(() => {
    const param = searchParams.get("section") as SectionId | null;
    if (param && SECTION_IDS.includes(param)) return new Set([param]);
    if (searchParams.get("step") === "2") return new Set<SectionId>(["exames"]);
    return new Set<SectionId>(["dados", "cirurgia", "autorizacao"]);
  });
  const toggleSection = (s: SectionId) =>
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(s)) next.delete(s);
      else next.add(s);
      return next;
    });

  // Abre a seção pedida na URL rolando até ela
  useEffect(() => {
    const param = searchParams.get("section") || (searchParams.get("step") === "2" ? "exames" : null);
    if (!param || loadingData) return;
    setTimeout(() => document.getElementById(`section-${param}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 200);
  }, [loadingData, searchParams]);

  // ------------------------------------------------------------ carregar

  const loadFiles = useCallback(async (patientId: string) => {
    const { data } = await supabase
      .from("patient_files")
      .select("id, file_name, file_path, file_size, created_at")
      .eq("patient_id", patientId)
      .order("created_at", { ascending: false });
    setExistingFiles(data || []);
  }, []);

  useEffect(() => {
    // Listas de hospitais e convênios (inclui os já usados por pacientes)
    supabase
      .from("hospitals")
      .select("name")
      .then(({ data }) => {
        const names = (data || []).map((h: { name: string }) => h.name);
        setHospitalNames((prev) => Array.from(new Set([...prev, ...names])).sort((a, b) => a.localeCompare(b)));
      });
    supabase
      .from("patients")
      .select("insurance")
      .not("insurance", "is", null)
      .then(({ data }) => {
        let custom: string[] = [];
        try {
          custom = JSON.parse(localStorage.getItem("custom_insurances") || "[]");
        } catch {
          /* ignore */
        }
        const used = (data || []).map((p: { insurance: string | null }) => p.insurance || "").filter(Boolean);
        setInsurances(Array.from(new Set([...DEFAULT_INSURANCES, ...custom, ...used])).sort((a, b) => a.localeCompare(b)));
      });
  }, []);

  useEffect(() => {
    if (isNew) {
      setBaseline(form);
      const draft = readDraft(draftKey);
      if (draft && JSON.stringify(draft.form) !== JSON.stringify(form)) setResumeDraft(draft);
      return;
    }
    (async () => {
      try {
        const { data, error } = await supabase.from("patients").select("*").eq("id", id!).single();
        if (error) throw error;
        const loaded: FormState = {
          name: data.name || "",
          phone: data.phone || "",
          birth_date: data.birth_date || "",
          gender: data.gender || "",
          procedure: data.procedure || "",
          hospital: data.hospital || "",
          insurance: data.insurance || "",
          status: (data.status as PatientStatusValue) || "awaiting_authorization",
          surgery_date: toLocalInput(data.surgery_date),
          surgery_to_confirm: !!data.surgery_to_confirm,
          guide_validity_date: data.guide_validity_date || "",
          origem: data.origem || "",
          responsible_user_id: data.responsible_user_id || "",
          is_oncology: !!data.is_oncology,
          oncology_stage: data.oncology_stage || "",
        };
        setForm(loaded);
        setBaseline(loaded);
        setCheckedExams(data.exams_checklist || []);
        setBaselineExams(data.exams_checklist || []);
        setEventId(data.google_calendar_event_id || null);
        await loadFiles(id!);

        // Rascunho mais novo que a última atualização do paciente → perguntar
        const draft = readDraft(draftKey);
        const updatedAt = new Date(data.updated_at || data.created_at).getTime();
        if (draft && draft.savedAt > updatedAt && JSON.stringify(draft.form) !== JSON.stringify(loaded)) {
          setResumeDraft(draft);
        } else if (draft) {
          localStorage.removeItem(draftKey);
        }
      } catch (error) {
        toast.error(describeError("Erro ao carregar dados do paciente", error));
        navigate("/patients");
      } finally {
        setLoadingData(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Profissional padrão para paciente novo
  useEffect(() => {
    if (!isNew || !user || roleLoading) return;
    const def = isAdmin ? DEFAULT_RESPONSIBLE_DOCTOR_ID : user.id;
    setForm((f) => (f.responsible_user_id ? f : { ...f, responsible_user_id: def }));
    setBaseline((b) => (b && !b.responsible_user_id ? { ...b, responsible_user_id: def } : b));
  }, [isNew, isAdmin, user, roleLoading]);

  // ------------------------------------------------------------ estado derivado

  const dirty =
    !!baseline &&
    (JSON.stringify(form) !== JSON.stringify(baseline) ||
      JSON.stringify([...checkedExams].sort()) !== JSON.stringify([...baselineExams].sort()) ||
      files.length > 0);

  const errors = validate(form, isNew, isNew && isAdmin);
  const visibleError = (field: keyof FormState) => (submitted || touched.has(field) ? errors[field] ?? null : null);

  const examsChecklist = getExamsForProcedure(form.procedure);

  // Rascunho automático (sobrevive a fechar o app ou cair a internet)
  useEffect(() => {
    if (!baseline || loadingData || resumeDraft) return;
    if (!dirty) {
      localStorage.removeItem(draftKey);
      return;
    }
    const t = setTimeout(() => {
      try {
        localStorage.setItem(draftKey, JSON.stringify({ form, checkedExams, savedAt: Date.now() } satisfies Draft));
      } catch {
        /* ignore */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [form, checkedExams, dirty, baseline, loadingData, resumeDraft, draftKey]);

  // Avisa o navegador ao fechar a aba com alterações
  useEffect(() => {
    if (!dirty) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  // Sugestão: horário mais comum no hospital escolhido
  useEffect(() => {
    if (!form.hospital) {
      setCommonTime(null);
      return;
    }
    let cancelled = false;
    supabase
      .from("patients")
      .select("surgery_date")
      .eq("hospital", form.hospital)
      .not("surgery_date", "is", null)
      .limit(200)
      .then(({ data }) => {
        if (cancelled) return;
        const counts = new Map<string, number>();
        for (const r of data || []) {
          const t = toLocalInput(r.surgery_date).slice(11, 16);
          if (t) counts.set(t, (counts.get(t) || 0) + 1);
        }
        const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
        setCommonTime(best && best[1] >= 2 ? best[0] : null);
      });
    return () => {
      cancelled = true;
    };
  }, [form.hospital]);

  // ------------------------------------------------------------ edição

  const set = <K extends keyof FormState>(field: K, value: FormState[K]) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "name") next.name = titleCase(value as string);
      if (field === "surgery_date" && !value) {
        next.surgery_to_confirm = false;
        if (prev.status === "surgery_scheduled" || prev.status === "pending_scheduling") next.status = "authorized";
      }
      // Marcar data num paciente autorizado já o coloca como agendado
      if (field === "surgery_date" && value && !prev.surgery_date && (prev.status === "authorized" || prev.status === "pending_scheduling")) {
        next.status = "surgery_scheduled";
      }
      return next;
    });
    setTouched((t) => new Set(t).add(field));
    if (field === "procedure" && value !== baseline?.procedure) setCheckedExams([]);
  };

  const applyImport = (data: ImportedPatientData) => {
    const keys = new Set<string>();
    setForm((prev) => {
      const next = { ...prev };
      (Object.keys(data) as (keyof ImportedPatientData)[]).forEach((k) => {
        const v = data[k];
        if (!v) return;
        keys.add(k);
        (next as Record<string, unknown>)[k] = k === "name" ? titleCase(v) : v;
      });
      if (data.surgery_date && (next.status === "awaiting_authorization" || next.status === "authorized")) next.status = "surgery_scheduled";
      return next;
    });
    if (data.insurance && !insurances.includes(data.insurance)) setInsurances((l) => [...l, data.insurance!].sort());
    if (data.hospital && !hospitalNames.includes(data.hospital)) setHospitalNames((l) => [...l, data.hospital!].sort());
    setImported(keys);
    if (["birth_date", "insurance", "hospital", "surgery_date"].some((k) => keys.has(k))) setMoreOpen(true);
  };

  const addInsurance = (v: string) => {
    setInsurances((l) => Array.from(new Set([...l, v])).sort((a, b) => a.localeCompare(b)));
    try {
      const custom: string[] = JSON.parse(localStorage.getItem("custom_insurances") || "[]");
      localStorage.setItem("custom_insurances", JSON.stringify(Array.from(new Set([...custom, v]))));
    } catch {
      /* ignore */
    }
  };

  // Campo focado nunca fica atrás do teclado
  const handleFocusCapture = (e: React.FocusEvent<HTMLDivElement>) => {
    if (!isMobile) return;
    const target = e.target as HTMLElement;
    if (!/INPUT|TEXTAREA/.test(target.tagName)) return;
    setTimeout(() => target.scrollIntoView({ block: "center", behavior: "smooth" }), 300);
  };

  // ------------------------------------------------------------ arquivos

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = Array.from(e.target.files || []);
    const allowed = ["application/pdf", "image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
    const valid = selected.filter((f) => allowed.includes(f.type));
    if (valid.length !== selected.length) toast.error("Apenas PDF e imagens (JPEG, PNG, GIF, WEBP)");
    setFiles((prev) => [...prev, ...valid]);
    e.target.value = "";
  };

  const uploadFiles = async (patientId: string) => {
    for (const file of files) {
      const ext = file.name.split(".").pop();
      const path = `${patientId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;
      const { error: upErr } = await supabase.storage.from("patient-files").upload(path, file);
      if (upErr) throw upErr;
      const { error: dbErr } = await supabase.from("patient_files").insert({
        patient_id: patientId,
        file_path: path,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        uploaded_by: user!.id,
      });
      if (dbErr) throw dbErr;
    }
    setFiles([]);
    await loadFiles(patientId);
  };

  const viewFile = async (path: string, name: string) => {
    const { data, error } = await supabase.storage.from("patient-files").createSignedUrl(path, 3600);
    if (error) toast.error(describeError("Erro ao carregar arquivo", error));
    else if (data?.signedUrl) setViewingFile({ url: data.signedUrl, name });
  };

  const deleteFile = async (fileId: string, path: string) => {
    try {
      const { error: sErr } = await supabase.storage.from("patient-files").remove([path]);
      if (sErr) throw sErr;
      const { error } = await supabase.from("patient_files").delete().eq("id", fileId);
      if (error) throw error;
      setExistingFiles((prev) => prev.filter((f) => f.id !== fileId));
      toast.success("Arquivo removido");
    } catch (error) {
      toast.error(describeError("Erro ao remover arquivo", error));
    }
  };

  // ------------------------------------------------------------ link de agendamento

  const generateSchedulingLink = async () => {
    if (!id || !user) return;
    setGeneratingLink(true);
    try {
      const expires = new Date();
      expires.setDate(expires.getDate() + 7);
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
      const token = Array.from(crypto.getRandomValues(new Uint8Array(8)))
        .map((b) => chars[b % chars.length])
        .join("");
      const { error } = await supabase.from("scheduling_links").insert({
        patient_id: id,
        doctor_id: form.responsible_user_id || user.id,
        expires_at: expires.toISOString(),
        token,
      });
      if (error) throw error;
      setSchedulingLink(`${window.location.origin}/agendar/${token}`);
      toast.success("Link de agendamento gerado");
    } catch (error) {
      toast.error(describeError("Erro ao gerar link de agendamento", error));
    } finally {
      setGeneratingLink(false);
    }
  };

  // ------------------------------------------------------------ salvar

  const snapshot = (f: FormState, patientId?: string): PatientSnapshot => ({
    id: patientId,
    name: f.name,
    phone: f.phone,
    procedure: f.procedure,
    hospital: f.hospital,
    surgery_date: toIso(f.surgery_date),
    surgery_to_confirm: f.surgery_to_confirm,
    status: f.status,
    responsible_user_id: f.responsible_user_id || null,
    is_oncology: f.is_oncology,
    oncology_stage: f.oncology_stage,
  });

  const handleSave = () => {
    setSubmitted(true);
    const fields = Object.keys(errors) as (keyof FormState)[];
    if (fields.length > 0) {
      const section = FIELD_SECTION[fields[0]];
      if (section) {
        setOpenSections((s) => new Set(s).add(section));
        if (isNew && section !== "dados" && fields[0] !== "procedure") setMoreOpen(true);
      }
      setTimeout(() => document.querySelector('[aria-invalid="true"]')?.scrollIntoView({ block: "center", behavior: "smooth" }), 100);
      toast.error("Confira os campos marcados");
      return;
    }
    // Mudança que dispara algo (mensagem, Google Agenda) → confirmar antes
    const effects = detectSaveEffects(isNew || !baseline ? null : snapshot(baseline), snapshot(form));
    if (effects.length > 0) setPendingEffects(effects);
    else void doSave(new Set());
  };

  const doSave = async (selected: Set<EffectKey>) => {
    if (!user) return;
    setSaveState("saving");
    try {
      const hospitalFinal = form.hospital ? await ensureHospitalRegistered(form.hospital, user.id) : "";
      const surgeryIso = toIso(form.surgery_date) || null;
      const payload = {
        name: form.name.trim(),
        phone: form.phone || null,
        birth_date: form.birth_date || null,
        gender: form.gender || null,
        procedure: form.procedure,
        hospital: hospitalFinal || null,
        insurance: form.insurance || null,
        status: form.status,
        surgery_date: surgeryIso,
        surgery_to_confirm: surgeryIso ? form.surgery_to_confirm : false,
        exams_checklist: checkedExams,
        guide_validity_date: form.guide_validity_date || null,
        origem: form.origem || null,
        responsible_user_id: form.responsible_user_id || (isAdmin ? DEFAULT_RESPONSIBLE_DOCTOR_ID : user.id),
        is_oncology: form.is_oncology,
        oncology_stage: form.is_oncology ? form.oncology_stage || null : null,
      };

      let patientId = id;
      if (isNew) {
        const { data, error } = await supabase
          .from("patients")
          .insert([{ ...payload, created_by: user.id }])
          .select("id")
          .single();
        if (error) throw error;
        patientId = data.id;
      } else {
        const { error } = await supabase.from("patients").update(payload).eq("id", id!);
        if (error) throw error;
      }

      if (files.length > 0) await uploadFiles(patientId!);

      const dateChanged = surgeryIso && surgeryIso !== toIso(baseline?.surgery_date || "");
      if (dateChanged) await createSurgeryTasks(patientId!, surgeryIso!, payload.name, payload.procedure, user.id);

      // Só faz o que a usuária confirmou na folha
      const res = await runSaveEffects(selected, { ...snapshot({ ...form, hospital: hospitalFinal }), id: patientId! }, eventId);
      if (res.calendarWarning) toast.warning(`Salvo, mas ${res.calendarWarning}.`);

      localStorage.removeItem(draftKey);
      setPendingEffects(null);
      const saved = { ...form, hospital: hospitalFinal };
      setForm(saved);
      setBaseline(saved);
      setBaselineExams(checkedExams);
      setSubmitted(false);
      setTouched(new Set());
      setImported(new Set());
      setSaveState("saved");

      if (isNew) {
        toast.success("Paciente criado");
        navigate(`/patients/${patientId}/exams`, { replace: true });
      } else {
        toast.success("Alterações salvas");
        const { data } = await supabase.from("patients").select("google_calendar_event_id").eq("id", patientId!).single();
        setEventId(data?.google_calendar_event_id || null);
      }
    } catch (error) {
      setSaveState("idle");
      setPendingEffects(null);
      toast.error(describeError(isNew ? "Erro ao criar paciente" : "Erro ao salvar", error));
    }
  };

  // ------------------------------------------------------------ sair

  const leave = () => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate(isNew ? "/patients" : `/patients/${id}/exams`, { replace: true });
  };
  const handleBack = () => (dirty ? setDiscardOpen(true) : leave());

  // ------------------------------------------------------------ render

  if (loadingData || roleLoading) {
    return (
      <>
        <PageHeader title={isNew ? "Novo paciente" : "Editar paciente"} largeTitle={false} back={{ label: "Voltar", onClick: leave }} />
        <div className="px-4 space-y-3 pt-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 rounded-lg bg-muted animate-pulse" />
          ))}
        </div>
      </>
    );
  }

  if (!isAdmin) {
    return (
      <div className="p-6 text-center text-muted-foreground">
        Apenas administradores podem criar ou editar pacientes.
        <div className="mt-4">
          <Button onClick={() => navigate("/patients")}>Voltar para Pacientes</Button>
        </div>
      </div>
    );
  }

  const professionalOptions = professionals.map((p) => ({ value: p.id, label: p.full_name }));

  // Blocos de campos reaproveitados entre "Novo" e "Editar"
  const personalFields = (
    <>
      <TextField
        label="Nome"
        required
        value={form.name}
        onChange={(v) => set("name", v)}
        error={visibleError("name")}
        autoCapitalize="words"
        autoComplete="off"
        placeholder="Nome completo"
        className={importedHighlight(imported.has("name"))}
      />
      <div className={importedHighlight(imported.has("phone"))}>
        <PhoneField value={form.phone} onChange={(v) => set("phone", v)} required={isNew} error={visibleError("phone")} />
      </div>
    </>
  );

  const extraPersonalFields = (
    <>
      <div className={importedHighlight(imported.has("birth_date"))}>
        <BirthDateField value={form.birth_date} onChange={(v) => set("birth_date", v)} />
      </div>
      <SegmentedField
        label="Gênero"
        value={form.gender}
        onChange={(v) => set("gender", v)}
        options={[
          { value: "feminino", label: "Feminino" },
          { value: "masculino", label: "Masculino" },
        ]}
      />
      <SelectSheetField
        label="Origem"
        value={form.origem}
        onChange={(v) => set("origem", v)}
        options={ORIGEM_OPTIONS.map((o) => ({ value: o, label: o }))}
        placeholder="Não informada"
      />
    </>
  );

  const professionalField = (
    <SelectSheetField
      label="Profissional"
      required
      value={form.responsible_user_id}
      onChange={(v) => set("responsible_user_id", v)}
      options={professionalOptions}
      error={visibleError("responsible_user_id")}
    />
  );

  const procedureField = (
    <div className={importedHighlight(imported.has("procedure"))}>
      <ChoiceChips
        label="Procedimento"
        required
        options={PROCEDURE_OPTIONS}
        value={form.procedure}
        onChange={(v) => set("procedure", v)}
        error={visibleError("procedure")}
        hint={examsChecklist.length > 0 ? `Exames sugeridos: ${examsChecklist.join(", ")}` : undefined}
      />
    </div>
  );

  const surgeryFields = (
    <>
      <div className={importedHighlight(imported.has("hospital"))}>
        <SelectSheetField
          label="Hospital"
          value={form.hospital}
          onChange={(v) => set("hospital", v)}
          options={hospitalNames.map((h) => ({ value: h, label: h }))}
          placeholder="Escolher"
          searchable
          onAddOption={(v) => setHospitalNames((l) => Array.from(new Set([...l, v])).sort())}
          error={visibleError("hospital")}
        />
      </div>
      <div className={importedHighlight(imported.has("surgery_date"))}>
        <SurgeryDateTimeField
          value={form.surgery_date}
          onChange={(v) => set("surgery_date", v)}
          error={visibleError("surgery_date")}
          required={form.status === "surgery_scheduled"}
        />
        {commonTime && form.surgery_date && form.surgery_date.slice(11, 16) !== commonTime && (
          <p className="px-4 md:px-0 -mt-1 pb-2 text-[13px] text-muted-foreground">
            Horário mais comum em {form.hospital.replace(/^Hospital\s+/i, "")}: {commonTime}.{" "}
            <button type="button" className="text-primary min-h-9" onClick={() => set("surgery_date", `${form.surgery_date.slice(0, 10)}T${commonTime}`)}>
              Usar
            </button>
          </p>
        )}
      </div>
      {form.surgery_date && (
        <SwitchField
          label="Data a confirmar"
          checked={form.surgery_to_confirm}
          onChange={(v) => set("surgery_to_confirm", v)}
          hint="Data proposta, ainda aguardando hospital ou paciente"
        />
      )}
      <SwitchField label="Paciente oncológico" checked={form.is_oncology} onChange={(v) => set("is_oncology", v)} />
      {form.is_oncology && (
        <SelectSheetField
          label="Estágio"
          value={form.oncology_stage}
          onChange={(v) => set("oncology_stage", v)}
          options={ONCOLOGY_STAGES}
          placeholder="Não informado"
        />
      )}
    </>
  );

  const authorizationFields = (
    <>
      <StatusField value={form.status} onChange={(v) => set("status", v as PatientStatusValue)} error={visibleError("status")} />
      <div className={importedHighlight(imported.has("insurance"))}>
        <SelectSheetField
          label="Convênio"
          value={form.insurance}
          onChange={(v) => set("insurance", v)}
          options={insurances.map((i) => ({ value: i, label: i }))}
          placeholder="Escolher"
          searchable
          onAddOption={addInsurance}
        />
      </div>
      <GuideValidityField value={form.guide_validity_date} onChange={(v) => set("guide_validity_date", v)} />
    </>
  );

  const examsBlock = (
    <div className="space-y-3 px-4 md:px-0">
      {examsChecklist.length > 0 && (
        <div className="rounded-lg bg-card p-3 space-y-1">
          <p className="text-sm font-medium">Checklist de exames</p>
          {examsChecklist.map((exam) => (
            <label key={exam} className="flex items-center gap-3 min-h-11 cursor-pointer">
              <Checkbox
                checked={checkedExams.includes(exam)}
                onCheckedChange={() => setCheckedExams((prev) => (prev.includes(exam) ? prev.filter((e) => e !== exam) : [...prev, exam]))}
                className="h-5 w-5"
              />
              <span className="text-[15px]">{exam}</span>
            </label>
          ))}
        </div>
      )}
      <div className="rounded-lg bg-card p-3 space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Arquivos</p>
          <Button type="button" variant="outline" size="sm" className="h-10" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-4 w-4 mr-1.5" />
            Anexar
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="application/pdf,image/jpeg,image/jpg,image/png,image/gif,image/webp"
            multiple
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>
        {existingFiles.length === 0 && files.length === 0 && <p className="text-sm text-muted-foreground">Nenhum arquivo enviado</p>}
        {existingFiles.map((f) => (
          <div key={f.id} className="flex items-center gap-2 min-h-11">
            <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
            <button type="button" className="flex-1 min-w-0 text-left text-sm truncate" onClick={() => viewFile(f.file_path, f.file_name)}>
              {f.file_name}
            </button>
            <button
              type="button"
              aria-label={`Remover ${f.file_name}`}
              className="h-11 w-11 flex items-center justify-center text-destructive"
              onClick={() => deleteFile(f.id, f.file_path)}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        ))}
        {files.map((f, i) => (
          <div key={`${f.name}-${i}`} className="flex items-center gap-2 min-h-11 text-sm">
            <Upload className="h-4 w-4 shrink-0 text-primary" />
            <span className="flex-1 truncate">{f.name}</span>
            <span className="text-xs text-muted-foreground">será enviado ao salvar</span>
            <button
              type="button"
              aria-label={`Tirar ${f.name}`}
              className="h-11 w-11 flex items-center justify-center"
              onClick={() => setFiles((p) => p.filter((_, j) => j !== i))}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  const schedulingBlock =
    !isNew && !form.surgery_date && (form.status === "pending_scheduling" || form.status === "authorized") ? (
      <div className="px-4 md:px-0 py-2 space-y-2">
        {!schedulingLink ? (
          <Button type="button" variant="outline" className="w-full h-11" disabled={generatingLink} onClick={generateSchedulingLink}>
            <Link2 className="h-4 w-4 mr-2" />
            {generatingLink ? "Gerando…" : "Gerar link para o paciente escolher a data"}
          </Button>
        ) : (
          <div className="flex gap-2">
            <Input value={schedulingLink} readOnly className="h-11 text-sm" />
            <Button
              type="button"
              variant="outline"
              className="h-11 w-11 p-0"
              aria-label="Copiar link"
              onClick={async () => {
                await navigator.clipboard.writeText(schedulingLink);
                setLinkCopied(true);
                setTimeout(() => setLinkCopied(false), 2000);
              }}
            >
              {linkCopied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
            </Button>
          </div>
        )}
      </div>
    ) : null;

  return (
    <>
      <PageHeader
        title={isNew ? "Novo paciente" : "Editar paciente"}
        largeTitle={false}
        back={{ label: isNew ? "Cancelar" : "Voltar", onClick: handleBack }}
        actions={
          isNew ? (
            <HeaderAction icon={<MessageCircle className="h-5 w-5" />} label="Importar do WhatsApp" onClick={() => setImportOpen(true)} />
          ) : undefined
        }
      />

      <div data-form-root onFocusCapture={handleFocusCapture} className="max-w-3xl mx-auto pt-2 md:p-6 space-y-5">
        {/* Computador: título e botão de importar */}
        <div className="hidden md:flex items-center justify-between">
          <h1 className="text-2xl font-bold text-foreground">{isNew ? "Novo paciente" : `Editar ${baseline?.name ?? "paciente"}`}</h1>
          {isNew && (
            <Button variant="outline" onClick={() => setImportOpen(true)}>
              <MessageCircle className="h-4 w-4 mr-2 text-[#25D366]" />
              Importar do WhatsApp
            </Button>
          )}
        </div>

        {isNew ? (
          <>
            {/* Mínimo obrigatório no topo */}
            <div className="px-4 md:px-0">
              <FieldGroup>
                {personalFields}
                {isAdmin && professionalField}
              </FieldGroup>
            </div>
            <div className="px-4 md:px-0">
              <FieldGroup className="md:block">{procedureField}</FieldGroup>
            </div>
            <DuplicateWarning name={form.name} phone={form.phone} />

            <FormSection
              id="mais"
              title="Mais detalhes"
              open={moreOpen}
              onToggle={() => setMoreOpen((o) => !o)}
              summary="Nascimento, convênio, hospital, data da cirurgia… (pode completar depois)"
            >
              <div className="space-y-4 px-4 md:px-0">
                <FieldGroup>{extraPersonalFields}</FieldGroup>
                <FieldGroup>{authorizationFields}</FieldGroup>
                <FieldGroup>{surgeryFields}</FieldGroup>
              </div>
            </FormSection>
          </>
        ) : (
          <>
            <DuplicateWarning name={form.name} phone={form.phone} excludeId={id} />

            <FormSection
              id="dados"
              title="Dados pessoais"
              open={openSections.has("dados")}
              onToggle={() => toggleSection("dados")}
              summary={[form.name, form.phone].filter(Boolean).join(" · ")}
              alert={!!(visibleError("name") || visibleError("phone"))}
            >
              <div className="px-4 md:px-0">
                <FieldGroup>
                  {personalFields}
                  {extraPersonalFields}
                  {professionalField}
                </FieldGroup>
              </div>
            </FormSection>

            <FormSection
              id="cirurgia"
              title="Cirurgia"
              open={openSections.has("cirurgia")}
              onToggle={() => toggleSection("cirurgia")}
              summary={[
                PROCEDURE_OPTIONS.find((p) => p.value === form.procedure)?.label ?? form.procedure,
                form.surgery_date ? longDateTime(new Date(form.surgery_date)) : "sem data",
              ].join(" · ")}
              alert={!!(visibleError("procedure") || visibleError("surgery_date") || visibleError("hospital"))}
            >
              <div className="space-y-3 px-4 md:px-0">
                <FieldGroup className="md:block">{procedureField}</FieldGroup>
                <FieldGroup>{surgeryFields}</FieldGroup>
              </div>
              {schedulingBlock}
            </FormSection>

            <FormSection
              id="autorizacao"
              title="Autorização e guia"
              open={openSections.has("autorizacao")}
              onToggle={() => toggleSection("autorizacao")}
              summary={[
                form.insurance || "Sem convênio",
                form.guide_validity_date ? `guia até ${form.guide_validity_date.split("-").reverse().join("/")}` : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            >
              <div className="px-4 md:px-0">
                <FieldGroup>{authorizationFields}</FieldGroup>
              </div>
            </FormSection>

            <FormSection
              id="exames"
              title="Exames e arquivos"
              open={openSections.has("exames")}
              onToggle={() => toggleSection("exames")}
              summary={`${checkedExams.length}/${examsChecklist.length} exames · ${existingFiles.length} arquivo(s)`}
            >
              {examsBlock}
            </FormSection>

            <FormSection id="notas" title="Notas" open={openSections.has("notas")} onToggle={() => toggleSection("notas")}>
              <div className="px-4 md:px-0">
                <PatientNotesSection patientId={id!} />
              </div>
            </FormSection>

            <FormSection id="feedback" title="Feedback" open={openSections.has("feedback")} onToggle={() => toggleSection("feedback")}>
              <div className="px-4 md:px-0">
                <PatientFeedbacksSection patientId={id!} />
              </div>
            </FormSection>

            <FormSection id="historico" title="Histórico" open={openSections.has("historico")} onToggle={() => toggleSection("historico")}>
              <div className="px-4 md:px-0 space-y-4">
                <PatientSurgeryTimeline
                  patientId={id!}
                  currentProcedure={form.procedure}
                  currentHospital={form.hospital}
                  currentSurgeryDate={toIso(form.surgery_date) || null}
                  currentStatus={form.status}
                />
                <PatientSurgeriesHistory
                  patientId={id!}
                  patientStatus={form.status}
                  currentProcedure={form.procedure}
                  currentHospital={form.hospital}
                  currentSurgeryDate={toIso(form.surgery_date) || null}
                  currentResponsibleUserId={form.responsible_user_id}
                  canManage={isAdmin}
                  onArchived={() => window.location.reload()}
                />
              </div>
            </FormSection>
          </>
        )}

        <div className="px-4 md:px-0">
          <SaveBar label={isNew ? "Criar paciente" : "Salvar"} dirty={dirty} state={saveState} onSave={handleSave} />
        </div>
      </div>

      <SaveEffectsSheet
        open={!!pendingEffects}
        effects={pendingEffects ?? []}
        saving={saveState === "saving"}
        onCancel={() => setPendingEffects(null)}
        onConfirm={(sel) => void doSave(sel)}
      />

      <DiscardChangesDialog
        open={discardOpen}
        onOpenChange={setDiscardOpen}
        onDiscard={() => {
          localStorage.removeItem(draftKey);
          setDiscardOpen(false);
          leave();
        }}
      />

      <ResumeDraftDialog
        open={!!resumeDraft}
        savedAt={resumeDraft?.savedAt}
        onResume={() => {
          if (resumeDraft) {
            setForm(resumeDraft.form);
            setCheckedExams(resumeDraft.checkedExams || []);
          }
          setResumeDraft(null);
        }}
        onDiscard={() => {
          localStorage.removeItem(draftKey);
          setResumeDraft(null);
        }}
      />

      {isNew && <ImportWhatsAppSheet open={importOpen} onOpenChange={setImportOpen} onImported={applyImport} />}

      <Dialog open={!!viewingFile} onOpenChange={() => setViewingFile(null)}>
        <DialogContent className="max-w-5xl max-h-[95vh] h-[95vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-4">
            <DialogTitle>{viewingFile?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 px-6 pb-6 overflow-hidden">
            {viewingFile && <iframe src={viewingFile.url} className="w-full h-full border-0 rounded-lg" title={viewingFile.name} />}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PatientForm;
