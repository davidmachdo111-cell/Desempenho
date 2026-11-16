import React from 'react';
import { Character, getCellName } from '../types/portal';
import { downloadGuidePdf } from '../lib/downloadHelpers';
import {
  FileText,
  Download,
  Printer,
  X,
  CreditCard,
  MapPin,
  MessageSquare,
} from 'lucide-react';

interface GuideMirrorModalProps {
  character: Character | null;
  exerciseTitle?: string;
  onClose: () => void;
}

export const GuideMirrorModal: React.FC<GuideMirrorModalProps> = ({
  character,
  exerciseTitle,
  onClose,
}) => {
  if (!character) return null;

  const cellName = getCellName(character.cell);

  const phrases = Array.isArray(character.typicalPhrases)
    ? character.typicalPhrases
    : character.typicalPhrases
    ? [character.typicalPhrases]
    : [];

  const handleDownloadPdf = () => {
    downloadGuidePdf(character, exerciseTitle);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto print:static print:inset-auto print:bg-white print:p-0 print:m-0 print:z-[99999] print:block print:overflow-visible">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col print:max-h-none print:my-0 print:border-none print:shadow-none print:rounded-none print:w-full print:max-w-none print:block print:overflow-visible">
        {/* Barra Superior de Ações Corporativas (Oculta na impressão) */}
        <div className="px-6 py-4 bg-[#064e3b] text-white flex items-center justify-between shrink-0 print:hidden">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-white/10 flex items-center justify-center text-emerald-200">
              <FileText className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">
                Ficha do Cliente / Simulação
              </h3>
              <p className="text-[11px] text-emerald-200">
                Cliente: {character.name} · Célula: {cellName}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handlePrint}
              className="px-3 py-1.5 text-xs font-bold text-emerald-900 bg-emerald-100 hover:bg-white rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              title="Imprimir ou Salvar como PDF via navegador"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Imprimir / Salvar PDF</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-600 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              title={`Baixar arquivo Cliente_${character.name.replace(/\s+/g, '_')}.pdf`}
            >
              <Download className="w-3.5 h-3.5" />
              <span>Baixar PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-emerald-200 hover:text-white p-1.5 rounded-lg hover:bg-white/10 cursor-pointer transition-colors"
              title="Fechar janela"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* ========================================================================= */}
        {/* DOCUMENTO DO CLIENTE (ÁREA IMPRIMÍVEL COM ID #printable-guide) */}
        {/* ========================================================================= */}
        <div
          id="printable-guide"
          className="p-6 md:p-8 overflow-y-auto space-y-6 flex-1 text-xs text-slate-800 bg-white print:p-0 print:overflow-visible print:space-y-4"
        >
          {/* A) Cabeçalho Limpo e Institucional */}
          <div className="rounded-xl overflow-hidden border border-[#064e3b] shadow-xs">
            <div className="bg-[#064e3b] text-white p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <h2 className="text-base md:text-lg font-bold tracking-tight text-white uppercase">
                  Portal de Desempenho — Ficha do Cliente
                </h2>
                <div className="text-xs text-emerald-200 font-medium mt-1">
                  Célula: <strong>{cellName}</strong>
                </div>
              </div>
            </div>
          </div>

          {/* B) Dados Cadastrais do Cliente (Quadro Destacado) */}
          <div className="border border-slate-200 rounded-xl bg-slate-50/70 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
              <h4 className="font-bold text-[#064e3b] text-xs uppercase tracking-wide flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-emerald-700" />
                1. Dados Cadastrais do Cliente
              </h4>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                  Célula: {cellName}
                </span>
                <span className="text-[10px] font-bold text-amber-900 bg-amber-100 border border-amber-200 px-2.5 py-0.5 rounded-full">
                  Complexidade: {character.customerTier || 'Mediano'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-medium">Nome do Cliente</span>
                <span className="font-bold text-slate-900 text-xs">{character.name || '---'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-medium">Carteirinha</span>
                <span className="font-mono font-bold text-slate-900 text-xs">{character.cardNumber || '---'}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-medium">Idade / Sexo</span>
                <span className="font-semibold text-slate-800 text-xs">
                  {character.age ? (character.age.toLowerCase().includes('ano') ? character.age : `${character.age} anos`) : '---'} · {character.gender || '---'}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-medium">Cidade / Polo</span>
                <span className="font-semibold text-slate-800 text-xs flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-slate-400" />
                  {character.city || '---'}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200/60 space-y-2 text-[11px] text-slate-700">
              <div>
                <span className="text-slate-400 font-medium uppercase text-[10px] block">Perfil / Temperamento Comportamental:</span>
                <span className="font-semibold text-slate-800">{character.temperament || 'Neutro, aguarda orientações.'}</span>
              </div>
              {character.objectives && (
                <div>
                  <span className="text-slate-400 font-medium uppercase text-[10px] block">Objetivos da Simulação:</span>
                  <span className="text-slate-800">{character.objectives}</span>
                </div>
              )}
            </div>
          </div>

          {/* C) Contexto do Atendimento & Histórico */}
          <div className="space-y-2">
            <h4 className="font-bold text-[#064e3b] text-xs uppercase tracking-wide flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-emerald-700" />
              2. Contexto do Atendimento & Histórico
            </h4>
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 leading-relaxed text-slate-800 text-xs">
              {character.serviceContext || 'Sem contexto adicional informado para este atendimento.'}
            </div>
          </div>

          {/* D) Roteiro de Simulação (Falas e Objeções) */}
          {phrases.length > 0 && (
            <div className="border border-slate-200 rounded-xl bg-white p-4 space-y-2.5">
              <h4 className="font-bold text-[#064e3b] text-xs uppercase tracking-wide flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-slate-600" />
                3. Roteiro de Simulação (Falas Típicas e Objeções)
              </h4>
              <div className="space-y-1.5">
                {phrases.map((phrase, idx) => (
                  <div
                    key={idx}
                    className="p-2.5 rounded-lg bg-slate-50 border border-slate-200/80 flex items-start gap-2.5"
                  >
                    <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 px-1.5 py-0.5 rounded shrink-0">
                      Fala {idx + 1}
                    </span>
                    <span className="italic text-slate-800 text-xs leading-relaxed">
                      "{phrase}"
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* E) Rodapé Oficial do Perfil */}
          <div className="pt-4 border-t border-slate-200 text-slate-500 flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-[11px]">
            <div>
              <p className="font-semibold text-slate-700">
                Portal de Desempenho Operacional — Perfil do Cliente / Simulação
              </p>
            </div>
            <div className="text-right shrink-0">
              <span className="font-mono text-[10px] bg-slate-100 px-2 py-0.5 rounded border border-slate-200 block md:inline-block">
                Página 1 de 1
              </span>
            </div>
          </div>
        </div>

        {/* Rodapé da Barra de Ações (Oculta na impressão) */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between shrink-0 print:hidden">
          <span className="text-[11px] text-slate-500 hidden sm:inline">
            Formato oficial compatível com download direto em PDF e impressão direta.
          </span>
          <div className="flex items-center gap-2 ml-auto">
            <button
              type="button"
              onClick={handlePrint}
              className="px-4 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition-all shadow-2xs inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-slate-600" />
              <span>Imprimir / Salvar PDF</span>
            </button>
            <button
              type="button"
              onClick={handleDownloadPdf}
              className="px-4 py-2 text-xs font-bold text-white bg-[#064e3b] hover:bg-emerald-900 rounded-xl transition-all shadow-sm inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5" />
              <span>Baixar PDF</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
            >
              Fechar
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
