import React, { useMemo, useState } from 'react';
import {
  Theater,
  Search,
  User,
  FileText,
  AlertCircle,
  MessageSquare,
  Users,
  Eye,
  Download,
  Building2,
  Sparkles,
  Info,
  CheckCircle2,
  BookOpen,
} from 'lucide-react';
import { usePortalStore } from '../../../context/PortalStoreContext';
import { Exercise, Character, normalizePhrases } from '../../../types/portal';
import { downloadGuidePdf } from '../../../lib/downloadHelpers';

export const ActorScenariosView: React.FC = () => {
  const {
    exercises,
    characters,
    collaborators,
    collaboratorChecklists,
    checklists,
    cells,
    currentUser,
  } = usePortalStore();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCell, setSelectedCell] = useState<string>('all');
  const [selectedCollaboratorId, setSelectedCollaboratorId] = useState<string>('all');
  const [selectedExerciseForModal, setSelectedExerciseForModal] = useState<Exercise | null>(null);

  // Mapeamento de exercícios atribuídos por colaborador através dos checklists da trilha
  const collaboratorExerciseMap = useMemo(() => {
    const map = new Map<string, string[]>(); // exerciseId -> collaboratorIds[]
    collaboratorChecklists.forEach((assign) => {
      const chk = checklists.find((c) => c.id === assign.checklistId);
      if (chk && chk.exerciseIds && chk.exerciseIds.length > 0) {
        chk.exerciseIds.forEach((exId) => {
          const existing = map.get(exId) || [];
          if (!existing.includes(assign.collaboratorId)) {
            existing.push(assign.collaboratorId);
          }
          map.set(exId, existing);
        });
      }
    });
    return map;
  }, [collaboratorChecklists, checklists]);

  // Personagens por ID para lookup rápido
  const characterMap = useMemo(() => {
    const map = new Map<string, Character>();
    characters.forEach((c) => map.set(c.id, c));
    return map;
  }, [characters]);

  // Filtragem dos exercícios
  const filteredExercises = useMemo(() => {
    return exercises.filter((ex) => {
      // Filtro de célula
      if (selectedCell !== 'all' && ex.cell !== selectedCell) {
        return false;
      }

      // Filtro de colaborador específico
      if (selectedCollaboratorId !== 'all') {
        const linkedCollabs = collaboratorExerciseMap.get(ex.id) || [];
        if (!linkedCollabs.includes(selectedCollaboratorId)) {
          return false;
        }
      }

      // Filtro de busca textual
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const linkedChars = (ex.characterIds || []).map((id) => characterMap.get(id)).filter(Boolean) as Character[];
        const hasCharMatch = linkedChars.some((c) => {
          const phrases = normalizePhrases(c.typicalPhrases);
          return (
            c.name.toLowerCase().includes(q) ||
            c.temperament.toLowerCase().includes(q) ||
            c.serviceContext.toLowerCase().includes(q) ||
            phrases.some((p) => p.toLowerCase().includes(q))
          );
        });

        const hasExMatch =
          ex.title.toLowerCase().includes(q) ||
          ex.scenarioInstructions.toLowerCase().includes(q) ||
          (ex.categoryName && ex.categoryName.toLowerCase().includes(q));

        if (!hasExMatch && !hasCharMatch) {
          return false;
        }
      }

      return true;
    });
  }, [exercises, selectedCell, selectedCollaboratorId, searchQuery, collaboratorExerciseMap, characterMap]);

  const handleDownloadGuide = (char: Character, exerciseTitle?: string) => {
    downloadGuidePdf(char, exerciseTitle);
  };

  return (
    <div className="space-y-6">
      {/* 1. Header do Painel do Ator */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-50 text-purple-800 rounded-xl border border-purple-200">
              <Theater className="w-5 h-5 text-purple-700" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-black text-slate-900 tracking-tight">
                  Cenários de Simulação & Casos Atrelados
                </h1>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-100 text-purple-900 border border-purple-200 uppercase">
                  Painel do Ator
                </span>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Consulte roteiros cênicos, perfis de pacientes e falas de objeção para apoiar a simulação com os colaboradores em treinamento.
              </p>
            </div>
          </div>
        </div>

        {/* Badge Informativa do Modo Leitura */}
        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 flex items-start gap-2.5 max-w-sm shrink-0">
          <Info className="w-4 h-4 text-purple-700 shrink-0 mt-0.5" />
          <div className="text-[11px] text-slate-600 leading-tight">
            <span className="font-bold text-slate-800 block mb-0.5">
              Acesso Exclusivo de Leitura & Apoio
            </span>
            Você tem visualização integral dos casos, falas e guias médicas. Sem atribuição de notas ou alteração de dados.
          </div>
        </div>
      </div>

      {/* 2. Barra de Filtros e Busca Rápida */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs grid grid-cols-1 md:grid-cols-12 gap-3.5 items-center">
        {/* Campo de Busca */}
        <div className="md:col-span-5 relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por caso, cliente, contexto ou falas típicas..."
            className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-600 font-medium text-slate-800 transition-colors"
          />
        </div>

        {/* Filtro por Colaborador em Treinamento */}
        <div className="md:col-span-4">
          <select
            value={selectedCollaboratorId}
            onChange={(e) => setSelectedCollaboratorId(e.target.value)}
            className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-600 font-medium text-slate-800 cursor-pointer"
          >
            <option value="all">Todos os Colaboradores em Treinamento</option>
            {collaborators.map((col) => (
              <option key={col.id} value={col.id}>
                Colaborador: {col.fullName} ({col.roleTitle} · {col.cellTeam || 'Geral'})
              </option>
            ))}
          </select>
        </div>

        {/* Filtro por Célula */}
        <div className="md:col-span-3">
          <select
            value={selectedCell}
            onChange={(e) => setSelectedCell(e.target.value)}
            className="w-full py-2 px-3 text-xs bg-slate-50 border border-slate-200 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-purple-600 font-medium text-slate-800 cursor-pointer"
          >
            <option value="all">Todas as Células Clínicas</option>
            <option value="LAB">Laboratório</option>
            <option value="IMG">Imagem</option>
            <option value="CONSULTA">Consultas</option>
            <option value="TERAPIA">Terapias</option>
            <option value="OPERADORA">Operadora</option>
          </select>
        </div>
      </div>

      {/* 3. Lista de Casos e Roteiros de Simulação */}
      {filteredExercises.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
          <Theater className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-sm font-bold text-slate-800">
            Nenhum cenário de simulação encontrado para estes filtros.
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto">
            Tente redefinir a busca por colaborador ou limpar o filtro de célula para visualizar outros casos de simulação.
          </p>
          <button
            type="button"
            onClick={() => {
              setSearchQuery('');
              setSelectedCell('all');
              setSelectedCollaboratorId('all');
            }}
            className="text-xs font-bold text-purple-700 hover:underline cursor-pointer"
          >
            Limpar todos os filtros
          </button>
        </div>
      ) : (
        <div className="space-y-5">
          <div className="text-xs font-semibold text-slate-500 px-1">
            Exibindo <strong>{filteredExercises.length}</strong> roteiro(s) de simulação disponíveis:
          </div>

          <div className="grid grid-cols-1 gap-5">
            {filteredExercises.map((exercise) => {
              const linkedCollabIds = collaboratorExerciseMap.get(exercise.id) || [];
              const linkedCollabs = collaborators.filter((c) => linkedCollabIds.includes(c.id));
              const exerciseChars = (exercise.characterIds || [])
                .map((id) => characterMap.get(id))
                .filter(Boolean) as Character[];

              return (
                <div
                  key={exercise.id}
                  className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs hover:border-purple-300 transition-all space-y-5"
                >
                  {/* Cabeçalho do Roteiro */}
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 pb-4 border-b border-slate-100">
                    <div className="space-y-1.5">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-purple-50 text-purple-800 border border-purple-200 uppercase tracking-wide">
                          Célula: {exercise.cell}
                        </span>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700 uppercase">
                          Dificuldade: {exercise.difficulty}
                        </span>
                        {exercise.categoryName && (
                          <span className="text-[10px] font-medium px-2 py-0.5 rounded bg-slate-50 text-slate-600 border border-slate-200">
                            {exercise.categoryName}
                          </span>
                        )}
                      </div>
                      <h2 className="text-base font-bold text-slate-900">
                        {exercise.title}
                      </h2>
                    </div>

                    {/* Colaboradores Vinculados */}
                    <div className="text-right sm:text-right">
                      <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center sm:justify-end gap-1.5">
                        <Users className="w-3.5 h-3.5 text-purple-600" />
                        <span>Colaboradores Atrelados:</span>
                      </div>
                      {linkedCollabs.length === 0 ? (
                        <span className="text-xs text-slate-400 italic">
                          Geral / Disponível na base
                        </span>
                      ) : (
                        <div className="flex flex-wrap gap-1 sm:justify-end mt-1">
                          {linkedCollabs.map((col) => (
                            <span
                              key={col.id}
                              className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200"
                            >
                              {col.fullName}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Instruções de Roteiro para o Ator */}
                  <div className="p-4 bg-purple-50/60 border border-purple-200/80 rounded-xl space-y-1.5">
                    <div className="flex items-center gap-2 text-xs font-bold text-purple-900 uppercase tracking-wide">
                      <Theater className="w-4 h-4 text-purple-700" />
                      <span>Roteiro & Instruções para Interpretação Cênica:</span>
                    </div>
                    <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line pl-6">
                      {exercise.scenarioInstructions}
                    </p>
                  </div>

                  {/* Ficha dos Clientes / Personagens Envolvidos */}
                  {exerciseChars.length > 0 && (
                    <div className="space-y-3">
                      <div className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-slate-500" />
                        <span>Personagem(ns) do Caso Clínico ({exerciseChars.length}):</span>
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {exerciseChars.map((char) => {
                          const phrases = normalizePhrases(char.typicalPhrases);
                          return (
                            <div
                              key={char.id}
                              className="bg-slate-50 border border-slate-200 rounded-xl p-4.5 space-y-3 flex flex-col justify-between"
                            >
                              <div className="space-y-2.5">
                                {/* Cabeçalho do Cliente */}
                                <div className="flex items-start justify-between gap-2">
                                  <div>
                                    <div className="font-bold text-sm text-slate-900">
                                      {char.name}
                                    </div>
                                    <div className="text-[11px] text-slate-500">
                                      {char.age} anos · {char.gender} · Cartão: {char.cardNumber || 'N/A'}
                                    </div>
                                  </div>
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-100 text-amber-900 border border-amber-200">
                                    {char.temperament}
                                  </span>
                                </div>

                                {/* Contexto de Atendimento */}
                                <div className="text-xs text-slate-700 space-y-0.5">
                                  <span className="font-bold text-slate-800 block text-[11px] uppercase tracking-wide">
                                    Contexto do Atendimento:
                                  </span>
                                  <p className="text-xs text-slate-600 bg-white p-2.5 rounded-lg border border-slate-200 leading-relaxed">
                                    {char.serviceContext}
                                  </p>
                                </div>

                                {/* Falas Típicas e Objeções para o Ator Dizer */}
                                {phrases.length > 0 && (
                                  <div className="space-y-1.5">
                                    <span className="font-bold text-slate-800 block text-[11px] uppercase tracking-wide flex items-center gap-1 text-purple-900">
                                      <MessageSquare className="w-3 h-3 text-purple-700" />
                                      Falas Típicas / Objeções para Dizer na Simulação:
                                    </span>
                                    <div className="space-y-1.5">
                                      {phrases.map((phrase, pIdx) => (
                                        <div
                                          key={pIdx}
                                          className="text-xs text-purple-950 bg-white border border-purple-200 rounded-lg px-3 py-1.5 italic font-medium flex items-start gap-1.5 shadow-2xs"
                                        >
                                          <span className="text-purple-400 font-bold font-serif select-none text-base leading-none">
                                            “
                                          </span>
                                          <span>{phrase}</span>
                                          <span className="text-purple-400 font-bold font-serif select-none text-base leading-none">
                                            ”
                                          </span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>

                              {/* Ações de Apoio (Baixar Guia Médica do Caso) */}
                              <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                                <span className="text-[11px] text-slate-500 font-mono">
                                  ID: {char.id}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleDownloadGuide(char)}
                                  className="px-3 py-1.5 text-xs font-bold text-purple-800 hover:text-purple-950 bg-purple-100 hover:bg-purple-200 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  <span>Baixar Guia Médica (PDF)</span>
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
