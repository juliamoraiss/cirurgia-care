import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Phone, MapPin, Stethoscope, CheckCircle2 } from "lucide-react";

const LandingPage = () => {
  const { toast } = useToast();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    procedure: "",
  });

  const whatsappNumber = "5561998695443";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.phone || !formData.procedure) {
      toast({
        title: "Campos obrigatórios",
        description: "Por favor, preencha todos os campos",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);

    try {
      const { error } = await supabase.functions.invoke('submit-landing-form', {
        body: formData,
      });

      if (error) throw error;

      toast({
        title: "Cadastro realizado!",
        description: "Você será redirecionado para o WhatsApp",
      });

      // Redirect to WhatsApp
      const message = encodeURIComponent(
        `Olá Dr. André! Meu nome é ${formData.name} e tenho interesse em ${formData.procedure}.`
      );
      window.open(`https://wa.me/${whatsappNumber}?text=${message}`, '_blank');

      // Reset form
      setFormData({ name: "", phone: "", procedure: "" });
    } catch (error) {
      console.error('Error submitting form:', error);
      toast({
        title: "Erro ao enviar",
        description: "Tente novamente mais tarde",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <section className="relative py-20 px-4 bg-gradient-to-b from-primary/10 to-background">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold mb-6 text-foreground">
            Dr. André Morais Alves
          </h1>
          <p className="text-xl md:text-2xl text-muted-foreground mb-8">
            Cirurgião Plástico | CRM XXXXX
          </p>
          <div className="flex items-center justify-center gap-2 text-primary">
            <Stethoscope className="h-6 w-6" />
            <span className="text-lg">Especialista em Cirurgia Plástica Estética e Reparadora</span>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="py-16 px-4">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold mb-8 text-center">Especialidades</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="p-6 border rounded-lg bg-card">
              <CheckCircle2 className="h-8 w-8 text-primary mb-4" />
              <h3 className="text-xl font-semibold mb-2">Rinoplastia</h3>
              <p className="text-muted-foreground">Cirurgia plástica do nariz com técnicas modernas e resultados naturais</p>
            </div>
            <div className="p-6 border rounded-lg bg-card">
              <CheckCircle2 className="h-8 w-8 text-primary mb-4" />
              <h3 className="text-xl font-semibold mb-2">Mamoplastia</h3>
              <p className="text-muted-foreground">Cirurgias de mama: aumento, redução e lifting</p>
            </div>
            <div className="p-6 border rounded-lg bg-card">
              <CheckCircle2 className="h-8 w-8 text-primary mb-4" />
              <h3 className="text-xl font-semibold mb-2">Lipoaspiração</h3>
              <p className="text-muted-foreground">Remodelagem corporal com técnicas avançadas</p>
            </div>
            <div className="p-6 border rounded-lg bg-card">
              <CheckCircle2 className="h-8 w-8 text-primary mb-4" />
              <h3 className="text-xl font-semibold mb-2">Abdominoplastia</h3>
              <p className="text-muted-foreground">Cirurgia plástica do abdômen para contorno definido</p>
            </div>
          </div>
        </div>
      </section>

      {/* Locations Section */}
      <section className="py-16 px-4 bg-muted/30">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-3xl font-bold mb-8 text-center">Locais de Atendimento</h2>
          <div className="grid md:grid-cols-2 gap-6">
            <div className="flex items-start gap-4 p-6 bg-card border rounded-lg">
              <MapPin className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold mb-2">Hospital Santa Lúcia</h3>
                <p className="text-muted-foreground">SHLS 716, Conjunto C - Asa Sul, Brasília - DF</p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-6 bg-card border rounded-lg">
              <MapPin className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold mb-2">Hospital Brasília</h3>
                <p className="text-muted-foreground">SGAS 613/614, Conjunto C - Asa Sul, Brasília - DF</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Form Section */}
      <section className="py-16 px-4">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-3xl font-bold mb-4">Agende sua Consulta</h2>
            <p className="text-muted-foreground">
              Preencha o formulário abaixo e entraremos em contato via WhatsApp
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 bg-card p-8 border rounded-lg">
            <div className="space-y-2">
              <Label htmlFor="name">Nome completo *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Seu nome"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone">Telefone *</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="(61) 99999-9999"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="procedure">Procedimento de interesse *</Label>
              <Input
                id="procedure"
                value={formData.procedure}
                onChange={(e) => setFormData({ ...formData, procedure: e.target.value })}
                placeholder="Ex: Rinoplastia"
                required
              />
            </div>

            <Button
              type="submit"
              className="w-full"
              disabled={isSubmitting}
            >
              <Phone className="mr-2 h-4 w-4" />
              {isSubmitting ? "Enviando..." : "Entrar em contato via WhatsApp"}
            </Button>

            <p className="text-xs text-center text-muted-foreground">
              Ao enviar, você concorda em ser contatado via WhatsApp
            </p>
          </form>
        </div>
      </section>
    </div>
  );
};

export default LandingPage;
