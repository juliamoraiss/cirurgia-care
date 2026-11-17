import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChevronRight, Clock } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { differenceInCalendarDays } from "date-fns";
import { procedureLabel } from "@/lib/patientOptions";
import { isIOS } from "@/lib/platform";
import { cn } from "@/lib/utils";

interface Patient {
  id: string;
  name: string;
  procedure: string;
  insurance: string | null;
  created_at?: string;
}
interface PendingPatientsProps {
  patients: Patient[];
  loading: boolean;
}

const VISIBLE = 5;
/** Acima disso o contador de dias fica laranja (espera longa). */
const LONG_WAIT_DAYS = 30;

/**
 * Pacientes aguardando autorização — mesmo estilo de "Próximas cirurgias":
 * nome · procedimento · "há N dias" ›, 5 itens + "Ver todos".
 */
export function PendingPatients({ patients, loading }: PendingPatientsProps) {
  const navigate = useNavigate();
  const now = new Date();
  const visible = patients.slice(0, VISIBLE);

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Clock className="h-5 w-5 shrink-0 text-muted-foreground" />
            <CardTitle className="text-base truncate">Aguardando autorização</CardTitle>
          </div>
          {!loading && patients.length > 0 && <span className="text-xs text-muted-foreground shrink-0">{patients.length}</span>}
        </div>
      </CardHeader>
      <CardContent className="pt-0 px-0">
        {loading ? (
          <div className="space-y-2 px-4 md:px-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-11 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        ) : patients.length === 0 ? (
          <p className="px-4 md:px-6 py-3 text-sm text-muted-foreground">Nenhum paciente aguardando autorização.</p>
        ) : (
          <>
            <ul className="divide-y divide-border/60">
              {visible.map((p) => {
                const days = p.created_at ? Math.max(0, differenceInCalendarDays(now, new Date(p.created_at))) : null;
                return (
                  <li key={p.id}>
                    <button
                      onClick={() => navigate(`/patients/${p.id}/exams`)}
                      className="w-full text-left px-4 md:px-6 py-2.5 min-h-11 flex items-center gap-3 active:bg-muted/60"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-[15px] text-foreground truncate">{p.name}</p>
                        <p className="text-[13px] text-muted-foreground truncate">
                          {procedureLabel(p.procedure)}
                          {days !== null && (
                            <>
                              {" · "}
                              <span className={cn(days > LONG_WAIT_DAYS && "font-medium text-amber-700 dark:text-amber-400")}>
                                {days === 0 ? "hoje" : `há ${days} ${days === 1 ? "dia" : "dias"}`}
                              </span>
                            </>
                          )}
                        </p>
                      </div>
                      {isIOS && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />}
                    </button>
                  </li>
                );
              })}
            </ul>
            {patients.length > VISIBLE && (
              <button
                type="button"
                onClick={() => navigate("/patients", { state: { filterStatus: "awaiting_authorization" } })}
                className="w-full min-h-11 border-t border-border/60 px-4 md:px-6 text-left text-[15px] text-primary active:bg-muted/60"
              >
                Ver todos ({patients.length})
              </button>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
