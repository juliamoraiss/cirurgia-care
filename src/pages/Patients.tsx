import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, ArrowUpDown, ArrowUp, ArrowDown } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Patient {
  id: string;
  name: string;
  procedure: string;
  hospital: string | null;
  status: string;
  surgery_date: string | null;
  created_at: string;
  exams_checklist: string[] | null;
}

const getExamsForProcedure = (procedure: string): string[] => {
  const examsMap: Record<string, string[]> = {
    simpatectomia: ["Risco Cirúrgico Cardiológico"],
    lobectomia: [
      "PET - CT",
      "Risco cardiológico",
      "Risco Pneumologico",
      "Ressonância Magnética de Crânio",
      "Resultado de biopsia",
      "Última tomografia do tórax (opcional)"
    ],
    rinoplastia: [],
    broncoscopia: ["Risco cardiológico (opcional)"]
  };
  return examsMap[procedure] || [];
};

const Patients = () => {
  const navigate = useNavigate();
  const { canEdit } = useUserRole();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [sortColumn, setSortColumn] = useState<"name" | "procedure" | "surgery_date" | "created_at">("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    fetchPatients();

    // Subscribe to realtime changes
    const channel = supabase
      .channel('patients-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'patients'
        },
        () => {
          fetchPatients();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  async function fetchPatients() {
    try {
      const { data, error } = await supabase
        .from("patients")
        .select("id, name, procedure, hospital, status, surgery_date, created_at, exams_checklist")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPatients(data || []);
    } catch (error) {
      toast.error("Erro ao carregar pacientes");
    } finally {
      setLoading(false);
    }
  }

  const handleSort = (column: "name" | "procedure" | "surgery_date" | "created_at") => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (column: "name" | "procedure" | "surgery_date" | "created_at") => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="h-4 w-4 ml-1 inline" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="h-4 w-4 ml-1 inline" />
    ) : (
      <ArrowDown className="h-4 w-4 ml-1 inline" />
    );
  };

  const filteredPatients = patients
    .filter((patient) =>
      patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      patient.procedure.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (patient.hospital && patient.hospital.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    .sort((a, b) => {
      let compareValue = 0;
      
      switch (sortColumn) {
        case "name":
          compareValue = a.name.localeCompare(b.name);
          break;
        case "procedure":
          compareValue = a.procedure.localeCompare(b.procedure);
          break;
        case "surgery_date":
          const dateA = a.surgery_date ? new Date(a.surgery_date).getTime() : 0;
          const dateB = b.surgery_date ? new Date(b.surgery_date).getTime() : 0;
          compareValue = dateA - dateB;
          break;
        case "created_at":
          compareValue = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
      }
      
      return sortDirection === "asc" ? compareValue : -compareValue;
    });

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Pacientes</h1>
          <p className="text-muted-foreground">
            Gerencie todos os pacientes e procedimentos
          </p>
        </div>
        {canEdit && (
          <Button onClick={() => navigate("/patients/new")}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Paciente
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center space-x-2">
            <Search className="h-5 w-5 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, procedimento ou hospital..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="max-w-sm"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando pacientes...
            </div>
          ) : filteredPatients.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {searchTerm ? "Nenhum paciente encontrado" : "Nenhum paciente cadastrado"}
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort("name")}
                    >
                      Nome{getSortIcon("name")}
                    </TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort("procedure")}
                    >
                      Procedimento{getSortIcon("procedure")}
                    </TableHead>
                    <TableHead>Hospital</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Exames</TableHead>
                    <TableHead 
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => handleSort("surgery_date")}
                    >
                      Data da Cirurgia{getSortIcon("surgery_date")}
                    </TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredPatients.map((patient) => (
                    <TableRow
                      key={patient.id}
                      className="cursor-pointer hover:bg-muted/50"
                      onClick={() => navigate(`/patients/${patient.id}`)}
                    >
                      <TableCell className="font-medium">{patient.name}</TableCell>
                      <TableCell className="capitalize">{patient.procedure}</TableCell>
                      <TableCell>{patient.hospital || "-"}</TableCell>
                      <TableCell>
                        <StatusBadge status={patient.status as any} />
                      </TableCell>
                      <TableCell>
                        {(() => {
                          const requiredExams = getExamsForProcedure(patient.procedure);
                          const checkedExams = patient.exams_checklist || [];
                          const allExamsChecked = requiredExams.length > 0 && 
                            requiredExams.every(exam => checkedExams.includes(exam));
                          
                          return allExamsChecked ? (
                            <Badge variant="success">Entregues</Badge>
                          ) : (
                            <Badge variant="warning">Aguardando envio</Badge>
                          );
                        })()}
                      </TableCell>
                      <TableCell>
                        {patient.surgery_date
                          ? format(new Date(patient.surgery_date), "dd/MM/yyyy HH:mm", {
                              locale: ptBR,
                            })
                          : "Marcação pendente"}
                      </TableCell>
                      <TableCell className="text-right">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            navigate(`/patients/${patient.id}`);
                          }}
                        >
                          Ver Detalhes
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Patients;
