import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "@/components/ui/dialog";
import { ArrowLeft, Upload, X, FileText } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

// Validation schema
const patientSchema = z.object({
  name: z.string().trim().min(3, "Nome deve ter no mínimo 3 caracteres").max(100, "Nome deve ter no máximo 100 caracteres"),
  cpf: z.string().regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, "CPF inválido. Formato: XXX.XXX.XXX-XX").optional().or(z.literal("")),
  phone: z.string().regex(/^\([0-9]{2}\) [0-9]{4,5}-[0-9]{4}$/, "Telefone inválido. Formato: (XX) XXXXX-XXXX").optional().or(z.literal("")),
  email: z.string().email("E-mail inválido").max(255, "E-mail muito longo").optional().or(z.literal("")),
  birth_date: z.string().optional(),
  procedure: z.string().trim().min(3, "Procedimento deve ter no mínimo 3 caracteres").max(200, "Procedimento deve ter no máximo 200 caracteres"),
  hospital: z.string().max(200, "Hospital deve ter no máximo 200 caracteres").optional().or(z.literal("")),
  insurance: z.string().max(200, "Convênio deve ter no máximo 200 caracteres").optional().or(z.literal("")),
  insurance_number: z.string().max(100, "Número da carteirinha deve ter no máximo 100 caracteres").optional().or(z.literal("")),
  notes: z.string().max(2000, "Observações devem ter no máximo 2000 caracteres").optional().or(z.literal("")),
  status: z.enum(["awaiting_authorization", "authorized", "pending_scheduling", "scheduled", "completed", "cancelled"]),
});

const PatientForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [loadingData, setLoadingData] = useState(!!id);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const isEditMode = !!id;
  
  const [formData, setFormData] = useState({
    name: "",
    cpf: "",
    phone: "",
    email: "",
    birth_date: "",
    procedure: "",
    hospital: "",
    insurance: "",
    insurance_number: "",
    status: "awaiting_authorization",
    notes: "",
    surgery_date: "",
  });
  const [files, setFiles] = useState<File[]>([]);
  const [existingFiles, setExistingFiles] = useState<any[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [viewingFile, setViewingFile] = useState<{ url: string; name: string } | null>(null);

  useEffect(() => {
    if (id) {
      loadPatientData(id);
      loadPatientFiles(id);
    }
  }, [id]);

  async function loadPatientData(patientId: string) {
    try {
      const { data, error } = await supabase
        .from("patients")
        .select("*")
        .eq("id", patientId)
        .single();

      if (error) throw error;

      if (data) {
        setFormData({
          name: data.name || "",
          cpf: data.cpf || "",
          phone: data.phone || "",
          email: data.email || "",
          birth_date: data.birth_date || "",
          procedure: data.procedure || "",
          hospital: data.hospital || "",
          insurance: data.insurance || "",
          insurance_number: data.insurance_number || "",
          status: data.status || "awaiting_authorization",
          notes: data.notes || "",
          surgery_date: data.surgery_date ? new Date(data.surgery_date).toISOString().slice(0, 16) : "",
        });
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error("Error loading patient:", error);
      }
      toast.error("Erro ao carregar dados do paciente");
      navigate("/patients");
    } finally {
      setLoadingData(false);
    }
  }

  async function loadPatientFiles(patientId: string) {
    try {
      const { data, error } = await supabase
        .from("patient_files")
        .select("*")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setExistingFiles(data || []);
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error("Error loading patient files:", error);
      }
    }
  }

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files || []);
    const pdfFiles = selectedFiles.filter(file => file.type === "application/pdf");
    
    if (pdfFiles.length !== selectedFiles.length) {
      toast.error("Apenas arquivos PDF são permitidos");
    }
    
    setFiles(prev => [...prev, ...pdfFiles]);
  };

  const removeFile = (index: number) => {
    setFiles(prev => prev.filter((_, i) => i !== index));
  };

  const viewFile = async (filePath: string, fileName: string) => {
    try {
      const { data, error } = await supabase.storage
        .from("patient-files")
        .createSignedUrl(filePath, 3600); // URL válida por 1 hora

      if (error) throw error;
      if (data?.signedUrl) {
        setViewingFile({ url: data.signedUrl, name: fileName });
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error("Error viewing file:", error);
      }
      toast.error("Erro ao carregar arquivo");
    }
  };

  const deleteExistingFile = async (fileId: string, filePath: string) => {
    try {
      const { error: storageError } = await supabase.storage
        .from("patient-files")
        .remove([filePath]);

      if (storageError) throw storageError;

      const { error: dbError } = await supabase
        .from("patient_files")
        .delete()
        .eq("id", fileId);

      if (dbError) throw dbError;

      setExistingFiles(prev => prev.filter(f => f.id !== fileId));
      toast.success("Arquivo removido com sucesso");
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error("Error deleting file:", error);
      }
      toast.error("Erro ao remover arquivo");
    }
  };

  const uploadFiles = async (patientId: string) => {
    if (files.length === 0) return;

    setUploadingFiles(true);
    try {
      for (const file of files) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${patientId}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;

        const { error: uploadError } = await supabase.storage
          .from("patient-files")
          .upload(fileName, file);

        if (uploadError) throw uploadError;

        const { error: dbError } = await supabase
          .from("patient_files")
          .insert({
            patient_id: patientId,
            file_path: fileName,
            file_name: file.name,
            file_type: file.type,
            file_size: file.size,
            uploaded_by: user!.id,
          });

        if (dbError) throw dbError;
      }

      setFiles([]);
      if (id) {
        await loadPatientFiles(id);
      }
    } catch (error) {
      if (process.env.NODE_ENV === 'development') {
        console.error("Error uploading files:", error);
      }
      throw error;
    } finally {
      setUploadingFiles(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setErrors({});
    setLoading(true);

    try {
      // Validate form data
      const validatedData = patientSchema.parse(formData);

      const patientData = {
        name: validatedData.name,
        cpf: validatedData.cpf || null,
        phone: validatedData.phone || null,
        email: validatedData.email || null,
        birth_date: validatedData.birth_date || null,
        procedure: validatedData.procedure,
        hospital: validatedData.hospital || null,
        insurance: validatedData.insurance || null,
        insurance_number: validatedData.insurance_number || null,
        status: validatedData.status as any,
        notes: validatedData.notes || null,
        surgery_date: formData.surgery_date ? new Date(formData.surgery_date).toISOString() : null,
      };

      let error;
      let savedPatientId = id;

      if (isEditMode && id) {
        const result = await supabase
          .from("patients")
          .update(patientData)
          .eq("id", id);
        error = result.error;
      } else {
        const result = await supabase
          .from("patients")
          .insert([{ ...patientData, created_by: user.id }])
          .select()
          .single();
        error = result.error;
        if (result.data) {
          savedPatientId = result.data.id;
        }
      }

      if (error) throw error;

      if (files.length > 0 && savedPatientId) {
        await uploadFiles(savedPatientId);
      }

      toast.success(isEditMode ? "Paciente atualizado com sucesso!" : "Paciente cadastrado com sucesso!");
      navigate("/patients");
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldErrors: Record<string, string> = {};
        error.errors.forEach((err) => {
          if (err.path[0]) {
            fieldErrors[err.path[0] as string] = err.message;
          }
        });
        setErrors(fieldErrors);
        toast.error("Por favor, corrija os erros no formulário");
      } else {
        if (process.env.NODE_ENV === 'development') {
          console.error("Error creating patient:", error);
        }
        toast.error("Erro ao cadastrar paciente");
      }
    } finally {
      setLoading(false);
    }
  };

  if (loadingData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto"></div>
          <p className="mt-4 text-muted-foreground">Carregando...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-4xl mx-auto space-y-6">
      <div>
        <Button
          variant="ghost"
          onClick={() => navigate("/patients")}
          className="mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Voltar
        </Button>
        <h1 className="text-3xl font-bold text-foreground">
          {isEditMode ? "Editar Paciente" : "Novo Paciente"}
        </h1>
        <p className="text-muted-foreground">
          {isEditMode ? "Atualize as informações do paciente" : "Cadastre um novo paciente no sistema"}
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <CardTitle>Dados do Paciente</CardTitle>
            <CardDescription>
              Preencha as informações do paciente e do procedimento
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="name">Nome Completo *</Label>
                <Input
                  id="name"
                  required
                  value={formData.name}
                  onChange={(e) => handleChange("name", e.target.value)}
                  className={errors.name ? "border-destructive" : ""}
                />
                {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="cpf">CPF</Label>
                <Input
                  id="cpf"
                  value={formData.cpf}
                  onChange={(e) => handleChange("cpf", e.target.value)}
                  placeholder="XXX.XXX.XXX-XX"
                  className={errors.cpf ? "border-destructive" : ""}
                />
                {errors.cpf && <p className="text-sm text-destructive">{errors.cpf}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                  placeholder="(XX) XXXXX-XXXX"
                  className={errors.phone ? "border-destructive" : ""}
                />
                {errors.phone && <p className="text-sm text-destructive">{errors.phone}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                  className={errors.email ? "border-destructive" : ""}
                />
                {errors.email && <p className="text-sm text-destructive">{errors.email}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="birth_date">Data de Nascimento</Label>
                <Input
                  id="birth_date"
                  type="date"
                  value={formData.birth_date}
                  onChange={(e) => handleChange("birth_date", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="surgery_date">Data da Cirurgia</Label>
                <Input
                  id="surgery_date"
                  type="datetime-local"
                  value={formData.surgery_date}
                  onChange={(e) => handleChange("surgery_date", e.target.value)}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="procedure">Procedimento *</Label>
              <Input
                id="procedure"
                required
                value={formData.procedure}
                onChange={(e) => handleChange("procedure", e.target.value)}
                placeholder="Ex: Artroscopia de joelho"
                className={errors.procedure ? "border-destructive" : ""}
              />
              {errors.procedure && <p className="text-sm text-destructive">{errors.procedure}</p>}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="hospital">Hospital</Label>
                <Input
                  id="hospital"
                  value={formData.hospital}
                  onChange={(e) => handleChange("hospital", e.target.value)}
                  className={errors.hospital ? "border-destructive" : ""}
                />
                {errors.hospital && <p className="text-sm text-destructive">{errors.hospital}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="insurance">Convênio</Label>
                <Input
                  id="insurance"
                  value={formData.insurance}
                  onChange={(e) => handleChange("insurance", e.target.value)}
                  className={errors.insurance ? "border-destructive" : ""}
                />
                {errors.insurance && <p className="text-sm text-destructive">{errors.insurance}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="insurance_number">Número da Carteirinha</Label>
                <Input
                  id="insurance_number"
                  value={formData.insurance_number}
                  onChange={(e) => handleChange("insurance_number", e.target.value)}
                  className={errors.insurance_number ? "border-destructive" : ""}
                />
                {errors.insurance_number && <p className="text-sm text-destructive">{errors.insurance_number}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status Inicial</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => handleChange("status", value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="awaiting_authorization">
                      Aguardando Autorização
                    </SelectItem>
                    <SelectItem value="authorized">Autorizado</SelectItem>
                    <SelectItem value="pending_scheduling">
                      Pendente de Marcação
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Observações</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) => handleChange("notes", e.target.value)}
                rows={4}
                placeholder="Informações adicionais sobre o paciente ou procedimento..."
                className={errors.notes ? "border-destructive" : ""}
              />
              {errors.notes && <p className="text-sm text-destructive">{errors.notes}</p>}
            </div>

            <div className="space-y-4">
              <Label>Exames (PDF)</Label>
              
              {existingFiles.length > 0 && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Arquivos já enviados:</p>
                  {existingFiles.map((file) => (
                    <div key={file.id} className="flex items-center justify-between p-3 border rounded-lg bg-muted/50">
                      <button
                        type="button"
                        onClick={() => viewFile(file.file_path, file.file_name)}
                        className="flex items-center gap-2 flex-1 text-left hover:opacity-70 transition-opacity"
                      >
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm">{file.file_name}</span>
                      </button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => deleteExistingFile(file.id, file.file_path)}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                </div>
              )}

              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    id="file-upload"
                    type="file"
                    accept="application/pdf"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => document.getElementById("file-upload")?.click()}
                  >
                    <Upload className="h-4 w-4 mr-2" />
                    Adicionar Exames
                  </Button>
                </div>

                {files.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">Novos arquivos a serem enviados:</p>
                    {files.map((file, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm">{file.name}</span>
                          <span className="text-xs text-muted-foreground">
                            ({(file.size / 1024).toFixed(1)} KB)
                          </span>
                        </div>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(index)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/patients")}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading || uploadingFiles}>
                {loading || uploadingFiles ? "Salvando..." : isEditMode ? "Atualizar Paciente" : "Cadastrar Paciente"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      <Dialog open={!!viewingFile} onOpenChange={() => setViewingFile(null)}>
        <DialogContent className="max-w-4xl h-[90vh]">
          <DialogHeader>
            <DialogTitle>{viewingFile?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 w-full h-full">
            {viewingFile && (
              <iframe
                src={viewingFile.url}
                className="w-full h-full border-0"
                title={viewingFile.name}
              />
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default PatientForm;
