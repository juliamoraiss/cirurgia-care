import { useState, useEffect, useMemo } from "react";
import { useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, MapPin, User, Stethoscope, CheckCircle2, AlertTriangle, Loader2 } from "lucide-react";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface Slot {
  date: string;
  time: string;
  datetime: string;
}

interface ScheduleData {
  patient_name: string;
  procedure: string;
  hospital: string | null;
  doctor_name: string;
  slots: Slot[];
}

type PageState = "loading" | "slots" | "confirming" | "success" | "error" | "expired" | "used";

const PublicSchedule = () => {
  const { token } = useParams<{ token: string }>();
  const [state, setState] = useState<PageState>("loading");
  const [data, setData] = useState<ScheduleData | null>(null);
  const [errorMessage, setErrorMessage] = useState("");
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [confirmedDate, setConfirmedDate] = useState<string | null>(null);
  const [confirmedHospital, setConfirmedHospital] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    fetchSlots();
  }, [token]);

  const fetchSlots = async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/public-schedule`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ action: "get_slots", token }),
      });

      const result = await res.json();

      if (!res.ok) {
        if (result.status === "used") {
          setState("used");
        } else if (result.status === "expired") {
          setState("expired");
        } else {
          setErrorMessage(result.error || "Erro ao carregar horários");
          setState("error");
        }
        return;
      }

      setData(result);
      setState("slots");
    } catch {
      setErrorMessage("Erro de conexão. Tente novamente.");
      setState("error");
    }
  };

  const confirmSlot = async () => {
    if (!selectedSlot || !token) return;
    setState("confirming");

    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/public-schedule`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ action: "confirm", token, slot: selectedSlot.datetime }),
      });

      const result = await res.json();

      if (!res.ok) {
        setErrorMessage(result.error || "Erro ao confirmar agendamento");
        setState("error");
        return;
      }

      setConfirmedDate(result.scheduled_date);
      setConfirmedHospital(result.hospital);
      setState("success");
    } catch {
      setErrorMessage("Erro de conexão. Tente novamente.");
      setState("error");
    }
  };

  // Group slots by date
  const slotsByDate = useMemo(() => {
    if (!data?.slots) return {};
    const grouped: Record<string, Slot[]> = {};
    for (const slot of data.slots) {
      if (!grouped[slot.date]) grouped[slot.date] = [];
      grouped[slot.date].push(slot);
    }
    return grouped;
  }, [data?.slots]);

  const availableDates = Object.keys(slotsByDate).sort();

  const formatDate = (dateStr: string) => {
    const [y, m, d] = dateStr.split("-").map(Number);
    const date = new Date(y, m - 1, d);
    return date.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  };

  const formatFullDate = (isoStr: string) => {
    const date = new Date(isoStr);
    return date.toLocaleDateString("pt-BR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });
  };

  const formatTime = (isoStr: string) => {
    const date = new Date(isoStr);
    return date.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
  };

  // Render
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 flex items-start justify-center p-4 pt-8 md:pt-16">
      <div className="w-full max-w-lg">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-blue-600 text-white mb-3">
            <Calendar className="h-7 w-7" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Agendamento de Cirurgia</h1>
          {data && (
            <p className="text-gray-500 mt-1">Escolha o melhor horário para você</p>
          )}
        </div>

        {/* Loading */}
        {state === "loading" && (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Loader2 className="h-10 w-10 animate-spin text-blue-600 mb-4" />
              <p className="text-gray-500">Carregando horários disponíveis...</p>
            </CardContent>
          </Card>
        )}

        {/* Error */}
        {state === "error" && (
          <Card className="border-red-200">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <AlertTriangle className="h-12 w-12 text-red-500 mb-4" />
              <p className="text-lg font-semibold text-gray-900 mb-1">Ops!</p>
              <p className="text-gray-500 text-center">{errorMessage}</p>
            </CardContent>
          </Card>
        )}

        {/* Expired */}
        {state === "expired" && (
          <Card className="border-amber-200">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <AlertTriangle className="h-12 w-12 text-amber-500 mb-4" />
              <p className="text-lg font-semibold text-gray-900 mb-1">Link Expirado</p>
              <p className="text-gray-500 text-center">
                Este link de agendamento expirou. Entre em contato com a clínica para um novo link.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Used */}
        {state === "used" && (
          <Card className="border-blue-200">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <CheckCircle2 className="h-12 w-12 text-blue-600 mb-4" />
              <p className="text-lg font-semibold text-gray-900 mb-1">Já Agendado</p>
              <p className="text-gray-500 text-center">
                Este link já foi utilizado para agendar sua cirurgia. Em caso de dúvidas, entre em contato com a clínica.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Slot selection */}
        {(state === "slots" || state === "confirming") && data && (
          <>
            {/* Patient info */}
            <Card className="mb-4">
              <CardContent className="pt-5 space-y-2">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <User className="h-4 w-4 shrink-0" />
                  <span>{data.patient_name}</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Stethoscope className="h-4 w-4 shrink-0" />
                  <span className="capitalize">{data.procedure}</span>
                </div>
                {data.hospital && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <MapPin className="h-4 w-4 shrink-0" />
                    <span>{data.hospital}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <User className="h-4 w-4 shrink-0" />
                  <span>Dr(a). {data.doctor_name}</span>
                </div>
              </CardContent>
            </Card>

            {availableDates.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-gray-500">Nenhum horário disponível no momento.</p>
                  <p className="text-sm text-gray-400 mt-1">Entre em contato com a clínica.</p>
                </CardContent>
              </Card>
            ) : (
              <>
                {/* Date selection */}
                <Card className="mb-4">
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      Escolha uma data
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    {availableDates.map((date) => (
                      <button
                        key={date}
                        onClick={() => {
                          setSelectedDate(date);
                          setSelectedSlot(null);
                        }}
                        disabled={state === "confirming"}
                        className={`w-full text-left px-4 py-3 rounded-lg border transition-all text-sm ${
                          selectedDate === date
                            ? "border-blue-600 bg-blue-50 text-blue-900 font-medium"
                            : "border-gray-200 hover:border-blue-300 hover:bg-blue-50/50 text-gray-700"
                        }`}
                      >
                        <span className="capitalize">{formatDate(date)}</span>
                        <span className="text-xs text-gray-400 ml-2">
                          ({slotsByDate[date].length} {slotsByDate[date].length === 1 ? "horário" : "horários"})
                        </span>
                      </button>
                    ))}
                  </CardContent>
                </Card>

                {/* Time selection */}
                {selectedDate && slotsByDate[selectedDate] && (
                  <Card className="mb-4">
                    <CardHeader className="pb-3">
                      <CardTitle className="text-base flex items-center gap-2">
                        <Clock className="h-4 w-4" />
                        Escolha um horário
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-2">
                        {slotsByDate[selectedDate].map((slot) => (
                          <button
                            key={slot.datetime}
                            onClick={() => setSelectedSlot(slot)}
                            disabled={state === "confirming"}
                            className={`px-3 py-2.5 rounded-lg border text-sm font-medium transition-all ${
                              selectedSlot?.datetime === slot.datetime
                                ? "border-blue-600 bg-blue-600 text-white"
                                : "border-gray-200 hover:border-blue-300 text-gray-700"
                            }`}
                          >
                            {slot.time}
                          </button>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Confirm */}
                {selectedSlot && (
                  <Button
                    onClick={confirmSlot}
                    disabled={state === "confirming"}
                    className="w-full h-12 text-base bg-blue-600 hover:bg-blue-700"
                  >
                    {state === "confirming" ? (
                      <>
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                        Confirmando...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4 mr-2" />
                        Confirmar Agendamento
                      </>
                    )}
                  </Button>
                )}
              </>
            )}
          </>
        )}

        {/* Success */}
        {state === "success" && confirmedDate && (
          <Card className="border-green-200">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-4">
                <CheckCircle2 className="h-9 w-9 text-green-600" />
              </div>
              <p className="text-xl font-bold text-gray-900 mb-1">Cirurgia Agendada!</p>
              <p className="text-gray-500 text-center mb-6">Seu agendamento foi confirmado com sucesso.</p>

              <div className="bg-gray-50 rounded-xl p-4 w-full space-y-2">
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-gray-400" />
                  <span className="capitalize">{formatFullDate(confirmedDate)}</span>
                </div>
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-gray-400" />
                  <span>{formatTime(confirmedDate)}</span>
                </div>
                {confirmedHospital && (
                  <div className="flex items-center gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-gray-400" />
                    <span>{confirmedHospital}</span>
                  </div>
                )}
              </div>

              <p className="text-xs text-gray-400 mt-6 text-center">
                A equipe médica entrará em contato com instruções adicionais.
              </p>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <p className="text-center text-xs text-gray-400 mt-8">
          Sistema seguro de agendamento médico
        </p>
      </div>
    </div>
  );
};

export default PublicSchedule;
