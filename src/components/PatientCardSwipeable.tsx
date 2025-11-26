import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { Card, CardContent } from "@/components/ui/card";
import { StatusBadge } from "@/components/StatusBadge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Building2, Calendar, Phone, CheckCircle2, XCircle, AlertCircle, Clock } from "lucide-react";
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
      return <XCircle className="h-5 w-5 text-destructive" />;
    }
    if (isSurgeryToday) {
      return <AlertCircle className="h-5 w-5 text-destructive animate-pulse" />;
    }
    if (isSurgeryTomorrow) {
      return <Clock className="h-5 w-5 text-warning" />;
    }
    if (hasExamsPending) {
      return <AlertCircle className="h-5 w-5 text-warning" />;
    }
    if (allExamsChecked) {
      return <CheckCircle2 className="h-5 w-5 text-success" />;
    }
    return null;
  };

  const statusIcon = getStatusIcon();

  return (
    <div className="relative overflow-hidden">
      {/* Action buttons behind the card */}
      <div className="absolute inset-0 flex items-center justify-end pr-4 gap-2">
        {patient.phone && (
          <Button
            size="sm"
            variant="ghost"
            className="bg-primary text-primary-foreground"
            onClick={(e) => {
              e.stopPropagation();
              window.location.href = `tel:${patient.phone}`;
            }}
          >
            <Phone className="h-4 w-4" />
          </Button>
        )}
      </div>

      {/* Swipeable card */}
      <motion.div
        drag="x"
        dragConstraints={{ left: -100, right: 0 }}
        dragElastic={0.1}
        onDragEnd={handleDragEnd}
        style={{ x, backgroundColor }}
        animate={swiped ? { x: -100 } : { x: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      >
        <Card 
          className="cursor-pointer hover:bg-muted/50 transition-colors"
          onClick={onClick}
        >
          <CardContent className="p-4 space-y-3">
            <div className="flex items-start justify-between gap-2">
              <div className="flex items-start gap-2 flex-1">
                {statusIcon && (
                  <div className="mt-0.5">
                    {statusIcon}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-base truncate">{patient.name}</h3>
                  <p className="text-sm text-muted-foreground capitalize mt-1">
                    {patient.procedure}
                  </p>
                </div>
              </div>
              <StatusBadge status={patient.status as any} />
            </div>

            {patient.hospital && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Building2 className="h-4 w-4 shrink-0" />
                <span className="truncate">{patient.hospital}</span>
              </div>
            )}

            <div className="flex items-center justify-between">
              <div className="text-sm">
                <span className="text-muted-foreground">Exames: </span>
                {patient.status === 'cancelled' ? (
                  <span className="text-muted-foreground">-</span>
                ) : allExamsChecked ? (
                  <Badge variant="success" className="text-xs">Entregues</Badge>
                ) : (
                  <Badge variant="warning" className="text-xs">Aguardando</Badge>
                )}
              </div>
            </div>

            {patient.surgery_date && patient.status !== 'cancelled' && (
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
                <span className={`${isSurgeryUrgent ? 'font-semibold text-destructive' : 'text-muted-foreground'}`}>
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
                className="w-full"
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
