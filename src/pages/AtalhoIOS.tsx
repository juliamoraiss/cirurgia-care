import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Share2, Copy, CheckCircle2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

const SHARE_URL = "https://medsystem.lovable.app/share-cirurgia?text=";

export default function AtalhoIOS() {
  const navigate = useNavigate();
  const [copied, setCopied] = useState(false);

  const copyUrl = async () => {
    try {
      await navigator.clipboard.writeText(SHARE_URL);
      setCopied(true);
      toast.success("URL copiada!");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Não foi possível copiar");
    }
  };

  return (
    <div className="min-h-screen bg-background pb-24">
      <div className="sticky top-0 z-10 bg-background/95 backdrop-blur border-b">
        <div className="flex items-center gap-3 p-4 max-w-2xl mx-auto">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h1 className="text-xl font-bold text-primary leading-tight">
            Atalho iOS — WhatsApp → MedSystem
          </h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto p-4 space-y-4">
        <Card className="border-primary/20 bg-primary/5">
          <CardContent className="pt-6">
            <div className="flex gap-3">
              <Smartphone className="h-5 w-5 text-primary shrink-0 mt-0.5" />
              <div className="space-y-1 text-sm">
                <p className="font-medium text-primary">
                  Por que preciso de um atalho?
                </p>
                <p className="text-muted-foreground leading-snug">
                  O iPhone não permite que apps PWA apareçam diretamente na folha de
                  compartilhamento do WhatsApp. O Atalhos da Apple resolve isso: ele
                  recebe o texto da mensagem e abre o MedSystem já com a IA processando.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">URL que o atalho deve abrir</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="p-3 bg-muted rounded-md font-mono text-xs break-all">
              {SHARE_URL}
            </div>
            <Button onClick={copyUrl} variant="outline" size="sm" className="w-full">
              {copied ? (
                <>
                  <CheckCircle2 className="h-4 w-4 mr-2 text-success" />
                  Copiado
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copiar URL
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Share2 className="h-4 w-4 text-primary" />
              Passo a passo (30 segundos)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ol className="space-y-3 text-sm">
              <Step n={1}>
                Abra o app <strong>Atalhos</strong> no iPhone (vem instalado).
              </Step>
              <Step n={2}>
                Toque em <strong>+</strong> no canto superior para criar um novo atalho.
              </Step>
              <Step n={3}>
                Toque em <strong>"Adicionar Ação"</strong> e busque por{" "}
                <strong>"URL"</strong>. Adicione a ação <em>URL</em> e cole a URL copiada
                acima — mas <strong>apague o final ".../share-cirurgia?text="</strong> e
                deixe só <code className="bg-muted px-1 rounded">https://medsystem.lovable.app/share-cirurgia?text=</code>{" "}
                <em>(termine com "=")</em>.
              </Step>
              <Step n={4}>
                Adicione outra ação: busque <strong>"Texto"</strong> e adicione a ação{" "}
                <em>Texto</em>. No campo, toque em <strong>"Variável Mágica"</strong> e
                escolha <strong>"Entrada do Atalho"</strong>.
              </Step>
              <Step n={5}>
                Adicione a ação <strong>"Codificar URL"</strong> (busque por
                "codificar"). Ela vai pegar o texto e deixar pronto pra URL.
              </Step>
              <Step n={6}>
                Adicione a ação <strong>"Combinar Texto"</strong>: combine a{" "}
                <em>URL</em> (passo 3) com o <em>URL Codificada</em> (passo 5).
              </Step>
              <Step n={7}>
                Adicione a ação final <strong>"Abrir URLs"</strong> com o resultado da
                combinação.
              </Step>
              <Step n={8}>
                Toque no <strong>nome do atalho</strong> no topo →{" "}
                <strong>"Detalhes"</strong> → ative{" "}
                <strong>"Mostrar na Folha de Compartilhamento"</strong> e em{" "}
                <strong>"Tipos de Compartilhamento"</strong> deixe só{" "}
                <strong>Texto</strong>.
              </Step>
              <Step n={9}>
                Renomeie para <strong>"Analisar no MedSystem"</strong> e salve.
              </Step>
            </ol>
          </CardContent>
        </Card>

        <Card className="border-success/30 bg-success/5">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2 text-success">
              <CheckCircle2 className="h-4 w-4" />
              Como usar
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm space-y-2">
            <p>1. No WhatsApp, mantenha pressionada a mensagem do paciente.</p>
            <p>2. Toque em <strong>Encaminhar</strong> → ícone de compartilhar.</p>
            <p>3. Role e escolha <strong>"Analisar no MedSystem"</strong>.</p>
            <p>
              4. O PWA abre direto na tela de importação com a IA já processando o texto.
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex-shrink-0 w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold flex items-center justify-center">
        {n}
      </span>
      <div className="flex-1 leading-snug pt-0.5">{children}</div>
    </li>
  );
}
