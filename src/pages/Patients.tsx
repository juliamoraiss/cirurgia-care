import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useLocation } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
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
import { Plus, Search, ArrowUpDown, ArrowUp, ArrowDown, Check, ChevronsUpDown } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { cn } from "@/lib/utils";

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
  const location = useLocation();
  const { isAdmin } = useUserRole();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterProcedures, setFilterProcedures] = useState<string[]>([]);
  const [filterHospitals, setFilterHospitals] = useState<string[]>([]);
  const [filterStatuses, setFilterStatuses] = useState<string[]>(["authorized", "awaiting_authorization"]);
  const [sortColumn, setSortColumn] = useState<"name" | "procedure" | "surgery_date" | "created_at">("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Apply filter from navigation state
  useEffect(() => {
    if (location.state?.filterStatus) {
      setFilterStatuses([location.state.filterStatus]);
    }
  }, [location.state]);

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
    .filter((patient) => {
      const matchesSearch = patient.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        patient.procedure.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (patient.hospital && patient.hospital.toLowerCase().includes(searchTerm.toLowerCase()));
      
      const matchesProcedure = filterProcedures.length === 0 || filterProcedures.includes(patient.procedure);
      const matchesHospital = filterHospitals.length === 0 || (patient.hospital && filterHospitals.includes(patient.hospital));
      const matchesStatus = filterStatuses.length === 0 || filterStatuses.includes(patient.status);
      
      return matchesSearch && matchesProcedure && matchesHospital && matchesStatus;
    })
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
        {isAdmin && (
          <Button onClick={() => navigate("/patients/new")}>
            <Plus className="h-4 w-4 mr-2" />
            Novo Paciente
          </Button>
        )}
      </div>

      <Card>
        <CardHeader>
          <div className="space-y-4">
            <div className="flex items-center space-x-2">
              <Search className="h-5 w-5 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, procedimento ou hospital..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="flex-1"
              />
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-between">
                    {filterProcedures.length > 0 
                      ? `${filterProcedures.length} selecionado(s)` 
                      : "Filtrar por procedimento"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[240px] p-0 bg-background z-50" align="start">
                  <div className="p-4 space-y-2">
                    {["simpatectomia", "lobectomia", "broncoscopia", "rinoplastia"].map((procedure) => (
                      <div key={procedure} className="flex items-center space-x-2">
                        <Checkbox
                          id={`procedure-${procedure}`}
                          checked={filterProcedures.includes(procedure)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setFilterProcedures([...filterProcedures, procedure]);
                            } else {
                              setFilterProcedures(filterProcedures.filter(p => p !== procedure));
                            }
                          }}
                        />
                        <label
                          htmlFor={`procedure-${procedure}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 capitalize cursor-pointer"
                        >
                          {procedure}
                        </label>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-between">
                    {filterHospitals.length > 0 
                      ? `${filterHospitals.length} selecionado(s)` 
                      : "Filtrar por hospital"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[240px] p-0 bg-background z-50" align="start">
                  <div className="p-4 space-y-2">
                    {["Hospital Brasília", "Hospital Anchieta", "Hospital Prontonorte"].map((hospital) => (
                      <div key={hospital} className="flex items-center space-x-2">
                        <Checkbox
                          id={`hospital-${hospital}`}
                          checked={filterHospitals.includes(hospital)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setFilterHospitals([...filterHospitals, hospital]);
                            } else {
                              setFilterHospitals(filterHospitals.filter(h => h !== hospital));
                            }
                          }}
                        />
                        <label
                          htmlFor={`hospital-${hospital}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {hospital}
                        </label>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className="justify-between">
                    {filterStatuses.length > 0 
                      ? `${filterStatuses.length} selecionado(s)` 
                      : "Filtrar por status"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[280px] p-0 bg-background z-50" align="start">
                  <div className="p-4 space-y-2">
                    {[
                      { value: "awaiting_consultation", label: "Aguardando Consulta" },
                      { value: "awaiting_authorization", label: "Aguardando Autorização" },
                      { value: "authorized", label: "Autorizado" },
                      { value: "completed", label: "Cirurgia Realizada" },
                      { value: "cancelled", label: "Cirurgia Cancelada" }
                    ].map((status) => (
                      <div key={status.value} className="flex items-center space-x-2">
                        <Checkbox
                          id={`status-${status.value}`}
                          checked={filterStatuses.includes(status.value)}
                          onCheckedChange={(checked) => {
                            if (checked) {
                              setFilterStatuses([...filterStatuses, status.value]);
                            } else {
                              setFilterStatuses(filterStatuses.filter(s => s !== status.value));
                            }
                          }}
                        />
                        <label
                          htmlFor={`status-${status.value}`}
                          className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                        >
                          {status.label}
                        </label>
                      </div>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
            </div>
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
                      onClick={() => navigate(`/patients/${patient.id}/exams?from=patients`)}
                    >
                      <TableCell className="font-medium">{patient.name}</TableCell>
                      <TableCell className="capitalize">{patient.procedure}</TableCell>
                      <TableCell>{patient.hospital || "-"}</TableCell>
                      <TableCell>
                        <StatusBadge status={patient.status as any} />
                      </TableCell>
                      <TableCell>
                        {(() => {
                          if (patient.status === 'cancelled') {
                            return '-';
                          }
                          
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
                        {patient.status === 'cancelled' 
                          ? "-"
                          : patient.surgery_date
                            ? format(new Date(patient.surgery_date), "dd/MM/yyyy HH:mm", {
                                locale: ptBR,
                              })
                            : "Marcação pendente"}
                      </TableCell>
                      <TableCell className="text-right">
                        {isAdmin && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              navigate(`/patients/${patient.id}`);
                            }}
                          >
                            Editar
                          </Button>
                        )}
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
