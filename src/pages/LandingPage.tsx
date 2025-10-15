import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Phone, MapPin, Stethoscope, Award, GraduationCap } from "lucide-react";
import drAndrePortrait from "@/assets/dr-andre-portrait.jpg";

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
      <section className="relative py-20 px-4 bg-gradient-to-b from-muted to-background">
        <div className="max-w-6xl mx-auto">
          <div className="grid md:grid-cols-2 gap-12 items-center">
            <div className="order-2 md:order-1">
              <h1 className="text-4xl md:text-5xl font-serif font-bold mb-6 text-foreground leading-tight">
                Dr. André Morais Alves
              </h1>
              <p className="text-xl text-muted-foreground mb-4">
                Cirurgião Torácico | CRM XXXXX
              </p>
              <div className="flex items-start gap-3 text-foreground mb-6">
                <Stethoscope className="h-6 w-6 mt-1 flex-shrink-0" />
                <span className="text-lg leading-relaxed">Especialista em Cirurgia Torácica com formação avançada e experiência em procedimentos de alta complexidade</span>
              </div>
              <div className="flex flex-col gap-3 text-muted-foreground">
                <div className="flex items-center gap-2">
                  <GraduationCap className="h-5 w-5" />
                  <span>Membro da Sociedade Brasileira de Cirurgia Torácica</span>
                </div>
                <div className="flex items-center gap-2">
                  <Award className="h-5 w-5" />
                  <span>Especialização em Cirurgia Videolaparoscópica</span>
                </div>
              </div>
            </div>
            <div className="order-1 md:order-2">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/5 rounded-lg transform rotate-3"></div>
                <img 
                  src={drAndrePortrait} 
                  alt="Dr. André Morais Alves - Cirurgião Torácico" 
                  className="relative rounded-lg shadow-2xl w-full object-cover aspect-[4/5]"
                />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* About Section */}
      <section className="py-20 px-4 bg-card">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-12 text-center">Áreas de Atuação</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="p-8 border-l-4 border-primary bg-background">
              <h3 className="text-xl font-semibold mb-3">Cirurgia de Câncer de Pulmão</h3>
              <p className="text-muted-foreground leading-relaxed">Ressecções pulmonares para tratamento oncológico com técnicas minimamente invasivas</p>
            </div>
            <div className="p-8 border-l-4 border-primary bg-background">
              <h3 className="text-xl font-semibold mb-3">Cirurgia de Mediastino</h3>
              <p className="text-muted-foreground leading-relaxed">Tratamento cirúrgico de tumores e lesões mediastinais por toracoscopia</p>
            </div>
            <div className="p-8 border-l-4 border-primary bg-background">
              <h3 className="text-xl font-semibold mb-3">Cirurgia de Parede Torácica</h3>
              <p className="text-muted-foreground leading-relaxed">Correção de deformidades e tratamento de lesões da parede torácica</p>
            </div>
            <div className="p-8 border-l-4 border-primary bg-background">
              <h3 className="text-xl font-semibold mb-3">Videotoracoscopia</h3>
              <p className="text-muted-foreground leading-relaxed">Procedimentos minimamente invasivos para diagnóstico e tratamento de doenças torácicas</p>
            </div>
          </div>
        </div>
      </section>

      {/* Locations Section */}
      <section className="py-20 px-4 bg-muted">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-3xl md:text-4xl font-serif font-bold mb-12 text-center">Locais de Atendimento</h2>
          <div className="grid md:grid-cols-2 gap-8">
            <div className="flex items-start gap-4 p-8 bg-card border-2 border-border rounded-none shadow-lg">
              <MapPin className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-lg mb-2">Hospital Santa Lúcia</h3>
                <p className="text-muted-foreground">SHLS 716, Conjunto C - Asa Sul, Brasília - DF</p>
              </div>
            </div>
            <div className="flex items-start gap-4 p-8 bg-card border-2 border-border rounded-none shadow-lg">
              <MapPin className="h-6 w-6 text-primary flex-shrink-0 mt-1" />
              <div>
                <h3 className="font-semibold text-lg mb-2">Hospital Brasília</h3>
                <p className="text-muted-foreground">SGAS 613/614, Conjunto C - Asa Sul, Brasília - DF</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Form Section */}
      <section className="py-20 px-4 bg-background">
        <div className="max-w-md mx-auto">
          <div className="text-center mb-10">
            <h2 className="text-3xl md:text-4xl font-serif font-bold mb-4">Agende sua Consulta</h2>
            <p className="text-muted-foreground leading-relaxed">
              Preencha o formulário abaixo e entraremos em contato via WhatsApp
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6 bg-card p-8 border-2 border-border shadow-xl">
            <div className="space-y-2">
              <Label htmlFor="name" className="text-sm font-medium">Nome completo *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Seu nome completo"
                required
                className="border-2"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="phone" className="text-sm font-medium">Telefone *</Label>
              <Input
                id="phone"
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                placeholder="(61) 99999-9999"
                required
                className="border-2"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="procedure" className="text-sm font-medium">Procedimento de interesse *</Label>
              <Input
                id="procedure"
                value={formData.procedure}
                onChange={(e) => setFormData({ ...formData, procedure: e.target.value })}
                placeholder="Ex: Cirurgia de pulmão"
                required
                className="border-2"
              />
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-base font-medium"
              disabled={isSubmitting}
            >
              <Phone className="mr-2 h-5 w-5" />
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
