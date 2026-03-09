import { useState, useEffect, useMemo, useRef } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Calendar, Clock, MapPin, User, Stethoscope, CheckCircle2, AlertTriangle, Loader2, MessageCircle, Upload, FileText, X, Paperclip, Trash2 } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface Slot {
  date: string;
  time: string;
  datetime: string;
}

interface ScheduleData {
  patient_name: string;
  patient_id: string;
  procedure: string;
  hospital: string | null;
  doctor_name: string;
  slots: Slot[];
}

interface ExistingFile {
  id: string;
  file_name: string;
  file_type: string;
  file_size: number | null;
  created_at: string;
}

interface UsedLinkData {
  status: "used";
  patient_id: string;
  patient_name: string;
  procedure: string;
  hospital: string | null;
  surgery_date: string;
  doctor_name: string;
  existing_files: ExistingFile[];
}

type PageState = "loading" | "slots" | "confirming" | "success" | "error" | "expired" | "used";

const ALLOWED_EXTENSIONS = ["pdf", "jpg", "jpeg", "png", "webp"];
const MAX_FILE_SIZE = 20 * 1024 * 1024; // 20MB

const PublicSchedule = () => {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<PageState>("loading");
  const [data, setData] = useState<ScheduleData | null>(null);
  const [usedLinkData, setUsedLinkData] = useState<UsedLinkData | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [confirmedDate, setConfirmedDate] = useState<string | null>(null);
  const [confirmedHospital, setConfirmedHospital] = useState<string | null>(null);
  const [confirmedPatientId, setConfirmedPatientId] = useState<string | null>(null);

  // File upload state
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploading, setUploading] = useState(false);
  const [uploadResult, setUploadResult] = useState<{ uploaded: string[]; errors: string[] } | null>(null);
  const [existingFiles, setExistingFiles] = useState<ExistingFile[]>([]);
  const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    document.title = "Agendamento de Cirurgia";
    if (!token) return;
    fetchSlots();
    return () => { document.title = "MedSystem"; };
  }, [token]);

  const fetchSlots = async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/public-schedule`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ action: "get_slots", token }),
      });

      const result = await res.json();

      if (!res.ok) {
        if (result.status === "used") {
          setUsedLinkData(result);
          setExistingFiles(result.existing_files || []);
          setState("used");
        } else if (result.status === "expired") {
          setState("expired");
        } else {
          setErrorMessage(result.error || "Erro ao carregar horários");
          setState("error");
        }
        return;
      }

      setData(result);
      setState("slots");
    } catch {
      setErrorMessage("Erro de conexão. Tente novamente.");
      setState("error");
    }
  };

  const confirmSlot = async () => {
    if (!selectedSlot || !token) return;
    setState("confirming");

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/public-schedule`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ action: "confirm", token, slot: selectedSlot.datetime }),
      });

      const result = await res.json();

      if (!res.ok) {
        setErrorMessage(result.error || "Erro ao confirmar agendamento");
        setState("error");
        return;
      }

      setConfirmedDate(result.scheduled_date);
      setConfirmedHospital(result.hospital);
      setConfirmedPatientId(result.patient_id || data?.patient_id || null);
      setState("success");
    } catch {
      setErrorMessage("Erro de conexão. Tente novamente.");
      setState("error");
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    const validFiles: File[] = [];

    for (const file of files) {
      const ext = file.name.split(".").pop()?.toLowerCase() || "";
      if (!ALLOWED_EXTENSIONS.includes(ext)) {
        continue;
      }
      if (file.size > MAX_FILE_SIZE) {
        continue;
      }
      validFiles.push(file);
    }

    setSelectedFiles(prev => [...prev, ...validFiles]);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const removeFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadFiles = async () => {
    const patientId = confirmedPatientId || data?.patient_id || usedLinkData?.patient_id;
    if (!selectedFiles.length || !patientId || !token) return;
    setUploading(true);

    try {
      const formData = new FormData();
      formData.append("token", token);
      formData.append("patient_id", patientId);
      selectedFiles.forEach((file, i) => {
        formData.append(`file_${i}`, file);
      });

      const res = await fetch(`${SUPABASE_URL}/functions/v1/public-schedule`, {
        method: "POST",
        headers: {
          apikey: SUPABASE_ANON_KEY,
        },
        body: formData,
      });

      const result = await res.json();
      setUploadResult({ uploaded: result.uploaded || [], errors: result.errors || [] });
      if (result.uploaded?.length) {
        setSelectedFiles([]);
        // Add newly uploaded files to the existing files list
        const newFiles: ExistingFile[] = selectedFiles
          .filter((_, i) => (result.uploaded || []).includes(selectedFiles[i]?.name))
          .map((file) => ({
            id: crypto.randomUUID(),
            file_name: file.name,
            file_type: file.name.split(".").pop()?.toLowerCase() || "",
            file_size: file.size,
            created_at: new Date().toISOString(),
          }));
        setExistingFiles(prev => [...newFiles, ...prev]);
      }
    } catch {
      setUploadResult({ uploaded: [], errors: ["Erro de conexão ao enviar arquivos"] });
    } finally {
      setUploading(false);
    }
  };

  const deleteFile = async (fileId: string) => {
    if (!token) return;
    setDeletingFileId(fileId);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/public-schedule`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ action: "delete_file", token, file_id: fileId }),
      });

      const result = await res.json();
      if (res.ok && result.success) {
        setExistingFiles(prev => prev.filter(f => f.id !== fileId));
      }
    } catch {
      // silently fail
    } finally {
      setDeletingFileId(null);
    }
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const slotsByDate = useMemo(() => {
    if (!data?.slots) return {};
    const grouped: Record<string, Slot[]> = {};
    for (const slot of data.slots) {
      if (!grouped[slot.date]) grouped[slot.date] = [];
      grouped[slot.date].push(slot);
    }
    return grouped;
  }, [data?.slots]);

  const availableDates = Object.keys(slotsByDate).sort();

  const formatDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  };

  const formatFullDate = (isoStr: string) => {
    const date = new Date(isoStr);
    return date.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const formatTime = (isoStr: string) => {
    const date = new Date(isoStr);
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  const openWhatsApp = () => {
    const message = encodeURIComponent("Gostaria de reagendar o dia da minha cirurgia");
    window.open(`https://wa.me/5561998695443?text=${message}`, "_blank");
  };

  return (
    <div className="min-h-screen bg-background flex items-start justify-center p-4 pt-8 md:pt-16">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary text-primary-foreground mb-3 shadow-md">
            <Calendar className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold text-primary">Agendamento de Cirurgia</h1>
          {data && (
            <p className="text-muted-foreground mt-1 text-sm">Escolha o melhor horário para você</p>
          )}
        </div>

        {/* Loading */}
        {state === "loading" && (
          <Card className="rounded-2xl shadow-md">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Carregando horários disponíveis...</p>
            </CardContent>
          </Card>
        )}

        {/* Error */}
        {state === "error" && (
          <Card className="rounded-2xl shadow-md border-destructive/30">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="w-14 h-14 rounded-full bg-destructive/10 flex items-center justify-center mb-4">
                <AlertTriangle className="h-7 w-7 text-destructive" />
              </div>
              <p className="text-lg font-semibold text-foreground mb-1">Ops!</p>
              <p className="text-muted-foreground text-center text-sm">{errorMessage}</p>
            </CardContent>
          </Card>
        )}

        {/* Expired */}
        {state === "expired" && (
          <Card className="rounded-2xl shadow-md border-warning/30">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <div className="w-14 h-14 rounded-full bg-warning/10 flex items-center justify-center mb-4">
                <AlertTriangle className="h-7 w-7 text-warning" />
              </div>
              <p className="text-lg font-semibold text-foreground mb-1">Link Expirado</p>
              <p className="text-muted-foreground text-center text-sm mb-4">
                Este link de agendamento expirou.
              </p>
              <p className="text-muted-foreground text-center text-sm">
                Entre em contato pelo WhatsApp <strong className="text-foreground">(61) 99869-5443</strong>
              </p>
              <Button
                onClick={openWhatsApp}
                className="mt-4 bg-success hover:bg-success/90 text-success-foreground"
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                Falar no WhatsApp
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Used - show patient info and file upload */}
        {state === "used" && usedLinkData && (
          <>
            {/* Surgery details */}
            <Card className="mb-4 rounded-2xl shadow-md border-success/30">
              <CardContent className="py-8">
                <div className="flex flex-col items-center justify-center mb-6">
                  <div className="w-14 h-14 rounded-full bg-success/10 flex items-center justify-center mb-3">
                    <CheckCircle2 className="h-7 w-7 text-success" />
                  </div>
                  <p className="text-lg font-semibold text-foreground mb-1">Cirurgia Agendada</p>
                  <p className="text-muted-foreground text-center text-sm">
                    Sua cirurgia foi confirmada com sucesso!
                  </p>
                </div>

                <div className="bg-muted rounded-xl p-4 space-y-3">
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <span className="font-medium text-foreground">{usedLinkData.patient_name}</span>
                  </div>
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <Stethoscope className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-foreground capitalize">{usedLinkData.procedure}</span>
                  </div>
                  {usedLinkData.hospital && (
                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <MapPin className="h-4 w-4 text-primary" />
                      </div>
                      <span className="text-foreground">{usedLinkData.hospital}</span>
                    </div>
                  )}
                  {usedLinkData.surgery_date && (
                    <>
                      <div className="flex items-center gap-3 text-sm">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Calendar className="h-4 w-4 text-primary" />
                        </div>
                        <span className="text-foreground capitalize">{formatFullDate(usedLinkData.surgery_date)}</span>
                      </div>
                      <div className="flex items-center gap-3 text-sm">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                          <Clock className="h-4 w-4 text-primary" />
                        </div>
                        <span className="text-foreground">{formatTime(usedLinkData.surgery_date)}</span>
                      </div>
                    </>
                  )}
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <User className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-foreground">Dr(a). {usedLinkData.doctor_name}</span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 mt-6">
                  <Button
                    onClick={openWhatsApp}
                    variant="outline"
                    className="w-full rounded-xl"
                  >
                    <MessageCircle className="h-4 w-4 mr-2" />
                    Falar no WhatsApp
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}

        {/* Slot selection */}
        {(state === "slots" || state === "confirming") && data && (
          <>
            {/* Patient info */}
            <Card className="mb-4 rounded-2xl shadow-md">
              <CardContent className="pt-5 space-y-2.5">
                <div className="flex items-center gap-3 text-sm text-foreground">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <span className="font-medium">{data.patient_name}</span>
                </div>
                <div className="flex items-center gap-3 text-sm text-foreground">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Stethoscope className="h-4 w-4 text-primary" />
                  </div>
                  <span className="capitalize">{data.procedure}</span>
                </div>
                {data.hospital && (
                  <div className="flex items-center gap-3 text-sm text-foreground">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <MapPin className="h-4 w-4 text-primary" />
                    </div>
                    <span>{data.hospital}</span>
                  </div>
                )}
                <div className="flex items-center gap-3 text-sm text-foreground">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <User className="h-4 w-4 text-primary" />
                  </div>
                  <span>Dr(a). {data.doctor_name}</span>
                </div>
              </CardContent>
            </Card>

            {availableDates.length === 0 ? (
              <Card className="rounded-2xl shadow-md">
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">Nenhum horário disponível no momento.</p>
                  <p className="text-sm text-muted-foreground mt-1">Entre em contato com a clínica.</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Date selection */}
                <Card className="mb-4 rounded-2xl shadow-md">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2 text-primary">
                      <Calendar className="h-4 w-4" />
                      Escolha uma data
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {availableDates.map((date) => (
                      <button
                        key={date}
                        onClick={() => {
                          setSelectedDate(date);
                          setSelectedSlot(null);
                        }}
                        disabled={state === "confirming"}
                        className={`w-full text-left px-4 py-3 rounded-xl border transition-all text-sm ${
                          selectedDate === date
                            ? "border-primary bg-primary/5 text-primary font-medium shadow-sm"
                            : "border-border hover:border-primary/40 hover:bg-accent text-foreground"
                        }`}
                      >
                        <span className="capitalize">{formatDate(date)}</span>
                        <Badge variant="secondary" className="ml-2 text-xs">
                          {slotsByDate[date].length} {slotsByDate[date].length === 1 ? "horário" : "horários"}
                        </Badge>
                      </button>
                    ))}
                  </CardContent>
                </Card>

                {/* Time selection */}
                {selectedDate && slotsByDate[selectedDate] && (
                  <Card className="mb-4 rounded-2xl shadow-md">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2 text-primary">
                        <Clock className="h-4 w-4" />
                        Escolha um horário
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-2">
                        {slotsByDate[selectedDate].map((slot) => (
                          <button
                            key={slot.datetime}
                            onClick={() => setSelectedSlot(slot)}
                            disabled={state === "confirming"}
                            className={`px-3 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                              selectedSlot?.datetime === slot.datetime
                                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                                : "border-border hover:border-primary/40 text-foreground"
                            }`}
                          >
                            {slot.time}
                          </button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Confirm */}
                {selectedSlot && (
                  <Button
                    onClick={confirmSlot}
                    disabled={state === "confirming"}
                    className="w-full h-12 text-base rounded-xl shadow-md"
                  >
                    {state === "confirming" ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Confirmando...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Confirmar Agendamento
                      </>
                    )}
                  </Button>
                 )}

                {/* File upload section - always show for slot selection */}
                <Card className="mt-4 rounded-2xl shadow-md">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2 text-primary">
                      <Paperclip className="h-4 w-4" />
                      Anexar Exames
                    </CardTitle>
                    <p className="text-xs text-muted-foreground mt-1">
                      Envie seus exames pré-operatórios (PDF, JPG, PNG). Máx. 20MB por arquivo.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {/* Upload area */}
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept=".pdf,.jpg,.jpeg,.png,.webp"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploading}
                      className="w-full border-2 border-dashed border-border hover:border-primary/40 rounded-xl py-8 flex flex-col items-center gap-2 transition-colors"
                    >
                      <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                        <Upload className="h-5 w-5 text-primary" />
                      </div>
                      <span className="text-sm text-muted-foreground">
                        Toque para selecionar arquivos
                      </span>
                      <span className="text-xs text-muted-foreground">
                        PDF, JPG, PNG
                      </span>
                    </button>

                    {/* Selected files list */}
                    {selectedFiles.length > 0 && (
                      <div className="space-y-2">
                        {selectedFiles.map((file, index) => (
                          <div key={index} className="flex items-center gap-3 p-2.5 bg-muted rounded-xl">
                            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                              <FileText className="h-4 w-4 text-primary" />
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-foreground truncate">{file.name}</p>
                              <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                            </div>
                            <button
                              onClick={() => removeFile(index)}
                              className="w-7 h-7 rounded-full hover:bg-destructive/10 flex items-center justify-center shrink-0"
                            >
                              <X className="h-4 w-4 text-muted-foreground" />
                            </button>
                          </div>
                        ))}

                        <Button
                          onClick={uploadFiles}
                          disabled={uploading}
                          className="w-full rounded-xl"
                        >
                          {uploading ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Enviando...
                            </>
                          ) : (
                            <>
                              <Upload className="h-4 w-4 mr-2" />
                              Enviar {selectedFiles.length} {selectedFiles.length === 1 ? "arquivo" : "arquivos"}
                            </>
                          )}
                        </Button>
                      </div>
                    )}

                    {/* Upload result */}
                    {uploadResult && (
                      <div className="space-y-2">
                        {uploadResult.uploaded.length > 0 && (
                          <div className="p-3 bg-success/10 rounded-xl">
                            <p className="text-sm text-success font-medium flex items-center gap-2">
                              <CheckCircle2 className="h-4 w-4" />
                              {uploadResult.uploaded.length} arquivo(s) enviado(s) com sucesso!
                            </p>
                          </div>
                        )}
                        {uploadResult.errors.length > 0 && (
                          <div className="p-3 bg-destructive/10 rounded-xl">
                            {uploadResult.errors.map((err, i) => (
                              <p key={i} className="text-sm text-destructive">{err}</p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </>
            )}
          </>
        )}

        {/* Existing files section for used links */}
        {state === "used" && usedLinkData && existingFiles.length > 0 && (
          <Card className="mt-4 rounded-2xl shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-primary">
                <FileText className="h-4 w-4" />
                Exames Enviados
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                {existingFiles.length} {existingFiles.length === 1 ? "arquivo enviado" : "arquivos enviados"}
              </p>
            </CardHeader>
            <CardContent className="space-y-2">
              {existingFiles.map((file) => (
                <div key={file.id} className="flex items-center gap-3 p-2.5 bg-muted rounded-xl">
                  <div className="w-8 h-8 rounded-lg bg-success/10 flex items-center justify-center shrink-0">
                    <CheckCircle2 className="h-4 w-4 text-success" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-foreground truncate">{file.file_name}</p>
                    <p className="text-xs text-muted-foreground">
                      {file.file_size ? formatFileSize(file.file_size) : file.file_type?.toUpperCase()}
                      {" · "}
                      {new Date(file.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
                    </p>
                  </div>
                  <button
                    onClick={() => deleteFile(file.id)}
                    disabled={deletingFileId === file.id}
                    className="w-7 h-7 rounded-full hover:bg-destructive/10 flex items-center justify-center shrink-0 transition-colors"
                    title="Excluir arquivo"
                  >
                    {deletingFileId === file.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
                    ) : (
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-destructive" />
                    )}
                  </button>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* File upload section for used links */}
        {state === "used" && usedLinkData && (
          <Card className="mt-4 rounded-2xl shadow-md">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-primary">
                <Paperclip className="h-4 w-4" />
                Anexar Exames
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Envie seus exames pré-operatórios (PDF, JPG, PNG). Máx. 20MB por arquivo.
              </p>
            </CardHeader>
            <CardContent className="space-y-3">
              {/* Upload area */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".pdf,.jpg,.jpeg,.png,.webp"
                onChange={handleFileSelect}
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full border-2 border-dashed border-border hover:border-primary/40 rounded-xl py-8 flex flex-col items-center gap-2 transition-colors"
              >
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Upload className="h-5 w-5 text-primary" />
                </div>
                <span className="text-sm text-muted-foreground">
                  Toque para selecionar arquivos
                </span>
                <span className="text-xs text-muted-foreground">
                  PDF, JPG, PNG
                </span>
              </button>

              {/* Selected files list */}
              {selectedFiles.length > 0 && (
                <div className="space-y-2">
                  {selectedFiles.map((file, index) => (
                    <div key={index} className="flex items-center gap-3 p-2.5 bg-muted rounded-xl">
                      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                        <FileText className="h-4 w-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground truncate">{file.name}</p>
                        <p className="text-xs text-muted-foreground">{formatFileSize(file.size)}</p>
                      </div>
                      <button
                        onClick={() => removeFile(index)}
                        className="w-7 h-7 rounded-full hover:bg-destructive/10 flex items-center justify-center shrink-0"
                      >
                        <X className="h-4 w-4 text-muted-foreground" />
                      </button>
                    </div>
                  ))}

                  <Button
                    onClick={uploadFiles}
                    disabled={uploading}
                    className="w-full rounded-xl"
                  >
                    {uploading ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Enviando...
                      </>
                    ) : (
                      <>
                        <Upload className="h-4 w-4 mr-2" />
                        Enviar {selectedFiles.length} {selectedFiles.length === 1 ? "arquivo" : "arquivos"}
                      </>
                    )}
                  </Button>
                </div>
              )}

              {/* Upload result */}
              {uploadResult && (
                <div className="space-y-2">
                  {uploadResult.uploaded.length > 0 && (
                    <div className="p-3 bg-success/10 rounded-xl">
                      <p className="text-sm text-success font-medium flex items-center gap-2">
                        <CheckCircle2 className="h-4 w-4" />
                        {uploadResult.uploaded.length} arquivo(s) enviado(s) com sucesso!
                      </p>
                    </div>
                  )}
                  {uploadResult.errors.length > 0 && (
                    <div className="p-3 bg-destructive/10 rounded-xl">
                      {uploadResult.errors.map((err, i) => (
                        <p key={i} className="text-sm text-destructive">{err}</p>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Success */}
        {state === "success" && confirmedDate && (
          <Card className="rounded-2xl shadow-md border-success/30">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 rounded-full bg-success/10 flex items-center justify-center mb-4">
                <CheckCircle2 className="h-9 w-9 text-success" />
              </div>
              <p className="text-xl font-bold text-foreground mb-1">Cirurgia Agendada!</p>
              <p className="text-muted-foreground text-center text-sm mb-6">Seu agendamento foi confirmado com sucesso.</p>

              <div className="bg-muted rounded-xl p-4 w-full space-y-2.5">
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Calendar className="h-4 w-4 text-primary" />
                  </div>
                  <span className="capitalize text-foreground">{formatFullDate(confirmedDate)}</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Clock className="h-4 w-4 text-primary" />
                  </div>
                  <span className="text-foreground">{formatTime(confirmedDate)}</span>
                </div>
                {confirmedHospital && (
                  <div className="flex items-center gap-3 text-sm">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                      <MapPin className="h-4 w-4 text-primary" />
                    </div>
                    <span className="text-foreground">{confirmedHospital}</span>
                  </div>
                )}
              </div>

              <p className="text-xs text-muted-foreground mt-6 text-center">
                A equipe médica entrará em contato com instruções adicionais.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <p className="text-center text-caption mt-8">
          Agendamento seguro e protegido
        </p>
      </div>
    </div>
  );
};

export default PublicSchedule;
