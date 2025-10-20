import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Upload, FileText, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

// Configura o worker do PDF.js
pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;

const PDFUploadComponent = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState('');
  const [progress, setProgress] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

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

      // Cria FormData com o texto extraído
      const formData = new FormData();
      formData.append('text', text);
      formData.append('pdfFileName', selectedFile.name);
      formData.append('userId', 'user-id-placeholder'); // Você deve substituir com o ID real do usuário

      // Envia para a Edge Function
      const { data: { session } } = await supabase.auth.getSession();
      
      const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-traffic-pdf`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.error || 'Erro ao processar PDF');
      }

      setProgress('Concluído!');
      setSuccess('PDF processado com sucesso! Os dados foram extraídos e salvos.');

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
    <div className="max-w-2xl mx-auto p-6 space-y-6">
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
    </div>
  );
};

export default PDFUploadComponent;