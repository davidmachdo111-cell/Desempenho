import React from 'react';
import { Character, getCellName } from '../types/portal';
import {
  downloadGuidePdf,
  extractExamsFromCharacter,
  getPreparationGuidelines,
} from '../lib/downloadHelpers';
import {
  FileText,
  Download,
  Printer,
  X,
  CreditCard,
  MapPin,
  Calendar,
  ShieldAlert,
  Activity,
  AlertCircle,
  MessageSquare,
  CheckCircle2,
  Clock,
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
  const examItems = extractExamsFromCharacter(character);
  const preparationGuidelines = getPreparationGuidelines(character);

  const phrases = Array.isArray(character.typicalPhrases)
    ? character.typicalPhrases
    : character.typicalPhrases
    ? [character.typicalPhrases]
    : [];

  const simulatedHash = Math.abs(
    character.id.split('').reduce((acc, c) => ((acc << 5) - acc + c.charCodeAt(0)) | 0, 0)
  ).toString().padStart(6, '0').slice(-6);
  const now = new Date();
  const protocolNumber = `TISS-SIM-${now.getFullYear()}.${String(now.getMonth() + 1).padStart(2, '0')}-${simulatedHash}`;
  const emissionDate = `${now.toLocaleDateString('pt-BR')} às ${now.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  })}`;

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
                Espelho Oficial da Guia Médica
              </h3>
              <p className="text-[11px] text-emerald-200">
                Beneficiário: {character.name} · Célula: {cellName}
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
              title={`Baixar arquivo Guia_${character.name.replace(/\s+/g, '_')}.pdf`}
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
        {/* DOCUMENTO DA GUIA (ÁREA IMPRIMÍVEL COM ID #printable-guide) */}
        {/* ========================================================================= */}
        <div
          id="printable-guide"
          className="p-6 md:p-8 overflow-y-auto space-y-6 flex-1 text-xs text-slate-800 bg-white print:p-0 print:overflow-visible print:space-y-4"
        >
          {/* A) Cabeçalho Institucional da Guia */}
          <div className="rounded-xl overflow-hidden border border-[#064e3b] shadow-xs">
            <div className="bg-[#064e3b] text-white p-5 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <div className="inline-block px-2.5 py-0.5 rounded-full bg-emerald-800 text-[10px] font-bold text-emerald-200 tracking-wider">
                    PADRÃO TISS DIGITAL SIMULADO
                  </div>
                </div>
                <h2 className="text-base md:text-lg font-bold tracking-tight text-white uppercase">
                  Portal de Desempenho — Guia de Atendimento e Simulação
                </h2>
                <div className="text-[11px] text-emerald-200/90 font-mono mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                  <span>Protocolo: <strong className="text-white">{protocolNumber}</strong></span>
                  <span>·</span>
                  <span>Emissão: <strong className="text-white">{emissionDate}</strong></span>
                  <span>·</span>
                  <span>Célula: <strong className="text-white">{cellName}</strong></span>
                </div>
              </div>

              {/* Badge discreto de treinamento */}
              <div className="shrink-0 self-start md:self-center">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-emerald-800/80 border border-emerald-600/50 text-[10px] font-bold text-emerald-100 uppercase tracking-wide">
                  <ShieldAlert className="w-3.5 h-3.5 text-emerald-300" />
                  Documento Fictício para Treinamento
                </span>
              </div>
            </div>
          </div>

          {/* B) Dados do Beneficiário (Quadro Destacado) */}
          <div className="border border-slate-200 rounded-xl bg-slate-50/70 p-4 space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200/80 pb-2">
              <h4 className="font-bold text-[#064e3b] text-xs uppercase tracking-wide flex items-center gap-1.5">
                <CreditCard className="w-4 h-4 text-emerald-700" />
                1. Dados Cadastrais do Beneficiário
              </h4>
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                  Célula: {cellName}
                </span>
                <span className="text-[10px] font-bold text-amber-900 bg-amber-100 border border-amber-200 px-2.5 py-0.5 rounded-full">
                  Tier: {character.customerTier || 'Intermediário'}
                </span>
              </div>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-medium">Nome do Paciente</span>
                <span className="font-bold text-slate-900 text-xs">{character.name}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-medium">Carteirinha</span>
                <span className="font-mono font-bold text-slate-900 text-xs">{character.cardNumber}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-medium">Idade / Sexo</span>
                <span className="font-semibold text-slate-800 text-xs">{character.age} anos · {character.gender}</span>
              </div>
              <div>
                <span className="text-[10px] text-slate-500 block uppercase font-medium">Cidade / Polo</span>
                <span className="font-semibold text-slate-800 text-xs flex items-center gap-1">
                  <MapPin className="w-3 h-3 text-slate-400" />
                  {character.city}
                </span>
              </div>
            </div>

            <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between text-[11px] text-slate-600">
              <div>
                <span className="text-slate-400 font-medium">Perfil / Temperamento: </span>
                <span className="font-semibold text-slate-800">{character.temperament}</span>
              </div>
              <div className="font-mono text-[10px] text-slate-400">
                Cadastro ID: {character.id}
              </div>
            </div>
          </div>

          {/* C) Dados Clínicos e Exames Solicitados (Tabela Formatada) */}
          <div className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h4 className="font-bold text-[#064e3b] text-xs uppercase tracking-wide flex items-center gap-1.5">
                <Activity className="w-4 h-4 text-emerald-700" />
                2. Dados Clínicos e Procedimentos Solicitados
              </h4>
              <span className="text-[10px] font-mono text-emerald-900 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                Anexo: {character.guideAttachmentName || 'Guia TISS Digital'}
              </span>
            </div>

            {/* Tabela de Exames com linhas alternadas e bordas suaves */}
            <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-[#064e3b] text-white text-[10px] uppercase font-bold tracking-wider">
                    <th className="py-2.5 px-3 w-12 text-center">Item</th>
                    <th className="py-2.5 px-3">Exame / Procedimento Solicitado</th>
                    <th className="py-2.5 px-3 w-28">Código TUSS</th>
                    <th className="py-2.5 px-3 w-36">Prazo ANS (RN 566)</th>
                    <th className="py-2.5 px-3 w-28 text-center">Situação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-xs">
                  {examItems.map((exam, idx) => (
                    <tr
                      key={idx}
                      className={idx % 2 === 0 ? 'bg-white' : 'bg-slate-50/80 hover:bg-slate-100/50 transition-colors'}
                    >
                      <td className="py-2.5 px-3 text-center font-bold text-slate-700">
                        {exam.itemNumber}
                      </td>
                      <td className="py-2.5 px-3 font-semibold text-slate-900">
                        {exam.name}
                      </td>
                      <td className="py-2.5 px-3 font-mono text-slate-600 text-[11px]">
                        {exam.tussCode}
                      </td>
                      <td className="py-2.5 px-3 text-slate-600 text-[11px]">
                        <span className="inline-flex items-center gap-1">
                          <Clock className="w-3 h-3 text-slate-400" />
                          {exam.deadlineAns}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                            exam.status.includes('Liberado')
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          <CheckCircle2 className="w-3 h-3" />
                          {exam.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Indicação Clínica e Contexto do Caso */}
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3.5 space-y-1.5">
              <span className="font-bold text-slate-700 text-[11px] block uppercase">
                Indicação Clínica & Contexto da Solicitação Médica:
              </span>
              <p className="text-slate-800 text-xs leading-relaxed">
                {character.serviceContext}
              </p>
            </div>
          </div>

          {/* D) Orientações de Coleta e Preparo */}
          <div className="border border-slate-200 rounded-xl bg-slate-50/80 p-4 space-y-3">
            <h4 className="font-bold text-[#064e3b] text-xs uppercase tracking-wide flex items-center gap-1.5">
              <AlertCircle className="w-4 h-4 text-emerald-700" />
              3. Orientações de Coleta, Preparo e Regras Operacionais
            </h4>
            <div className="space-y-2">
              {preparationGuidelines.map((guideline, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs text-slate-700">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-700 mt-1.5 shrink-0" />
                  <span className="leading-relaxed">{guideline}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Falas Típicas e Objeções da Simulação */}
          {phrases.length > 0 && (
            <div className="border border-slate-200 rounded-xl bg-white p-4 space-y-2.5">
              <h4 className="font-bold text-[#064e3b] text-xs uppercase tracking-wide flex items-center gap-1.5">
                <MessageSquare className="w-4 h-4 text-slate-600" />
                4. Roteiro de Simulação (Falas Típicas e Objeções)
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

          {/* E) Rodapé Oficial da Guia */}
          <div className="pt-4 border-t border-slate-200 text-slate-500 flex flex-col md:flex-row md:items-center md:justify-between gap-2 text-[11px]">
            <div>
              <p className="font-semibold text-slate-700">
                Portal de Desempenho Operacional — Guia Médica Fictícia de Simulação
              </p>
              <p className="text-[10px] text-slate-400">
                Aviso: Documento gerado estritamente para avaliação de qualidade e treinamento contínuo. Regulamentado sob as diretrizes da ANS (RN 566/2022).
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
