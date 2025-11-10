import React, { useEffect, useRef, useState } from "react";
import * as pdfjsLib from "pdfjs-dist";
// @ts-ignore - Vite will resolve worker URL
import pdfjsWorker from "pdfjs-dist/build/pdf.worker?url";

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker as any;

interface PdfViewerProps {
  url: string;
  zoom: number; // 0.5 - 3
}

// Very small PDF viewer rendering all pages stacked with current zoom
export const PdfViewer: React.FC<PdfViewerProps> = ({ url, zoom }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [doc, setDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const loadingTask = pdfjsLib.getDocument({ url, withCredentials: false });
        const pdf = await loadingTask.promise;
        if (!cancelled) setDoc(pdf);
      } catch (e) {
        // eslint-disable-next-line no-console
        console.error("PDF load error", e);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [url]);

  useEffect(() => {
    if (!doc || !containerRef.current) return;

    const container = containerRef.current;
    container.innerHTML = ""; // clear previous canvases

    const render = async () => {
      for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
        const page = await doc.getPage(pageNum);
        const viewport = page.getViewport({ scale: zoom });

        const canvas = document.createElement("canvas");
        canvas.width = viewport.width as number;
        canvas.height = viewport.height as number;
        canvas.style.display = "block";
        canvas.style.margin = "0 auto 12px auto";
        const context = canvas.getContext("2d");
        if (!context) continue;

        await page.render({ canvasContext: context, viewport, canvas }).promise;
        container.appendChild(canvas);
      }
    };

    render();
  }, [doc, zoom]);

  return (
    <div
      ref={containerRef}
      className="w-full h-full overflow-auto p-4"
      style={{ touchAction: "pan-x pan-y pinch-zoom" }}
    />
  );
};

export default PdfViewer;
