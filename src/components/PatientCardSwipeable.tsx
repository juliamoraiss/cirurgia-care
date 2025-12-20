import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { Building2, Calendar, MessageCircle, CheckCircle2, XCircle, AlertCircle, Clock, User } from "lucide-react";
import { format, isToday, isTomorrow } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { StandardCard, CardInfo } from "@/components/StandardCard";
import { StatusBadge } from "@/components/StatusBadge";
import { createWhatsAppUrl, safeWindowOpen } from "@/lib/urlSecurity";

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
  nextAction?: { text: string; variant: "default" | "warning" | "success" | "destructive" };
}

export function PatientCardSwipeable({
  patient,
  requiredExams,
  isAdmin,
  onEdit,
  onClick,
  nextAction,
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

  const getStatusIcon = () => {
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

  // Build card infos
  const infos: CardInfo[] = [];
  
  if (patient.hospital) {
    infos.push({
      icon: Building2,
      label: "Hospital",
      value: patient.hospital,
    });
  }

  // Exam status
  const examStatus = patient.status === 'cancelled' 
    ? '-'
    : allExamsChecked 
      ? 'Entregues' 
      : 'Aguardando';
  
  infos.push({
    icon: CheckCircle2,
    label: "Exames",
    value: examStatus,
    highlighted: hasExamsPending,
  });

  if (patient.surgery_date && patient.status !== 'cancelled') {
    const dateLabel = isSurgeryToday ? "(HOJE!)" : isSurgeryTomorrow ? "(Amanhã)" : "";
    infos.push({
      icon: Calendar,
      label: "Cirurgia",
      value: `${format(new Date(patient.surgery_date), "dd/MM/yyyy HH:mm", { locale: ptBR })} ${dateLabel}`,
      highlighted: isSurgeryUrgent,
    });
  }

  // Add next action as info if provided
  if (nextAction) {
    infos.push({
      icon: Clock,
      label: "Próxima ação",
      value: nextAction.text,
      highlighted: nextAction.variant === "warning" || nextAction.variant === "destructive",
    });
  }

  const getWhatsAppMessage = () => {
    const patientName = patient.name.split(' ')[0];
    const gender = patient.procedure?.toLowerCase().includes('mama') || 
                   patient.procedure?.toLowerCase().includes('abdominoplastia') ? 'F' : 'M';
    const pronoun = gender === 'F' ? 'a' : 'o';
    const article = gender === 'F' ? 'da' : 'do';
    
    return `Olá ${patientName}! 

Gostaria de confirmar ${article} sua ${patient.procedure} no ${patient.hospital || 'hospital'}.

Data e horário: ${patient.surgery_date ? format(new Date(patient.surgery_date), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR }) : 'a confirmar'}

Por favor, confirme sua presença respondendo esta mensagem.

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
              const phoneNumber = patient.phone.replace(/\D/g, '');
              // Admin gets pre-configured message, user gets empty chat
              if (isAdmin) {
                const whatsappUrl = createWhatsAppUrl(phoneNumber, getWhatsAppMessage());
                safeWindowOpen(whatsappUrl);
              } else {
                const whatsappUrl = createWhatsAppUrl(phoneNumber);
                safeWindowOpen(whatsappUrl);
              }
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
        <StandardCard
          title={patient.name}
          subtitle={patient.procedure}
          infos={infos}
          badge={<StatusBadge status={patient.status as any} />}
          statusIcon={statusIcon}
          actionLabel={isAdmin ? "Editar" : undefined}
          onAction={isAdmin ? onEdit : undefined}
          onClick={onClick}
          highlighted={isSurgeryUrgent}
        />
      </motion.div>
    </div>
  );
}
