import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar as CalendarIcon } from "lucide-react";

const Calendar = () => {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Agenda de Cirurgias</h1>
        <p className="text-muted-foreground">
          Visualize e gerencie os procedimentos agendados
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center">
            <CalendarIcon className="h-5 w-5 mr-2" />
            Calendário de Cirurgias
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12 text-muted-foreground">
            <CalendarIcon className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-lg">Funcionalidade de calendário em desenvolvimento</p>
            <p className="text-sm mt-2">
              Em breve você poderá visualizar todas as cirurgias em um calendário interativo
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Calendar;
