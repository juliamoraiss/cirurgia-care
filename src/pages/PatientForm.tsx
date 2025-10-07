import { useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { ArrowLeft } from "lucide-react";
import { toast } from "sonner";
import { z } from "zod";

// Validation schema for patient data
const patientSchema = z.object({
  name: z.string().trim().min(3, "Nome deve ter no mínimo 3 caracteres").max(100, "Nome deve ter no máximo 100 caracteres"),
  cpf: z.string().regex(/^\d{3}\.\d{3}\.\d{3}-\d{2}$/, "CPF inválido. Formato: XXX.XXX.XXX-XX").optional().or(z.literal("")),
  phone: z.string().regex(/^\([0-9]{2}\) [0-9]{4,5}-[0-9]{4}$/, "Telefone inválido. Formato: (XX) XXXXX-XXXX").optional().or(z.literal("")),
  email: z.string().email("E-mail inválido").max(255, "E-mail muito longo").optional().or(z.literal("")),
  birth_date: z.string().optional().or(z.literal("")),
  procedure: z.string().trim().min(3, "Procedimento deve ter no mínimo 3 caracteres").max(200, "Procedimento deve ter no máximo 200 caracteres"),
  hospital: z.string().max(200, "Hospital deve ter no máximo 200 caracteres").optional().or(z.literal("")),
  insurance: z.string().max(200, "Convênio deve ter no máximo 200 caracteres").optional().or(z.literal("")),
  insurance_number: z.string().max(100, "Número do convênio deve ter no máximo 100 caracteres").optional().or(z.literal("")),
  notes: z.string().max(2000, "Observações devem ter no máximo 2000 caracteres").optional().or(z.literal("")),
  status: z.enum(["awaiting_authorization", "authorized", "pending_scheduling", "scheduled", "completed", "cancelled"]),
});

const PatientForm = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  
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
  });

  const handleChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    // Clear error for this field when user starts typing
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
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

      const { error } = await supabase.from("patients").insert([
        {
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
          created_by: user.id,
        },
      ]);

      if (error) throw error;

      toast.success("Paciente cadastrado com sucesso!");
      navigate("/patients");
    } catch (error) {
      if (error instanceof z.ZodError) {
        // Map Zod errors to field names
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
        <h1 className="text-3xl font-bold text-foreground">Novo Paciente</h1>
        <p className="text-muted-foreground">
          Cadastre um novo paciente no sistema
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
                  placeholder="000.000.000-00"
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
                  placeholder="(00) 00000-0000"
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

            <div className="flex justify-end space-x-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => navigate("/patients")}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Salvando..." : "Cadastrar Paciente"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
};

export default PatientForm;
