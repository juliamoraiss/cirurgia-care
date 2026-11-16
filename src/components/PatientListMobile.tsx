import { useRef, useState, type ReactNode, type TouchEvent } from "react";
import { AlertTriangle, ChevronRight, MessageCircle, Phone } from "lucide-react";
import { ToConfirmBadge } from "@/components/ToConfirmBadge";
import { shortDateTime } from "@/lib/dates";
import { getPatientIssues } from "@/lib/patientAlerts";
import { isIOS } from "@/lib/platform";
import { createWhatsAppUrl, safeWindowOpen } from "@/lib/urlSecurity";
import { cn } from "@/lib/utils";

export interface MobilePatient {
  id: string;
  name: string;
  procedure: string;
  hospital: string | null;
  status: string;
  surgery_date: string | null;
  phone?: string | null;
  exams_checklist: string[] | null;
  guide_validity_date?: string | null;
  surgery_to_confirm?: boolean;
}

export interface PatientSection {
  key: string;
  title: string;
  patients: MobilePatient[];
}

/** Cor do pontinho de status (não compete com o nome). */
const STATUS_DOT: Record<string, { label: string; dot: string }> = {
  awaiting_consultation: { label: "Ag. consulta", dot: "bg-slate-400" },
  awaiting_authorization: { label: "Ag. autorização", dot: "bg-amber-500" },
  authorized: { label: "Autorizado", dot: "bg-emerald-500" },
  pending_scheduling: { label: "Ag. agendamento", dot: "bg-sky-500" },
  surgery_scheduled: { label: "Agendada", dot: "bg-emerald-600" },
  surgery_completed: { label: "Realizada", dot: "bg-slate-500" },
  completed: { label: "Concluído", dot: "bg-slate-500" },
  cancelled: { label: "Cancelado", dot: "bg-red-500" },
};

const SWIPE_WIDTH = 144; // 2 botões de 72px

function SwipeRow({
  patient,
  onOpen,
  openId,
  setOpenId,
}: {
  patient: MobilePatient;
  onOpen: () => void;
  openId: string | null;
  setOpenId: (id: string | null) => void;
}) {
  const phone = (patient.phone || "").replace(/\D/g, "");
  const canSwipe = phone.length >= 10;
  const isOpen = openId === patient.id;
  const [dragX, setDragX] = useState<number | null>(null);
  const start = useRef<{ x: number; y: number; base: number; horizontal: boolean | null } | null>(null);

  const offset = dragX ?? (isOpen ? -SWIPE_WIDTH : 0);

  const onTouchStart = (e: TouchEvent) => {
    if (!canSwipe) return;
    const t = e.touches[0];
    start.current = { x: t.clientX, y: t.clientY, base: isOpen ? -SWIPE_WIDTH : 0, horizontal: null };
  };
  const onTouchMove = (e: TouchEvent) => {
    const s = start.current;
    if (!s) return;
    const t = e.touches[0];
    const dx = t.clientX - s.x;
    const dy = t.clientY - s.y;
    if (s.horizontal === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
      s.horizontal = Math.abs(dx) > Math.abs(dy);
    }
    if (!s.horizontal) return;
    setDragX(Math.max(-SWIPE_WIDTH - 24, Math.min(0, s.base + dx)));
  };
  const onTouchEnd = () => {
    const s = start.current;
    start.current = null;
    if (!s?.horizontal || dragX === null) {
      setDragX(null);
      return;
    }
    setOpenId(dragX < -SWIPE_WIDTH / 2 ? patient.id : null);
    setDragX(null);
  };

  const issues = getPatientIssues(patient);
  const status = STATUS_DOT[patient.status];
  const hospital = patient.hospital?.replace(/^Hospital\s+/i, "");
  const meta = [
    patient.procedure.charAt(0).toUpperCase() + patient.procedure.slice(1),
    hospital,
    patient.surgery_date ? shortDateTime(patient.surgery_date) : null,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <div className="relative overflow-hidden">
      {/* Ações reveladas ao deslizar para a esquerda */}
      {canSwipe && (
        <div className="absolute inset-y-0 right-0 flex" aria-hidden={!isOpen}>
          <a
            href={`tel:${phone}`}
            tabIndex={isOpen ? 0 : -1}
            className="w-[72px] flex flex-col items-center justify-center gap-0.5 bg-sky-600 text-white text-xs font-medium"
            onClick={() => setOpenId(null)}
          >
            <Phone className="h-5 w-5" />
            Ligar
          </a>
          <button
            type="button"
            tabIndex={isOpen ? 0 : -1}
            className="w-[72px] flex flex-col items-center justify-center gap-0.5 bg-[#25D366] text-white text-xs font-medium"
            onClick={() => {
              setOpenId(null);
              safeWindowOpen(createWhatsAppUrl(phone, ""));
            }}
          >
            <MessageCircle className="h-5 w-5" />
            WhatsApp
          </button>
        </div>
      )}

      <button
        type="button"
        onClick={() => (isOpen ? setOpenId(null) : onOpen())}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ transform: `translateX(${offset}px)` }}
        className={cn(
          "relative w-full text-left bg-card flex items-center gap-2 pl-4 pr-3 py-2.5 min-h-[60px] active:bg-muted",
          dragX === null && "transition-transform duration-200"
        )}
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2">
            {/* Nome completo: quebra em até 2 linhas, não é cortado pelo status */}
            <span className="flex-1 min-w-0 text-[16px] font-medium leading-snug text-foreground line-clamp-2 break-words">
              {patient.name}
            </span>
            {issues.length > 0 && (
              <AlertTriangle
                className={cn(
                  "h-4 w-4 mt-0.5 shrink-0",
                  issues.some((i) => i.severity === "danger") ? "text-destructive" : "text-amber-600"
                )}
                aria-label={issues.map((i) => i.label).join(", ")}
              />
            )}
          </div>
          <p className="text-[13px] text-muted-foreground truncate mt-0.5">{meta}</p>
          <div className="mt-1 flex items-center gap-2">
            {status && (
              <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
                <span className={cn("h-2 w-2 rounded-full", status.dot)} />
                {status.label}
              </span>
            )}
            {patient.surgery_to_confirm && <ToConfirmBadge />}
          </div>
        </div>
        {isIOS && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/50" />}
      </button>
    </div>
  );
}

