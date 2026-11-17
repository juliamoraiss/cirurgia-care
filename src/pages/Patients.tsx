import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useNavigate, useLocation } from "react-router-dom";
import { useUserRole } from "@/hooks/useUserRole";
import { useIsMobile } from "@/hooks/use-mobile";
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
import { Plus, Search, ArrowUpDown, ArrowUp, ArrowDown, Check, ChevronsUpDown, X, MessageCircle } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { toast } from "sonner";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { cn, normalizeSearch } from "@/lib/utils";
import { getExamsForProcedure } from "@/lib/patientAlerts";
import { PatientFiltersSheet } from "@/components/PatientFiltersSheet";
import { PatientListMobile, type PatientSection } from "@/components/PatientListMobile";
import { PageHeader, HeaderAction } from "@/components/PageHeader";
import { FAB } from "@/components/FAB";
import { isIOS } from "@/lib/platform";
import {
  DEFAULT_STATUS_FILTER,
  HOSPITAL_FILTER_OPTIONS,
  PROCEDURE_FILTER_OPTIONS,
  STATUS_FILTER_OPTIONS,
  type PatientFilters,
  shortHospital,
  statusLabel,
} from "@/lib/patientFilters";
import { describeError } from "@/lib/errors";

interface Patient {
  id: string;
  name: string;
  procedure: string;
  hospital: string | null;
  status: string;
  surgery_date: string | null;
  created_at: string;
  exams_checklist: string[] | null;
  phone?: string | null;
  guide_validity_date?: string | null;
  surgery_to_confirm?: boolean;
}

function useSessionState<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = sessionStorage.getItem(key);
      return stored !== null ? (JSON.parse(stored) as T) : initialValue;
    } catch {
      return initialValue;
    }
  });

  useEffect(() => {
    try {
      sessionStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* ignore */
    }
  }, [key, value]);

  return [value, setValue] as const;
}

