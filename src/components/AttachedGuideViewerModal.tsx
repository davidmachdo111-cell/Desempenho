import React, { useEffect, useState } from 'react';
import { Download, FileText, Image as ImageIcon, X } from 'lucide-react';
import { AttachedGuideItem } from '../types/portal';

export interface AttachedGuideViewerData {
  title: string;
  subtitle?: string;
  guides: AttachedGuideItem[];
  initialIndex?: number;
}

interface AttachedGuideViewerModalProps {
  attachment: AttachedGuideViewerData | null;
  onClose: () => void;
}

function isImageAttachment(fileUrl: string, fileName?: string | null): boolean {
  const lowerUrl = fileUrl.trim().toLowerCase();
  if (lowerUrl.startsWith('data:image/')) return true;
  if (lowerUrl.startsWith('data:application/pdf')) return false;

  const cleanUrlPath = lowerUrl.split('#')[0].split('?')[0];
  const imageExtRegex = /\.(png|jpe?g|webp|gif|svg|bmp|avif)$/i;
  if (imageExtRegex.test(cleanUrlPath)) return true;
  if (fileName && imageExtRegex.test(fileName.trim())) return true;
  return false;
}

function buildDownloadFileName(
  title: string,
  fileUrl: string,
  fileName?: string | null,
  isImage?: boolean
): string {
  if (fileName && fileName.trim()) {
    return fileName.trim().replace(/[^\w.\-() ]+/g, '_');
  }
  const baseTitle =
    title
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '_')
      .replace(/^_+|_+$/g, '') || 'Guia_Medica';

  if (fileUrl.startsWith('data:application/pdf') || !isImage) {
    return `${baseTitle}.pdf`;
  }
  return `${baseTitle}.png`;
}

