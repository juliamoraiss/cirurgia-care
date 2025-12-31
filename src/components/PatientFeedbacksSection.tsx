import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Upload, X, Image, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Feedback {
  id: string;
  feedback_type: string;
  description: string | null;
  image_path: string;
  image_name: string;
  created_at: string;
  imageUrl?: string;
}

interface PatientFeedbacksSectionProps {
  patientId: string;
}

const FEEDBACK_TYPES = [
  { value: "pre_op", label: "Pré-Operatório" },
  { value: "post_op", label: "Pós-Operatório" },
  { value: "post_op_30_days", label: "30 Dias Pós-Cirurgia" },
  { value: "exam_followup", label: "Cobrança de Exame" },
  { value: "confirmation", label: "Confirmação de Cirurgia" },
  { value: "other", label: "Outro" },
];

export function PatientFeedbacksSection({ patientId }: PatientFeedbacksSectionProps) {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  // Form state
  const [selectedType, setSelectedType] = useState("other");
  const [description, setDescription] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  useEffect(() => {
    loadFeedbacks();
  }, [patientId]);

  async function loadFeedbacks() {
    try {
      const { data, error } = await supabase
        .from("patient_feedbacks")
        .select("*")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      
      // Carregar URLs das imagens para cada feedback
      const feedbacksWithUrls = await Promise.all(
        (data || []).map(async (feedback) => {
          try {
            const { data: urlData } = await supabase.storage
              .from("patient-feedbacks")
              .createSignedUrl(feedback.image_path, 3600);
            return { ...feedback, imageUrl: urlData?.signedUrl };
          } catch {
            return feedback;
          }
        })
      );
      
      setFeedbacks(feedbacksWithUrls);
    } catch (error) {
      console.error("Erro ao carregar feedbacks:", error);
    } finally {
      setLoading(false);
    }
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const allowedTypes = ["image/jpeg", "image/jpg", "image/png", "image/gif", "image/webp"];
    if (!allowedTypes.includes(file.type)) {
      toast.error("Apenas imagens são permitidas (JPEG, PNG, GIF, WEBP)");
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Arquivo muito grande. Máximo 10MB");
      return;
    }

    setSelectedFile(file);
  }

  async function handleUpload() {
    if (!selectedFile || !user) return;

    setUploading(true);
    try {
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${patientId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("patient-feedbacks")
        .upload(fileName, selectedFile);

      if (uploadError) throw uploadError;

      const { error: dbError } = await supabase
        .from("patient_feedbacks")
        .insert({
          patient_id: patientId,
          feedback_type: selectedType,
          description: description || null,
          image_path: fileName,
          image_name: selectedFile.name,
          created_by: user.id,
        });

      if (dbError) throw dbError;

      toast.success("Feedback adicionado com sucesso!");
      setDialogOpen(false);
      setSelectedFile(null);
      setDescription("");
      setSelectedType("other");
      loadFeedbacks();
    } catch (error) {
      console.error("Erro ao fazer upload:", error);
      toast.error("Erro ao salvar feedback");
    } finally {
      setUploading(false);
    }
  }


  async function deleteFeedback(feedbackId: string, imagePath: string) {
    try {
      await supabase.storage
        .from("patient-feedbacks")
        .remove([imagePath]);

      const { error } = await supabase
        .from("patient_feedbacks")
        .delete()
        .eq("id", feedbackId);

      if (error) throw error;

      toast.success("Feedback removido");
      loadFeedbacks();
    } catch (error) {
      toast.error("Erro ao remover feedback");
    }
  }

  function getTypeLabel(type: string) {
    return FEEDBACK_TYPES.find(t => t.value === type)?.label || type;
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Feedbacks</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="animate-pulse space-y-2">
            <div className="h-16 bg-muted rounded" />
            <div className="h-16 bg-muted rounded" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
          <CardTitle className="text-lg">Feedbacks de Mensagens</CardTitle>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm">
                <Plus className="h-4 w-4 mr-1" />
                Adicionar
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Feedback</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Tipo de Mensagem</Label>
                  <Select value={selectedType} onValueChange={setSelectedType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {FEEDBACK_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Descrição (opcional)</Label>
                  <Input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Ex: Paciente confirmou recebimento"
                    maxLength={200}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Print da Mensagem</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      id="feedback-file"
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                      onChange={handleFileSelect}
                      className="hidden"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => document.getElementById("feedback-file")?.click()}
                    >
                      <Upload className="h-4 w-4 mr-2" />
                      {selectedFile ? selectedFile.name : "Selecionar imagem"}
                    </Button>
                    {selectedFile && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => setSelectedFile(null)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>

                <Button
                  onClick={handleUpload}
                  disabled={!selectedFile || uploading}
                  className="w-full"
                >
                  {uploading ? "Enviando..." : "Salvar Feedback"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          {feedbacks.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              Nenhum feedback adicionado ainda.
            </p>
          ) : (
            <div className="space-y-4">
              {feedbacks.map((feedback) => (
                <div
                  key={feedback.id}
                  className="border rounded-lg overflow-hidden bg-muted/30"
                >
                  {/* Header com info e botão delete */}
                  <div className="flex items-center justify-between p-3 border-b">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">
                        {getTypeLabel(feedback.feedback_type)}
                      </p>
                      {feedback.description && (
                        <p className="text-xs text-muted-foreground truncate">
                          {feedback.description}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground">
                        {formatDate(feedback.created_at)}
                      </p>
                    </div>
                    {isAdmin && (
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteFeedback(feedback.id, feedback.image_path)}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    )}
                  </div>
                  
                  {/* Imagem diretamente visível */}
                  {feedback.imageUrl ? (
                    <button
                      type="button"
                      onClick={() => setViewingImage(feedback.imageUrl!)}
                      className="w-full cursor-pointer hover:opacity-90 transition-opacity overflow-hidden"
                    >
                      <img
                        src={feedback.imageUrl}
                        alt={`Feedback: ${getTypeLabel(feedback.feedback_type)}`}
                        className="w-full h-auto max-h-64 object-cover object-top"
                      />
                    </button>
                  ) : (
                    <div className="p-8 flex items-center justify-center">
                      <div className="animate-pulse flex items-center gap-2 text-muted-foreground">
                        <Image className="h-5 w-5" />
                        <span className="text-sm">Carregando imagem...</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Image Viewer Dialog */}
      <Dialog open={!!viewingImage} onOpenChange={() => setViewingImage(null)}>
        <DialogContent className="max-w-4xl max-h-[90vh] p-0">
          <DialogHeader className="p-4 pb-0">
            <DialogTitle>Visualizar Feedback</DialogTitle>
          </DialogHeader>
          <div className="p-4 overflow-auto max-h-[80vh]">
            {viewingImage && (
              <img
                src={viewingImage}
                alt="Feedback"
                className="w-full h-auto rounded-lg"
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
