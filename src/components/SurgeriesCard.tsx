import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Calendar, ChevronRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { ToConfirmBadge } from "@/components/ToConfirmBadge";
import { shortDateTime } from "@/lib/dates";
import { getPatientIssues } from "@/lib/patientAlerts";
import { isIOS } from "@/lib/platform";
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

/**
 * Próximas cirurgias (7 dias). Cirurgia "amanhã" é normal: sem cor de alerta.
 * Laranja/vermelho só quando há problema real (autorização, exames, guia).
 */
export function SurgeriesCard({ surgeries, loading }: SurgeriesCardProps) {
  const navigate = useNavigate();

  const now = new Date();
  const limit = new Date(now);
  limit.setDate(limit.getDate() + 7);
  limit.setHours(23, 59, 59, 999);
  const upcoming = surgeries.filter((s) => new Date(s.surgery_date) <= limit);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calendar className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Próximas cirurgias</CardTitle>
          </div>
          {!loading && upcoming.length > 0 && (
            <span className="text-xs text-muted-foreground">{upcoming.length} em 7 dias</span>
          )}
        </div>
      </CardHeader>
      <CardContent className="pt-0 px-0">
        {loading ? (
          <div className="space-y-2 px-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : upcoming.length === 0 ? (
          <p className="px-6 py-3 text-sm text-muted-foreground">Nenhuma cirurgia nos próximos 7 dias.</p>
        ) : (
          <ul className="divide-y divide-border/60">
            {upcoming.map((surgery) => {
              const issues = getPatientIssues(surgery, now);
              const worst = issues.some((i) => i.severity === "danger") ? "danger" : issues.length ? "warning" : null;
              return (
                <li key={surgery.id}>
                  <button
                    onClick={() => navigate(`/patients/${surgery.id}/exams`)}
                    className="w-full text-left px-6 py-2.5 min-h-11 flex items-center gap-3 active:bg-muted/60"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-[15px] text-foreground truncate">{surgery.name}</span>
                        {surgery.surgery_to_confirm && <ToConfirmBadge />}
                      </div>
                      <p className="text-[13px] text-muted-foreground truncate capitalize">
                        {shortDateTime(surgery.surgery_date)} · {surgery.procedure}
                        {surgery.hospital ? ` · ${surgery.hospital.replace(/^Hospital\s+/i, "")}` : ""}
                      </p>
                      {worst && (
                        <p
                          className={cn(
                            "mt-0.5 flex items-center gap-1 text-xs font-medium",
                            worst === "danger" ? "text-destructive" : "text-amber-700 dark:text-amber-400"
                          )}
                        >
                          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
                          {issues.map((i) => i.label).join(" · ")}
                        </p>
                      )}
                    </div>
                    {isIOS && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />}
                  </button>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