export const AttachedGuideViewerModal: React.FC<AttachedGuideViewerModalProps> = ({
  attachment,
  onClose,
}) => {
  const [activeIndex, setActiveIndex] = useState(0);
  const [isDownloading, setIsDownloading] = useState(false);
  const [imageLoadError, setImageLoadError] = useState(false);

  const guides = attachment?.guides?.filter((g) => g && g.url) || [];
  const safeIndex = activeIndex >= 0 && activeIndex < guides.length ? activeIndex : 0;
  const activeGuide = guides[safeIndex] || null;

  useEffect(() => {
    setActiveIndex(attachment?.initialIndex ?? 0);
  }, [attachment]);

  useEffect(() => {
    setImageLoadError(false);
  }, [activeGuide?.url]);

  useEffect(() => {
    if (!attachment) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [attachment, onClose]);

  if (!attachment || guides.length === 0 || !activeGuide) return null;

  const isImage = isImageAttachment(activeGuide.url, activeGuide.name);
  const downloadFileName = buildDownloadFileName(
    attachment.title,
    activeGuide.url,
    activeGuide.name,
    isImage
  );

  const handleDownload = async () => {
    if (isDownloading) return;
    setIsDownloading(true);

    const triggerAnchorDownload = (href: string, name: string) => {
      const link = document.createElement('a');
      link.href = href;
      link.download = name;
      link.rel = 'noopener noreferrer';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    };

    try {
      if (activeGuide.url.startsWith('data:') || activeGuide.url.startsWith('blob:')) {
        triggerAnchorDownload(activeGuide.url, downloadFileName);
      } else {
        const response = await fetch(activeGuide.url);
        if (!response.ok) throw new Error('Download failed');
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        triggerAnchorDownload(blobUrl, downloadFileName);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1500);
      }
    } catch {
      triggerAnchorDownload(activeGuide.url, downloadFileName);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-70 bg-slate-900/75 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-5xl max-h-[94vh] border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header institucional */}
        <div className="px-5 py-3.5 bg-[#0f3e2e] text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-white/10 border border-white/15 flex items-center justify-center shrink-0">
              {isImage ? (
                <ImageIcon className="w-4 h-4 text-emerald-200" />
              ) : (
                <FileText className="w-4 h-4 text-emerald-200" />
              )}
            </div>
            <div className="min-w-0">
              <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-2">
                <span>Visualizador de Guia Médica Anexada</span>
                {guides.length > 1 && (
                  <span className="px-1.5 py-0.5 rounded bg-white/15 text-white">
                    {safeIndex + 1} de {guides.length}
                  </span>
                )}
              </div>
              <h3 className="text-sm sm:text-base font-bold text-white truncate">
                {attachment.title}
              </h3>
              <div className="flex items-center gap-2 flex-wrap mt-0.5">
                {attachment.subtitle && (
                  <span className="text-[11px] text-emerald-100/85 truncate">
                    {attachment.subtitle}
                  </span>
                )}
                {activeGuide.name && (
                  <span className="text-[10px] font-mono bg-white/10 border border-white/15 px-2 py-0.5 rounded text-emerald-100 truncate max-w-[280px]">
                    {activeGuide.name}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
            <button
              type="button"
              onClick={handleDownload}
              disabled={isDownloading}
              className="px-3.5 py-2 text-xs font-bold text-[#0f3e2e] bg-white hover:bg-emerald-50 rounded-xl transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-60"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isDownloading ? 'Baixando...' : 'Baixar Guia (PDF)'}</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="p-2 text-emerald-200 hover:text-white hover:bg-white/10 rounded-xl transition-colors cursor-pointer"
              title="Fechar visualizador"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Barra de seleção quando houver 2 ou mais guias anexadas */}
        {guides.length >= 2 && (
          <div className="px-4 py-2.5 bg-emerald-950/5 border-b border-slate-200 flex items-center gap-1.5 flex-wrap shrink-0">
            {guides.map((guide, idx) => {
              const isSelected = idx === safeIndex;
              return (
                <button
                  key={guide.id || idx}
                  type="button"
                  onClick={() => setActiveIndex(idx)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer max-w-[260px] truncate flex items-center gap-1.5 ${
                    isSelected
                      ? 'bg-[#0f3e2e] text-white shadow-xs'
                      : 'bg-white text-slate-700 border border-slate-200 hover:border-emerald-500'
                  }`}
                  title={`Guia ${idx + 1}: ${guide.name}`}
                >
                  <FileText
                    className={`w-3.5 h-3.5 shrink-0 ${
                      isSelected ? 'text-emerald-200' : 'text-emerald-700'
                    }`}
                  />
                  <span className="truncate">
                    Guia {idx + 1}: {guide.name}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Área de visualização de alta resolução */}
        <div className="p-3 sm:p-4 bg-slate-100 flex-1 overflow-auto flex items-center justify-center min-h-[55vh]">
          {isImage && !imageLoadError ? (
            <div className="w-full h-full flex items-center justify-center">
              <img
                src={activeGuide.url}
                alt={activeGuide.name || attachment.title}
                onError={() => setImageLoadError(true)}
                className="max-w-full max-h-[72vh] object-contain rounded-xl border border-slate-200 bg-white shadow-md"
              />
            </div>
          ) : imageLoadError ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center max-w-md space-y-3 shadow-xs">
              <FileText className="w-10 h-10 text-slate-400 mx-auto" />
              <div className="space-y-1">
                <h4 className="text-sm font-bold text-slate-800">
                  Pré-visualização indisponível no navegador
                </h4>
                <p className="text-xs text-slate-500">
                  Utilize o botão acima para fazer o download direto do arquivo anexado.
                </p>
              </div>
              <button
                type="button"
                onClick={handleDownload}
                className="px-4 py-2 text-xs font-bold text-white bg-[#0f3e2e] hover:bg-emerald-900 rounded-xl inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Baixar Guia (PDF)</span>
              </button>
            </div>
          ) : (
            <iframe
              key={activeGuide.id || activeGuide.url}
              src={activeGuide.url}
              title={activeGuide.name || attachment.title}
              className="w-full h-[72vh] rounded-xl border border-slate-200 bg-white shadow-xs"
            />
          )}
        </div>

        {/* Rodapé */}
        <div className="px-5 py-3 bg-white border-t border-slate-200 flex items-center justify-between gap-2 text-xs shrink-0">
          <span className="text-[11px] text-slate-500 truncate">
            {guides.length > 1
              ? `Exibindo Guia ${safeIndex + 1} de ${guides.length} (${activeGuide.name}). Alterne pelas abas acima para consultar e baixar cada documento.`
              : 'Documento anexado ao prontuário de simulação para consulta em tela e download.'}
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer shrink-0"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