interface PatientListMobileProps {
  sections: PatientSection[];
  loading: boolean;
  onOpen: (id: string) => void;
  empty: ReactNode;
}

/**
 * Lista de pacientes no celular: linhas compactas (6–8 por tela), seções com
 * cabeçalho fixo ao rolar ("inset grouped" no iOS), deslizar para Ligar/WhatsApp.
 */
export function PatientListMobile({ sections, loading, onOpen, empty }: PatientListMobileProps) {
  const [openId, setOpenId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className={cn("bg-card", isIOS && "mx-4 rounded-xl overflow-hidden")}>
        {Array.from({ length: 7 }).map((_, i) => (
          <div key={i} className="px-4 py-3 border-b border-border/60 last:border-b-0 space-y-1.5">
            <div className="h-4 w-2/3 rounded bg-muted animate-pulse" />
            <div className="h-3 w-1/2 rounded bg-muted animate-pulse" />
          </div>
        ))}
      </div>
    );
  }

  const visible = sections.filter((s) => s.patients.length > 0);
  if (visible.length === 0) return <>{empty}</>;

  return (
    <div className="space-y-5">
      {visible.map((section) => (
        <section key={section.key} aria-label={section.title}>
          {/* Cabeçalho fixo da seção, logo abaixo do cabeçalho da tela */}
          <h2
            className={cn(
              "sticky z-20 flex items-center justify-between px-4 py-1.5 bg-page-background/95 backdrop-blur",
              "top-[calc(env(safe-area-inset-top)+44px)] android:top-[calc(env(safe-area-inset-top)+64px)]",
              isIOS
                ? "text-[13px] font-normal uppercase tracking-wide text-muted-foreground"
                : "text-sm font-medium text-primary"
            )}
          >
            <span>{section.title}</span>
            <span className="text-xs font-normal normal-case text-muted-foreground">{section.patients.length}</span>
          </h2>
          <div
            className={cn(
              "bg-card divide-y divide-border/60",
              isIOS ? "mx-4 rounded-xl overflow-hidden [&>*]:ml-0" : ""
            )}
          >
            {section.patients.map((p) => (
              <SwipeRow key={p.id} patient={p} onOpen={() => onOpen(p.id)} openId={openId} setOpenId={setOpenId} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
