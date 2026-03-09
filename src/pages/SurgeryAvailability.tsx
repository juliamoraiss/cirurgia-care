import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Clock, Plus, Trash2, MapPin, Settings2, CalendarOff, CalendarIcon } from "lucide-react";
import { useSurgeryAvailability, DAY_NAMES, DAY_SHORT, type SurgeryAvailabilityInput } from "@/hooks/useSurgeryAvailability";
import { useScheduleBlocks } from "@/hooks/useScheduleBlocks";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { cn } from "@/lib/utils";

const DURATION_OPTIONS = [
  { value: 30, label: "30 min" },
  { value: 60, label: "1 hora" },
  { value: 90, label: "1h30" },
  { value: 120, label: "2 horas" },
  { value: 180, label: "3 horas" },
  { value: 240, label: "4 horas ou mais" },
];

const SurgeryAvailability = () => {
  const { slots, loading, addSlot, updateSlot, deleteSlot } = useSurgeryAvailability();
  const { blocks, loading: blocksLoading, addBlock, deleteBlock } = useScheduleBlocks();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [blockDialogOpen, setBlockDialogOpen] = useState(false);
  const [form, setForm] = useState<SurgeryAvailabilityInput>({
    day_of_week: 1,
    start_time: "08:00",
    end_time: "12:00",
    default_duration_minutes: 120,
    max_surgeries_per_day: 3,
    location: "",
  });

  // Block form state
  const [blockMode, setBlockMode] = useState<"single" | "range">("single");
  const [blockStartDate, setBlockStartDate] = useState<Date | undefined>();
  const [blockEndDate, setBlockEndDate] = useState<Date | undefined>();
  const [blockReason, setBlockReason] = useState("");

  const handleAdd = async () => {
    await addSlot({
      ...form,
      location: form.location?.trim() || null,
    });
    setDialogOpen(false);
    setForm({
      day_of_week: 1,
      start_time: "08:00",
      end_time: "12:00",
      default_duration_minutes: 120,
      max_surgeries_per_day: 3,
      location: "",
    });
  };

  const handleAddBlock = async () => {
    if (!blockStartDate) return;
    const start = format(blockStartDate, "yyyy-MM-dd");
    const end = blockMode === "range" && blockEndDate
      ? format(blockEndDate, "yyyy-MM-dd")
      : start;
    await addBlock(start, end, blockReason);
    setBlockDialogOpen(false);
    setBlockStartDate(undefined);
    setBlockEndDate(undefined);
    setBlockReason("");
  };

  // Group slots by day
  const slotsByDay = new Map<number, typeof slots>();
  slots.forEach(slot => {
    const existing = slotsByDay.get(slot.day_of_week) || [];
    existing.push(slot);
    slotsByDay.set(slot.day_of_week, existing);
  });

  // Filter future blocks
  const today = new Date().toISOString().split("T")[0];
  const futureBlocks = blocks.filter(b => b.end_date >= today);
  const pastBlocks = blocks.filter(b => b.end_date < today);

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6 pb-24">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl md:text-2xl font-bold text-foreground flex items-center gap-2">
            <Settings2 className="h-7 w-7" />
            Disponibilidade para Cirurgias
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Configure seus horários e bloqueios de agenda
          </p>
        </div>

        <div className="flex gap-2">
          <Dialog open={blockDialogOpen} onOpenChange={setBlockDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" variant="outline" className="gap-1.5">
                <CalendarOff className="h-4 w-4" />
                <span className="hidden sm:inline">Bloquear</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Bloquear agenda</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                {/* Mode toggle */}
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant={blockMode === "single" ? "default" : "outline"}
                    size="sm"
                    onClick={() => { setBlockMode("single"); setBlockEndDate(undefined); }}
                    className="flex-1"
                  >
                    Data única
                  </Button>
                  <Button
                    type="button"
                    variant={blockMode === "range" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setBlockMode("range")}
                    className="flex-1"
                  >
                    Período
                  </Button>
                </div>

                {/* Start date */}
                <div>
                  <Label>{blockMode === "range" ? "Data inicial" : "Data"}</Label>
                  <Popover>
                    <PopoverTrigger asChild>
                      <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !blockStartDate && "text-muted-foreground")}>
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {blockStartDate ? format(blockStartDate, "dd/MM/yyyy") : "Selecionar data"}
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0" align="start">
                      <Calendar
                        mode="single"
                        selected={blockStartDate}
                        onSelect={setBlockStartDate}
                        disabled={(date) => date < new Date(new Date().setHours(0, 0, 0, 0))}
                        initialFocus
                        className={cn("p-3 pointer-events-auto")}
                      />
                    </PopoverContent>
                  </Popover>
                </div>

                {/* End date (range mode only) */}
                {blockMode === "range" && (
                  <div>
                    <Label>Data final</Label>
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !blockEndDate && "text-muted-foreground")}>
                          <CalendarIcon className="mr-2 h-4 w-4" />
                          {blockEndDate ? format(blockEndDate, "dd/MM/yyyy") : "Selecionar data"}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={blockEndDate}
                          onSelect={setBlockEndDate}
                          disabled={(date) => date < (blockStartDate || new Date())}
                          initialFocus
                          className={cn("p-3 pointer-events-auto")}
                        />
                      </PopoverContent>
                    </Popover>
                  </div>
                )}

                {/* Reason */}
                <div>
                  <Label>Motivo (opcional)</Label>
                  <Input
                    placeholder="Ex: Férias, congresso, folga..."
                    value={blockReason}
                    onChange={e => setBlockReason(e.target.value)}
                  />
                </div>

                <Button
                  onClick={handleAddBlock}
                  className="w-full"
                  disabled={!blockStartDate || (blockMode === "range" && !blockEndDate)}
                >
                  Bloquear {blockMode === "range" ? "período" : "data"}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button size="sm" className="gap-1.5">
                <Plus className="h-4 w-4" />
                <span className="hidden sm:inline">Adicionar</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>Novo horário de disponibilidade</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <div>
                  <Label>Dia da semana</Label>
                  <Select
                    value={String(form.day_of_week)}
                    onValueChange={v => setForm(f => ({ ...f, day_of_week: Number(v) }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DAY_NAMES.map((name, i) => (
                        <SelectItem key={i} value={String(i)}>{name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <Label>Início</Label>
                    <Select
                      value={form.start_time}
                      onValueChange={v => setForm(f => ({ ...f, start_time: v }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 24 }, (_, i) => {
                          const h = String(i).padStart(2, "0") + ":00";
                          return <SelectItem key={h} value={h}>{h.slice(0, 2)}h</SelectItem>;
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Fim</Label>
                    <Select
                      value={form.end_time}
                      onValueChange={v => setForm(f => ({ ...f, end_time: v }))}
                    >
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        {Array.from({ length: 24 }, (_, i) => {
                          const h = String(i).padStart(2, "0") + ":00";
                          return <SelectItem key={h} value={h}>{h.slice(0, 2)}h</SelectItem>;
                        })}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div>
                  <Label>Duração padrão da cirurgia</Label>
                  <Select
                    value={String(form.default_duration_minutes)}
                    onValueChange={v => setForm(f => ({ ...f, default_duration_minutes: Number(v) }))}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {DURATION_OPTIONS.map(opt => (
                        <SelectItem key={opt.value} value={String(opt.value)}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Máx. cirurgias por dia</Label>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    value={form.max_surgeries_per_day}
                    onChange={e => setForm(f => ({ ...f, max_surgeries_per_day: Number(e.target.value) }))}
                  />
                </div>

                <Button onClick={handleAdd} className="w-full">
                  Salvar horário
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Schedule Blocks Section */}
      {(futureBlocks.length > 0 || blocksLoading) && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <CalendarOff className="h-4 w-4 text-destructive" />
              Bloqueios de Agenda
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4 space-y-2">
            {futureBlocks.map(block => {
              const isSingleDay = block.start_date === block.end_date;
              const startFormatted = format(new Date(block.start_date + "T12:00:00"), "dd/MM/yyyy");
              const endFormatted = format(new Date(block.end_date + "T12:00:00"), "dd/MM/yyyy");

              return (
                <div
                  key={block.id}
                  className="flex items-center justify-between p-3 rounded-lg border border-destructive/20 bg-destructive/5"
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-foreground">
                      {isSingleDay ? startFormatted : `${startFormatted} – ${endFormatted}`}
                    </div>
                    {block.reason && (
                      <p className="text-xs text-muted-foreground mt-0.5">{block.reason}</p>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => deleteBlock(block.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Availability Slots */}
      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto" />
          <p className="mt-4 text-muted-foreground">Carregando...</p>
        </div>
      ) : slots.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Clock className="h-12 w-12 text-muted-foreground/40 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-1">Nenhum horário configurado</h3>
            <p className="text-sm text-muted-foreground mb-4">
              Configure seus dias e horários disponíveis para cirurgias
            </p>
            <Button onClick={() => setDialogOpen(true)} className="gap-1.5">
              <Plus className="h-4 w-4" />
              Adicionar horário
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {Array.from(slotsByDay.entries())
            .sort(([a], [b]) => a - b)
            .map(([dayOfWeek, daySlots]) => (
              <Card key={dayOfWeek}>
                <CardHeader className="pb-2 pt-4 px-4">
                  <CardTitle className="text-base font-semibold flex items-center gap-2">
                    <Badge variant="outline" className="text-xs px-2">
                      {DAY_SHORT[dayOfWeek]}
                    </Badge>
                    {DAY_NAMES[dayOfWeek]}
                  </CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-4 space-y-2">
                  {daySlots.map(slot => (
                    <div
                      key={slot.id}
                      className={`flex items-center justify-between p-3 rounded-lg border ${
                        slot.is_active ? "bg-background" : "bg-muted/30 opacity-60"
                      }`}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Clock className="h-3.5 w-3.5 text-primary" />
                          {slot.start_time.slice(0, 5)} – {slot.end_time.slice(0, 5)}
                        </div>
                        <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                          <span>Duração: {slot.default_duration_minutes}min</span>
                          <span>Máx: {slot.max_surgeries_per_day}/dia</span>
                        </div>
                        {slot.location && (
                          <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
                            <MapPin className="h-3 w-3" />
                            {slot.location}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-2 ml-2">
                        <Switch
                          checked={slot.is_active}
                          onCheckedChange={checked => updateSlot(slot.id, { is_active: checked })}
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive"
                          onClick={() => deleteSlot(slot.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            ))}
        </div>
      )}
    </div>
  );
};

export default SurgeryAvailability;
