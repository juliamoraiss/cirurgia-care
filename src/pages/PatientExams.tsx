import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, Download, X, ZoomIn, ZoomOut, Maximize2, Calendar, Pencil, Phone, MessageCircle, ChevronRight, Plus } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { PatientNotesSection } from "@/components/PatientNotesSection";
import { PatientTasksSection } from "@/components/PatientTasksSection";
import { ToConfirmBadge } from "@/components/ToConfirmBadge";
import { PatientFeedbacksSection } from "@/components/PatientFeedbacksSection";
import { OncologyTimeline } from "@/components/OncologyTimeline";
import PdfViewer from "@/components/PdfViewer";
import { useUserRole } from "@/hooks/useUserRole";
import { capitalizeFirst } from "@/lib/utils";
import { createWhatsAppUrl, safeWindowOpen } from "@/lib/urlSecurity";
import { PageHeader, HeaderAction } from "@/components/PageHeader";
import { StatusBadge } from "@/components/StatusBadge";
import { longDate, longDateTime } from "@/lib/dates";
import { isIOS } from "@/lib/platform";
import { cn } from "@/lib/utils";
import { PatientSurgeriesHistory } from "@/components/PatientSurgeriesHistory";
import { PatientSurgeryTimeline } from "@/components/PatientSurgeryTimeline";
import { useAuth } from "@/hooks/useAuth";
import { describeError } from "@/lib/errors";

interface Patient {
  id: string;
  name: string;
  procedure: string;
  hospital: string | null;
  surgery_date: string | null;
  insurance?: string | null;
  phone?: string | null;
  guide_validity_date?: string | null;
  surgery_to_confirm?: boolean;
  birth_date: string | null;
  status: string;
  is_oncology: boolean;
  oncology_stage: string | null;
  responsible_user_id: string | null;
}

interface PatientFile {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  created_at: string;
}

/** Seção agrupada do celular (some no computador): título pequeno em cinza. */
function GroupedSection({ title, action, children }: { title: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="md:hidden space-y-1.5">
      <div className="flex items-center justify-between px-4">
        <h3
          className={cn(
            "text-[13px] font-normal",
            isIOS ? "uppercase tracking-wide text-muted-foreground" : "text-sm font-medium text-primary"
          )}
        >
          {title}
        </h3>
        {action}
      </div>
      <div className={cn("bg-card overflow-hidden [&>*:last-child_.row-sep]:border-b-0 [&>*:last-child]:border-b-0", isIOS ? "rounded-xl" : "rounded-lg")}>
        {children}
      </div>
    </section>
  );
}

/** Linha "rótulo à esquerda, valor à direita". */
function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="ml-4 flex items-start justify-between gap-4 py-3 pr-4 border-b border-border/60 min-h-11">
      <span className="text-[15px] text-foreground shrink-0">{label}</span>
      <span className="text-[15px] text-muted-foreground text-right min-w-0 break-words">{value}</span>
    </div>
  );
}

