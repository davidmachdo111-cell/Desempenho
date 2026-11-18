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
  X,
  Shield,
  BookmarkPlus,
  Layers,
  Building2,
} from 'lucide-react';
import { usePortalStore } from '../../../context/PortalStoreContext';
import { useToast } from '../../../context/ToastContext';
import {
  canViewRestrictedItem,
  Collaborator,
  CollaboratorTrackStep,
  Checklist,
  Survey,
  TrackTemplate,
  getCellName,
  getScorePerformanceMeta,
  OfficialCell,
  CLEAN_CELL_NAMES,
} from '../../../types/portal';

interface CollaboratorTrackBuilderProps {
  collaborator: Collaborator;
  onClose?: () => void;
  readOnly?: boolean;
  onStartEvaluation?: (assignmentId: string, collaboratorId?: string) => void;
}

export const CollaboratorTrackBuilder: React.FC<CollaboratorTrackBuilderProps> = ({
  collaborator,
  readOnly,
  onStartEvaluation,
}) => {
  const {
    checklists,
    surveys,
    categories,
    trackTemplates,
    currentUser,
    hasPermission,
    updateCollaboratorTrack,
    addStepToCollaboratorTrack,
    removeStepFromCollaboratorTrack,
    ensureCollaboratorChecklistAssignment,
    saveTrackTemplate,
    deleteTrackTemplate,
  } = usePortalStore();
  const { showToast } = useToast();

  const canManageTracks = hasPermission('can_manage_collaborators');
  const isReadOnly = readOnly !== undefined ? readOnly : !canManageTracks;
  const isFinalized = Boolean(collaborator.isTrackFinalized);
  const canEditStructure = !isReadOnly && !isFinalized;

  // Tab da biblioteca (Checklists ou Pesquisas)
  const [libraryTab, setLibraryTab] = useState<'checklists' | 'surveys'>('checklists');
  const [searchQuery, setSearchQuery] = useState('');
  const [cellFilter, setCellFilter] = useState<'all' | OfficialCell>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [draggedItem, setDraggedItem] = useState<{
    type: 'checklist' | 'survey';
    id: string;
    title: string;
  } | null>(null);

  const [draggedStepIndex, setDraggedStepIndex] = useState<number | null>(null);
  const [dragOverStepIndex, setDragOverStepIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Estados de Modelos de Trilha Reutilizáveis
  const [isSaveTemplateModalOpen, setIsSaveTemplateModalOpen] = useState(false);
  const [templateNameInput, setTemplateNameInput] = useState('');
  const [templateCellInput, setTemplateCellInput] = useState(
    collaborator.cellTeam ? getCellName(collaborator.cellTeam) : 'Laboratório'
  );
  const [isSavingTemplate, setIsSavingTemplate] = useState(false);
  const [isApplyTemplateModalOpen, setIsApplyTemplateModalOpen] = useState(false);
  const [isApplyingTemplate, setIsApplyingTemplate] = useState(false);

  // Trilha reativa do colaborador
  const currentTrack: CollaboratorTrackStep[] = useMemo(() => {
    return collaborator.track || [];
  }, [collaborator.track]);

  // Contadores e métricas de progresso
  const totalSteps = currentTrack.length;
  const completedSteps = currentTrack.filter((s) => s.status === 'concluido').length;
  const progressPct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  const availableCategories = useMemo(() => {
    return categories.filter((c) => c.type === 'checklist' || c.type === 'geral');
  }, [categories]);

  // Filtragem da biblioteca de Checklists
  const filteredChecklists = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return checklists.filter((chk) => {
      if (cellFilter !== 'all' && chk.cell !== cellFilter) return false;
      if (categoryFilter !== 'all') {
        const chkCatName = chk.categoryName || 'Geral';
        if (chkCatName !== categoryFilter && chk.categoryId !== categoryFilter) return false;
      }
      if (!q) return true;
      return (
        chk.title.toLowerCase().includes(q) ||
        (chk.categoryName && chk.categoryName.toLowerCase().includes(q)) ||
        chk.description.toLowerCase().includes(q)
      );
    });
  }, [checklists, searchQuery, cellFilter, categoryFilter]);

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

  // Ação: Incluir item na trilha (Checklists nascem com 'evaluator' por padrão)
  const handleIncludeItem = async (type: 'checklist' | 'survey', item: Checklist | Survey) => {
    if (currentTrack.some((s) => s.type === type && s.refId === item.id)) {
      showToast('Esta atividade já está vinculada na trilha deste colaborador.', 'info');
      return;
    }

    setIsSaving(true);
    const res = await addStepToCollaboratorTrack(collaborator.id, {
      type,
      title: item.title,
      refId: item.id,
      filledBy: type === 'checklist' ? 'evaluator' : 'collaborator',
    });
    setIsSaving(false);
    if (res.success) {
      showToast(`"${item.title}" incluído na trilha!`, 'success');
    } else {
      showToast(res.message, 'error');
    }
  };

  // Ação: Remover item da trilha
  const handleRemoveStep = async (stepId: string) => {
    setIsSaving(true);
    const res = await removeStepFromCollaboratorTrack(collaborator.id, stepId);
    setIsSaving(false);
    if (res.success) {
      showToast('Etapa removida da trilha.', 'success');
    } else {
      showToast(res.message, 'error');
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
    const targetItem =
      draggedItem.type === 'checklist'
        ? checklists.find((c) => c.id === draggedItem.id)
        : surveys.find((s) => s.id === draggedItem.id);
    setDraggedItem(null);
    if (!targetItem) return;
    await handleIncludeItem(draggedItem.type, targetItem);
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

  const handleOpenSaveTemplateModal = () => {
    if (currentTrack.length === 0) {
      showToast('Adicione ao menos uma etapa na trilha antes de salvar como modelo.', 'info');
      return;
    }
    setTemplateNameInput('');
    setTemplateCellInput(collaborator.cellTeam ? getCellName(collaborator.cellTeam) : 'Geral');
    setIsSaveTemplateModalOpen(true);
  };

  const handleConfirmSaveTemplate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!templateNameInput.trim()) {
      showToast('Informe um nome para identificar este modelo de trilha.', 'error');
      return;
    }

    setIsSavingTemplate(true);
    const res = await saveTrackTemplate(
      templateNameInput.trim(),
      templateCellInput,
      currentTrack.map((step) => ({
        type: step.type,
        refId: step.refId,
        filledBy: step.filledBy,
      }))
    );
    setIsSavingTemplate(false);

    if (res.success) {
      showToast(res.message, 'success');
      setIsSaveTemplateModalOpen(false);
      setTemplateNameInput('');
    } else {
      showToast(res.message, 'error');
    }
  };

  const handleApplyTemplate = async (template: TrackTemplate) => {
    if (!canEditStructure || isApplyingTemplate) return;

    const existingKeys = new Set(currentTrack.map((s) => `${s.type}:${s.refId}`));
    const hasAnyIncomplete = currentTrack.some((s) => s.status !== 'concluido');

    const stepsToAppend: CollaboratorTrackStep[] = [];
    let skippedDuplicates = 0;

    template.steps.forEach((tplStep, idx) => {
      const key = `${tplStep.type}:${tplStep.refId}`;
      if (existingKeys.has(key)) {
        skippedDuplicates++;
        return;
      }

      const linkedItem =
        tplStep.type === 'checklist'
          ? checklists.find((c) => c.id === tplStep.refId)
          : surveys.find((s) => s.id === tplStep.refId);

      if (!linkedItem) {
        return;
      }

      existingKeys.add(key);
      const isFirstNewPending =
        !hasAnyIncomplete && stepsToAppend.length === 0;

      stepsToAppend.push({
        id: `trk-step-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
        type: tplStep.type,
        title: linkedItem.title,
        refId: tplStep.refId,
        filledBy:
          tplStep.type === 'survey'
            ? 'collaborator'
            : tplStep.filledBy || 'evaluator',
        order: currentTrack.length + stepsToAppend.length + 1,
        status:
          currentTrack.length === 0 && stepsToAppend.length === 0
            ? 'disponivel'
            : isFirstNewPending
            ? 'disponivel'
            : 'bloqueado',
        completedAt: null,
        finalScore: null,
        collaboratorChecklistId:
          tplStep.type === 'checklist'
            ? `asg-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`
            : undefined,
      });
    });

    if (stepsToAppend.length === 0) {
      showToast(
        skippedDuplicates > 0
          ? 'Todas as etapas deste modelo já estão presentes na trilha do colaborador.'
          : 'Nenhuma etapa válida encontrada neste modelo.',
        'info'
      );
      return;
    }

    setIsApplyingTemplate(true);
    const res = await updateCollaboratorTrack(collaborator.id, [
      ...currentTrack,
      ...stepsToAppend,
    ]);
    setIsApplyingTemplate(false);

    if (res.success) {
      showToast(
        `Modelo "${template.name}" aplicado! ${stepsToAppend.length} etapa(s) adicionada(s)${
          skippedDuplicates > 0 ? ` (${skippedDuplicates} duplicada(s) ignorada(s))` : ''
        }.`,
        'success'
      );
      setIsApplyTemplateModalOpen(false);
    } else {
      showToast(res.message, 'error');
    }
  };

  const handleDeleteTemplate = async (template: TrackTemplate) => {
    const res = await deleteTrackTemplate(template.id);
    if (res.success) {
      showToast(`Modelo "${template.name}" removido.`, 'success');
    } else {
      showToast(res.message, 'error');
    }
  };

  return (
    <div className="space-y-4">

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

      {/* Banner de Trilha Finalizada e Bloqueada */}
      {isFinalized && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex items-center gap-3 text-xs text-amber-950 shadow-xs">
          <div className="w-8 h-8 rounded-xl bg-amber-200/80 text-amber-900 flex items-center justify-center shrink-0">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold">
              Trilha Finalizada e Bloqueada para Edições
            </div>
            <p className="text-[11px] text-amber-900/90 mt-0.5">
              Esta jornada já recebeu parecer oficial do Guardião Anfitrião
              {collaborator.guardianFinalizedBy ? ` (${collaborator.guardianFinalizedBy})` : ''}.
              Inclusões, remoções, reordenações e novas avaliações estão travadas.
            </p>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* LAYOUT: BIBLIOTECA (ESQ - ADMIN) & TRILHA DO COLAB (DIR) */}
      {/* ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* ========================================================= */}
        {/* PAINEL DA ESQUERDA: BIBLIOTECA DE ATIVIDADES PRONTAS (ADMIN) */}
        {/* ========================================================= */}
        {canEditStructure && (
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

            {/* Filtros por Categoria e Célula apenas na aba de Checklists */}
            {libraryTab === 'checklists' && (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-slate-500 shrink-0">
                    Categoria:
                  </span>
                  <select
                    value={categoryFilter}
                    onChange={(e) => setCategoryFilter(e.target.value)}
                    className="flex-1 px-2.5 py-1.5 bg-white border border-slate-300 rounded-lg text-[11px] font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    <option value="all">Todas as Categorias</option>
                    {availableCategories.map((cat) => (
                      <option key={cat.id} value={cat.name}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex items-center gap-1 overflow-x-auto pb-1 text-[11px]">
                  <span className="text-slate-400 font-semibold mr-1">Célula:</span>
                  {[
                    { key: 'all', label: 'Todas' },
                    { key: 'LAB', label: 'Laboratório' },
                    { key: 'IMG', label: 'Imagem' },
                    { key: 'CONSULTA', label: 'Consultas' },
                    { key: 'TERAPIA', label: 'Terapias' },
                    { key: 'OPERADORA', label: 'Operadora' },
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
                filteredChecklists.map((chk) => {
                  const isAlreadyInTrack = currentTrack.some(
                    (s) => s.type === 'checklist' && s.refId === chk.id
                  );

                  return (
                    <div
                      key={chk.id}
                      draggable={!isAlreadyInTrack}
                      onDragStart={
                        isAlreadyInTrack
                          ? undefined
                          : () =>
                              setDraggedItem({ type: 'checklist', id: chk.id, title: chk.title })
                      }
                      className={`p-3 rounded-xl border transition-all flex flex-col justify-between gap-2.5 group ${
                        isAlreadyInTrack
                          ? 'border-emerald-200 bg-emerald-50/30 opacity-85'
                          : 'border-slate-200 bg-white hover:border-emerald-400 hover:shadow-xs cursor-grab active:cursor-grabbing'
                      }`}
                    >
                      <div className="space-y-1">
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] font-bold text-emerald-900 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md uppercase">
                              {chk.categoryName || 'Geral'}
                            </span>
                            {chk.visibility === 'restrito' && (
                              <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-900 bg-amber-50 border border-amber-300 px-1.5 py-0.5 rounded-md">
                                <Lock className="w-2.5 h-2.5 text-amber-700" />
                                <span>Restrito</span>
                              </span>
                            )}
                          </div>
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

                        {isAlreadyInTrack ? (
                          <button
                            type="button"
                            disabled
                            className="px-2.5 py-1 text-[11px] font-bold text-emerald-800 bg-emerald-100/80 border border-emerald-200 rounded-lg flex items-center gap-1 cursor-not-allowed"
                          >
                            <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                            <span>Já na trilha</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleIncludeItem('checklist', chk)}
                            disabled={isSaving}
                            className="px-2.5 py-1 text-[11px] font-bold text-white bg-[#0f3e2e] hover:bg-emerald-900 rounded-lg transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
                          >
                            <Plus className="w-3 h-3" />
                            <span>Incluir na Trilha</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })
              )
            ) : filteredSurveys.length === 0 ? (
              <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-xs">
                Nenhuma pesquisa de satisfação cadastrada no momento.
              </div>
            ) : (
              filteredSurveys.map((survey) => {
                const isAlreadyInTrack = currentTrack.some(
                  (s) => s.type === 'survey' && s.refId === survey.id
                );

                return (
                  <div
                    key={survey.id}
                    draggable={!isAlreadyInTrack}
                    onDragStart={
                      isAlreadyInTrack
                        ? undefined
                        : () =>
                            setDraggedItem({ type: 'survey', id: survey.id, title: survey.title })
                    }
                    className={`p-3 rounded-xl border transition-all flex flex-col justify-between gap-2.5 group ${
                      isAlreadyInTrack
                        ? 'border-emerald-200 bg-emerald-50/30 opacity-85'
                        : 'border-slate-200 bg-white hover:border-emerald-400 hover:shadow-xs cursor-grab active:cursor-grabbing'
                    }`}
                  >
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[10px] font-bold text-purple-900 bg-purple-50 border border-purple-200 px-2 py-0.5 rounded-md uppercase">
                            Pesquisa de Satisfação
                          </span>
                          {survey.visibility === 'restrito' && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-900 bg-amber-50 border border-amber-300 px-1.5 py-0.5 rounded-md">
                              <Lock className="w-2.5 h-2.5 text-amber-700" />
                              <span>Restrito</span>
                            </span>
                          )}
                        </div>
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

                      {isAlreadyInTrack ? (
                        <button
                          type="button"
                          disabled
                          className="px-2.5 py-1 text-[11px] font-bold text-emerald-800 bg-emerald-100/80 border border-emerald-200 rounded-lg flex items-center gap-1 cursor-not-allowed"
                        >
                          <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                          <span>Já na trilha</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => handleIncludeItem('survey', survey)}
                          disabled={isSaving}
                          className="px-2.5 py-1 text-[11px] font-bold text-white bg-[#0f3e2e] hover:bg-emerald-900 rounded-lg transition-colors flex items-center gap-1 cursor-pointer shadow-2xs"
                        >
                          <Plus className="w-3 h-3" />
                          <span>Incluir na Trilha</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

        {/* ========================================================= */}
        {/* PAINEL DA DIREITA: TRILHA INDIVIDUAL DO COLABORADOR */}
        {/* ========================================================= */}
        <div
          onDragOver={!canEditStructure ? undefined : (e) => e.preventDefault()}
          onDrop={!canEditStructure ? undefined : handleDropFromLibrary}
          className={`${
            !canEditStructure ? 'lg:col-span-12 w-full' : 'lg:col-span-7'
          } bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden flex flex-col`}
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

            <div className="flex items-center gap-2 flex-wrap">
              {canEditStructure && (
                <>
                  <button
                    type="button"
                    onClick={handleOpenSaveTemplateModal}
                    className="px-2.5 py-1.5 text-[11px] font-bold text-[#0f3e2e] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                    title="Salvar a sequência atual da trilha como modelo reutilizável"
                  >
                    <BookmarkPlus className="w-3.5 h-3.5" />
                    <span>Salvar como Modelo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsApplyTemplateModalOpen(true)}
                    className="px-2.5 py-1.5 text-[11px] font-bold text-white bg-[#0f3e2e] hover:bg-emerald-900 rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                    title="Aplicar um modelo de trilha salvo"
                  >
                    <Layers className="w-3.5 h-3.5 text-emerald-200" />
                    <span>
                      Aplicar Modelo
                      {trackTemplates.length > 0 ? ` (${trackTemplates.length})` : ''}
                    </span>
                  </button>
                </>
              )}
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
                const linkedItem = isChecklist
                  ? checklists.find((c) => c.id === step.refId)
                  : surveys.find((s) => s.id === step.refId);
                const isRestrictedStep = linkedItem?.visibility === 'restrito';
                const canViewThisStep = canViewRestrictedItem(currentUser, linkedItem?.visibility);

                const isCompleted = step.status === 'concluido';
                const isAvailable = step.status === 'disponivel';
                const hasNumericScore = typeof step.finalScore === 'number';
                const scoreMeta = getScorePerformanceMeta(
                  hasNumericScore ? step.finalScore : undefined
                );

                return (
                  <div
                    key={step.id}
                    draggable={canEditStructure}
                    onDragStart={canEditStructure ? (e) => handleTimelineDragStart(e, index) : undefined}
                    onDragOver={
                      canEditStructure
                        ? (e) => {
                            e.preventDefault();
                            setDragOverStepIndex(index);
                          }
                        : undefined
                    }
                    onDragLeave={canEditStructure ? () => setDragOverStepIndex(null) : undefined}
                    onDrop={canEditStructure ? (e) => handleTimelineDrop(e, index) : undefined}
                    className={`border rounded-2xl p-4 transition-all shadow-xs relative ${
                      dragOverStepIndex === index
                        ? 'border-emerald-600 ring-2 ring-emerald-300'
                        : isCompleted
                        ? hasNumericScore && canViewThisStep
                          ? `${scoreMeta.borderClass} bg-white`
                          : 'border-slate-300 bg-slate-50/40'
                        : isAvailable
                        ? 'border-slate-300 bg-white hover:border-emerald-400'
                        : 'border-slate-200 bg-slate-50/60 opacity-80'
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      {/* Alça de Arraste (apenas Admin) e Número da Etapa */}
                      <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
                        {canEditStructure && (
                          <button
                            type="button"
                            className="text-slate-300 hover:text-slate-600 cursor-grab active:cursor-grabbing p-0.5"
                            title="Arraste para reordenar"
                          >
                            <GripVertical className="w-4 h-4" />
                          </button>
                        )}
                        <span
                          className={`w-7 h-7 rounded-full font-bold text-xs flex items-center justify-center shrink-0 ${
                            isCompleted
                              ? 'bg-slate-700 text-white shadow-2xs'
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

                            {isRestrictedStep && (
                              <span
                                title="Conteúdo restrito ao Guardião Anfitrião / Admin"
                                className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-900 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded-full"
                              >
                                <Lock className="w-2.5 h-2.5 text-amber-700" />
                                <span>Restrito</span>
                              </span>
                            )}

                            {/* Badge do Status Sequencial (neutro para Concluído, separado da nota) */}
                            <span
                              className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                                isCompleted
                                  ? 'bg-slate-100 text-slate-700 border-slate-200'
                                  : isAvailable
                                  ? 'bg-blue-50 text-blue-900 border-blue-200'
                                  : 'bg-slate-100 text-slate-600 border-slate-200'
                              }`}
                            >
                              {isCompleted ? (
                                <>
                                  <CheckCircle2 className="w-3 h-3 text-slate-500" />
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

                          {/* Botões de Ordenação e Exclusão (Apenas ADMIN em modo edição não finalizado) */}
                          {canEditStructure && (
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
                          )}
                        </div>

                        {/* Linha de Responsabilidade / Ação Funcional de Avaliação */}
                        <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                          {/* Quem Preenche: Seletor para ADMIN vs Badge Somente Leitura */}
                          {canEditStructure ? (
                            isChecklist ? (
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
                            )
                          ) : (
                            /* Modo Somente Leitura (Avaliador): Identificação clara de responsabilidade */
                            <div className="flex items-center gap-2">
                              {isChecklist ? (
                                step.filledBy === 'evaluator' ? (
                                  <span className="text-[11px] font-semibold text-emerald-900 bg-emerald-50 px-2.5 py-1 rounded-md border border-emerald-200 inline-flex items-center gap-1.5">
                                    <UserCheck className="w-3.5 h-3.5 text-emerald-700" />
                                    <span>Responsabilidade: Auxiliar / Avaliador</span>
                                  </span>
                                ) : (
                                  <span className="text-[11px] font-semibold text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 inline-flex items-center gap-1.5">
                                    <User className="w-3.5 h-3.5 text-slate-500" />
                                    <span>Responsabilidade: Colaborador (Autoavaliação)</span>
                                  </span>
                                )
                              ) : (
                                <span className="text-[11px] font-semibold text-purple-800 bg-purple-50 px-2.5 py-1 rounded-md border border-purple-200 inline-flex items-center gap-1.5">
                                  <User className="w-3.5 h-3.5 text-purple-600" />
                                  <span>Pesquisa de Satisfação (Aluno)</span>
                                </span>
                              )}
                            </div>
                          )}

                          {/* AÇÃO DO AVALIADOR: Botão "Avaliar Checklist" ou Status de Conclusão */}
                          {!canViewThisStep ? (
                            <span className="text-[11px] font-semibold text-amber-900 bg-amber-50 px-2.5 py-1 rounded-md border border-amber-200 inline-flex items-center gap-1.5">
                              <Lock className="w-3 h-3 text-amber-700" />
                              <span>Conteúdo restrito (Guardião Anfitrião / Admin)</span>
                            </span>
                          ) : isReadOnly && isChecklist && step.filledBy === 'evaluator' ? (
                            isCompleted ? (
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-[11px] font-bold text-slate-700 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 inline-flex items-center gap-1">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-slate-500" />
                                  <span>Concluído</span>
                                </span>
                                {hasNumericScore && (
                                  <span
                                    className={`text-[11px] font-bold font-mono px-2.5 py-1 rounded-md border ${scoreMeta.badgeClass}`}
                                    title={scoreMeta.label}
                                  >
                                    {step.finalScore!.toFixed(1)}/10 · {scoreMeta.label}
                                  </span>
                                )}
                                {onStartEvaluation && !isFinalized && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                       const asgId = ensureCollaboratorChecklistAssignment(
                                        collaborator.id,
                                        step.refId,
                                        step.collaboratorChecklistId || undefined
                                      );
                                      onStartEvaluation(asgId, collaborator.id);
                                    }}
                                    className="text-[11px] font-bold text-emerald-700 hover:text-emerald-900 underline cursor-pointer"
                                  >
                                    Reavaliar
                                  </button>
                                )}
                              </div>
                            ) : isAvailable && !isFinalized ? (
                              <button
                                type="button"
                                onClick={() => {
                                  const asgId = ensureCollaboratorChecklistAssignment(
                                    collaborator.id,
                                    step.refId,
                                    step.collaboratorChecklistId || undefined
                                  );
                                  if (onStartEvaluation) {
                                    onStartEvaluation(asgId, collaborator.id);
                                  }
                                }}
                                className="px-3.5 py-1.5 bg-[#064E3B] hover:bg-emerald-900 text-white rounded-lg font-bold text-xs flex items-center gap-1.5 shadow-sm transition-all cursor-pointer"
                              >
                                <ClipboardCheck className="w-3.5 h-3.5 text-emerald-300" />
                                <span>Avaliar Checklist</span>
                              </button>
                            ) : (
                              <span className="text-[11px] font-medium text-slate-400 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200 inline-flex items-center gap-1">
                                <Lock className="w-3 h-3 text-slate-400" />
                                <span>
                                  {isFinalized
                                    ? 'Trilha finalizada'
                                    : 'Bloqueado (Conclua a etapa anterior)'}
                                </span>
                              </span>
                            )
                          ) : (
                            /* Se Concluído (modo Admin ou Colaborador): Exibe Nota com Semáforo e Data */
                            isCompleted && (
                              <div className="text-[11px] font-semibold flex items-center gap-2 flex-wrap">
                                {hasNumericScore && (
                                  <span
                                    className={`font-mono font-bold px-2.5 py-0.5 rounded-md border ${scoreMeta.badgeClass}`}
                                    title={scoreMeta.label}
                                  >
                                    Nota: {step.finalScore!.toFixed(1)}/10 · {scoreMeta.label}
                                  </span>
                                )}
                                {step.completedAt && (
                                  <span className="text-slate-400 font-normal">
                                    {new Date(step.completedAt).toLocaleDateString('pt-BR')}
                                  </span>
                                )}
                              </div>
                            )
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

      {/* ========================================================= */}
      {/* MODAL: SALVAR TRILHA ATUAL COMO MODELO REUTILIZÁVEL */}
      {/* ========================================================= */}
      {isSaveTemplateModalOpen && (
        <div
          className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setIsSaveTemplateModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 bg-[#0f3e2e] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <BookmarkPlus className="w-5 h-5 text-emerald-200" />
                <div>
                  <h3 className="text-sm font-bold text-white">Salvar como Modelo de Trilha</h3>
                  <p className="text-[11px] text-emerald-200">
                    Reutilize esta sequência de {currentTrack.length} etapa(s) em outros colaboradores
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsSaveTemplateModalOpen(false)}
                className="text-emerald-200 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmSaveTemplate} className="p-5 space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Nome do Modelo *
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={templateNameInput}
                  onChange={(e) => setTemplateNameInput(e.target.value)}
                  placeholder="Ex: Onboarding Padrão - Laboratório"
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Célula de Referência
                </label>
                <select
                  value={templateCellInput}
                  onChange={(e) => setTemplateCellInput(e.target.value)}
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-900"
                >
                  <option value="Geral">Geral (Todas as Células)</option>
                  {CLEAN_CELL_NAMES.map((cellName) => (
                    <option key={cellName} value={cellName}>
                      {cellName}
                    </option>
                  ))}
                </select>
              </div>

              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-1.5 max-h-40 overflow-y-auto">
                <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                  Etapas incluídas no modelo ({currentTrack.length}):
                </span>
                {currentTrack.map((s, idx) => (
                  <div
                    key={s.id}
                    className="flex items-center justify-between gap-2 text-[11px] text-slate-700"
                  >
                    <span className="truncate font-medium">
                      {idx + 1}. {s.title}
                    </span>
                    <span className="text-[10px] text-slate-500 shrink-0">
                      {s.type === 'survey'
                        ? 'Pesquisa'
                        : s.filledBy === 'collaborator'
                        ? 'Colaborador'
                        : 'Avaliador'}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsSaveTemplateModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingTemplate}
                  className="px-5 py-2 font-bold text-white bg-[#0f3e2e] hover:bg-emerald-900 rounded-xl transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isSavingTemplate ? 'Salvando...' : 'Salvar Modelo'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL: APLICAR MODELO DE TRILHA SALVO */}
      {/* ========================================================= */}
      {isApplyTemplateModalOpen && (
        <div
          className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setIsApplyTemplateModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[85vh] border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 bg-[#0f3e2e] text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <Layers className="w-5 h-5 text-emerald-200" />
                <div>
                  <h3 className="text-sm font-bold text-white">Aplicar Modelo de Trilha</h3>
                  <p className="text-[11px] text-emerald-200">
                    Etapas já existentes na trilha de {collaborator.fullName} serão ignoradas automaticamente
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsApplyTemplateModalOpen(false)}
                className="text-emerald-200 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-3 flex-1">
              {trackTemplates.length === 0 ? (
                <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center space-y-2 bg-slate-50/50">
                  <Layers className="w-10 h-10 text-slate-300 mx-auto" />
                  <h4 className="text-sm font-bold text-slate-800">
                    Nenhum modelo de trilha salvo ainda
                  </h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Monte uma sequência na Linha do Tempo e clique em{' '}
                    <strong>Salvar como Modelo</strong> para reutilizá-la em novos colaboradores.
                  </p>
                </div>
              ) : (
                trackTemplates.map((tpl) => {
                  const newCount = tpl.steps.filter(
                    (tplStep) =>
                      !currentTrack.some(
                        (s) => s.type === tplStep.type && s.refId === tplStep.refId
                      )
                  ).length;

                  return (
                    <div
                      key={tpl.id}
                      className="border border-slate-200 hover:border-emerald-400 rounded-xl p-4 bg-white transition-all space-y-3"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-bold text-slate-900 truncate">
                              {tpl.name}
                            </h4>
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200">
                              <Building2 className="w-3 h-3 text-slate-500" />
                              <span>{tpl.cell}</span>
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-900 border border-emerald-200">
                              {tpl.steps.length} etapa(s)
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-500">
                            Criado em {new Date(tpl.createdAt).toLocaleDateString('pt-BR')}
                            {newCount < tpl.steps.length &&
                              ` · ${tpl.steps.length - newCount} etapa(s) já na trilha`}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleApplyTemplate(tpl)}
                            disabled={isApplyingTemplate || newCount === 0}
                            className="px-3 py-1.5 text-xs font-bold text-white bg-[#0f3e2e] hover:bg-emerald-900 rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs"
                          >
                            {newCount === 0 ? 'Já Aplicado' : `Aplicar (+${newCount})`}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteTemplate(tpl)}
                            className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                            title="Excluir modelo"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>

                      {/* Prévia compacta das etapas */}
                      <div className="flex flex-wrap gap-1.5 pt-2 border-t border-slate-100">
                        {tpl.steps.map((step, sIdx) => {
                          const item =
                            step.type === 'checklist'
                              ? checklists.find((c) => c.id === step.refId)
                              : surveys.find((s) => s.id === step.refId);
                          const alreadyAdded = currentTrack.some(
                            (s) => s.type === step.type && s.refId === step.refId
                          );
                          return (
                            <span
                              key={`${tpl.id}-${sIdx}`}
                              className={`text-[10px] px-2 py-0.5 rounded-md border truncate max-w-[230px] ${
                                alreadyAdded
                                  ? 'bg-emerald-50/60 text-emerald-800 border-emerald-200 line-through opacity-75'
                                  : 'bg-slate-50 text-slate-700 border-slate-200'
                              }`}
                              title={item?.title || 'Atividade removida'}
                            >
                              {sIdx + 1}. {item?.title || 'Atividade removida'}
                            </span>
                          );
                        })}
                      </div>
                    </div>
                  );
                })
              )}
            </div>

            <div className="px-5 py-3 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setIsApplyTemplateModalOpen(false)}
                className="px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
