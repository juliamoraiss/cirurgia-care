import { MessageCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { createWhatsAppUrl, safeWindowOpen } from "@/lib/urlSecurity";

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
  type: "pre_op" | "post_op" | "post_op_30_days" | "exam_followup";
  examName?: string;
}

export function WhatsAppTemplates({ patient, type, examName }: WhatsAppTemplatesProps) {
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
• Evite esforço físico intenso nos primeiros 3 dias
• Curativo: O curativo é estéril. Mantenha-o no local por dois dias. Se o curativo se soltar antes, não há problema.
• Higiene da Ferida: Mantenha a ferida sempre limpa e seca. A higienização deve ser feita com água e sabão neutro.

Em caso de dúvidas ou qualquer sintoma preocupante, entre em contato imediatamente.

Qualquer dúvida, estou à disposição.

Uma boa recuperação!`;
  }

  function getPostOp30DaysMessage() {
    return `Olá, ${firstName}, tudo bem?

Meu nome é Júlia, trabalho com o Dr. André Alves. Passando para saber como você tem se sentido desde a cirurgia e como está sendo sua recuperação.

Para nós, é muito importante saber como foi sua experiência, pois isso nos ajuda a cuidar cada vez melhor dos nossos pacientes.

Agradecemos muito por compartilhar com a gente e pela confiança em nosso trabalho.`;
  }

  function getExamFollowupMessage() {
    const exam = examName || "exame";
    return `Olá, ${firstName}! Tudo bem?
Gostaria de confirmar se você já realizou o exame ${exam}.
Se sim, poderia me avisar se já tem os resultados em mãos?
Caso ainda não tenha feito, tem previsão de quando pretende realizar?

Obrigada pela atenção.`;
  }

  const message = type === "pre_op" 
    ? getPreOpMessage() 
    : type === "post_op" 
      ? getPostOpMessage() 
      : type === "post_op_30_days"
        ? getPostOp30DaysMessage()
        : getExamFollowupMessage();

  function sendWhatsApp() {
    if (!phoneNumber || !message) {
      return;
    }
    const whatsappUrl = createWhatsAppUrl(phoneNumber, message);
    safeWindowOpen(whatsappUrl);
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
    >
      <MessageCircle className="h-4 w-4 mr-2" />
      {type === "pre_op" ? "Enviar Instruções Pré-Op" : type === "post_op" ? "Enviar Recomendações Pós-Op" : type === "post_op_30_days" ? "Enviar Follow-up 30 Dias" : "Enviar Cobrança de Exame"}
    </Button>
  );
}