import React, { useState, useMemo } from 'react';
import {
  GraduationCap,
  BookOpen,
  ClipboardCheck,
  Search,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
  GripVertical,
  CheckCircle2,
  Clock,
  Lock,
  UserCheck,
  User,
  AlertCircle,
  HelpCircle,
  X,
  Sparkles,
} from 'lucide-react';
import { usePortalStore } from '../../../context/PortalStoreContext';
import {
  Collaborator,
  CollaboratorTrackStep,
  Checklist,
  Survey,
  getCellName,
  OfficialCell,
} from '../../../types/portal';

interface CollaboratorTrackBuilderProps {
  collaborator: Collaborator;
  onClose?: () => void;
}

export const CollaboratorTrackBuilder: React.FC<CollaboratorTrackBuilderProps> = ({
  collaborator,
  onClose,
}) => {
  const {
    checklists,
    surveys,
    updateCollaboratorTrack,
    addStepToCollaboratorTrack,
    removeStepFromCollaboratorTrack,
  } = usePortalStore();

  // Tab da biblioteca (Checklists ou Pesquisas)
  const [libraryTab, setLibraryTab] = useState<'checklists' | 'surveys'>('checklists');
  const [searchQuery, setSearchQuery] = useState('');
  const [cellFilter, setCellFilter] = useState<'all' | OfficialCell>('all');
  const [draggedItem, setDraggedItem] = useState<{
    type: 'checklist' | 'survey';
    id: string;
    title: string;
  } | null>(null);

  const [draggedStepIndex, setDraggedStepIndex] = useState<number | null>(null);
  const [dragOverStepIndex, setDragOverStepIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  // Trilha reativa do colaborador
  const currentTrack: CollaboratorTrackStep[] = useMemo(() => {
    return collaborator.track || [];
  }, [collaborator.track]);

  // Contadores e métricas de progresso
  const totalSteps = currentTrack.length;
  const completedSteps = currentTrack.filter((s) => s.status === 'concluido').length;
  const progressPct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  // Filtragem da biblioteca de Checklists
  const filteredChecklists = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return checklists.filter((chk) => {
      if (cellFilter !== 'all' && chk.cell !== cellFilter) return false;
      if (!q) return true;
      return (
        chk.title.toLowerCase().includes(q) ||
        (chk.categoryName && chk.categoryName.toLowerCase().includes(q)) ||
        chk.description.toLowerCase().includes(q)
      );
    });
  }, [checklists, searchQuery, cellFilter]);

  // Filtragem da biblioteca de Pesquisas
  const filteredSurveys = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return surveys.filter((srv) => {
      if (!q) return true;
      return (
        srv.title.toLowerCase().includes(q) ||
        srv.description.toLowerCase().includes(q) ||
        (srv.targetCell && srv.targetCell.toLowerCase().includes(q))
      );
    });
  }, [surveys, searchQuery]);

  // Ação: Incluir item na trilha
  const handleIncludeItem = async (type: 'checklist' | 'survey', item: Checklist | Survey) => {
    setFeedback(null);
    setIsSaving(true);
    const res = await addStepToCollaboratorTrack(collaborator.id, {
      type,
      title: item.title,
      refId: item.id,
      filledBy: 'collaborator',
    });
    setIsSaving(false);
    if (res.success) {
      setFeedback({ type: 'success', text: `"${item.title}" incluído na trilha!` });
    } else {
      setFeedback({ type: 'error', text: res.message });
    }
  };

  // Ação: Remover item da trilha
  const handleRemoveStep = async (stepId: string) => {
    setFeedback(null);
    setIsSaving(true);
    const res = await removeStepFromCollaboratorTrack(collaborator.id, stepId);
    setIsSaving(false);
    if (res.success) {
      setFeedback({ type: 'success', text: 'Etapa removida da trilha.' });
    } else {
      setFeedback({ type: 'error', text: res.message });
    }
  };

  // Ação: Mudar quem preenche (Colaborador vs Auxiliar/Avaliador)
  const handleChangeFilledBy = async (
    stepId: string,
    filledBy: 'collaborator' | 'evaluator'
  ) => {
    const updated = currentTrack.map((step) =>
      step.id === stepId ? { ...step, filledBy } : step
    );
    await updateCollaboratorTrack(collaborator.id, updated);
  };

  // Ação: Mover etapa para cima
  const handleMoveStepUp = async (index: number) => {
    if (index === 0) return;
    const updated = [...currentTrack];
    const [moved] = updated.splice(index, 1);
    updated.splice(index - 1, 0, moved);
    await updateCollaboratorTrack(collaborator.id, updated);
  };

  // Ação: Mover etapa para baixo
  const handleMoveStepDown = async (index: number) => {
    if (index === currentTrack.length - 1) return;
    const updated = [...currentTrack];
    const [moved] = updated.splice(index, 1);
    updated.splice(index + 1, 0, moved);
    await updateCollaboratorTrack(collaborator.id, updated);
  };

  // Drag-and-Drop: Soltar da Biblioteca na Trilha
  const handleDropFromLibrary = async (e: React.DragEvent) => {
    e.preventDefault();
    if (!draggedItem) return;
    await handleIncludeItem(
      draggedItem.type,
      draggedItem.type === 'checklist'
        ? checklists.find((c) => c.id === draggedItem.id)!
        : surveys.find((s) => s.id === draggedItem.id)!
    );
    setDraggedItem(null);
  };

  // Drag-and-Drop: Reordenar na Linha do Tempo
  const handleTimelineDragStart = (e: React.DragEvent, index: number) => {
    setDraggedStepIndex(index);
    e.dataTransfer.setData('text/plain', index.toString());
  };

  const handleTimelineDrop = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedStepIndex === null) return;
    if (draggedStepIndex === targetIndex) {
      setDraggedStepIndex(null);
      setDragOverStepIndex(null);
      return;
    }

    const updated = [...currentTrack];
    const [removed] = updated.splice(draggedStepIndex, 1);
    updated.splice(targetIndex, 0, removed);
    setDraggedStepIndex(null);
    setDragOverStepIndex(null);
    await updateCollaboratorTrack(collaborator.id, updated);
  };

  return (
    <div className="space-y-4">
      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`p-3.5 rounded-xl flex items-center justify-between text-xs font-medium border shadow-xs animate-in fade-in duration-150 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-950 border-emerald-300'
              : 'bg-red-50 text-red-950 border-red-300'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-700 font-bold ml-3 cursor-pointer"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header do Construtor */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0f3e2e] text-white flex items-center justify-center font-bold shadow-xs">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-slate-900 font-display">
                Trilha de Aprendizagem & Linha do Tempo
              </h2>
              <span className="text-[10px] font-bold text-emerald-900 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                Individual
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Monte a jornada sequencial de desenvolvimento para{' '}
              <strong className="text-slate-800">{collaborator.fullName}</strong>. Arraste ou
              adicione itens da biblioteca ao lado.
            </p>
          </div>
        </div>

        {/* Resumo do Progresso da Trilha */}
        <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl shrink-0">
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Total de Etapas
            </div>
            <div className="text-base font-bold text-slate-900 font-mono">
              {totalSteps} atividade(s)
            </div>
          </div>
          <div className="w-px h-8 bg-slate-200" />
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Evolução
            </div>
            <div className="flex items-center gap-1.5 font-mono text-base font-bold text-emerald-800">
              <span>{progressPct}%</span>
              <span className="text-xs font-normal text-slate-500 font-sans">
                ({completedSteps}/{totalSteps})
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* LAYOUT EM 2 COLUNAS: BIBLIOTECA (ESQ) & TRILHA DO COLAB (DIR) */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ========================================================= */}
        {/* PAINEL DA ESQUERDA: BIBLIOTECA DE ATIVIDADES PRONTAS */}
        {/* ========================================================= */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden flex flex-col">
          {/* Header do Painel */}
          <div className="p-4 bg-slate-50/80 border-b border-slate-200 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                <BookOpen className="w-4 h-4 text-emerald-800" />
                <span>Biblioteca de Atividades</span>
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                {libraryTab === 'checklists'
                  ? `${filteredChecklists.length} checklist(s)`
                  : `${filteredSurveys.length} pesquisa(s)`}
              </span>
            </div>

            {/* Alternância de Abas: Checklists vs Pesquisas */}
            <div className="grid grid-cols-2 gap-1.5 bg-slate-200/70 p-1 rounded-xl text-xs font-bold">
              <button
                type="button"
                onClick={() => setLibraryTab('checklists')}
                className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  libraryTab === 'checklists'
                    ? 'bg-white text-emerald-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Checklists ({checklists.length})</span>
              </button>
              <button
                type="button"
                onClick={() => setLibraryTab('surveys')}
                className={`py-2 px-3 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                  libraryTab === 'surveys'
                    ? 'bg-white text-emerald-950 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <ClipboardCheck className="w-3.5 h-3.5" />
                <span>Pesquisas ({surveys.length})</span>
              </button>
            </div>

            {/* Campo de Busca Rápida */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  libraryTab === 'checklists'
                    ? 'Buscar checklist por nome ou categoria...'
                    : 'Buscar pesquisa de satisfação...'
                }
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs placeholder-slate-400 text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Filtro por Célula apenas na aba de Checklists */}
            {libraryTab === 'checklists' && (
              <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px]">
                <span className="text-slate-400 font-semibold mr-1">Célula:</span>
                {[
                  { key: 'all', label: 'Todas' },
                  { key: 'LAB', label: 'Laboratório' },
                  { key: 'IMG', label: 'Imagem' },
                  { key: 'CONSULTA', label: 'Consultas' },
                  { key: 'TERAPIA', label: 'Terapias' },
                  { key: 'OPERADORA', label: 'Convênio' },
                ].map((item) => {
                  const isSel = cellFilter === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => setCellFilter(item.key as 'all' | OfficialCell)}
                      className={`px-2 py-0.5 rounded-md transition-colors cursor-pointer whitespace-nowrap ${
                        isSel
                          ? 'bg-[#0f3e2e] text-white font-bold'
                          : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Lista de Itens Disponíveis */}
          <div className="p-3 space-y-2.5 max-h-[560px] overflow-y-auto">
            {libraryTab === 'checklists' ? (
              filteredChecklists.length === 0 ? (
                <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs">
                  Nenhum checklist encontrado com o filtro atual.
                </div>
              ) : (
                filteredChecklists.map((chk) => (
                  <div
                    key={chk.id}
                    draggable
                    onDragStart={() =>
                      setDraggedItem({ type: 'checklist', id: chk.id, title: chk.title })
                    }
                    className="p-3 rounded-xl border border-slate-200 bg-white hover:border-emerald-400 hover:shadow-xs transition-all flex flex-col justify-between gap-2.5 cursor-grab active:cursor-grabbing group"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] font-bold text-emerald-900 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md uppercase">
                          {chk.categoryName || 'Geral'}
                        </span>
                        <span className="text-[10px] text-slate-400 font-medium">
                          {getCellName(chk.cell)}
                        </span>
                      </div>
                      <h4 className="font-bold text-xs text-slate-900 group-hover:text-emerald-950 leading-snug">
                        {chk.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 line-clamp-1 leading-relaxed">
                        {chk.description || 'Critérios operacionais de atendimento.'}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <span className="text-[10px] text-slate-400">
                        {chk.criteria.length} critérios
                      </span>

                      <button
                        type="button"
                        onClick={() => handleIncludeItem('checklist', chk)}
                        disabled={isSaving}
                        className="px-2.5 py-1 text-[11px] font-bold text-white bg-[#0f3e2e] hover:bg-emerald-900 rounded-lg transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
                      >
                        <Plus className="w-3 h-3" />
                        <span>Incluir na Trilha</span>
                      </button>
                    </div>
                  </div>
                ))
              )
            ) : filteredSurveys.length === 0 ? (
              <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs">
                Nenhuma pesquisa de satisfação cadastrada no momento.
              </div>
            ) : (
              filteredSurveys.map((survey) => (
                <div
                  key={survey.id}
                  draggable
                  onDragStart={() =>
                    setDraggedItem({ type: 'survey', id: survey.id, title: survey.title })
                  }
                  className="p-3 rounded-xl border border-slate-200 bg-white hover:border-emerald-400 hover:shadow-xs transition-all flex flex-col justify-between gap-2.5 cursor-grab active:cursor-grabbing group"
                >
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold text-purple-900 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-md uppercase">
                        Pesquisa de Satisfação
                      </span>
                      <span className="text-[10px] text-slate-400 font-medium">
                        {survey.targetCell || 'Todas'}
                      </span>
                    </div>
                    <h4 className="font-bold text-xs text-slate-900 group-hover:text-emerald-950 leading-snug">
                      {survey.title}
                    </h4>
                    <p className="text-[11px] text-slate-500 line-clamp-1 leading-relaxed">
                      {survey.description || 'Avaliação da experiência e satisfação.'}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">
                      {survey.questions.length} pergunta(s)
                    </span>

                    <button
                      type="button"
                      onClick={() => handleIncludeItem('survey', survey)}
                      disabled={isSaving}
                      className="px-2.5 py-1 text-[11px] font-bold text-white bg-[#0f3e2e] hover:bg-emerald-900 rounded-lg transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
                    >
                      <Plus className="w-3 h-3" />
                      <span>Incluir na Trilha</span>
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* ========================================================= */}
        {/* PAINEL DA DIREITA: TRILHA INDIVIDUAL DO COLABORADOR */}
        {/* ========================================================= */}
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDropFromLibrary}
          className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden flex flex-col"
        >
          {/* Header da Trilha */}
          <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span>Linha do Tempo: {collaborator.fullName}</span>
                <span className="text-[11px] font-mono font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                  @{collaborator.username || 'colaborador'}
                </span>
              </h3>
              <p className="text-[11px] text-slate-500">
                Ordem sequencial obrigatória. Reordene com os botões ↑ ↓ ou arraste o card.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-slate-600 bg-white px-3 py-1 rounded-lg border border-slate-200">
                {currentTrack.length} etapa(s)
              </span>
            </div>
          </div>

          {/* Área de Linha do Tempo */}
          <div className="p-4 space-y-3 min-h-[460px]">
            {currentTrack.length === 0 ? (
              <div className="border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center space-y-3 bg-slate-50/50">
                <div className="w-12 h-12 rounded-full bg-emerald-50 text-[#0f3e2e] flex items-center justify-center mx-auto">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <h4 className="font-bold text-sm text-slate-800">
                  Nenhuma atividade inserida na trilha ainda
                </h4>
                <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                  Utilize o botão <strong className="text-emerald-950">+ Incluir na Trilha</strong>{' '}
                  ou arraste checklists e pesquisas do painel ao lado para começar a montar o
                  roteiro deste colaborador.
                </p>
              </div>
            ) : (
              currentTrack.map((step, index) => {
                const isChecklist = step.type === 'checklist';
                const isCompleted = step.status === 'concluido';
                const isAvailable = step.status === 'disponivel';
                const isLocked = step.status === 'bloqueado';

                return (
                  <div
                    key={step.id}
                    draggable
                    onDragStart={(e) => handleTimelineDragStart(e, index)}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOverStepIndex(index);
                    }}
                    onDragLeave={() => setDragOverStepIndex(null)}
                    onDrop={(e) => handleTimelineDrop(e, index)}
                    className={`border rounded-2xl p-4 transition-all shadow-xs relative ${
                      dragOverStepIndex === index
                        ? 'border-emerald-600 ring-2 ring-emerald-300'
                        : isCompleted
                        ? 'border-emerald-200 bg-emerald-50/20'
                        : isAvailable
                        ? 'border-slate-300 bg-white hover:border-emerald-400'
                        : 'border-slate-200 bg-slate-50/60 opacity-80'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Alça de Arraste e Número da Etapa */}
                      <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                        <button
                          type="button"
                          className="text-slate-300 hover:text-slate-600 cursor-grab active:cursor-grabbing p-0.5"
                          title="Arraste para reordenar"
                        >
                          <GripVertical className="w-4 h-4" />
                        </button>
                        <span
                          className={`w-7 h-7 rounded-full font-bold text-xs flex items-center justify-center shrink-0 ${
                            isCompleted
                              ? 'bg-emerald-700 text-white shadow-2xs'
                              : isAvailable
                              ? 'bg-[#0f3e2e] text-white shadow-2xs'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {index + 1}
                        </span>
                      </div>

                      {/* Informações da Etapa */}
                      <div className="flex-1 space-y-2">
                        <div className="flex items-center gap-2 flex-wrap justify-between">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-bold text-sm text-slate-900 leading-snug">
                              {step.title}
                            </h4>

                            {/* Badge do Tipo */}
                            <span
                              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                                isChecklist
                                  ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                                  : 'bg-purple-50 text-purple-900 border-purple-200'
                              }`}
                            >
                              {isChecklist ? 'Checklist' : 'Pesquisa de Satisfação'}
                            </span>

                            {/* Badge do Status Sequencial */}
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                                isCompleted
                                  ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                  : isAvailable
                                  ? 'bg-blue-50 text-blue-900 border-blue-200'
                                  : 'bg-slate-100 text-slate-600 border-slate-200'
                              }`}
                            >
                              {isCompleted ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                                  <span>Concluído</span>
                                </>
                              ) : isAvailable ? (
                                <>
                                  <Clock className="w-3 h-3 text-blue-700" />
                                  <span>Disponível</span>
                                </>
                              ) : (
                                <>
                                  <Lock className="w-3 h-3 text-slate-400" />
                                  <span>Bloqueado</span>
                                </>
                              )}
                            </span>
                          </div>

                          {/* Botões de Ordenação e Exclusão */}
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => handleMoveStepUp(index)}
                              disabled={index === 0}
                              className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg disabled:opacity-30 cursor-pointer"
                              title="Mover para cima"
                            >
                              <ArrowUp className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleMoveStepDown(index)}
                              disabled={index === currentTrack.length - 1}
                              className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg disabled:opacity-30 cursor-pointer"
                              title="Mover para baixo"
                            >
                              <ArrowDown className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveStep(step.id)}
                              className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer ml-1"
                              title="Remover etapa"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        {/* Controle de Quem Preenche */}
                        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                          {isChecklist ? (
                            <div className="flex items-center gap-2">
                              <span className="text-slate-500 font-medium text-[11px]">
                                Quem preenche?
                              </span>
                              <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200">
                                <button
                                  type="button"
                                  onClick={() => handleChangeFilledBy(step.id, 'collaborator')}
                                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                    step.filledBy === 'collaborator'
                                      ? 'bg-white text-emerald-950 shadow-2xs'
                                      : 'text-slate-500 hover:text-slate-800'
                                  }`}
                                >
                                  <User className="w-3 h-3" />
                                  <span>Colaborador</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleChangeFilledBy(step.id, 'evaluator')}
                                  className={`px-2.5 py-1 rounded-md text-[11px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                    step.filledBy === 'evaluator'
                                      ? 'bg-white text-emerald-950 shadow-2xs'
                                      : 'text-slate-500 hover:text-slate-800'
                                  }`}
                                >
                                  <UserCheck className="w-3 h-3" />
                                  <span>Auxiliar / Avaliador</span>
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1.5 text-[11px] text-purple-950 font-medium">
                              <User className="w-3.5 h-3.5 text-purple-700" />
                              <span>Preenchida pelo Colaborador</span>
                            </div>
                          )}

                          {/* Se Concluído: Exibe Nota / Data */}
                          {isCompleted && (
                            <div className="text-[11px] text-emerald-900 font-semibold flex items-center gap-2">
                              {typeof step.finalScore === 'number' && (
                                <span className="font-mono bg-emerald-100/80 px-2 py-0.5 rounded border border-emerald-300">
                                  Nota: {step.finalScore.toFixed(1)}/10
                                </span>
                              )}
                              {step.completedAt && (
                                <span className="text-slate-400 font-normal">
                                  {new Date(step.completedAt).toLocaleDateString('pt-BR')}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
