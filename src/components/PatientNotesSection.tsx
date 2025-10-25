import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserRole } from "@/hooks/useUserRole";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";

interface Note {
  id: string;
  note: string;
  created_at: string;
  created_by: string;
}

interface PatientNotesSectionProps {
  patientId: string;
}

export function PatientNotesSection({ patientId }: PatientNotesSectionProps) {
  const { user } = useAuth();
  const { isAdmin } = useUserRole();
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [newNote, setNewNote] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadNotes();
  }, [patientId]);

  async function loadNotes() {
    try {
      const { data, error } = await supabase
        .from("patient_notes")
        .select("*")
        .eq("patient_id", patientId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setNotes(data || []);
    } catch (error) {
      console.error("Error loading notes:", error);
    } finally {
      setLoading(false);
    }
  }

  async function saveNote() {
    if (!newNote.trim()) {
      toast.error("Digite uma nota antes de salvar");
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase.from("patient_notes").insert({
        patient_id: patientId,
        note: newNote.trim(),
        created_by: user?.id,
      });

      if (error) throw error;

      toast.success("Nota salva com sucesso!");
      setNewNote("");
      setDialogOpen(false);
      loadNotes();
    } catch (error) {
      console.error("Error saving note:", error);
      toast.error("Erro ao salvar nota");
    } finally {
      setSaving(false);
    }
  }

  async function deleteNote(noteId: string) {
    try {
      const { error } = await supabase
        .from("patient_notes")
        .delete()
        .eq("id", noteId);

      if (error) throw error;
      toast.success("Nota excluída com sucesso!");
      loadNotes();
    } catch (error) {
      toast.error("Erro ao excluir nota");
    }
  }

  if (loading) {
    return <div className="text-center py-4">Carregando notas...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Notas e Interações</CardTitle>
          {isAdmin && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="h-4 w-4 mr-2" />
                  Nova Nota
                </Button>
              </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Adicionar Nova Nota</DialogTitle>
                <DialogDescription>
                  Registre interações e observações sobre o paciente
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="note">Nota *</Label>
                  <Textarea
                    id="note"
                    placeholder="Adicione uma nota sobre a conversa com o paciente..."
                    value={newNote}
                    onChange={(e) => setNewNote(e.target.value)}
                    rows={5}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  Cancelar
                </Button>
                <Button onClick={saveNote} disabled={saving || !newNote.trim()}>
                  {saving ? "Salvando..." : "Adicionar Nota"}
                </Button>
              </DialogFooter>
              </DialogContent>
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {notes.length === 0 ? (
          <p className="text-center text-muted-foreground py-4">
            Nenhuma nota registrada ainda
          </p>
        ) : (
          <div className="space-y-3">
            <h4 className="font-semibold text-sm">Histórico de Notas</h4>
            {notes.map((note) => (
              <div
                key={note.id}
                className="p-3 rounded-lg border bg-muted/50 flex gap-3"
              >
                <div className="flex-1">
                  <p className="text-sm whitespace-pre-wrap">{note.note}</p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                    <span>
                      {format(new Date(note.created_at), "dd/MM/yyyy 'às' HH:mm", {
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                </div>
                {isAdmin && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => deleteNote(note.id)}
                    className="text-destructive hover:text-destructive"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}