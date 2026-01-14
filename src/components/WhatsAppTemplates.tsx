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
  type: "pre_op" | "post_op" | "post_op_30_days" | "exam_followup" | "surgery_confirmation_patient" | "surgery_confirmation_doctor";
  examName?: string;
  doctorPhone?: string;
}

export function WhatsAppTemplates({ patient, type, examName, doctorPhone }: WhatsAppTemplatesProps) {
  const firstName = patient.name.split(" ")[0];
  const treatment = patient.gender === "masculino" ? "o senhor" : patient.gender === "feminino" ? "a senhora" : "você";
  const phoneNumber = patient.phone.replace(/\D/g, "");
  const doctorPhoneNumber = doctorPhone?.replace(/\D/g, "") || "61999999999";

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
🚫 Não é permitido estar com extensão de cílios no dia da cirurgia.
📋 Leve todos os exames pré-operatórios (laboratoriais, de imagem) e demais documentos solicitados pelo médico.

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

  function getSurgeryConfirmationPatientMessage() {
    if (!patient.surgery_date) return "";

    const surgeryDate = new Date(patient.surgery_date);
    const formattedDate = format(surgeryDate, "dd/MM/yyyy", { locale: ptBR });
    const formattedTime = format(surgeryDate, "HH:mm", { locale: ptBR });

    return `Olá, ${firstName}! Tudo bem?
Passando para confirmar que sua cirurgia foi agendada com sucesso.

🗓 Data: ${formattedDate}
⏰ Horário: ${formattedTime}
🏥 Local: ${patient.hospital || "Hospital Brasília"}

Qualquer dúvida ou necessidade de ajuste, estou à disposição por aqui.`;
  }

  function getSurgeryConfirmationDoctorMessage() {
    if (!patient.surgery_date) return "";

    const surgeryDate = new Date(patient.surgery_date);
    const formattedDate = format(surgeryDate, "dd/MM/yyyy", { locale: ptBR });
    const formattedTime = format(surgeryDate, "HH:mm", { locale: ptBR });

    // Criar link do Google Calendar
    const endDate = new Date(surgeryDate);
    endDate.setHours(endDate.getHours() + 2);
    
    const formatCalendarDate = (date: Date) => {
      return date.toISOString().replace(/[-:]/g, '').split('.')[0] + 'Z';
    };
    
    const calendarTitle = `Cirurgia: ${patient.procedure} - ${patient.name}`;
    const calendarDetails = `Paciente: ${patient.name}\nProcedimento: ${patient.procedure}`;
    const calendarLocation = patient.hospital || "Hospital Brasília";
    
    const googleCalendarLink = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(calendarTitle)}&dates=${formatCalendarDate(surgeryDate)}/${formatCalendarDate(endDate)}&details=${encodeURIComponent(calendarDetails)}&location=${encodeURIComponent(calendarLocation)}`;

    return `🏥 Nova Cirurgia Agendada

👤 Paciente: ${patient.name}
🔬 Procedimento: ${patient.procedure}
📅 Data: ${formattedDate}
⏰ Horário: ${formattedTime}
🏥 Local: ${patient.hospital || "Hospital Brasília"}

📆 Adicionar ao Google Agenda:
${googleCalendarLink}`;
  }

  const message = type === "pre_op" 
    ? getPreOpMessage() 
    : type === "post_op" 
      ? getPostOpMessage() 
      : type === "post_op_30_days"
        ? getPostOp30DaysMessage()
        : type === "surgery_confirmation_patient"
          ? getSurgeryConfirmationPatientMessage()
          : type === "surgery_confirmation_doctor"
            ? getSurgeryConfirmationDoctorMessage()
            : getExamFollowupMessage();

  const targetPhone = type === "surgery_confirmation_doctor" ? doctorPhoneNumber : phoneNumber;

  function sendWhatsApp() {
    if (!targetPhone || !message) {
      return;
    }
    const whatsappUrl = createWhatsAppUrl(targetPhone, message);
    safeWindowOpen(whatsappUrl);
  }

  if (!targetPhone) {
    return null;
  }

  const getButtonLabel = () => {
    switch (type) {
      case "pre_op":
        return { short: "Enviar Pré-Op", full: "Enviar Instruções Pré-Op" };
      case "post_op":
        return { short: "Enviar Pós-Op", full: "Enviar Recomendações Pós-Op" };
      case "post_op_30_days":
        return { short: "Follow-up 30d", full: "Enviar Follow-up 30 Dias" };
      case "surgery_confirmation_patient":
        return { short: "Confirmar Paciente", full: "Enviar Confirmação ao Paciente" };
      case "surgery_confirmation_doctor":
        return { short: "Confirmar Médico", full: "Enviar Confirmação ao Médico" };
      default:
        return { short: "Cobrar Exame", full: "Enviar Cobrança de Exame" };
    }
  };

  const label = getButtonLabel();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      className="text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3"
      onClick={sendWhatsApp}
    >
      <MessageCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4 mr-1 sm:mr-2 shrink-0" />
      <span className="hidden sm:inline">{label.full}</span>
      <span className="sm:hidden">{label.short}</span>
    </Button>
  );
}