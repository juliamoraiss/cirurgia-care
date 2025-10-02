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

const PatientForm = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  
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
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    setLoading(true);
    try {
      const { error } = await supabase.from("patients").insert([
        {
          name: formData.name,
          cpf: formData.cpf || null,
          phone: formData.phone || null,
          email: formData.email || null,
          birth_date: formData.birth_date || null,
          procedure: formData.procedure,
          hospital: formData.hospital || null,
          insurance: formData.insurance || null,
          insurance_number: formData.insurance_number || null,
          status: formData.status as any,
          notes: formData.notes || null,
          created_by: user.id,
        },
      ]);

      if (error) throw error;

      toast.success("Paciente cadastrado com sucesso!");
      navigate("/patients");
    } catch (error: any) {
      console.error("Error creating patient:", error);
      toast.error(error.message || "Erro ao cadastrar paciente");
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
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cpf">CPF</Label>
                <Input
                  id="cpf"
                  value={formData.cpf}
                  onChange={(e) => handleChange("cpf", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="phone">Telefone</Label>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => handleChange("phone", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => handleChange("email", e.target.value)}
                />
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
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="hospital">Hospital</Label>
                <Input
                  id="hospital"
                  value={formData.hospital}
                  onChange={(e) => handleChange("hospital", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="insurance">Convênio</Label>
                <Input
                  id="insurance"
                  value={formData.insurance}
                  onChange={(e) => handleChange("insurance", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="insurance_number">Número da Carteirinha</Label>
                <Input
                  id="insurance_number"
                  value={formData.insurance_number}
                  onChange={(e) => handleChange("insurance_number", e.target.value)}
                />
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
              />
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