const Patients = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { isAdmin } = useUserRole();
  const isMobile = useIsMobile();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);
  // Busca e filtros ficam salvos na sessão para não se perderem ao abrir um
  // paciente e voltar, ou ao puxar a tela para atualizar.
  const [searchTerm, setSearchTerm] = useSessionState("patients:search", "");
  const [filterProcedures, setFilterProcedures] = useSessionState<string[]>("patients:procedures", []);
  const [filterHospitals, setFilterHospitals] = useSessionState<string[]>("patients:hospitals", []);
  const [filterStatuses, setFilterStatuses] = useSessionState<string[]>("patients:statuses", DEFAULT_STATUS_FILTER);
  const [sortColumn, setSortColumn] = useState<"name" | "procedure" | "surgery_date" | "created_at">("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  // Filtro vindo de outra tela (ex.: card da Home): aplica uma vez e limpa o
  // state da navegação, senão ao voltar da ficha ele sobrescreveria os filtros.
  useEffect(() => {
    if (location.state?.filterStatus) {
      setFilterStatuses([location.state.filterStatus]);
      navigate(location.pathname + location.search, { replace: true, state: null });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
        .select("id, name, procedure, hospital, status, surgery_date, created_at, exams_checklist, phone, guide_validity_date, surgery_to_confirm")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setPatients(data || []);
    } catch (error) {
      toast.error(describeError("Erro ao carregar pacientes", error));
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

  const currentFilters: PatientFilters = {
    procedures: filterProcedures,
    hospitals: filterHospitals,
    statuses: filterStatuses,
  };

  const matchesFilters = (patient: Patient, filters: PatientFilters) => {
    // Busca sem diferenciar acentos/maiúsculas; telefone pelos dígitos
    const query = normalizeSearch(searchTerm);
    const queryDigits = searchTerm.replace(/\D/g, "");
    const matchesSearch =
      !query ||
      normalizeSearch(patient.name).includes(query) ||
      normalizeSearch(patient.procedure).includes(query) ||
      normalizeSearch(patient.hospital).includes(query) ||
      (queryDigits.length >= 4 && (patient.phone || "").replace(/\D/g, "").includes(queryDigits));

    // Paciente com vários procedimentos ("rinoplastia, septoplastia") casa com qualquer um
    const patientProcedures = patient.procedure.split(",").map((p) => p.trim().toLowerCase());
    const matchesProcedure = filters.procedures.length === 0 || filters.procedures.some((f) => patientProcedures.includes(f));
    const matchesHospital = filters.hospitals.length === 0 || (!!patient.hospital && filters.hospitals.includes(patient.hospital));
    const matchesStatus = filters.statuses.length === 0 || filters.statuses.includes(patient.status);

    return matchesSearch && matchesProcedure && matchesHospital && matchesStatus;
  };

  const applyFilters = (filters: PatientFilters) => {
    setFilterProcedures(filters.procedures);
    setFilterHospitals(filters.hospitals);
    setFilterStatuses(filters.statuses);
  };

  const filteredPatients = patients
    .filter((patient) => matchesFilters(patient, currentFilters))
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

  const activeFilterCount = filterProcedures.length + filterHospitals.length + filterStatuses.length;
  const hasActiveFilters = searchTerm.trim() !== "" || activeFilterCount > 0;

  const clearFilters = () => {
    setSearchTerm("");
    setFilterProcedures([]);
    setFilterHospitals([]);
    setFilterStatuses([]);
  };

  // Filtros ativos como etiquetas removíveis (celular e computador)
  const filterChips: { key: string; label: string; remove: () => void }[] = [
    ...(searchTerm.trim() ? [{ key: "search", label: `"${searchTerm.trim()}"`, remove: () => setSearchTerm("") }] : []),
    ...filterProcedures.map((v) => ({
      key: `p-${v}`,
      label: v.charAt(0).toUpperCase() + v.slice(1),
      remove: () => setFilterProcedures(filterProcedures.filter((x) => x !== v)),
    })),
    ...filterHospitals.map((v) => ({
      key: `h-${v}`,
      label: shortHospital(v),
      remove: () => setFilterHospitals(filterHospitals.filter((x) => x !== v)),
    })),
    ...filterStatuses.map((v) => ({
      key: `s-${v}`,
      label: statusLabel(v),
      remove: () => setFilterStatuses(filterStatuses.filter((x) => x !== v)),
    })),
  ];

  // Seções da lista do celular (cabeçalho fixo ao rolar)
  const now = new Date();
  const byDateAsc = (x: Patient, y: Patient) =>
    new Date(x.surgery_date || 0).getTime() - new Date(y.surgery_date || 0).getTime();
  const isFuture = (p: Patient) =>
    !!p.surgery_date && new Date(p.surgery_date) > now && p.status !== "completed" && p.status !== "cancelled";
  const sectionOf = (p: Patient): string => {
    if (isFuture(p)) return "upcoming";
    if (p.status === "cancelled") return "cancelled";
    if (p.status === "completed" || p.status === "surgery_completed" || (p.surgery_date && new Date(p.surgery_date) <= now))
      return "done";
    if (p.status === "awaiting_authorization") return "authorization";
    if (p.status === "authorized" || p.status === "pending_scheduling") return "scheduling";
    if (p.status === "awaiting_consultation") return "consultation";
    return "other";
  };
  const SECTION_TITLES: [string, string][] = [
    ["upcoming", "Cirurgias futuras"],
    ["authorization", "Aguardando autorização"],
    ["scheduling", "Aguardando agendamento"],
    ["consultation", "Consultas"],
    ["done", "Realizadas"],
    ["cancelled", "Cancelados"],
    ["other", "Outros"],
  ];
  const mobileSections: PatientSection[] = SECTION_TITLES.map(([key, title]) => {
    const list = filteredPatients.filter((p) => sectionOf(p) === key);
    return { key, title, patients: key === "upcoming" ? [...list].sort(byDateAsc) : list };
  });

  if (isMobile) {
    return (
      <>
        <PageHeader
          title="Pacientes"
          actions={
            isAdmin ? (
              <>
                <HeaderAction
                  icon={<MessageCircle className="h-[22px] w-[22px]" />}
                  label="Importar do WhatsApp"
                  onClick={() => navigate("/share-cirurgia")}
                />
                {isIOS && (
                  <HeaderAction
                    icon={<Plus className="h-6 w-6" strokeWidth={2.2} />}
                    label="Novo paciente"
                    onClick={() => navigate("/patients/new")}
                  />
                )}
              </>
            ) : undefined
          }
        >
          <div className="flex items-center gap-2">
            <div className="relative flex-1 min-w-0">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
              <Input
                type="search"
                inputMode="search"
                placeholder="Buscar"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className={cn(
                  "pl-8 h-10 text-base border-0",
                  isIOS ? "rounded-[10px] bg-muted/80" : "rounded-full bg-secondary dark:bg-card"
                )}
              />
            </div>
            <PatientFiltersSheet
              value={currentFilters}
              onApply={applyFilters}
              previewCount={(filters) => patients.filter((p) => matchesFilters(p, filters)).length}
            />
          </div>
          {/* Chips numa linha só, com rolagem horizontal; "Limpar" por último */}
          {filterChips.length > 0 && (
            <div className="-mx-4 px-4 flex gap-1.5 overflow-x-auto no-scrollbar" aria-label="Filtros ativos">
              {filterChips.map((chip) => (
                <button
                  key={chip.key}
                  type="button"
                  onClick={chip.remove}
                  aria-label={`Remover filtro ${chip.label}`}
                  className="shrink-0 inline-flex items-center gap-1 h-8 rounded-full border bg-card pl-3 pr-2 text-xs font-medium whitespace-nowrap active:bg-muted"
                >
                  {chip.label}
                  <X className="h-3.5 w-3.5 text-muted-foreground" />
                </button>
              ))}
              <button
                type="button"
                onClick={clearFilters}
                className="shrink-0 h-8 rounded-full px-3 text-xs font-medium text-primary whitespace-nowrap active:bg-muted"
              >
                Limpar
              </button>
            </div>
          )}
          {!loading && hasActiveFilters && (
            <p className="text-xs text-muted-foreground">
              Mostrando {filteredPatients.length} de {patients.length} pacientes
            </p>
          )}
        </PageHeader>

        <PatientListMobile
          sections={mobileSections}
          loading={loading}
          onOpen={(id) => navigate(`/patients/${id}/exams`)}
          empty={
            <div className="mx-4 rounded-xl bg-card px-4 py-6 text-center text-sm text-muted-foreground space-y-3">
              {patients.length === 0 ? (
                <p>Nenhum paciente cadastrado</p>
              ) : (
                <>
                  <p>Nenhum paciente com a busca e os filtros atuais.</p>
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    Limpar filtros
                  </Button>
                </>
              )}
            </div>
          }
        />

        {isAdmin && (
          <FAB icon={<Plus />} label="Novo paciente" onClick={() => navigate("/patients/new")} />
        )}
      </>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 pb-24">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Pacientes</h1>
          <p className="text-sm text-muted-foreground">
            Gerencie todos os pacientes e procedimentos
          </p>
        </div>
        {isAdmin && (
          <div className="flex w-full sm:w-auto gap-2">
            {/* No celular esse atalho fica no botão "+" */}
            <Button variant="outline" onClick={() => navigate("/share-cirurgia")} className="hidden md:inline-flex">
              <MessageCircle className="h-4 w-4 mr-2 text-[#25D366]" />
              Importar do WhatsApp
            </Button>
            <Button onClick={() => navigate("/patients/new")} className="w-full sm:w-auto">
              <Plus className="h-4 w-4 mr-2" />
              Novo Paciente
            </Button>
          </div>
        )}
      </div>

      <Card>
        <CardHeader className="sticky top-0 z-10 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
          <div className="space-y-4">
            {/* Computador: busca + filtros em menus */}
            <>
                <div className="flex items-center space-x-2">
                  <Search className="h-5 w-5 text-muted-foreground" />
                  <Input
                    placeholder="Buscar por nome, procedimento, hospital ou telefone..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="flex-1"
                  />
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {[
                    {
                      key: "procedures",
                      placeholder: "Filtrar por procedimento",
                      selected: filterProcedures,
                      set: setFilterProcedures,
                      options: PROCEDURE_FILTER_OPTIONS.map((v) => ({ value: v, label: v.charAt(0).toUpperCase() + v.slice(1) })),
                    },
                    {
                      key: "hospitals",
                      placeholder: "Filtrar por hospital",
                      selected: filterHospitals,
                      set: setFilterHospitals,
                      options: HOSPITAL_FILTER_OPTIONS.map((v) => ({ value: v, label: v })),
                    },
                    {
                      key: "statuses",
                      placeholder: "Filtrar por status",
                      selected: filterStatuses,
                      set: setFilterStatuses,
                      options: STATUS_FILTER_OPTIONS,
                    },
                  ].map((filter) => (
                    <Popover key={filter.key}>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className="justify-between">
                          {filter.selected.length > 0 ? `${filter.selected.length} selecionado(s)` : filter.placeholder}
                          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                        </Button>
                      </PopoverTrigger>
                      {/* Fica dentro da tela (collisionPadding) e rola se não couber; fecha ao clicar fora */}
                      <PopoverContent
                        className="w-[var(--radix-popover-trigger-width)] min-w-[240px] p-0 bg-background z-50 max-h-[min(60vh,var(--radix-popover-content-available-height))] overflow-y-auto overscroll-contain"
                        align="start"
                        collisionPadding={8}
                      >
                        <div className="p-2">
                          {filter.options.map((option) => {
                            const id = `${filter.key}-${option.value}`;
                            return (
                              <label
                                key={option.value}
                                htmlFor={id}
                                className="flex items-center gap-2 min-h-10 px-2 rounded-md cursor-pointer hover:bg-muted"
                              >
                                <Checkbox
                                  id={id}
                                  checked={filter.selected.includes(option.value)}
                                  onCheckedChange={(checked) =>
                                    filter.set(
                                      checked
                                        ? [...filter.selected, option.value]
                                        : filter.selected.filter((v) => v !== option.value)
                                    )
                                  }
                                />
                                <span className="text-sm font-medium">{option.label}</span>
                              </label>
                            );
                          })}
                        </div>
                      </PopoverContent>
                    </Popover>
                  ))}
                </div>
            </>

            {/* Filtros ativos como etiquetas removíveis + contagem */}
            {hasActiveFilters && (
              <div className="space-y-2">
                <div className="flex flex-wrap gap-1.5" aria-label="Filtros ativos">
                  {filterChips.map((chip) => (
                    <button
                      key={chip.key}
                      type="button"
                      onClick={chip.remove}
                      aria-label={`Remover filtro ${chip.label}`}
                      className="inline-flex items-center gap-1 h-9 max-w-full rounded-full border bg-secondary/60 pl-3 pr-2 text-xs font-medium text-foreground active:bg-secondary"
                    >
                      <span className="truncate">{chip.label}</span>
                      <X className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                    </button>
                  ))}
                </div>
                {!loading && (
                  <div className="flex items-center justify-between gap-2 text-sm text-muted-foreground">
                    <span>
                      Mostrando {filteredPatients.length} de {patients.length} pacientes
                    </span>
                    <Button variant="ghost" size="sm" onClick={clearFilters} className="h-9 px-2 text-primary shrink-0">
                      Limpar tudo
                    </Button>
                  </div>
                )}
              </div>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-muted-foreground">
              Carregando pacientes...
            </div>
          ) : filteredPatients.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground space-y-3">
              {patients.length === 0 ? (
                <p>Nenhum paciente cadastrado</p>
              ) : (
                <>
                  <p>
                    Nenhum paciente encontrado com a busca e os filtros atuais.
                    <br />
                    {patients.length} {patients.length === 1 ? "paciente está oculto" : "pacientes estão ocultos"}.
                  </p>
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    <X className="h-4 w-4 mr-1" />
                    Limpar filtros
                  </Button>
                </>
              )}
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
                      onClick={() => navigate(`/patients/${patient.id}/exams`)}
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
