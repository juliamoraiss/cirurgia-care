import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

interface Message {
  id: number;
  text: string;
  sender: "bot" | "user";
}

type Step = "greeting" | "ask_name" | "ask_phone" | "done";

interface ChatWidgetProps {
  schedulingUrl?: string;
  doctorName?: string;
}

export function ChatWidget({ schedulingUrl, doctorName = "Dr. André Alves" }: ChatWidgetProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [step, setStep] = useState<Step>("greeting");
  const [leadName, setLeadName] = useState("");
  const [leadPhone, setLeadPhone] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  let nextId = useRef(0);

  const addMessage = (text: string, sender: "bot" | "user") => {
    const id = nextId.current++;
    setMessages((prev) => [...prev, { id, text, sender }]);
  };

  useEffect(() => {
    if (isOpen && messages.length === 0) {
      addMessage(
        `Olá! 👋 Sou o assistente virtual do ${doctorName}. Como posso ajudar?`,
        "bot"
      );
      setTimeout(() => {
        addMessage(
          "Se você deseja agendar uma consulta ou cirurgia, posso te ajudar! Me diga seu nome para começarmos.",
          "bot"
        );
        setStep("ask_name");
      }, 1000);
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 300);
    }
  }, [isOpen, step]);

  const saveLead = async (name: string, phone: string, message: string) => {
    try {
      await fetch(`${SUPABASE_URL}/rest/v1/chat_leads`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ name, phone, message }),
      });
    } catch (e) {
      console.error("Failed to save lead:", e);
    }
  };

  const handleSend = () => {
    const trimmed = input.trim();
    if (!trimmed) return;

    addMessage(trimmed, "user");
    setInput("");

    if (step === "ask_name") {
      setLeadName(trimmed);
      setTimeout(() => {
        addMessage(
          `Prazer, ${trimmed}! 😊 Pode me informar seu telefone com DDD para que possamos entrar em contato?`,
          "bot"
        );
        setStep("ask_phone");
      }, 600);
    } else if (step === "ask_phone") {
      setLeadPhone(trimmed);
      const linkText = schedulingUrl
        ? `👉 Acesse aqui para agendar: ${window.location.origin}${schedulingUrl}`
        : "Nossa equipe entrará em contato em breve para agendar seu horário!";

      setTimeout(() => {
        addMessage(`Obrigado! 🙏`, "bot");
        setTimeout(() => {
          addMessage(
            `${linkText}\n\nSe preferir, nossa equipe também pode entrar em contato pelo telefone informado.`,
            "bot"
          );
          setStep("done");
          saveLead(leadName, trimmed, `Lead via chatbot do site`);
        }, 800);
      }, 600);
    } else if (step === "done") {
      setTimeout(() => {
        addMessage(
          "Nosso atendimento humano entrará em contato em breve. Obrigado por usar nosso assistente! 😊",
          "bot"
        );
      }, 600);
    }
  };

  return (
    <>
      {/* Floating button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center justify-center w-14 h-14 rounded-full bg-green-500 hover:bg-green-600 text-white shadow-lg transition-transform hover:scale-110"
          aria-label="Abrir chat"
        >
          <MessageCircle className="w-7 h-7" />
        </button>
      )}

      {/* Chat window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-[340px] max-w-[calc(100vw-2rem)] rounded-2xl shadow-2xl border bg-background flex flex-col overflow-hidden"
          style={{ height: "min(480px, calc(100vh - 6rem))" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 bg-green-500 text-white rounded-t-2xl">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5" />
              <div>
                <p className="text-sm font-semibold">Assistente Virtual</p>
                <p className="text-xs opacity-80">Online agora</p>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-white/20 rounded">
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-3 py-3 space-y-2">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`max-w-[85%] px-3 py-2 rounded-xl text-sm whitespace-pre-line ${
                  msg.sender === "bot"
                    ? "bg-muted text-foreground self-start mr-auto"
                    : "bg-green-500 text-white self-end ml-auto"
                }`}
              >
                {msg.text}
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-2 border-t flex gap-2">
            <Input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSend()}
              placeholder={
                step === "ask_name"
                  ? "Digite seu nome..."
                  : step === "ask_phone"
                  ? "(61) 99999-9999"
                  : "Digite sua mensagem..."
              }
              className="flex-1 text-sm"
            />
            <Button size="icon" onClick={handleSend} className="bg-green-500 hover:bg-green-600 shrink-0">
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      )}
    </>
  );
}
