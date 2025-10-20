import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle, Calendar, TrendingUp, Users } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

// Configura o worker do PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

interface Report {
  id: string;
  report_date: string;
  platform: string;
  period_start: string | null;
  period_end: string | null;
  total_leads: number | null;
  scheduled_appointments: number | null;
  not_scheduled: number | null;
  awaiting_response: number | null;
  no_continuity: number | null;
  no_contact_after_attempts: number | null;
  leads_outside_brasilia: number | null;
  active_leads: number | null;
  in_progress: number | null;
  concierge_name: string | null;
  pdf_file_name: string | null;
  created_at: string;
}

const PDFUploadComponent = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState('');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [reports, setReports] = useState<Report[]>([]);
  const [isLoadingReports, setIsLoadingReports] = useState(true);

  const fetchReports = async () => {
    setIsLoadingReports(true);
    try {
      const { data, error } = await supabase
        .from('paid_traffic_reports')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setReports(data || []);
    } catch (err) {
      console.error('Erro ao buscar relatórios:', err);
      toast.error('Erro ao carregar relatórios');
    } finally {
      setIsLoadingReports(false);
    }
  };

  useEffect(() => {
    fetchReports();
  }, []);

  const extractTextFromPDF = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = async (e) => {
        try {
          const typedArray = new Uint8Array(e.target?.result as ArrayBuffer);
          
          setProgress('Carregando PDF...');
          const loadingTask = pdfjsLib.getDocument({ data: typedArray });
          const pdf = await loadingTask.promise;
          
          let fullText = '';
          const numPages = pdf.numPages;
          
          for (let i = 1; i <= numPages; i++) {
            setProgress(`Extraindo texto da página ${i} de ${numPages}...`);
            const page = await pdf.getPage(i);
            const textContent = await page.getTextContent();
            const pageText = textContent.items
              .map((item: any) => item.str)
              .join(' ');
            fullText += pageText + '\n\n';
          }
          
          setProgress('Texto extraído com sucesso!');
          resolve(fullText);
        } catch (error) {
          console.error('Erro ao extrair texto:', error);
          reject(error);
        }
      };
      
      reader.onerror = () => reject(new Error('Erro ao ler arquivo'));
      reader.readAsArrayBuffer(file);
    });
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setSuccess('');

    if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
      setError('Por favor, selecione um arquivo PDF');
      return;
    }

    if (file.size > 10 * 1024 * 1024) {
      setError('O arquivo deve ter no máximo 10MB');
      return;
    }

    setSelectedFile(file);
    setExtractedText('');
    setProgress('');
    setSuccess(`Arquivo selecionado: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)`);
  };

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Por favor, selecione um arquivo PDF');
      return;
    }

    setIsProcessing(true);
    setProgress('Iniciando processamento...');
    setError('');
    setSuccess('');

    try {
      // Extrai o texto do PDF
      setProgress('Extraindo texto do PDF...');
      const text = await extractTextFromPDF(selectedFile);
      
      if (!text || text.trim().length < 50) {
        throw new Error('PDF não contém texto suficiente. Pode ser uma imagem escaneada.');
      }

      setExtractedText(text);
      setProgress('Enviando para análise...');

      // Obtém a sessão do usuário
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) {
        throw new Error('Você precisa estar autenticado para enviar o PDF.');
      }

      // Cria FormData com o texto extraído
      const formData = new FormData();
      formData.append('text', text);
      formData.append('pdfFileName', selectedFile.name);
      // Envie o userId real (fallback: não envia se não houver)
      if (session.user?.id) {
        formData.append('userId', session.user.id);
      }

      // Envia para a Edge Function
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-traffic-pdf`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Erro ao processar PDF');
      }

      setProgress('Concluído!');
      setSuccess('PDF processado com sucesso! Os dados foram extraídos e salvos.');
      
      // Atualiza a lista de relatórios
      fetchReports();

      // Limpa o formulário após 2 segundos
      setTimeout(() => {
        setSelectedFile(null);
        setExtractedText('');
        setProgress('');
        setSuccess('');
        const fileInput = document.getElementById('pdf-input') as HTMLInputElement;
        if (fileInput) fileInput.value = '';
      }, 2000);

    } catch (error) {
      console.error('Erro ao processar PDF:', error);
      setError(error instanceof Error ? error.message : 'Erro desconhecido ao processar PDF');
      setProgress('');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-8 max-w-7xl">
      <div className="bg-card border-2 border-border rounded-lg p-6 space-y-6">
        <div className="space-y-2">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <FileText className="h-6 w-6" />
            Upload de Relatório PDF
          </h2>
          <p className="text-muted-foreground">
            Selecione um arquivo PDF para análise automática de dados
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="pdf-input">Arquivo PDF *</Label>
            <div className="flex gap-2">
              <Input
                id="pdf-input"
                type="file"
                accept=".pdf,application/pdf"
                onChange={handleFileSelect}
                disabled={isProcessing}
                className="border-2"
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Tamanho máximo: 10MB
            </p>
          </div>

          {selectedFile && (
            <div className="bg-muted p-4 rounded-lg space-y-2">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <div className="flex-1">
                  <p className="font-medium">{selectedFile.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                {!isProcessing && !progress && (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                )}
              </div>
            </div>
          )}

          {progress && (
            <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg border border-blue-200 dark:border-blue-800">
              <div className="flex items-center gap-3">
                {isProcessing ? (
                  <Loader2 className="h-5 w-5 animate-spin text-blue-500" />
                ) : (
                  <CheckCircle2 className="h-5 w-5 text-green-500" />
                )}
                <p className="text-sm font-medium">{progress}</p>
              </div>
            </div>
          )}

          {error && (
            <div className="bg-red-50 dark:bg-red-950 p-4 rounded-lg border border-red-200 dark:border-red-800">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0" />
                <p className="text-sm font-medium text-red-700 dark:text-red-300">{error}</p>
              </div>
            </div>
          )}

          {success && (
            <div className="bg-green-50 dark:bg-green-950 p-4 rounded-lg border border-green-200 dark:border-green-800">
              <div className="flex items-center gap-3">
                <CheckCircle2 className="h-5 w-5 text-green-500 flex-shrink-0" />
                <p className="text-sm font-medium text-green-700 dark:text-green-300">{success}</p>
              </div>
            </div>
          )}

          {extractedText && (
            <div className="space-y-2">
              <Label>Prévia do texto extraído</Label>
              <div className="bg-muted p-4 rounded-lg max-h-40 overflow-y-auto">
                <p className="text-xs font-mono whitespace-pre-wrap">
                  {extractedText.slice(0, 500)}
                  {extractedText.length > 500 && '...'}
                </p>
              </div>
              <p className="text-xs text-muted-foreground">
                {extractedText.length} caracteres extraídos
              </p>
            </div>
          )}

          <Button
            onClick={handleUpload}
            disabled={!selectedFile || isProcessing}
            className="w-full"
            size="lg"
          >
            {isProcessing ? (
              <>
                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                Processando...
              </>
            ) : (
              <>
                <Upload className="mr-2 h-5 w-5" />
                Enviar e Analisar PDF
              </>
            )}
          </Button>
        </div>

        <div className="bg-yellow-50 dark:bg-yellow-950 p-4 rounded-lg border border-yellow-200 dark:border-yellow-800">
          <h3 className="font-semibold text-sm mb-2">⚠️ Importante</h3>
          <ul className="text-xs text-muted-foreground space-y-1">
            <li>• O PDF deve conter texto selecionável (não pode ser apenas uma imagem escaneada)</li>
            <li>• Arquivos muito grandes podem demorar mais para processar</li>
            <li>• O sistema extrai automaticamente os dados usando IA</li>
          </ul>
        </div>
      </div>

      {/* Lista de Relatórios Salvos */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-2xl font-bold">Relatórios Salvos</h2>
          <Button onClick={fetchReports} variant="outline" size="sm" disabled={isLoadingReports}>
            {isLoadingReports ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Atualizar'}
          </Button>
        </div>

        {isLoadingReports ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : reports.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center text-muted-foreground">
              <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
              <p>Nenhum relatório encontrado. Envie seu primeiro PDF acima!</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-6 md:grid-cols-2">
            {reports.map((report) => (
              <Card key={report.id} className="overflow-hidden">
                <CardHeader className="bg-muted/50">
                  <CardTitle className="flex items-center justify-between text-lg">
                    <span className="flex items-center gap-2">
                      <FileText className="h-5 w-5" />
                      {report.pdf_file_name || 'Relatório'}
                    </span>
                    <span className="text-sm font-normal text-muted-foreground">
                      {formatDistanceToNow(new Date(report.created_at), { addSuffix: true, locale: ptBR })}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4 pt-6">
                  {/* Período */}
                  {(report.period_start || report.period_end) && (
                    <div className="flex items-center gap-2 text-sm">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Período:</span>
                      <span className="font-medium">
                        {report.period_start && new Date(report.period_start).toLocaleDateString('pt-BR')}
                        {report.period_start && report.period_end && ' - '}
                        {report.period_end && new Date(report.period_end).toLocaleDateString('pt-BR')}
                      </span>
                    </div>
                  )}

                  {/* Concierge */}
                  {report.concierge_name && (
                    <div className="flex items-center gap-2 text-sm">
                      <Users className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Concierge:</span>
                      <span className="font-medium">{report.concierge_name}</span>
                    </div>
                  )}

                  {/* Estatísticas principais */}
                  <div className="grid grid-cols-2 gap-4 pt-2">
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Total de Leads</p>
                      <p className="text-2xl font-bold">{report.total_leads ?? '-'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Agendamentos</p>
                      <p className="text-2xl font-bold text-green-600">{report.scheduled_appointments ?? '-'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Não Agendados</p>
                      <p className="text-2xl font-bold text-red-600">{report.not_scheduled ?? '-'}</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground">Aguardando Resposta</p>
                      <p className="text-2xl font-bold text-yellow-600">{report.awaiting_response ?? '-'}</p>
                    </div>
                  </div>

                  {/* Detalhes adicionais */}
                  <div className="border-t pt-4 space-y-2 text-sm">
                    {report.no_continuity !== null && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Sem continuidade:</span>
                        <span className="font-medium">{report.no_continuity}</span>
                      </div>
                    )}
                    {report.no_contact_after_attempts !== null && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Sem contato após tentativas:</span>
                        <span className="font-medium">{report.no_contact_after_attempts}</span>
                      </div>
                    )}
                    {report.leads_outside_brasilia !== null && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Leads fora de Brasília:</span>
                        <span className="font-medium">{report.leads_outside_brasilia}</span>
                      </div>
                    )}
                    {report.active_leads !== null && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Leads ativos:</span>
                        <span className="font-medium">{report.active_leads}</span>
                      </div>
                    )}
                    {report.in_progress !== null && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Em progresso:</span>
                        <span className="font-medium">{report.in_progress}</span>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default PDFUploadComponent;