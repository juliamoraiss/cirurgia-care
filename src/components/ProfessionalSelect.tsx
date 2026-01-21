import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useProfessionals } from "@/hooks/useProfessionals";

interface ProfessionalSelectProps {
  value: string;
  onChange: (value: string) => void;
  error?: string;
}

export function ProfessionalSelect({ value, onChange, error }: ProfessionalSelectProps) {
  const { professionals, loading } = useProfessionals();

  const getProfessionalLabel = (professional: { full_name: string; user_type: string | null }) => {
    const type = professional.user_type === "dentista" ? "Dentista" : "Médico";
    return `${professional.full_name} (${type})`;
  };

  return (
    <div className="space-y-2">
      <Label htmlFor="responsible_user_id">Profissional Responsável *</Label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className={error ? "border-destructive" : ""}>
          <SelectValue placeholder={loading ? "Carregando..." : "Selecione o profissional"} />
        </SelectTrigger>
        <SelectContent>
          {professionals.map((professional) => (
            <SelectItem key={professional.id} value={professional.id}>
              {getProfessionalLabel(professional)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {error && <p className="text-sm text-destructive">{error}</p>}
    </div>
  );
}
