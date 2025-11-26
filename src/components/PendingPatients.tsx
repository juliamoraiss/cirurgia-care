import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";

interface Patient {
  id: string;
  name: string;
  procedure: string;
  insurance: string | null;
}

interface PendingPatientsProps {
  patients: Patient[];
  loading: boolean;
}

export function PendingPatients({ patients, loading }: PendingPatientsProps) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-warning" />
            <CardTitle>Pacientes com Pendências</CardTitle>
          </div>
          <CardDescription>Aguardando autorização do convênio</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (patients.length === 0) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-warning" />
            <CardTitle>Pacientes com Pendências</CardTitle>
          </div>
          <CardDescription>Aguardando autorização do convênio</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4 opacity-50" />
            <p className="text-muted-foreground text-sm">Nenhum paciente com pendência</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-warning" />
          <CardTitle>Pacientes com Pendências</CardTitle>
        </div>
        <CardDescription>
          {patients.length} {patients.length === 1 ? 'paciente aguardando' : 'pacientes aguardando'} autorização
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-2.5">
          {patients.map((patient) => (
            <div
              key={patient.id}
              onClick={() => navigate(`/patients/${patient.id}/exams`)}
              className="p-3 rounded-lg border bg-card hover:bg-accent/50 transition-colors cursor-pointer"
            >
              <div className="flex items-start gap-2 mb-1.5">
                <AlertCircle className="h-4 w-4 text-warning flex-shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <h4 className="font-semibold text-sm text-foreground line-clamp-1">{patient.name}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">{patient.procedure}</p>
                  {patient.insurance && (
                    <p className="text-[10px] text-muted-foreground mt-0.5 truncate">
                      Convênio: {patient.insurance}
                    </p>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
