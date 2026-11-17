import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Calendar, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ToConfirmBadge } from "@/components/ToConfirmBadge";
import { spDaysFromToday, spLongDate, spTime, spWeekdayDate } from "@/lib/dates";
import { procedureLabel } from "@/lib/patientOptions";
import { isIOS } from "@/lib/platform";
import { useTodayTomorrowAlerts } from "@/lib/surgeryAlerts";
import { cn } from "@/lib/utils";

interface Surgery {
  id: string;
  name: string;
  procedure: string;
  surgery_date: string;
  hospital: string | null;
  status?: string;
  surgery_to_confirm?: boolean;
  exams_checklist?: string[] | null;
  guide_validity_date?: string | null;
}
interface SurgeriesCardProps {
  surgeries: Surgery[];
  loading: boolean;
}

type GroupKey = "today" | "tomorrow" | "week" | "later";
const GROUPS: { key: GroupKey; title: string }[] = [
  { key: "today", title: "Hoje" },
  { key: "tomorrow", title: "Amanhã" },
  { key: "week", title: "Esta semana" },
  { key: "later", title: "Depois" },
];
const LATER_LIMIT = 5;

// Vermelhos com contraste AA no claro e no escuro (o vermelho padrão do tema não passa)
const URGENT_TEXT = "text-red-700 dark:text-red-400";

function groupOf(days: number): GroupKey {
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  if (days <= 7) return "week";
  return "later";
}

/**
 * Próximas cirurgias agrupadas por dia (fuso de São Paulo): HOJE · AMANHÃ ·
 * ESTA SEMANA · DEPOIS. Hoje/amanhã ganham etiqueta + hora em vermelho e
 * mostram as pendências (tocáveis) abaixo do nome.
 */
export function SurgeriesCard({ surgeries, loading }: SurgeriesCardProps) {
  const navigate = useNavigate();
  const { alerts } = useTodayTomorrowAlerts(surgeries.length);
  const now = new Date();

  const upcoming = surgeries
    .filter((s) => spDaysFromToday(s.surgery_date, now) >= 0)
    .sort((a, b) => new Date(a.surgery_date).getTime() - new Date(b.surgery_date).getTime());
  const grouped = new Map<GroupKey, Surgery[]>();
  for (const s of upcoming) {
    const key = groupOf(spDaysFromToday(s.surgery_date, now));
    grouped.set(key, [...(grouped.get(key) || []), s]);
  }
  const laterTotal = grouped.get("later")?.length ?? 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Próximas cirurgias</CardTitle>
          </div>
          {!loading && upcoming.length > 0 && <span className="text-xs text-muted-foreground">{upcoming.length}</span>}
        </div>
      </CardHeader>
      <CardContent className="pt-0 px-0">
        {loading ? (
          <div className="space-y-2 px-4 md:px-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : upcoming.length === 0 ? (
          <p className="px-4 md:px-6 py-3 text-sm text-muted-foreground">Nenhuma cirurgia agendada.</p>
        ) : (
          GROUPS.filter((g) => grouped.get(g.key)?.length).map((g) => {
            const list = grouped.get(g.key)!;
            const shown = g.key === "later" ? list.slice(0, LATER_LIMIT) : list;
            return (
              <section key={g.key} aria-label={g.title}>
                <h4 className="px-4 md:px-6 pt-3 pb-1 text-[12px] font-semibold uppercase tracking-wide text-muted-foreground">
                  {g.title}
                </h4>
                <ul className="divide-y divide-border/60">
                  {shown.map((s) => (
                    <SurgeryRow key={s.id} surgery={s} group={g.key} alerts={alerts.get(s.id) ?? []} onOpen={(path) => navigate(path)} />
                  ))}
                </ul>
                {g.key === "later" && laterTotal > LATER_LIMIT && (
                  <button
                    type="button"
                    onClick={() => navigate("/calendar")}
                    className="w-full min-h-11 border-t border-border/60 px-4 md:px-6 text-left text-[15px] text-primary active:bg-muted/60"
                  >
                    Ver agenda ({laterTotal - LATER_LIMIT} mais)
                  </button>
                )}
              </section>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}

function SurgeryRow({
  surgery,
  group,
  alerts,
  onOpen,
}: {
  surgery: Surgery;
  group: GroupKey;
  alerts: { key: string; label: string; path: string }[];
  onOpen: (path: string) => void;
}) {
  const urgent = group === "today" || group === "tomorrow";
  const meta = [procedureLabel(surgery.procedure), surgery.hospital?.replace(/^Hospital\s+/i, "")].filter(Boolean).join(" · ");

  // Sempre texto + cor (nunca só cor)
  const when =
    group === "today" ? (
      <span className="inline-flex items-center gap-1.5">
        <span className="rounded px-1.5 py-0.5 text-[11px] font-bold tracking-wide bg-red-700 text-white dark:bg-red-400 dark:text-red-950">HOJE</span>
        <span className={cn("text-[14px] font-semibold tabular-nums", URGENT_TEXT)}>{spTime(surgery.surgery_date)}</span>
      </span>
    ) : group === "tomorrow" ? (
      <span className="inline-flex items-center gap-1.5">
        <span className="rounded px-1.5 py-0.5 text-[11px] font-bold tracking-wide border border-red-700 text-red-700 dark:border-red-400 dark:text-red-400">
          AMANHÃ
        </span>
        <span className={cn("text-[14px] font-semibold tabular-nums", URGENT_TEXT)}>{spTime(surgery.surgery_date)}</span>
      </span>
    ) : group === "week" ? (
      <span className="text-[14px] text-foreground">
        {spWeekdayDate(surgery.surgery_date)}, {spTime(surgery.surgery_date)}
      </span>
    ) : (
      <span className="text-[14px] text-muted-foreground">
        {spLongDate(surgery.surgery_date)} · {spTime(surgery.surgery_date)}
      </span>
    );

  return (
    <li className="px-4 md:px-6 py-2.5">
      <button type="button" onClick={() => onOpen(`/patients/${surgery.id}/exams`)} className="w-full text-left flex items-center gap-3 min-h-11">
        <div className="flex-1 min-w-0 space-y-0.5">
          {when}
          <div className="flex items-center gap-1.5">
            <span className="font-medium text-[15px] text-foreground truncate">{surgery.name}</span>
            {!urgent && surgery.surgery_to_confirm && <ToConfirmBadge />}
          </div>
          {meta && <p className="text-[13px] text-muted-foreground truncate">{meta}</p>}
        </div>
        {isIOS && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />}
      </button>

      {/* Pendências de hoje/amanhã: tocar abre a ação correspondente */}
      {urgent && alerts.length > 0 && (
        <ul className="mt-1 space-y-0.5">
          {alerts.map((a) => (
            <li key={a.key}>
              <button
                type="button"
                onClick={() => onOpen(a.path)}
                className={cn("inline-flex items-center gap-1.5 min-h-9 text-[13px] font-medium underline-offset-2 active:underline", URGENT_TEXT)}
              >
                <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
                <span>{a.label}</span>
                <ChevronRight className="h-3.5 w-3.5" aria-hidden />
              </button>
            </li>
          ))}
        </ul>
      )}
    </li>
  );
}
