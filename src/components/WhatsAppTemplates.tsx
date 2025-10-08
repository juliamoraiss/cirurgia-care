import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Patient {
  name: string;
  phone: string;
  procedure: string;
  hospital: string;
  surgery_date: string;
  gender: string;
}

interface WhatsAppTemplatesProps {
  patient: Patient;
  type: "pre_op" | "post_op";
}

export function WhatsAppTemplates({ patient, type }: WhatsAppTemplatesProps) {
  const firstName = patient.name.split(" ")[0];
  const treatment = patient.gender === "masculino" ? "o senhor" : patient.gender === "feminino" ? "a senhora" : "você";
  const phoneNumber = patient.phone.replace(/\D/g, "");

  function getPreOpMessage() {
    if (!patient.surgery_date) return "";

    const surgeryDate = new Date(patient.surgery_date);
    const surgeryDateStr = format(surgeryDate, "dd/MM/yyyy", { locale: ptBR });
    const surgeryTime = format(surgeryDate, "HH:mm", { locale: ptBR });

    return `Olá, ${firstName}.
Estou vindo aqui para passar as instruções para o seu procedimento.

📍 A sua cirurgia — ${patient.procedure} — está agendada para amanhã (${surgeryDateStr}) às ${surgeryTime}, no ${patient.hospital || "Hospital Brasília"}.
⏰ Solicitamos que chegue com 2 horas de antecedência para os preparativos.
🥣 É necessário realizar jejum absoluto de 8 horas (sólidos e líquidos) antes do horário da cirurgia.

Qualquer dúvida, estou à disposição para orientá-${treatment === "o senhor" ? "lo" : "la"}.`;
  }

  function getPostOpMessage() {
    return `Olá, ${firstName}! 
Espero que ${treatment === "o senhor" ? "o senhor esteja" : treatment === "a senhora" ? "a senhora esteja" : "você esteja"} se recuperando bem da cirurgia.

📋 Recomendações pós-operatórias:
• Mantenha repouso conforme orientado pelo Dr. André Alves
• Tome os medicamentos prescritos nos horários corretos
• Observe a região operada e comunique qualquer alteração
• Evite esforço físico nas primeiras semanas
• Mantenha a alimentação leve e saudável
• Compareça às consultas de retorno agendadas

Em caso de dúvidas ou qualquer sintoma preocupante, entre em contato imediatamente.

Qualquer dúvida, estou à disposição.
Melhoras! 🌸`;
  }

  const message = type === "pre_op" ? getPreOpMessage() : getPostOpMessage();

  function sendWhatsApp() {
    if (!phoneNumber || !message) {
      return;
    }
    const whatsappUrl = `https://wa.me/55${phoneNumber}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, "_blank");
  }

  if (!phoneNumber) {
    return null;
  }

  return (
    <Button
      type="button"
      variant="outline"
      className="w-full"
      onClick={sendWhatsApp}
      disabled={!message}
    >
      <MessageCircle className="h-4 w-4 mr-2" />
      {type === "pre_op" ? "Enviar Instruções Pré-Op" : "Enviar Recomendações Pós-Op"}
    </Button>
  );
}