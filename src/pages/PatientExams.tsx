import { useEffect, useState } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText, Download, X, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";
import { toast } from "sonner";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { PatientNotesSection } from "@/components/PatientNotesSection";

interface Patient {
  id: string;
  name: string;
  procedure: string;
  hospital: string | null;
  surgery_date: string | null;
  birth_date: string | null;
}

interface PatientFile {
  id: string;
  file_name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  created_at: string;
}

const PatientExams = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const fromPage = searchParams.get("from") || "calendar";
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
        .select("id, name, procedure, hospital, surgery_date, birth_date")
        .eq("id", id)
        .single();

      if (error) throw error;
      setPatient(data);
    } catch (error) {
      toast.error("Erro ao carregar dados do paciente");
      navigate(fromPage === "patients" ? "/patients" : "/calendar");
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
      toast.error("Erro ao carregar exames do paciente");
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
      toast.error("Erro ao carregar arquivo");
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
      toast.error("Erro ao fazer download do arquivo");
    }
  };

  const isImageFile = (fileName: string) => {
    const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
    return imageExtensions.some(ext => fileName.toLowerCase().endsWith(ext));
  };

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

  return (
    <div className="p-3 md:p-6 max-w-4xl mx-auto space-y-4 md:space-y-6">
      <div>
        <Button
          variant="ghost"
          onClick={() => navigate(fromPage === "patients" ? "/patients" : "/calendar")}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          {fromPage === "patients" ? "Voltar para Pacientes" : "Voltar para Agenda"}
        </Button>
        <h1 className="text-2xl md:text-3xl font-bold text-foreground">Exames Pré-Operatórios</h1>
        <p className="text-sm md:text-base text-muted-foreground">
          Paciente: {patient.name}
          {patient.birth_date && (() => {
            const today = new Date();
            const birthDate = new Date(patient.birth_date);
            let age = today.getFullYear() - birthDate.getFullYear();
            const monthDiff = today.getMonth() - birthDate.getMonth();
            if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
              age--;
            }
            return ` • ${age} anos`;
          })()}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Informações da Cirurgia</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4">
            <div>
              <span className="font-semibold">Procedimento:</span>{" "}
              <span className="capitalize">{patient.procedure}</span>
            </div>
            <div>
              <span className="font-semibold">Hospital:</span>{" "}
              <span>{patient.hospital || "Não informado"}</span>
            </div>
            {patient.surgery_date && (
              <div>
                <span className="font-semibold">Data da Cirurgia:</span>{" "}
                <span>{new Date(patient.surgery_date).toLocaleString('pt-BR')}</span>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
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

      <PatientNotesSection patientId={id!} />

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
            {viewingFile && isImageFile(viewingFile.name) && (
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
            {viewingFile && isImageFile(viewingFile.name) ? (
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
            ) : (
              viewingFile && (
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
  );
};

export default PatientExams;