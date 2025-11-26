import { useState } from "react";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

interface YearMonthDatePickerProps {
  date: Date | undefined;
  onDateChange: (date: Date | undefined) => void;
  label?: string;
  placeholder?: string;
  className?: string;
}

export function YearMonthDatePicker({
  date,
  onDateChange,
  label,
  placeholder = "Selecione a data",
  className,
}: YearMonthDatePickerProps) {
  const [manualDate, setManualDate] = useState({
    day: date ? format(date, "dd") : "",
    month: date ? format(date, "MM") : "",
    year: date ? format(date, "yyyy") : "",
  });

  const handleManualDateChange = (field: "day" | "month" | "year", value: string) => {
    const numericValue = value.replace(/\D/g, "");
    const newDate = { ...manualDate, [field]: numericValue };
    setManualDate(newDate);

    // Try to construct date if all fields are filled
    if (newDate.day && newDate.month && newDate.year.length === 4) {
      const day = parseInt(newDate.day);
      const month = parseInt(newDate.month) - 1;
      const year = parseInt(newDate.year);

      if (day >= 1 && day <= 31 && month >= 0 && month <= 11 && year >= 1900) {
        const constructedDate = new Date(year, month, day);
        if (!isNaN(constructedDate.getTime())) {
          onDateChange(constructedDate);
        }
      }
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      {label && <Label>{label}</Label>}
      <div className="flex gap-2">
        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              className={cn(
                "flex-1 justify-start text-left font-normal",
                !date && "text-muted-foreground"
              )}
            >
              <CalendarIcon className="mr-2 h-4 w-4" />
              {date ? format(date, "dd/MM/yyyy", { locale: ptBR }) : placeholder}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={date}
              onSelect={onDateChange}
              initialFocus
              className="pointer-events-auto"
              captionLayout="dropdown-buttons"
              fromYear={1900}
              toYear={new Date().getFullYear()}
            />
          </PopoverContent>
        </Popover>
      </div>
      <div className="flex gap-2">
        <div className="flex-1">
          <Input
            type="text"
            placeholder="DD"
            maxLength={2}
            value={manualDate.day}
            onChange={(e) => handleManualDateChange("day", e.target.value)}
            className="text-center"
          />
        </div>
        <div className="flex-1">
          <Input
            type="text"
            placeholder="MM"
            maxLength={2}
            value={manualDate.month}
            onChange={(e) => handleManualDateChange("month", e.target.value)}
            className="text-center"
          />
        </div>
        <div className="flex-[2]">
          <Input
            type="text"
            placeholder="AAAA"
            maxLength={4}
            value={manualDate.year}
            onChange={(e) => handleManualDateChange("year", e.target.value)}
            className="text-center"
          />
        </div>
      </div>
    </div>
  );
}
