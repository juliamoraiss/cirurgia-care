import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { Check, Search } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Drawer, DrawerContent, DrawerDescription, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { describeError } from "@/lib/errors";
import { cn, normalizeSearch } from "@/lib/utils";

interface NewTaskDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

/** "Nova tarefa" a partir da tela de Tarefas: escolhe o paciente, título e quando avisar. */
export function NewTaskDialog({ open, onOpenChange, onCreated }: NewTaskDialogProps) {
  const { user } = useAuth();
  const [patients, setPatients] = useState<{ id: string; name: string }[]>([]);
  const [query, setQuery] = useState("");
  const [patientId, setPatientId] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [description, setDescription] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setPatientId(null);
    setTitle("");
    setDescription("");
    // Padrão: daqui a 1 hora, em ponto
    const next = new Date();
    next.setHours(next.getHours() + 1, 0, 0, 0);
    setDueDate(format(next, "yyyy-MM-dd'T'HH:mm"));
    supabase
      .from("patients")
      .select("id, name")
      .order("name")
      .then(({ data }) => setPatients(data || []));
  }, [open]);

  const matches = useMemo(() => {
    const q = normalizeSearch(query);
    const list = q ? patients.filter((p) => normalizeSearch(p.name).includes(q)) : patients;
    return list.slice(0, 30);
  }, [patients, query]);

  const selected = patients.find((p) => p.id === patientId);

  async function handleSave() {
    if (!patientId || !title.trim() || !dueDate) {
      toast.error("Escolha o paciente, o título e a data");
      return;
    }
    setSaving(true);
    try {
      const { error } = await supabase.from("patient_tasks").insert({
        patient_id: patientId,
        task_type: "custom",
        title: title.trim(),
        description: description.trim() || null,
        due_date: new Date(dueDate).toISOString(),
        created_by: user?.id,
      });
      if (error) throw error;
      toast.success("Tarefa criada");
      onOpenChange(false);
      onCreated();
    } catch (error) {
      toast.error(describeError("Erro ao criar tarefa", error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Drawer open={open} onOpenChange={onOpenChange} shouldScaleBackground={false}>
      <DrawerContent className="max-h-[92vh] max-h-[92dvh] z-[70]">
        <DrawerHeader className="text-left pb-2">
          <DrawerTitle>Nova tarefa</DrawerTitle>
          <DrawerDescription>Você será avisada no celular na data e hora escolhidas.</DrawerDescription>
        </DrawerHeader>

        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 pb-2 space-y-4">
          <div className="space-y-1.5">
            <Label>Paciente *</Label>
            {selected ? (
              <button
                type="button"
                onClick={() => setPatientId(null)}
                className="w-full min-h-11 flex items-center justify-between rounded-lg border px-3 text-left"
              >
                <span className="font-medium">{selected.name}</span>
                <span className="text-sm text-primary">Trocar</span>
              </button>
            ) : (
              <div className="rounded-lg border overflow-hidden">
                <div className="relative border-b">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Buscar paciente"
                    className="pl-9 h-11 border-0 rounded-none text-base focus-visible:ring-0"
                  />
                </div>
                <ul className="max-h-48 overflow-y-auto">
                  {matches.map((p) => (
                    <li key={p.id}>
                      <button
                        type="button"
                        onClick={() => setPatientId(p.id)}
                        className={cn("w-full min-h-11 px-3 text-left text-sm flex items-center justify-between active:bg-muted")}
                      >
                        {p.name}
                        {patientId === p.id && <Check className="h-4 w-4 text-primary" />}
                      </button>
                    </li>
                  ))}
                  {matches.length === 0 && <li className="px-3 py-3 text-sm text-muted-foreground">Nenhum paciente</li>}
                </ul>
              </div>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-title">Título *</Label>
            <Input
              id="task-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Ex.: Ligar para confirmar jejum"
              className="h-11 text-base"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-due">Quando *</Label>
            <Input
              id="task-due"
              type="datetime-local"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="h-11 text-base"
            />
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="task-desc">Observação</Label>
            <Textarea id="task-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 border-t bg-background p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]">
          <Button variant="outline" className="h-11" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button className="h-11" onClick={handleSave} disabled={saving}>
            {saving ? "Salvando..." : "Criar tarefa"}
          </Button>
        </div>
      </DrawerContent>
    </Drawer>
  );
}
