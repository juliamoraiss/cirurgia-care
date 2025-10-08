import { useState, useEffect } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { ArrowLeft, Upload, X, FileText, MessageCircle, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";
import { PatientTasksSection } from "@/components/PatientTasksSection";
import { PatientNotesSection } from "@/components/PatientNotesSection";

// Validation schema with enhanced security
const patientSchema = z.object({
  name: z.string().trim().min(3, "Nome deve ter no mínimo 3 caracteres").max(200, "Nome deve ter no máximo 200 caracteres"),
  cpf: z.string().regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, "CPF inválido. Formato: XXX.XXX.XXX-XX").optional().or(z.literal("")),
  phone: z.string().regex(/^\([0-9]{2}\) [0-9]{4,5}-[0-9]{4}$/, "Telefone inválido. Formato: (XX) XXXXX-XXXX").optional().or(z.literal("")),
  email: z.string().email("Email inválido").max(255, "Email deve ter no máximo 255 caracteres").optional().or(z.literal("")),
  birth_date: z.string().optional(),
  gender: z.enum(["masculino", "feminino"]).optional(),
  procedure: z.string().trim().min(3, "Procedimento deve ter no mínimo 3 caracteres").max(500, "Procedimento deve ter no máximo 500 caracteres"),
  hospital: z.string().max(200, "Hospital deve ter no máximo 200 caracteres").optional().or(z.literal("")),
  insurance: z.string().max(200, "Convênio deve ter no máximo 200 caracteres").optional().or(z.literal("")),
  insurance_number: z.string().max(100, "Número do convênio deve ter no máximo 100 caracteres").optional().or(z.literal("")),
  notes: z.string().max(5000, "Observações devem ter no máximo 5000 caracteres").optional().or(z.literal("")),
  status: z.enum(["awaiting_authorization", "authorized", "pending_scheduling", "scheduled", "completed", "cancelled"]),
});

const PatientForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const { isAdmin } = useUserRole();
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
    gender: "",
    procedure: "",
    hospital: "",
    insurance: "",
    insurance_number: "",
    status: "awaiting_authorization",
    notes: "",
    surgery_date: "",
    guide_validity_date: "",
  });
  const [files, setFiles] = useState<File[]>([]);
  const [existingFiles, setExistingFiles] = useState<any[]>([]);
  const [uploadingFiles, setUploadingFiles] = useState(false);
  const [viewingFile, setViewingFile] = useState<{ url: string; name: string } | null>(null);
  const [examsChecklist, setExamsChecklist] = useState<string[]>([]);
  const [checkedExams, setCheckedExams] = useState<string[]>([]);
  const [deletingPatient, setDeletingPatient] = useState(false);

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
        // Extract checklist before setting formData to preserve it
        const savedExams = data.exams_checklist || [];
        
        // Convert UTC timestamp to local datetime-local format
        let localSurgeryDate = "";
        if (data.surgery_date) {
          const date = new Date(data.surgery_date);
          // Format to YYYY-MM-DDTHH:mm for datetime-local input
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          const hours = String(date.getHours()).padStart(2, '0');
          const minutes = String(date.getMinutes()).padStart(2, '0');
          localSurgeryDate = `${year}-${month}-${day}T${hours}:${minutes}`;
        }
        
        setFormData({
          name: data.name || "",
          cpf: data.cpf || "",
          phone: data.phone || "",
          email: data.email || "",
          birth_date: data.birth_date || "",
          gender: data.gender || "",
          procedure: data.procedure || "",
          hospital: data.hospital || "",
          insurance: data.insurance || "",
          insurance_number: data.insurance_number || "",
          status: data.status || "awaiting_authorization",
          notes: data.notes || "",
          surgery_date: localSurgeryDate,
          guide_validity_date: data.guide_validity_date || "",
        });
        
        // Set checklist for the procedure and restore checked exams
        const procedureExams = getExamsForProcedure(data.procedure || "");
        setExamsChecklist(procedureExams);
        setCheckedExams(savedExams);
      }
    } catch (error) {
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
      // Error logged server-side
    }
  }

  const formatCPF = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 11) {
      return numbers
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d)/, '$1.$2')
        .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
    }
    return value;
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    if (numbers.length <= 11) {
      return numbers
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{5})(\d)/, '$1-$2');
    }
    return value;
  };

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

  const formatNameToTitleCase = (name: string) => {
    return name
      .toLowerCase()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  };

  const handleChange = (field: string, value: string) => {
    let formattedValue = value;
    
    if (field === 'cpf') {
      formattedValue = formatCPF(value);
    } else if (field === 'phone') {
      formattedValue = formatPhone(value);
    } else if (field === 'name') {
      formattedValue = formatNameToTitleCase(value);
    }
    
    setFormData((prev) => ({ ...prev, [field]: formattedValue }));
    
    if (field === 'procedure') {
      const newExams = getExamsForProcedure(value);
      setExamsChecklist(newExams);
      // Only clear checked exams if not in edit mode or if procedure actually changed
      if (!isEditMode || formData.procedure !== value) {
        setCheckedExams([]);
      }
    }
    
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const toggleExam = (exam: string) => {
    setCheckedExams(prev => 
      prev.includes(exam) 
        ? prev.filter(e => e !== exam)
        : [...prev, exam]
    );
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
      throw error;
    } finally {
      setUploadingFiles(false);
    }
  };

  const createAutomaticTasks = async (patientId: string, surgeryDateISO: string, patientName: string, procedure: string) => {
    try {
      const surgeryDate = new Date(surgeryDateISO);
      
      // Tarefa de instruções pré-operatórias (1 dia antes, meia-noite)
      const preOpDate = new Date(surgeryDate);
      preOpDate.setDate(preOpDate.getDate() - 1);
      preOpDate.setHours(0, 0, 0, 0);
      
      // Verificar se já existe tarefa pré-op não concluída
      const { data: existingPreOp } = await supabase
        .from("patient_tasks")
        .select("id")
        .eq("patient_id", patientId)
        .eq("task_type", "pre_op_instructions")
        .eq("completed", false)
        .single();
      
      if (!existingPreOp) {
        await supabase.from("patient_tasks").insert({
          patient_id: patientId,
          task_type: "pre_op_instructions",
          title: "Enviar instruções pré-operatórias",
          description: `Enviar instruções ao paciente ${patientName} para a cirurgia de ${procedure}`,
          due_date: preOpDate.toISOString(),
          created_by: user!.id,
        });
      }
      
      // Tarefa de recomendações pós-operatórias (mesma data, 5 horas após)
      const postOpDate = new Date(surgeryDate);
      postOpDate.setHours(postOpDate.getHours() + 5);
      
      // Verificar se já existe tarefa pós-op não concluída
      const { data: existingPostOp } = await supabase
        .from("patient_tasks")
        .select("id")
        .eq("patient_id", patientId)
        .eq("task_type", "post_op_instructions")
        .eq("completed", false)
        .single();
      
      if (!existingPostOp) {
        await supabase.from("patient_tasks").insert({
          patient_id: patientId,
          task_type: "post_op_instructions",
          title: "Enviar recomendações pós-operatórias",
          description: `Enviar recomendações ao paciente ${patientName}`,
          due_date: postOpDate.toISOString(),
          created_by: user!.id,
        });
      }
    } catch (error) {
      console.error("Erro ao criar tarefas automáticas:", error);
      // Não lançar erro para não interromper o fluxo principal
    }
  };

  const handleDeletePatient = async () => {
    if (!id || !user) return;

    setDeletingPatient(true);
    try {
      // Primeiro, excluir todos os arquivos do storage
      const { data: filesData } = await supabase
        .from("patient_files")
        .select("file_path")
        .eq("patient_id", id);

      if (filesData && filesData.length > 0) {
        const filePaths = filesData.map(f => f.file_path);
        await supabase.storage
          .from("patient-files")
          .remove(filePaths);
      }

      // Excluir registros de arquivos
      await supabase
        .from("patient_files")
        .delete()
        .eq("patient_id", id);

      // Excluir histórico do paciente
      await supabase
        .from("patient_history")
        .delete()
        .eq("patient_id", id);

      // Excluir o paciente
      const { error } = await supabase
        .from("patients")
        .delete()
        .eq("id", id);

      if (error) throw error;

      toast.success("Paciente excluído com sucesso!");
      navigate("/patients");
    } catch (error) {
      toast.error("Erro ao excluir paciente");
    } finally {
      setDeletingPatient(false);
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

      // Convert local datetime-local to UTC for storage
      let utcSurgeryDate = null;
      if (formData.surgery_date) {
        // datetime-local gives us "YYYY-MM-DDTHH:mm" in local time
        // Create date object from local time string
        const localDate = new Date(formData.surgery_date);
        utcSurgeryDate = localDate.toISOString();
      }
      
      // Validate that surgery_date doesn't exceed guide_validity_date
      if (formData.surgery_date && formData.guide_validity_date) {
        const surgeryDate = new Date(formData.surgery_date);
        const validityDate = new Date(formData.guide_validity_date);
        
        if (surgeryDate > validityDate) {
          toast.error("A data da cirurgia não pode ultrapassar a validade da guia");
          setLoading(false);
          return;
        }
      }
      
      const patientData = {
        name: validatedData.name,
        cpf: validatedData.cpf || null,
        phone: validatedData.phone || null,
        email: validatedData.email || null,
        birth_date: validatedData.birth_date || null,
        gender: validatedData.gender || null,
        procedure: validatedData.procedure,
        hospital: validatedData.hospital || null,
        insurance: validatedData.insurance || null,
        insurance_number: validatedData.insurance_number || null,
        status: validatedData.status as any,
        notes: validatedData.notes || null,
        surgery_date: utcSurgeryDate,
        exams_checklist: checkedExams,
        guide_validity_date: formData.guide_validity_date || null,
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

      // Criar tarefas automaticamente se houver data de cirurgia
      if (utcSurgeryDate && savedPatientId) {
        await createAutomaticTasks(savedPatientId, utcSurgeryDate, validatedData.name, validatedData.procedure);
      }

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

  // Verificar se o usuário é admin
  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle>Acesso Restrito</CardTitle>
            <CardDescription>
              Apenas administradores podem criar ou editar pacientes.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => navigate("/patients")} className="w-full">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Voltar para Pacientes
            </Button>
          </CardContent>
        </Card>
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
                <Label htmlFor="birth_date">Data de Nascimento</Label>
                <Input
                  id="birth_date"
                  type="date"
                  value={formData.birth_date}
                  onChange={(e) => handleChange("birth_date", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="gender">Gênero</Label>
                <Select
                  value={formData.gender}
                  onValueChange={(value) => handleChange("gender", value)}
                >
                  <SelectTrigger className={errors.gender ? "border-destructive" : ""}>
                    <SelectValue placeholder="Selecione o gênero" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="masculino">Masculino</SelectItem>
                    <SelectItem value="feminino">Feminino</SelectItem>
                  </SelectContent>
                </Select>
                {errors.gender && <p className="text-sm text-destructive">{errors.gender}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="guide_validity_date">Validade da Guia</Label>
                <Input
                  id="guide_validity_date"
                  type="date"
                  value={formData.guide_validity_date}
                  onChange={(e) => handleChange("guide_validity_date", e.target.value)}
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
              <Select
                value={formData.procedure}
                onValueChange={(value) => handleChange("procedure", value)}
              >
                <SelectTrigger className={errors.procedure ? "border-destructive" : ""}>
                  <SelectValue placeholder="Selecione o procedimento" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="simpatectomia">Simpatectomia</SelectItem>
                  <SelectItem value="lobectomia">Lobectomia</SelectItem>
                  <SelectItem value="broncoscopia">Broncoscopia</SelectItem>
                  <SelectItem value="rinoplastia">Rinoplastia</SelectItem>
                </SelectContent>
              </Select>
              {errors.procedure && <p className="text-sm text-destructive">{errors.procedure}</p>}
            </div>

            {examsChecklist.length > 0 && (
              <div className="space-y-3">
                <Label>Checklist de Exames</Label>
                <div className="space-y-2 border rounded-lg p-4">
                  {examsChecklist.map((exam) => (
                    <div key={exam} className="flex items-center space-x-2">
                      <Checkbox
                        id={exam}
                        checked={checkedExams.includes(exam)}
                        onCheckedChange={() => toggleExam(exam)}
                      />
                      <label
                        htmlFor={exam}
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70 cursor-pointer"
                      >
                        {exam}
                      </label>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="hospital">Hospital</Label>
                <Select
                  value={formData.hospital}
                  onValueChange={(value) => handleChange("hospital", value)}
                >
                  <SelectTrigger className={errors.hospital ? "border-destructive" : ""}>
                    <SelectValue placeholder="Selecione o hospital" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Hospital Brasília">Hospital Brasília</SelectItem>
                    <SelectItem value="Hospital Anchieta">Hospital Anchieta</SelectItem>
                  </SelectContent>
                </Select>
                {errors.hospital && <p className="text-sm text-destructive">{errors.hospital}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="insurance">Convênio</Label>
                <Select
                  value={formData.insurance}
                  onValueChange={(value) => handleChange("insurance", value)}
                >
                  <SelectTrigger className={errors.insurance ? "border-destructive" : ""}>
                    <SelectValue placeholder="Selecione o convênio" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ASSEFAZ">ASSEFAZ</SelectItem>
                    <SelectItem value="FUSEX">FUSEX</SelectItem>
                    <SelectItem value="QUALLITY">QUALLITY</SelectItem>
                    <SelectItem value="Plenum saúde">Plenum saúde</SelectItem>
                    <SelectItem value="Sulamerica">Sulamerica</SelectItem>
                    <SelectItem value="POSTAL SAUDE">POSTAL SAUDE</SelectItem>
                  </SelectContent>
                </Select>
                {errors.insurance && <p className="text-sm text-destructive">{errors.insurance}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
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
                    <SelectItem value="completed">Cirurgia Realizada</SelectItem>
                    <SelectItem value="cancelled">Cirurgia Cancelada</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {formData.status === "authorized" && formData.phone.trim() !== "" && (
              <Button
                type="button"
                variant="outline"
                className="w-full"
                onClick={() => {
                  const phoneNumber = formData.phone.replace(/\D/g, '');
                  
                  // Determinar tratamento baseado no gênero
                  const treatment = formData.gender === "masculino" ? "o senhor" : formData.gender === "feminino" ? "a senhora" : "o(a) senhor(a)";
                  
                  // Determinar se é singular ou plural para exames
                  const examCount = examsChecklist.length;
                  const examWord = examCount === 1 ? "o exame" : "os exames";
                  
                  // Montar lista de exames com checkmarks
                  const examsWithCheckmarks = examsChecklist.map(exam => `✅ ${exam}`).join('\n');
                  const examsSection = examsWithCheckmarks || 'exames necessários';
                  
                  const message = `Olá, ${formData.name}, como vai?\nMe chamo Júlia, sou da equipe do Dr. André Alves.\n\nEstou passando para informar que a sua cirurgia foi autorizada!\nAntes de seguirmos com o agendamento no ${formData.hospital || 'Hospital Brasília'}, gostaria de confirmar se ${treatment} já realizou ${examWord}:\n${examsSection}\n\nQualquer dúvida estou à disposição.\nObrigada.`;
                  const whatsappUrl = `https://wa.me/55${phoneNumber}?text=${encodeURIComponent(message)}`;
                  window.open(whatsappUrl, '_blank');
                }}
              >
                <MessageCircle className="h-4 w-4 mr-2" />
                Enviar mensagem
              </Button>
            )}

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
              <Label>Exames</Label>
              
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

            <div className="flex justify-between items-center pt-4">
              {isEditMode && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      type="button"
                      variant="destructive"
                      disabled={deletingPatient}
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Excluir Paciente
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Esta ação não pode ser desfeita. Isso irá excluir permanentemente o paciente
                        <strong> {formData.name}</strong>, todos os seus arquivos e histórico.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Cancelar</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={handleDeletePatient}
                        className="bg-destructive hover:bg-destructive/90"
                      >
                        {deletingPatient ? "Excluindo..." : "Excluir"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
              <div className="flex space-x-2 ml-auto">
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
            </div>
          </CardContent>
        </Card>
      </form>

      {isEditMode && id && (
        <div className="grid gap-6 md:grid-cols-2 mt-6">
          <PatientTasksSection patientId={id} />
          <PatientNotesSection patientId={id} />
        </div>
      )}

      <Dialog open={!!viewingFile} onOpenChange={() => setViewingFile(null)}>
        <DialogContent className="max-w-5xl max-h-[95vh] h-[95vh] flex flex-col p-0">
          <DialogHeader className="p-6 pb-4">
            <DialogTitle>{viewingFile?.name}</DialogTitle>
          </DialogHeader>
          <div className="flex-1 px-6 pb-6 overflow-hidden">
            {viewingFile && (
              <iframe
                src={viewingFile.url}
                className="w-full h-full border-0 rounded-lg"
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
