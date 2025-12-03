import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, AlertCircle, User, Building2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { StandardCard, CardInfo } from "@/components/StandardCard";
import { Badge } from "@/components/ui/badge";
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
export function PendingPatients({
  patients,
  loading
}: PendingPatientsProps) {
  const navigate = useNavigate();
  if (loading) {
    return <Card>
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
      </Card>;
  }
  if (patients.length === 0) {
    return <Card>
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
      </Card>;
  }
  return <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-warning" />
          <CardTitle className="text-base">Pacientes aguardando autorização</CardTitle>
        </div>
        <CardDescription>
          {patients.length} {patients.length === 1 ? 'paciente aguardando' : 'pacientes aguardando'} autorização
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {patients.map(patient => {
          const infos: CardInfo[] = [];
          if (patient.insurance) {
            infos.push({
              icon: Building2,
              label: "Convênio",
              value: patient.insurance
            });
          }
          return <StandardCard key={patient.id} title={patient.name} subtitle={patient.procedure} infos={infos} statusIcon={<AlertCircle className="h-4 w-4 text-warning" />} badge={<Badge variant="warning" className="text-[10px] px-1.5 py-0">Aguardando</Badge>} actionLabel="Ver detalhes" onAction={() => navigate(`/patients/${patient.id}/exams`)} onClick={() => navigate(`/patients/${patient.id}/exams`)} />;
        })}
        </div>
      </CardContent>
    </Card>;
}