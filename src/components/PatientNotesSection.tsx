import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Plus } from "lucide-react";
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
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(true);
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
      loadNotes();
    } catch (error) {
      console.error("Error saving note:", error);
      toast.error("Erro ao salvar nota");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return <div className="text-center py-4">Carregando notas...</div>;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notas e Interações</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="space-y-2">
            <Textarea
              placeholder="Adicione uma nota sobre a conversa com o paciente..."
              value={newNote}
              onChange={(e) => setNewNote(e.target.value)}
              rows={3}
            />
            <Button onClick={saveNote} disabled={saving || !newNote.trim()}>
              <Plus className="h-4 w-4 mr-2" />
              {saving ? "Salvando..." : "Adicionar Nota"}
            </Button>
          </div>

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
                  className="p-3 rounded-lg border bg-muted/50"
                >
                  <p className="text-sm whitespace-pre-wrap">{note.note}</p>
                  <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                    <span>
                      {format(new Date(note.created_at), "dd/MM/yyyy 'às' HH:mm", {
                        locale: ptBR,
                      })}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}