import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, Calendar, MessageCircle, CheckCircle2, XCircle, AlertCircle, Clock } from "lucide-react";
import { format, isToday, isTomorrow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState, ReactNode } from "react";

interface PatientCardSwipeableProps {
  patient: {
    id: string;
    name: string;
    procedure: string;
    hospital: string | null;
    status: string;
    surgery_date: string | null;
    phone?: string | null;
    exams_checklist: string[] | null;
  };
  requiredExams: string[];
  isAdmin: boolean;
  onEdit: () => void;
  onClick: () => void;
}

export function PatientCardSwipeable({
  patient,
  requiredExams,
  isAdmin,
  onEdit,
  onClick,
}: PatientCardSwipeableProps) {
  const [swiped, setSwiped] = useState(false);
  const x = useMotionValue(0);
  const backgroundColor = useTransform(
    x,
    [-100, 0],
    ["hsl(var(--destructive))", "transparent"]
  );

  const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (info.offset.x < -50) {
      setSwiped(true);
    } else {
      setSwiped(false);
      x.set(0);
    }
  };

  const checkedExams = patient.exams_checklist || [];
  const allExamsChecked = requiredExams.length > 0 && 
    requiredExams.every(exam => checkedExams.includes(exam));
  const hasExamsPending = requiredExams.length > 0 && !allExamsChecked;
  
  const surgeryDate = patient.surgery_date ? new Date(patient.surgery_date) : null;
  const isSurgeryToday = surgeryDate && isToday(surgeryDate);
  const isSurgeryTomorrow = surgeryDate && isTomorrow(surgeryDate);
  const isSurgeryUrgent = isSurgeryToday || isSurgeryTomorrow;

  const getStatusIcon = (): ReactNode => {
    if (patient.status === 'cancelled') {
      return <XCircle className="h-4 w-4 text-destructive" />;
    }
    if (isSurgeryToday) {
      return <AlertCircle className="h-4 w-4 text-destructive animate-pulse" />;
    }
    if (isSurgeryTomorrow) {
      return <Clock className="h-4 w-4 text-warning" />;
    }
    if (hasExamsPending) {
      return <AlertCircle className="h-4 w-4 text-warning" />;
    }
    if (allExamsChecked) {
      return <CheckCircle2 className="h-4 w-4 text-success" />;
    }
    return null;
  };

  const statusIcon = getStatusIcon();

  const getWhatsAppMessage = () => {
    const patientName = patient.name.split(' ')[0];
    
    // Se autorizado E com data de cirurgia → instruções pré-operatórias
    if (patient.status === 'authorized' && patient.surgery_date) {
      const surgeryDateFormatted = format(new Date(patient.surgery_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
      return `Olá ${patientName}! 

Sua cirurgia de ${patient.procedure} está confirmada para ${surgeryDateFormatted} no ${patient.hospital || 'hospital'}.

*INSTRUÇÕES PRÉ-OPERATÓRIAS IMPORTANTES:*

📋 *No dia anterior:*
- Jejum absoluto a partir da meia-noite (nem água)
- Banho completo na noite anterior
- Remover esmalte das unhas
- Não usar cremes, maquiagem ou produtos cosméticos

🏥 *No dia da cirurgia:*
- Chegar com 2 horas de antecedência
- Trazer documentos e exames
- Usar roupas confortáveis e fáceis de vestir
- Vir acompanhado(a)

Por favor, confirme o recebimento dessas instruções.

Atenciosamente,
Dr. André`;
    }
    
    // Se autorizado MAS sem data de cirurgia → mensagem de autorização
    if (patient.status === 'authorized' && !patient.surgery_date) {
      return `Olá ${patientName}! 

Tenho uma ótima notícia! ✅

Sua cirurgia de ${patient.procedure} foi *AUTORIZADA* pelo convênio.

Agora vamos agendar a data da sua cirurgia. Entrarei em contato em breve para combinarmos a melhor data para você.

Enquanto isso, mantenha seus exames em dia e qualquer dúvida, estou à disposição.

Atenciosamente,
Dr. André`;
    }
    
    // Se cirurgia concluída → recomendações pós-operatórias
    if (patient.status === 'surgery_completed' || patient.status === 'completed') {
      return `Olá ${patientName}! 

Espero que esteja se recuperando bem da sua ${patient.procedure}! 

*RECOMENDAÇÕES PÓS-OPERATÓRIAS:*

💊 *Medicação:*
- Seguir rigorosamente os horários prescritos
- Não interromper os antibióticos

🛏️ *Repouso:*
- Repouso relativo nos primeiros 7 dias
- Evitar esforços físicos por 30 dias
- Dormir com cabeceira elevada

🚫 *Evitar:*
- Exposição solar na região operada
- Bebidas alcoólicas por 15 dias
- Dirigir nos primeiros 7 dias

⚠️ *Sinais de alerta (procure atendimento):*
- Febre acima de 38°C
- Sangramento excessivo
- Dor intensa não controlada
- Secreção com mau cheiro

📅 Não esqueça do retorno agendado!

Como está se sentindo?

Dr. André`;
    }
    
    // Mensagem padrão para outros status
    return `Olá ${patientName}! 

Gostaria de atualizar sobre sua ${patient.procedure}.

Qualquer dúvida, estou à disposição.

Atenciosamente,
Dr. André`;
  };

  return (
    <div className="relative overflow-hidden rounded-lg">
      {/* Action buttons behind the card */}
      <div className="absolute inset-0 flex items-center justify-end pr-2 gap-2 bg-[#25D366]/20">
        {patient.phone && (
          <Button
            size="sm"
            variant="ghost"
            className="bg-[#25D366] text-white hover:bg-[#20BA5A] h-14 w-14 rounded-lg shadow-lg"
            onClick={(e) => {
              e.stopPropagation();
              const message = encodeURIComponent(getWhatsAppMessage());
              const phoneNumber = patient.phone.replace(/\D/g, '');
              window.open(`https://wa.me/55${phoneNumber}?text=${message}`, '_blank');
            }}
          >
            <MessageCircle className="h-5 w-5" />
          </Button>
        )}
      </div>

      {/* Swipeable card */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -80, right: 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        style={{ x }}
        animate={swiped ? { x: -80 } : { x: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
        className="relative bg-background rounded-lg"
      >
        <Card 
          className="cursor-pointer hover:bg-muted/50 transition-colors border shadow-none bg-card"
          onClick={onClick}
        >
          <CardContent className="p-3 space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-1.5 flex-1 min-w-0">
                {statusIcon && (
                  <div className="mt-0.5 shrink-0">
                    {statusIcon}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-sm leading-tight truncate">{patient.name}</h3>
                  <p className="text-xs text-muted-foreground capitalize mt-0.5 truncate">
                    {patient.procedure}
                  </p>
                </div>
              </div>
              <div className="shrink-0 flex items-center gap-1.5">
                {patient.phone && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="bg-[#25D366] text-white hover:bg-[#20BA5A] h-7 w-7 p-0 rounded-md"
                    onClick={(e) => {
                      e.stopPropagation();
                      const message = encodeURIComponent(getWhatsAppMessage());
                      const phoneNumber = patient.phone.replace(/\D/g, '');
                      window.open(`https://wa.me/55${phoneNumber}?text=${message}`, '_blank');
                    }}
                    onTouchStart={(e) => e.stopPropagation()}
                  >
                    <MessageCircle className="h-4 w-4" />
                  </Button>
                )}
                <StatusBadge status={patient.status as any} />
              </div>
            </div>

            {patient.hospital && (
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Building2 className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{patient.hospital}</span>
              </div>
            )}

            <div className="flex items-center justify-between gap-2">
              <div className="text-xs flex items-center gap-1.5">
                <span className="text-muted-foreground">Exames:</span>
                {patient.status === 'cancelled' ? (
                  <span className="text-muted-foreground">-</span>
                ) : allExamsChecked ? (
                  <Badge variant="success" className="text-[10px] px-1.5 py-0">Entregues</Badge>
                ) : (
                  <Badge variant="warning" className="text-[10px] px-1.5 py-0">Aguardando</Badge>
                )}
              </div>
            </div>

            {patient.surgery_date && patient.status !== 'cancelled' && (
              <div className="flex items-center gap-1.5 text-xs">
                <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className={`truncate ${isSurgeryUrgent ? 'font-semibold text-destructive' : 'text-muted-foreground'}`}>
                  {format(new Date(patient.surgery_date), "dd/MM/yyyy HH:mm", {
                    locale: ptBR,
                  })}
                  {isSurgeryToday && " (HOJE!)"}
                  {isSurgeryTomorrow && " (Amanhã)"}
                </span>
              </div>
            )}

            {isAdmin && (
              <Button
                variant="outline"
                size="sm"
                className="w-full text-xs h-8 mt-1 relative z-10"
                onTouchStart={(e) => e.stopPropagation()}
                onTouchEnd={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  onEdit();
                }}
              >
                Editar
              </Button>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