const PatientExams = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAdmin } = useUserRole();
  const canManagePatient = isAdmin;
  const { user } = useAuth();
  const [patient, setPatient] = useState<Patient | null>(null);
  const [files, setFiles] = useState<PatientFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewingFile, setViewingFile] = useState<{ url: string; name: string } | null>(null);
  const [zoom, setZoom] = useState(1);
  const [isFullscreen, setIsFullscreen] = useState(false);

  useEffect(() => {
    if (id) {
      loadPatientData();
      loadPatientFiles();
    }
  }, [id]);

  // Reset zoom quando abrir novo arquivo
  useEffect(() => {
    if (viewingFile) {
      setZoom(1);
      setIsFullscreen(false);
    }
  }, [viewingFile]);

  async function loadPatientData() {
    try {
      const { data, error } = await supabase
        .from("patients")
        .select("id, name, procedure, hospital, surgery_date, surgery_to_confirm, birth_date, status, is_oncology, oncology_stage, responsible_user_id, insurance, phone, guide_validity_date")
        .eq("id", id)
        .single();

      if (error) throw error;
      setPatient(data);
    } catch (error) {
      toast.error(describeError("Erro ao carregar dados do paciente", error));
      navigate(-1);
    } finally {
      setLoading(false);
    }
  }

  async function loadPatientFiles() {
    try {
      const { data, error } = await supabase
        .from("patient_files")
        .select("*")
        .eq("patient_id", id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setFiles(data || []);
    } catch (error) {
      toast.error(describeError("Erro ao carregar exames do paciente", error));
    }
  }

  const viewFile = async (filePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("patient-files")
        .createSignedUrl(filePath, 3600);

      if (error) throw error;
      if (data?.signedUrl) {
        setViewingFile({ url: data.signedUrl, name: fileName });
      }
    } catch (error) {
      toast.error(describeError("Erro ao carregar arquivo", error));
    }
  };

  const downloadFile = async (filePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("patient-files")
        .download(filePath);

      if (error) throw error;
      if (data) {
        const url = URL.createObjectURL(data);
        const link = document.createElement('a');
        link.href = url;
        link.download = fileName;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
        toast.success("Download iniciado");
      }
    } catch (error) {
      toast.error(describeError("Erro ao fazer download do arquivo", error));
    }
  };

  const isImageFile = (fileName: string) => {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    return imageExtensions.some(ext => fileName.toLowerCase().endsWith(ext));
  };

  const isPdfFile = (fileName: string) => fileName.toLowerCase().endsWith('.pdf');

  const handleZoomIn = () => {
    setZoom(prev => Math.min(prev + 0.25, 3));
  };

  const handleZoomOut = () => {
    setZoom(prev => Math.max(prev - 0.25, 0.5));
  };

  const handleResetZoom = () => {
    setZoom(1);
  };

  const closeViewer = () => {
    setViewingFile(null);
    setZoom(1);
    setIsFullscreen(false);
  };

  const goBack = () => {
    if (((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0) navigate(-1);
    else navigate("/patients");
  };

  const openInGoogleCalendar = () => {
    if (!patient?.surgery_date) return;
    const surgeryDate = new Date(patient.surgery_date);
    const endDate = new Date(surgeryDate);
    endDate.setHours(endDate.getHours() + 2);
    const fmt = (date: Date) => date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
    const title = `Cirurgia: ${patient.procedure} - ${patient.name}`;
    const details = `Paciente: ${patient.name}\nProcedimento: ${patient.procedure}`;
    const location = patient.hospital || "";
    safeWindowOpen(
      `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${fmt(surgeryDate)}/${fmt(endDate)}&details=${encodeURIComponent(details)}&location=${encodeURIComponent(location)}`,
      "_blank"
    );
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="p-6">
        <p className="text-center text-muted-foreground">Paciente não encontrado</p>
      </div>
    );
  }

  const phoneDigits = (patient.phone || "").replace(/\D/g, "");
  const age = (() => {
    if (!patient.birth_date) return null;
    const today = new Date();
    const birth = new Date(patient.birth_date);
    let years = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) years--;
    return years;
  })();

  return (
    <>
    <PageHeader
      title={patient.name}
      largeTitle={false}
      back={{ label: "Voltar", onClick: goBack }}
      actions={
        isAdmin ? (
          <HeaderAction
            icon={<Pencil className="h-5 w-5" />}
            label="Editar"
            iosText
            onClick={() => navigate(`/patients/${id}`)}
          />
        ) : undefined
      }
    />
    <div className="px-4 pt-2 md:p-6 max-w-4xl mx-auto space-y-5 md:space-y-6">
      {/* Celular: topo com nome, status, convênio e ações rápidas */}
      <div className="md:hidden text-center space-y-2">
        <h2 className="text-[22px] font-bold leading-tight text-foreground">{patient.name}</h2>
        <div className="flex items-center justify-center flex-wrap gap-1.5 text-sm text-muted-foreground">
          <StatusBadge status={patient.status as never} />
          {patient.insurance && <span>{patient.insurance}</span>}
          {age !== null && <span>· {age} anos</span>}
        </div>
        <div className="flex justify-center gap-6 pt-2">
          {[
            {
              key: "call",
              label: "Ligar",
              icon: <Phone className="h-5 w-5" />,
              disabled: !phoneDigits,
              onClick: () => (window.location.href = `tel:${phoneDigits}`),
            },
            {
              key: "whatsapp",
              label: "WhatsApp",
              icon: <MessageCircle className="h-5 w-5" />,
              disabled: !phoneDigits,
              onClick: () => safeWindowOpen(createWhatsAppUrl(phoneDigits, "")),
            },
            {
              key: "calendar",
              label: "Agenda",
              icon: <Calendar className="h-5 w-5" />,
              disabled: !patient.surgery_date,
              onClick: openInGoogleCalendar,
            },
          ].map((action) => (
            <button
              key={action.key}
              type="button"
              onClick={action.onClick}
              disabled={action.disabled}
              className="flex flex-col items-center gap-1 text-xs font-medium text-primary disabled:text-muted-foreground disabled:opacity-60"
            >
              <span className="flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">{action.icon}</span>
              {action.label}
            </button>
          ))}
        </div>
      </div>

      {/* Celular: lista agrupada "rótulo à esquerda, valor à direita" */}
      <GroupedSection title="Cirurgia">
        <InfoRow label="Procedimento" value={capitalizeFirst(patient.procedure)} />
        <InfoRow label="Hospital" value={patient.hospital || "—"} />
        <InfoRow
          label="Data"
          value={
            patient.surgery_date ? (
              <span className="inline-flex flex-col items-end gap-1">
                <span>{longDateTime(patient.surgery_date)}</span>
                {patient.surgery_to_confirm && <ToConfirmBadge />}
              </span>
            ) : (
              "Sem data"
            )
          }
        />
        {patient.guide_validity_date && (
          <InfoRow label="Validade da guia" value={longDate(`${patient.guide_validity_date}T12:00:00`)} />
        )}
        {patient.phone && <InfoRow label="Telefone" value={patient.phone} />}
      </GroupedSection>

      <GroupedSection
        title="Exames"
        action={
          isAdmin ? (
            <button
              type="button"
              onClick={() => navigate(`/patients/${id}?step=2`)}
              className="inline-flex items-center gap-0.5 text-[13px] font-medium text-primary normal-case tracking-normal min-h-11 -my-3"
            >
              <Plus className="h-4 w-4" />
              Adicionar
            </button>
          ) : undefined
        }
      >
        {files.length === 0 ? (
          <p className="px-4 py-3 text-[15px] text-muted-foreground">Nenhum exame enviado</p>
        ) : (
          files.map((file) => (
            <div key={file.id} className="flex items-center gap-3 pl-4 min-h-12">
              <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
              <button
                type="button"
                onClick={() => viewFile(file.file_path, file.file_name)}
                className="row-sep flex-1 min-w-0 flex items-center gap-2 py-2.5 pr-2 border-b border-border/60 text-left"
              >
                <span className="flex-1 min-w-0">
                  <span className="block text-[15px] truncate">{file.file_name}</span>
                  <span className="block text-xs text-muted-foreground">
                    {(file.file_size / 1024).toFixed(0)} KB · {longDate(file.created_at)}
                  </span>
                </span>
                {isIOS && <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground/60" />}
              </button>
              <button
                type="button"
                onClick={() => downloadFile(file.file_path, file.file_name)}
                aria-label={`Baixar ${file.file_name}`}
                className="h-11 w-11 shrink-0 flex items-center justify-center text-primary"
              >
                <Download className="h-5 w-5" />
              </button>
            </div>
          ))
        )}
      </GroupedSection>

      {/* Computador: cabeçalho e cartões originais */}
      <div className="hidden md:block">
        <div className="flex items-center justify-between mb-4">
          <Button
            variant="ghost"
            onClick={() => {
              if (((window.history.state as { idx?: number } | null)?.idx ?? 0) > 0) {
                navigate(-1);
              } else {
                navigate("/patients");
              }
            }}
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Voltar
          </Button>
          
          {isAdmin && (
            <Button
              variant="outline"
              onClick={() => navigate(`/patients/${id}`)}
            >
              <Pencil className="h-4 w-4 mr-2" />
              Editar Paciente
            </Button>
          )}
        </div>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">{patient.name}</h1>
        {patient.birth_date && (
          <p className="text-sm md:text-base text-muted-foreground">
            {(() => {
              const today = new Date();
              const birthDate = new Date(patient.birth_date);
              let age = today.getFullYear() - birthDate.getFullYear();
              const monthDiff = today.getMonth() - birthDate.getMonth();
              if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                age--;
              }
              return `${age} anos`;
            })()}
          </p>
        )}
      </div>

      <Card className="hidden md:block">
        <CardHeader>
          <CardTitle>Informações da Cirurgia</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div>
              <span className="font-semibold">Procedimento:</span>{" "}
              <span>{capitalizeFirst(patient.procedure)}</span>
            </div>
            <div>
              <span className="font-semibold">Hospital:</span>{" "}
              <span>{patient.hospital || "Não informado"}</span>
            </div>
            {patient.surgery_date && (
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold">Data da Cirurgia:</span>{" "}
                <span>{new Date(patient.surgery_date).toLocaleString('pt-BR')}</span>
                {patient.surgery_to_confirm && <ToConfirmBadge />}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => {
                    const surgeryDate = new Date(patient.surgery_date!);
                    const endDate = new Date(surgeryDate);
                    endDate.setHours(endDate.getHours() + 2);
                    
                    const formatCalendarDate = (date: Date) => {
                      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
                    };
                    
                    const calendarTitle = `Cirurgia: ${patient.procedure} - ${patient.name}`;
                    const calendarDetails = `Paciente: ${patient.name}\nProcedimento: ${patient.procedure}`;
                    const calendarLocation = patient.hospital || "Hospital Brasília";
                    
                    const googleCalendarLink = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(calendarTitle)}&dates=${formatCalendarDate(surgeryDate)}/${formatCalendarDate(endDate)}&details=${encodeURIComponent(calendarDetails)}&location=${encodeURIComponent(calendarLocation)}`;
                    
                    safeWindowOpen(googleCalendarLink, '_blank');
                  }}
                >
                  <Calendar className="h-3.5 w-3.5 mr-1" />
                  Adicionar ao Calendário
                </Button>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card className="hidden md:block">
        <CardHeader>
          <CardTitle>Exames Enviados</CardTitle>
          <CardDescription>
            {files.length === 0 
              ? "Nenhum exame foi enviado ainda" 
              : `${files.length} arquivo(s) disponível(is)`}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {files.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum exame disponível para este paciente</p>
            </div>
          ) : (
            <div className="space-y-3">
              {files.map((file) => (
                <div 
                  key={file.id} 
                  className="flex flex-col md:flex-row md:items-center gap-3 p-3 md:p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <FileText className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm md:text-base truncate">{file.file_name}</p>
                      <p className="text-xs md:text-sm text-muted-foreground">
                        {(file.file_size / 1024).toFixed(1)} KB • {new Date(file.created_at).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => viewFile(file.file_path, file.file_name)}
                      className="flex-1 md:flex-initial"
                    >
                      Visualizar
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => downloadFile(file.file_path, file.file_name)}
                      className="flex-1 md:flex-initial"
                    >
                      <Download className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <PatientSurgeriesHistory
        patientId={id!}
        patientStatus={patient.status}
        currentProcedure={patient.procedure}
        currentHospital={patient.hospital}
        currentSurgeryDate={patient.surgery_date}
        currentResponsibleUserId={patient.responsible_user_id}
        canManage={isAdmin || !!(user && patient.responsible_user_id === user.id)}
        onArchived={() => {
          loadPatientData();
        }}
      />

      <PatientSurgeryTimeline
        patientId={id!}
        currentProcedure={patient.procedure}
        currentHospital={patient.hospital}
        currentSurgeryDate={patient.surgery_date}
        currentStatus={patient.status}
      />


      {/* Tarefas do paciente ficam na ficha (antes só apareciam na tela de edição) */}
      {canManagePatient && <PatientTasksSection patientId={id!} />}

      <PatientNotesSection patientId={id!} />

      {/* Oncology Timeline - only for oncology patients */}
      {patient.is_oncology && (
        <OncologyTimeline patientId={id!} patientName={patient.name} />
      )}

      {/* Mostrar seção de feedback apenas para pacientes com cirurgia realizada */}
      {patient.status === 'completed' && (
        <PatientFeedbacksSection patientId={id!} />
      )}

      <Dialog open={!!viewingFile} onOpenChange={closeViewer}>
        <DialogContent className="max-w-[100vw] max-h-[100vh] h-[100vh] w-[100vw] md:max-w-5xl md:max-h-[95vh] md:h-[95vh] md:w-auto flex flex-col p-0 m-0 md:rounded-lg rounded-none overflow-hidden">
          {/* Header com controles */}
          <div className="flex items-center justify-between px-4 py-3 pt-safe md:p-6 border-b bg-background flex-shrink-0 z-10 safe-top">
            <div className="flex-1 min-w-0 pr-4">
              <h3 className="text-sm md:text-base font-semibold truncate">
                {viewingFile?.name}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                Zoom: {Math.round(zoom * 100)}%
              </p>
            </div>
            
            {/* Controles de Zoom */}
            {viewingFile && (
              <div className="flex items-center gap-2 mr-2">
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleZoomOut}
                  disabled={zoom <= 0.5}
                  className="h-8 w-8"
                >
                  <ZoomOut className="h-4 w-4" />
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleResetZoom}
                  className="h-8 px-2 text-xs"
                >
                  {Math.round(zoom * 100)}%
                </Button>
                <Button
                  variant="outline"
                  size="icon"
                  onClick={handleZoomIn}
                  disabled={zoom >= 3}
                  className="h-8 w-8"
                >
                  <ZoomIn className="h-4 w-4" />
                </Button>
              </div>
            )}

            {/* Botão Fechar */}
            <Button
              variant="ghost"
              size="icon"
              onClick={closeViewer}
              className="h-8 w-8 flex-shrink-0"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* Área de visualização */}
          <div className="flex-1 overflow-auto bg-muted/30">
            {viewingFile && (
              isImageFile(viewingFile.name) ? (
                <div className="w-full h-full flex items-center justify-center p-4 overflow-auto">
                  <img
                    src={viewingFile.url}
                    alt={viewingFile.name}
                    className="max-w-full h-auto"
                    style={{ 
                      transform: `scale(${zoom})`,
                      transformOrigin: 'center center',
                      transition: 'transform 0.2s ease',
                      cursor: zoom > 1 ? 'grab' : 'default',
                      touchAction: 'pan-x pan-y pinch-zoom'
                    }}
                    draggable={false}
                  />
                </div>
              ) : isPdfFile(viewingFile.name) ? (
                <PdfViewer url={viewingFile.url} zoom={zoom} />
              ) : (
                <iframe
                  src={`${viewingFile.url}#zoom=${Math.round(zoom * 100)}`}
                  className="w-full h-full border-0"
                  title={viewingFile.name}
                />
              )
            )}
          </div>

          {/* Instruções mobile */}
          {viewingFile && isImageFile(viewingFile.name) && (
            <div className="md:hidden p-2 bg-muted/50 text-center text-xs text-muted-foreground flex-shrink-0">
              Use dois dedos para dar zoom na imagem
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
    </>
  );
};

export default PatientExams;