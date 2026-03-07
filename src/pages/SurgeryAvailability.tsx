import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Clock, Plus, Trash2, MapPin, Settings2, ChevronUp, ChevronDown } from "lucide-react";
import { useSurgeryAvailability, DAY_NAMES, DAY_SHORT, type SurgeryAvailabilityInput } from "@/hooks/useSurgeryAvailability";

const DURATION_OPTIONS = [
  { value: 30, label: "30 min" },
  { value: 60, label: "1 hora" },
  { value: 90, label: "1h30" },
  { value: 120, label: "2 horas" },
  { value: 180, label: "3 horas" },
  { value: 240, label: "4 horas" },
];

const SurgeryAvailability = () => {
  const { slots, loading, addSlot, updateSlot, deleteSlot } = useSurgeryAvailability();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState<SurgeryAvailabilityInput>({
    day_of_week: 1,
    start_time: "08:00",
    end_time: "12:00",
    default_duration_minutes: 120,
    max_surgeries_per_day: 3,
    location: "",
  });

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

  // Group slots by day
  const slotsByDay = new Map<number, typeof slots>();
  slots.forEach(slot => {
    const existing = slotsByDay.get(slot.day_of_week) || [];
    existing.push(slot);
    slotsByDay.set(slot.day_of_week, existing);
  });

  return (
    <div className="p-4 md:p-6 space-y-4 md:space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
            <Settings2 className="h-7 w-7" />
            Disponibilidade para Cirurgias
          </h1>
          <p className="text-sm md:text-base text-muted-foreground mt-1">
            Configure seus horários disponíveis para agendamento
          </p>
        </div>

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
                  <Input
                    type="time"
                    value={form.start_time}
                    onChange={e => setForm(f => ({ ...f, start_time: e.target.value }))}
                  />
                </div>
                <div>
                  <Label>Fim</Label>
                  <Input
                    type="time"
                    value={form.end_time}
                    onChange={e => setForm(f => ({ ...f, end_time: e.target.value }))}
                  />
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

              <div>
                <Label>Local / Hospital</Label>
                <Input
                  placeholder="Ex: Hospital Santa Lúcia"
                  value={form.location || ""}
                  onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
                />
              </div>

              <Button onClick={handleAdd} className="w-full">
                Salvar horário
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

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
