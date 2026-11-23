import React, { useMemo, useState } from 'react';
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
  Layers,
  Building2,
  AlertTriangle,
  Download,
  Calendar,
  Eye,
  Globe,
  MessageSquareText,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { usePortalStore } from '../../../context/PortalStoreContext';
import { useToast } from '../../../context/ToastContext';
import {
  canViewRestrictedItem,
  ChecklistCell,
  Collaborator,
  CollaboratorTrackStep,
  TrackTemplate,
  getCellName,
  getScorePerformanceMeta,
  isGeneralCell,
  normalizeChecklistCell,
  normalizeStageName,
  normalizeTemplateStageName,
} from '../../../types/portal';
import {
  buildStageDossierData,
  groupTrackStepsByStage,
} from '../../../lib/dossierBuilders';
import { downloadStageDossierPdf } from '../../../lib/downloadHelpers';
import { groupTemplateStepsByStage } from './TrackTemplatesView';

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
    collaboratorChecklists,
    exercises,
    characters,
    surveys,
    surveyResponses,
    users,
    trackTemplates,
    currentUser,
    hasPermission,
    updateCollaboratorTrack,
    addSingleStepToCollaborator,
    removeStepFromCollaboratorTrack,
    ensureCollaboratorChecklistAssignment,
    applyTrackTemplateToCollaborator,
  } = usePortalStore();
  const { showToast } = useToast();

  const canManageTracks = hasPermission('can_manage_collaborators');
  const isReadOnly = readOnly !== undefined ? readOnly : !canManageTracks;
  const isFinalized = Boolean(collaborator.isTrackFinalized);
  const canEditStructure = !isReadOnly && !isFinalized;

  const pdfGeneratedBy = currentUser
    ? { fullName: currentUser.fullName, username: currentUser.username }
    : undefined;

  const [draggedStepIndex, setDraggedStepIndex] = useState<number | null>(null);
  const [dragOverStepIndex, setDragOverStepIndex] = useState<number | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Modal 1: + Aplicar Modelo
  const [isApplyTemplateModalOpen, setIsApplyTemplateModalOpen] = useState(false);
  const [isApplyingTemplate, setIsApplyingTemplate] = useState(false);
  const [templateSearch, setTemplateSearch] = useState('');
  const [allowTemplateRecycling, setAllowTemplateRecycling] = useState(false);

  // Modal 2: + Novo Bloco Avulso / + Adicionar Atividade
  const [isAddSingleStepModalOpen, setIsAddSingleStepModalOpen] = useState(false);
  const [singleStageMode, setSingleStageMode] = useState<'new' | 'existing'>('new');
  const [singleNewStageName, setSingleNewStageName] = useState('Etapa 1');
  const [singleExistingStageName, setSingleExistingStageName] = useState('');
  const [singleStepType, setSingleStepType] = useState<'checklist' | 'survey'>('checklist');
  const [singleStepCellFilter, setSingleStepCellFilter] = useState<'all' | ChecklistCell>('all');
  const [singleStepSearch, setSingleStepSearch] = useState('');
  const [singleStepRefId, setSingleStepRefId] = useState('');
  const [singleStepFilledBy, setSingleStepFilledBy] = useState<'collaborator' | 'evaluator'>(
    'evaluator'
  );
  const [isAddingSingleStep, setIsAddingSingleStep] = useState(false);
  const [expandedNotesStepIds, setExpandedNotesStepIds] = useState<Record<string, boolean>>({});

  const currentTrack: CollaboratorTrackStep[] = useMemo(() => {
    return collaborator.track || [];
  }, [collaborator.track]);

  const stageGroups = useMemo(() => {
    return groupTrackStepsByStage(currentTrack);
  }, [currentTrack]);

  const existingStageNames = useMemo(() => {
    return stageGroups.map((g) => g.stageName);
  }, [stageGroups]);

  const suggestedNextStageName = useMemo(() => {
    const existingLower = new Set(existingStageNames.map((n) => n.toLowerCase()));
    let blockNumber = Math.max(1, existingStageNames.length + 1);
    while (existingLower.has(`etapa ${blockNumber}`)) {
      blockNumber++;
    }
    return existingStageNames.length === 0 ? 'Etapa 1' : `Etapa ${blockNumber}`;
  }, [existingStageNames]);

  const totalSteps = currentTrack.length;
  const completedSteps = currentTrack.filter((s) => s.status === 'concluido').length;
  const progressPct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  const existingStepKeysByStage = useMemo(() => {
    const map = new Map<string, Set<string>>();
    currentTrack.forEach((s) => {
      const stageKey = normalizeStageName(s.stageName).toLowerCase();
      if (!map.has(stageKey)) {
        map.set(stageKey, new Set());
      }
      map.get(stageKey)!.add(`${s.type}:${s.refId}`);
    });
    return map;
  }, [currentTrack]);

  const resolvedSingleStageName = useMemo(() => {
    if (singleStageMode === 'existing' && singleExistingStageName.trim()) {
      return normalizeStageName(singleExistingStageName);
    }
    return normalizeStageName(singleNewStageName);
  }, [singleStageMode, singleExistingStageName, singleNewStageName]);

  const filteredTemplatesForModal = useMemo(() => {
    const q = templateSearch.trim().toLowerCase();
    const collabCell = getCellName(collaborator.cellTeam);
    return [...trackTemplates]
      .filter((tpl) => {
        if (!q) return true;
        return (
          tpl.name.toLowerCase().includes(q) ||
          tpl.cell.toLowerCase().includes(q) ||
          (tpl.description && tpl.description.toLowerCase().includes(q))
        );
      })
      .sort((a, b) => {
        const aMatchesCell = getCellName(a.cell) === collabCell ? 0 : a.cell === 'Geral' ? 1 : 2;
        const bMatchesCell = getCellName(b.cell) === collabCell ? 0 : b.cell === 'Geral' ? 1 : 2;
        return aMatchesCell - bMatchesCell;
      });
  }, [trackTemplates, templateSearch, collaborator.cellTeam]);

  const filteredSingleStepOptions = useMemo(() => {
    const q = singleStepSearch.trim().toLowerCase();
    if (singleStepType === 'checklist') {
      return checklists
        .filter((c) => {
          const chkCell = normalizeChecklistCell(c.cell);
          if (singleStepCellFilter === 'GERAL') {
            if (!isGeneralCell(chkCell)) return false;
          } else if (singleStepCellFilter !== 'all') {
            // Sempre inclui checklists da célula selecionada + checklists marcados como Geral
            if (chkCell !== singleStepCellFilter && !isGeneralCell(chkCell)) return false;
          }
          if (!q) return true;
          return (
            c.title.toLowerCase().includes(q) ||
            (c.categoryName && c.categoryName.toLowerCase().includes(q)) ||
            getCellName(chkCell).toLowerCase().includes(q)
          );
        })
        .sort((a, b) => {
          if (singleStepCellFilter !== 'all' && singleStepCellFilter !== 'GERAL') {
            const aExact = normalizeChecklistCell(a.cell) === singleStepCellFilter ? 0 : 1;
            const bExact = normalizeChecklistCell(b.cell) === singleStepCellFilter ? 0 : 1;
            if (aExact !== bExact) return aExact - bExact;
          }
          return a.title.localeCompare(b.title, 'pt-BR');
        });
    }
    return surveys.filter((s) => {
      if (!q) return true;
      return (
        s.title.toLowerCase().includes(q) ||
        (s.targetCell && s.targetCell.toLowerCase().includes(q))
      );
    });
  }, [singleStepType, singleStepCellFilter, singleStepSearch, checklists, surveys]);

  const selectedSingleAlreadyInSameStage = useMemo(() => {
    if (!singleStepRefId) return false;
    return currentTrack.some(
      (s) =>
        s.type === singleStepType &&
        s.refId === singleStepRefId &&
        normalizeStageName(s.stageName).toLowerCase() === resolvedSingleStageName.toLowerCase()
    );
  }, [currentTrack, singleStepType, singleStepRefId, resolvedSingleStageName]);

  const selectedSingleInOtherStage = useMemo(() => {
    if (!singleStepRefId || selectedSingleAlreadyInSameStage) return false;
    return currentTrack.some(
      (s) =>
        s.type === singleStepType &&
        s.refId === singleStepRefId &&
        normalizeStageName(s.stageName).toLowerCase() !== resolvedSingleStageName.toLowerCase()
    );
  }, [currentTrack, singleStepType, singleStepRefId, resolvedSingleStageName, selectedSingleAlreadyInSameStage]);

  const handleRemoveStep = async (stepId: string) => {
    setIsSaving(true);
    const res = await removeStepFromCollaboratorTrack(collaborator.id, stepId);
    setIsSaving(false);
    if (res.success) {
      showToast('Atividade removida da trilha.', 'success');
    } else {
      showToast(res.message, 'error');
    }
  };

  const handleChangeFilledBy = async (
    stepId: string,
    filledBy: 'collaborator' | 'evaluator'
  ) => {
    const updated = currentTrack.map((step) =>
      step.id === stepId ? { ...step, filledBy } : step
    );
    await updateCollaboratorTrack(collaborator.id, updated);
  };

  const handleMoveStepUp = async (index: number) => {
    if (index === 0) return;
    const updated = [...currentTrack];
    const [moved] = updated.splice(index, 1);
    updated.splice(index - 1, 0, moved);
    await updateCollaboratorTrack(collaborator.id, updated);
  };

  const handleMoveStepDown = async (index: number) => {
    if (index === currentTrack.length - 1) return;
    const updated = [...currentTrack];
    const [moved] = updated.splice(index, 1);
    updated.splice(index + 1, 0, moved);
    await updateCollaboratorTrack(collaborator.id, updated);
  };

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

  const handleOpenApplyTemplateModal = () => {
    setTemplateSearch('');
    setAllowTemplateRecycling(false);
    setIsApplyTemplateModalOpen(true);
  };

  const handleApplyTemplate = async (template: TrackTemplate) => {
    if (isReadOnly || isApplyingTemplate) return;

    setIsApplyingTemplate(true);
    const res = await applyTrackTemplateToCollaborator(collaborator.id, template.id, {
      allowDuplicates: allowTemplateRecycling,
    });
    setIsApplyingTemplate(false);

    if (res.success) {
      showToast(res.message, 'success');
      setIsApplyTemplateModalOpen(false);
    } else {
      showToast(res.message, 'info');
    }
  };

  const handleOpenAddSingleStepModal = (targetStageName?: string) => {
    const defaultCellFilter = normalizeChecklistCell(collaborator.cellTeam);
    const matchingChecklists = checklists.filter((c) => {
      const chkCell = normalizeChecklistCell(c.cell);
      return chkCell === defaultCellFilter || isGeneralCell(chkCell);
    });
    const effectiveCellFilter: 'all' | ChecklistCell =
      matchingChecklists.length > 0 ? defaultCellFilter : 'all';

    setSingleStepType('checklist');
    setSingleStepCellFilter(effectiveCellFilter);
    setSingleStepSearch('');
    setSingleStepRefId(matchingChecklists[0]?.id || checklists[0]?.id || '');
    setSingleStepFilledBy('evaluator');
    if (targetStageName) {
      setSingleStageMode('existing');
      setSingleExistingStageName(targetStageName);
      setSingleNewStageName(suggestedNextStageName);
    } else {
      setSingleStageMode('new');
      setSingleNewStageName(suggestedNextStageName);
      setSingleExistingStageName(existingStageNames[existingStageNames.length - 1] || '');
    }
    setIsAddSingleStepModalOpen(true);
  };

  const handleConfirmAddSingleStep = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!singleStepRefId) {
      showToast('Selecione uma atividade para anexar à trilha.', 'error');
      return;
    }

    if (singleStageMode === 'new' && !singleNewStageName.trim()) {
      showToast('Informe o nome da nova Etapa / Semana.', 'error');
      return;
    }

    if (singleStageMode === 'existing' && !singleExistingStageName.trim()) {
      showToast('Selecione uma Etapa / Semana existente.', 'error');
      return;
    }

    const linkedItem =
      singleStepType === 'checklist'
        ? checklists.find((c) => c.id === singleStepRefId)
        : surveys.find((s) => s.id === singleStepRefId);

    if (!linkedItem) {
      showToast('Atividade selecionada não encontrada.', 'error');
      return;
    }

    setIsAddingSingleStep(true);
    const res = await addSingleStepToCollaborator(
      collaborator.id,
      {
        type: singleStepType,
        title: linkedItem.title,
        refId: linkedItem.id,
        filledBy: singleStepType === 'survey' ? 'collaborator' : singleStepFilledBy,
      },
      resolvedSingleStageName
    );
    setIsAddingSingleStep(false);

    if (res.success) {
      const msg = res.reopened
        ? `"${linkedItem.title}" adicionado em "${resolvedSingleStageName}" e trilha reaberta!`
        : selectedSingleInOtherStage
        ? `"${linkedItem.title}" adicionado em "${resolvedSingleStageName}" para novo ciclo!`
        : `"${linkedItem.title}" adicionado em "${resolvedSingleStageName}"!`;
      showToast(msg, 'success');
      setIsAddSingleStepModalOpen(false);
    } else {
      showToast(res.message, 'error');
    }
  };

  const handleExportStageDossier = (stageName: string) => {
    const data = buildStageDossierData(
      {
        collaborator,
        currentUser,
        checklists,
        collaboratorChecklists,
        exercises,
        characters,
        surveys,
        surveyResponses,
        users,
        generatedBy: pdfGeneratedBy,
      },
      stageName
    );
    if (!data) {
      showToast('Não há atividades visíveis nesta etapa para gerar o dossiê.', 'info');
      return;
    }
    downloadStageDossierPdf(data);
    showToast(`Dossiê da etapa "${stageName}" gerado em PDF!`, 'success');
  };

  return (
    <div className="space-y-4 w-full">
      {/* Header Resumo da Trilha */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#0f3e2e] text-white flex items-center justify-center font-bold shadow-xs shrink-0">
            <GraduationCap className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="text-base font-bold text-slate-900 font-display">
                Trilha de Aprendizagem por Etapas / Semanas
              </h2>
              <span className="text-[10px] font-bold text-emerald-900 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                {stageGroups.length} Etapa(s)
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Acompanhe a evolução sequencial de{' '}
              <strong className="text-slate-800">{collaborator.fullName}</strong> organizada por fases semanais ou reciclagens.
            </p>
          </div>
        </div>

        {/* Métricas Compactas */}
        <div className="flex items-center gap-4 bg-slate-50 border border-slate-200 px-4 py-2.5 rounded-xl shrink-0">
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Total de Atividades
            </div>
            <div className="text-base font-bold text-slate-900 font-mono">
              {totalSteps} atividade(s)
            </div>
          </div>
          <div className="w-px h-8 bg-slate-200" />
          <div>
            <div className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
              Evolução Geral
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

      {/* Banner de Trilha Finalizada */}
      {isFinalized && (
        <div className="bg-amber-50 border border-amber-300 rounded-2xl p-4 flex items-center gap-3 text-xs text-amber-950 shadow-xs">
          <div className="w-8 h-8 rounded-xl bg-amber-200/80 text-amber-900 flex items-center justify-center shrink-0">
            <Shield className="w-4 h-4" />
          </div>
          <div>
            <div className="font-bold">
              Trilha Finalizada — Histórico Protegido
            </div>
            <p className="text-[11px] text-amber-900/90 mt-0.5">
              Esta jornada recebeu parecer oficial do Guardião Anfitrião
              {collaborator.guardianFinalizedBy ? ` (${collaborator.guardianFinalizedBy})` : ''}.
              {!isReadOnly
                ? ' Edições em etapas antigas estão travadas, mas você pode adicionar novas Etapas/Semanas (a trilha será reaberta automaticamente).'
                : ' Alterações estão bloqueadas.'}
            </p>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* LINHA DO TEMPO AGRUPADA POR ETAPAS / SEMANAS (W-FULL) */}
      {/* ========================================================= */}
      <div className="w-full bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden flex flex-col">
        {/* Header da Linha do Tempo */}
        <div className="p-4 bg-slate-50/80 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2 flex-wrap">
              <span>Linha do Tempo: {collaborator.fullName}</span>
              <span className="text-[11px] font-mono font-medium text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                @{collaborator.username || 'colaborador'}
              </span>
              <span className="text-[11px] font-bold text-slate-600 bg-white px-2.5 py-0.5 rounded-lg border border-slate-200">
                {stageGroups.length} etapa(s) · {currentTrack.length} atividade(s)
              </span>
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {canEditStructure
                ? 'As atividades seguem ordem sequencial rigorosa e podem ser repetidas em diferentes Etapas/Semanas.'
                : 'Fluxo sequencial das atividades atribuídas por etapa/semana.'}
            </p>
          </div>

          {!isReadOnly && (
            <div className="flex items-center gap-2 flex-wrap shrink-0">
              <button
                type="button"
                onClick={handleOpenApplyTemplateModal}
                className="px-3 py-1.5 text-xs font-bold text-white bg-[#0f3e2e] hover:bg-emerald-900 rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
              >
                <Layers className="w-3.5 h-3.5 text-emerald-200" />
                <span>+ Aplicar Modelo</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenAddSingleStepModal()}
                className="px-3 py-1.5 text-xs font-bold text-[#0f3e2e] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>+ Novo Bloco Avulso</span>
              </button>
            </div>
          )}
        </div>

        {/* Lista Agrupada por Etapas / Semanas */}
        <div className="p-4 sm:p-5 space-y-5 min-h-[320px]">
          {currentTrack.length === 0 ? (
            <div className="border-2 border-dashed border-slate-200 rounded-2xl p-12 text-center space-y-3 bg-slate-50/50">
              <div className="w-12 h-12 rounded-full bg-emerald-50 text-[#0f3e2e] flex items-center justify-center mx-auto">
                <GraduationCap className="w-6 h-6" />
              </div>
              <h4 className="font-bold text-sm text-slate-800">
                Nenhuma atividade inserida na trilha ainda
              </h4>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                {!isReadOnly
                  ? 'Clique em + Aplicar Modelo para herdar os blocos de um modelo salvo ou em + Novo Bloco Avulso para inserir um checklist ou pesquisa.'
                  : 'Aguardando a atribuição de etapas pela gestão.'}
              </p>
              {!isReadOnly && (
                <div className="flex items-center justify-center gap-2 pt-1 flex-wrap">
                  <button
                    type="button"
                    onClick={handleOpenApplyTemplateModal}
                    className="px-3.5 py-2 text-xs font-bold text-white bg-[#0f3e2e] hover:bg-emerald-900 rounded-xl transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Layers className="w-3.5 h-3.5 text-emerald-200" />
                    <span>+ Aplicar Modelo</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleOpenAddSingleStepModal()}
                    className="px-3.5 py-2 text-xs font-bold text-[#0f3e2e] bg-white hover:bg-emerald-50 border border-emerald-300 rounded-xl transition-colors inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>+ Novo Bloco Avulso</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            stageGroups.map((stageGroup, groupIdx) => {
              const stageCompletedCount = stageGroup.entries.filter(
                (e) => e.step.status === 'concluido'
              ).length;
              const stageTotalCount = stageGroup.entries.length;
              const stageProgressPct =
                stageTotalCount > 0
                  ? Math.round((stageCompletedCount / stageTotalCount) * 100)
                  : 0;

              // Média parcial da etapa (somente avaliações visíveis com nota)
              const visibleStageScores = stageGroup.entries
                .filter(({ step }) => {
                  if (step.type !== 'checklist' || step.status !== 'concluido') return false;
                  const chk = checklists.find((c) => c.id === step.refId);
                  if (!canViewRestrictedItem(currentUser, chk?.visibility)) return false;
                  return typeof step.finalScore === 'number';
                })
                .map(({ step }) => step.finalScore as number);

              const stageAverage =
                visibleStageScores.length > 0
                  ? visibleStageScores.reduce((acc, s) => acc + s, 0) /
                    visibleStageScores.length
                  : null;
              const stageAvgMeta = getScorePerformanceMeta(stageAverage);

              return (
                <section
                  key={`${stageGroup.stageName}-${groupIdx}`}
                  className="border border-slate-200 rounded-2xl bg-slate-50/50 overflow-hidden shadow-xs"
                >
                  {/* Cabeçalho do Bloco da Etapa / Semana */}
                  <div className="px-4 py-3.5 bg-white border-b border-slate-200 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <div className="w-8 h-8 rounded-xl bg-emerald-50 border border-emerald-200 text-[#0f3e2e] flex items-center justify-center shrink-0">
                        <Calendar className="w-4 h-4" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-sm font-bold text-slate-900 font-display">
                            {stageGroup.stageName}
                          </h4>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                            {stageCompletedCount}/{stageTotalCount} concluída(s) · {stageProgressPct}%
                          </span>
                          {stageAverage !== null ? (
                            <span
                              className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded-full border ${stageAvgMeta.badgeClass}`}
                            >
                              Média da Etapa: {stageAverage.toFixed(1)}/10
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-slate-50 text-slate-500 border border-slate-200">
                              Média Parcial: Pendente
                            </span>
                          )}
                        </div>
                        <div className="w-44 bg-slate-200 h-1.5 rounded-full overflow-hidden mt-1.5">
                          <div
                            className="bg-[#0f3e2e] h-full rounded-full transition-all duration-500"
                            style={{ width: `${stageProgressPct}%` }}
                          />
                        </div>
                      </div>
                    </div>

                    {/* Ações da Etapa: + Adicionar Atividade & Dossiê desta Etapa */}
                    <div className="flex items-center gap-2 flex-wrap shrink-0">
                      {!isReadOnly && (
                        <button
                          type="button"
                          onClick={() => handleOpenAddSingleStepModal(stageGroup.stageName)}
                          className="px-2.5 py-1.5 text-[11px] font-bold text-[#0f3e2e] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>+ Adicionar Atividade</span>
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() => handleExportStageDossier(stageGroup.stageName)}
                        className="px-2.5 py-1.5 text-[11px] font-bold text-white bg-[#0f3e2e] hover:bg-emerald-900 rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer shadow-2xs"
                        title={`Gerar Dossiê em PDF apenas da etapa ${stageGroup.stageName}`}
                      >
                        <Download className="w-3.5 h-3.5 text-emerald-200" />
                        <span>Dossiê desta Etapa</span>
                      </button>
                    </div>
                  </div>

                  {/* Lista de Atividades desta Etapa */}
                  <div className="p-3.5 space-y-2.5">
                    {stageGroup.entries.map(({ step, globalIndex }) => {
                      const isChecklist = step.type === 'checklist';
                      const linkedItem = isChecklist
                        ? checklists.find((c) => c.id === step.refId)
                        : surveys.find((s) => s.id === step.refId);
                      const isRestrictedStep = linkedItem?.visibility === 'restrito';
                      const canViewThisStep = canViewRestrictedItem(
                        currentUser,
                        linkedItem?.visibility
                      );

                      const isCompleted = step.status === 'concluido';
                      const isAvailable = step.status === 'disponivel';
                      const linkedAssignment = isChecklist
                        ? (step.collaboratorChecklistId
                            ? collaboratorChecklists.find((a) => a.id === step.collaboratorChecklistId)
                            : undefined) ||
                          collaboratorChecklists.find(
                            (a) => a.collaboratorId === collaborator.id && a.checklistId === step.refId
                          )
                        : undefined;
                      const frozenSnapshot =
                        isCompleted && linkedAssignment?.status === 'concluido'
                          ? linkedAssignment.frozenSnapshot
                          : undefined;
                      const displayStepTitle = isCompleted
                        ? frozenSnapshot?.checklistTitle || step.title
                        : linkedItem?.title || step.title;
                      const hasNumericScore = typeof step.finalScore === 'number';
                      const scoreMeta = getScorePerformanceMeta(
                        hasNumericScore ? step.finalScore : undefined
                      );
                      const completedCriteriaSource =
                        frozenSnapshot?.criteriaAnswers && frozenSnapshot.criteriaAnswers.length > 0
                          ? frozenSnapshot.criteriaAnswers
                          : linkedAssignment?.criteriaAnswers || [];
                      const criteriaWithEvaluatorNotes = isCompleted
                        ? completedCriteriaSource.filter((c) => Boolean(c.notes?.trim()))
                        : [];
                      const generalObsPreview = isCompleted
                        ? linkedAssignment?.generalObservations?.trim() || ''
                        : '';
                      const hasEvaluatorNotesPreview =
                        isChecklist &&
                        isCompleted &&
                        canViewThisStep &&
                        (criteriaWithEvaluatorNotes.length > 0 || Boolean(generalObsPreview));
                      const isNotesExpanded = Boolean(expandedNotesStepIds[step.id]);
                      const isGeneralChecklistStep =
                        isChecklist &&
                        linkedItem &&
                        'cell' in linkedItem &&
                        isGeneralCell(linkedItem.cell);

                      return (
                        <div
                          key={step.id}
                          draggable={canEditStructure}
                          onDragStart={
                            canEditStructure
                              ? (e) => handleTimelineDragStart(e, globalIndex)
                              : undefined
                          }
                          onDragOver={
                            canEditStructure
                              ? (e) => {
                                  e.preventDefault();
                                  setDragOverStepIndex(globalIndex);
                                }
                              : undefined
                          }
                          onDragLeave={
                            canEditStructure ? () => setDragOverStepIndex(null) : undefined
                          }
                          onDrop={
                            canEditStructure
                              ? (e) => handleTimelineDrop(e, globalIndex)
                              : undefined
                          }
                          className={`border rounded-xl p-3.5 transition-all shadow-2xs relative ${
                            dragOverStepIndex === globalIndex
                              ? 'border-emerald-600 ring-2 ring-emerald-300 bg-white'
                              : isCompleted
                              ? hasNumericScore && canViewThisStep
                                ? `${scoreMeta.borderClass} bg-white`
                                : 'border-slate-300 bg-white/80'
                              : isAvailable
                              ? 'border-emerald-300 bg-white hover:border-emerald-500'
                              : 'border-slate-200 bg-white/60 opacity-85'
                          }`}
                        >
                          <div className="flex items-start gap-3">
                            {/* Alça de Arraste e Número Sequencial Global */}
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
                                {globalIndex + 1}
                              </span>
                            </div>

                            {/* Informações da Atividade */}
                            <div className="flex-1 space-y-2 min-w-0">
                              <div className="flex items-center gap-2 flex-wrap justify-between">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <h5 className="font-bold text-sm text-slate-900 leading-snug">
                                    {displayStepTitle}
                                  </h5>

                                  <span
                                    className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                                      isChecklist
                                        ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                                        : 'bg-purple-50 text-purple-900 border-purple-200'
                                    }`}
                                  >
                                    {isChecklist ? 'Checklist' : 'Pesquisa de Satisfação'}
                                  </span>

                                  {isGeneralChecklistStep && (
                                    <span
                                      title="Checklist Geral aplicável a todas as células"
                                      className="inline-flex items-center gap-1 text-[10px] font-bold text-teal-800 bg-teal-50 border border-teal-200 px-2 py-0.5 rounded-full"
                                    >
                                      <Globe className="w-2.5 h-2.5 text-teal-600" />
                                      <span>Geral</span>
                                    </span>
                                  )}

                                  {isRestrictedStep && (
                                    <span
                                      title="Conteúdo restrito ao Guardião Anfitrião / Admin"
                                      className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-900 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded-full"
                                    >
                                      <Lock className="w-2.5 h-2.5 text-amber-700" />
                                      <span>Restrito</span>
                                    </span>
                                  )}

                                  {frozenSnapshot && (
                                    <span
                                      title={`Snapshot histórico congelado em ${new Date(
                                        frozenSnapshot.frozenAt
                                      ).toLocaleString('pt-BR', {
                                        dateStyle: 'short',
                                        timeStyle: 'short',
                                      })} (${frozenSnapshot.exercises.length} exercício(s))`}
                                      className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-900 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full"
                                    >
                                      <Lock className="w-2.5 h-2.5 text-emerald-700" />
                                      <span>Histórico Congelado</span>
                                    </span>
                                  )}

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

                                {canEditStructure && (
                                  <div className="flex items-center gap-1 shrink-0">
                                    <button
                                      type="button"
                                      onClick={() => handleMoveStepUp(globalIndex)}
                                      disabled={globalIndex === 0 || isSaving}
                                      className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg disabled:opacity-30 cursor-pointer"
                                      title="Mover para cima"
                                    >
                                      <ArrowUp className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleMoveStepDown(globalIndex)}
                                      disabled={
                                        globalIndex === currentTrack.length - 1 || isSaving
                                      }
                                      className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded-lg disabled:opacity-30 cursor-pointer"
                                      title="Mover para baixo"
                                    >
                                      <ArrowDown className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleRemoveStep(step.id)}
                                      disabled={isSaving}
                                      className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer ml-1"
                                      title="Remover atividade"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </div>
                                )}
                              </div>

                              {/* Linha de Responsabilidade e Avaliação */}
                              <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3 text-xs">
                                {canEditStructure ? (
                                  isChecklist ? (
                                    <div className="flex items-center gap-2">
                                      <span className="text-slate-500 font-medium text-[11px]">
                                        Quem preenche?
                                      </span>
                                      <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200">
                                        <button
                                          type="button"
                                          onClick={() =>
                                            handleChangeFilledBy(step.id, 'collaborator')
                                          }
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
                                          onClick={() =>
                                            handleChangeFilledBy(step.id, 'evaluator')
                                          }
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
                                      {onStartEvaluation && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const asgId = ensureCollaboratorChecklistAssignment(
                                              collaborator.id,
                                              step.refId,
                                              step.collaboratorChecklistId || linkedAssignment?.id
                                            );
                                            onStartEvaluation(asgId, collaborator.id);
                                          }}
                                          className="px-2.5 py-1 text-[11px] font-bold text-[#0f3e2e] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md inline-flex items-center gap-1 cursor-pointer transition-colors"
                                        >
                                          <Eye className="w-3 h-3 text-emerald-700" />
                                          <span>Ver Avaliação</span>
                                        </button>
                                      )}
                                      {onStartEvaluation && !isFinalized && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const asgId = ensureCollaboratorChecklistAssignment(
                                              collaborator.id,
                                              step.refId,
                                              step.collaboratorChecklistId || linkedAssignment?.id
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
                                      {isChecklist && onStartEvaluation && (
                                        <button
                                          type="button"
                                          onClick={() => {
                                            const asgId = ensureCollaboratorChecklistAssignment(
                                              collaborator.id,
                                              step.refId,
                                              step.collaboratorChecklistId || linkedAssignment?.id
                                            );
                                            onStartEvaluation(asgId, collaborator.id);
                                          }}
                                          className="px-2.5 py-1 text-[11px] font-bold text-[#0f3e2e] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-md inline-flex items-center gap-1 cursor-pointer transition-colors"
                                        >
                                          <Eye className="w-3 h-3 text-emerald-700" />
                                          <span>Ver Avaliação</span>
                                        </button>
                                      )}
                                    </div>
                                  )
                                )}
                              </div>

                              {/* Revisão rápida das Observações do Avaliador (por critério e geral) */}
                              {hasEvaluatorNotesPreview && (
                                <div className="pt-2 border-t border-slate-100">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setExpandedNotesStepIds((prev) => ({
                                        ...prev,
                                        [step.id]: !prev[step.id],
                                      }))
                                    }
                                    className="inline-flex items-center gap-1.5 text-[11px] font-bold text-[#0f3e2e] hover:text-emerald-800 bg-emerald-50/70 hover:bg-emerald-100/70 border border-emerald-200/80 px-2.5 py-1 rounded-lg transition-colors cursor-pointer"
                                  >
                                    <MessageSquareText className="w-3.5 h-3.5 text-emerald-700" />
                                    <span>
                                      Observações do Avaliador
                                      {criteriaWithEvaluatorNotes.length > 0
                                        ? ` (${criteriaWithEvaluatorNotes.length} ${
                                            criteriaWithEvaluatorNotes.length === 1
                                              ? 'critério'
                                              : 'critérios'
                                          })`
                                        : ' (Geral)'}
                                    </span>
                                    {isNotesExpanded ? (
                                      <ChevronUp className="w-3.5 h-3.5" />
                                    ) : (
                                      <ChevronDown className="w-3.5 h-3.5" />
                                    )}
                                  </button>

                                  {isNotesExpanded && (
                                    <div className="mt-2 bg-slate-50 border border-slate-200 rounded-xl p-3 space-y-2 text-xs">
                                      {criteriaWithEvaluatorNotes.map((crit, cIdx) => (
                                        <div
                                          key={crit.criterionId || cIdx}
                                          className={`p-2.5 rounded-lg border space-y-1 ${
                                            crit.checked
                                              ? 'bg-emerald-50/50 border-emerald-200'
                                              : 'bg-amber-50/60 border-amber-200'
                                          }`}
                                        >
                                          <div className="flex items-center justify-between gap-2">
                                            <span className="font-bold text-slate-900 text-[11px]">
                                              {crit.name}
                                            </span>
                                            <span
                                              className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                                                crit.checked
                                                  ? 'bg-emerald-100 text-emerald-800'
                                                  : 'bg-red-100 text-red-700'
                                              }`}
                                            >
                                              {crit.checked ? 'Atendido' : 'Não Atendido'}
                                            </span>
                                          </div>
                                          <p className="text-[11px] text-slate-700 leading-relaxed italic">
                                            &ldquo;{crit.notes?.trim()}&rdquo;
                                          </p>
                                        </div>
                                      ))}

                                      {generalObsPreview && (
                                        <div className="p-2.5 rounded-lg bg-white border border-slate-200 space-y-0.5">
                                          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                                            Observações Gerais do Avaliador
                                          </div>
                                          <p className="text-[11px] text-slate-700 leading-relaxed">
                                            {generalObsPreview}
                                          </p>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })
          )}
        </div>
      </div>

      {/* ========================================================= */}
      {/* MODAL 1: + APLICAR MODELO (1 CLIQUE HERDANDO BLOCOS) */}
      {/* ========================================================= */}
      {isApplyTemplateModalOpen && (
        <div
          className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setIsApplyTemplateModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-xl w-full max-h-[88vh] border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 bg-[#0f3e2e] text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <Layers className="w-5 h-5 text-emerald-200" />
                <div>
                  <h3 className="text-sm font-bold text-white">
                    Aplicar Modelo de Trilha
                  </h3>
                  <p className="text-[11px] text-emerald-200">
                    Escolha o modelo para importar seus blocos e etapas com 1 clique
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
              {/* Aviso de Append Não-Destrutivo + Opção de Reciclagem */}
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 space-y-2 text-xs text-emerald-950">
                <div className="flex items-start gap-2.5">
                  <CheckCircle2 className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="font-semibold">
                      Os blocos (Etapa 1, Etapa 2...) serão copiados exatamente como configurados no modelo, sem sobrescrever o histórico anterior.
                    </p>
                    {isFinalized && (
                      <p className="text-[11px] text-amber-800 font-medium">
                        Como esta trilha está finalizada, aplicar um modelo irá reabri-la automaticamente.
                      </p>
                    )}
                  </div>
                </div>

                {currentTrack.length > 0 && (
                  <label className="flex items-center gap-2 pt-2 border-t border-emerald-200/70 text-[11px] font-semibold text-emerald-900 cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={allowTemplateRecycling}
                      onChange={(e) => setAllowTemplateRecycling(e.target.checked)}
                      className="rounded border-emerald-400 text-[#0f3e2e] focus:ring-emerald-500"
                    />
                    <span>
                      Modo reciclagem (aplicar novamente mesmo blocos e atividades já existentes na trilha)
                    </span>
                  </label>
                )}
              </div>

              {trackTemplates.length > 0 && (
                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={templateSearch}
                    onChange={(e) => setTemplateSearch(e.target.value)}
                    placeholder="Buscar modelo por nome ou célula..."
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              )}

              {trackTemplates.length === 0 ? (
                <div className="border-2 border-dashed border-slate-200 rounded-2xl p-8 text-center space-y-2 bg-slate-50/50">
                  <Layers className="w-10 h-10 text-slate-300 mx-auto" />
                  <h4 className="text-sm font-bold text-slate-800">
                    Nenhum modelo de trilha salvo ainda
                  </h4>
                  <p className="text-xs text-slate-500 max-w-sm mx-auto">
                    Acesse o menu <strong>Modelos de Trilha</strong> na barra lateral para criar modelos organizados por blocos e células.
                  </p>
                </div>
              ) : filteredTemplatesForModal.length === 0 ? (
                <div className="text-center py-8 text-xs text-slate-500">
                  Nenhum modelo encontrado para &ldquo;{templateSearch}&rdquo;.
                </div>
              ) : (
                filteredTemplatesForModal.map((tpl) => {
                  const blockGroups = groupTemplateStepsByStage(tpl.steps);
                  const simulatedExisting = new Map<string, Set<string>>();
                  existingStepKeysByStage.forEach((set, k) => {
                    simulatedExisting.set(k, new Set(set));
                  });

                  let newCount = 0;
                  tpl.steps.forEach((tplStep) => {
                    const stageKey = normalizeTemplateStageName(tplStep.stageName).toLowerCase();
                    const itemKey = `${tplStep.type}:${tplStep.refId}`;
                    const hasLinked =
                      tplStep.type === 'checklist'
                        ? checklists.some((c) => c.id === tplStep.refId)
                        : surveys.some((s) => s.id === tplStep.refId);
                    if (!hasLinked) return;

                    if (allowTemplateRecycling) {
                      newCount++;
                    } else if (!simulatedExisting.get(stageKey)?.has(itemKey)) {
                      if (!simulatedExisting.has(stageKey)) {
                        simulatedExisting.set(stageKey, new Set());
                      }
                      simulatedExisting.get(stageKey)!.add(itemKey);
                      newCount++;
                    }
                  });

                  const blockSummary = blockGroups
                    .map((g) => `${g.stageName} (${g.steps.length})`)
                    .join(' · ');

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
                              <span>{tpl.cell === 'Geral' ? 'Geral' : getCellName(tpl.cell)}</span>
                            </span>
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-900 border border-emerald-200">
                              {blockGroups.length} bloco(s) · {tpl.steps.length} atividade(s)
                            </span>
                          </div>
                          {tpl.description && (
                            <p className="text-[11px] text-slate-600 line-clamp-1">
                              {tpl.description}
                            </p>
                          )}
                          <p className="text-[11px] font-medium text-emerald-800">
                            {blockSummary}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {allowTemplateRecycling
                              ? `Todas as ${newCount} atividade(s) serão adicionadas como novo ciclo`
                              : newCount === tpl.steps.length
                              ? `${newCount} atividade(s) pronta(s) para importar`
                              : newCount === 0
                              ? 'Todos os blocos e atividades deste modelo já estão na trilha'
                              : `${newCount} nova(s) · ${tpl.steps.length - newCount} já presente(s) nos mesmos blocos`}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => handleApplyTemplate(tpl)}
                          disabled={isApplyingTemplate || newCount === 0}
                          className="px-3.5 py-1.5 text-xs font-bold text-white bg-[#0f3e2e] hover:bg-emerald-900 rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-2xs shrink-0"
                        >
                          {newCount === 0 ? 'Já Aplicado' : `Aplicar (+${newCount})`}
                        </button>
                      </div>

                      {/* Prévia agrupada por blocos */}
                      <div className="space-y-2 pt-2 border-t border-slate-100">
                        {blockGroups.map((group) => {
                          const stageKey = group.stageName.toLowerCase();
                          const existingSet = existingStepKeysByStage.get(stageKey);
                          return (
                            <div key={group.stageName} className="space-y-1">
                              <div className="text-[10px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                                <Calendar className="w-3 h-3 text-emerald-700" />
                                <span>{group.stageName}</span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {group.steps.map(({ step, flatIndex }) => {
                                  const item =
                                    step.type === 'checklist'
                                      ? checklists.find((c) => c.id === step.refId)
                                      : surveys.find((s) => s.id === step.refId);
                                  const alreadyAddedInBlock =
                                    !allowTemplateRecycling &&
                                    Boolean(existingSet?.has(`${step.type}:${step.refId}`));

                                  return (
                                    <span
                                      key={`${tpl.id}-${flatIndex}`}
                                      className={`text-[10px] px-2 py-0.5 rounded-md border truncate max-w-[230px] ${
                                        alreadyAddedInBlock
                                          ? 'bg-emerald-50/60 text-emerald-800 border-emerald-200 line-through opacity-75'
                                          : 'bg-slate-50 text-slate-700 border-slate-200'
                                      }`}
                                      title={item?.title || 'Atividade removida'}
                                    >
                                      {flatIndex + 1}. {item?.title || 'Atividade removida'}
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
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

      {/* ========================================================= */}
      {/* MODAL 2: + NOVO BLOCO AVULSO / + ADICIONAR ATIVIDADE */}
      {/* ========================================================= */}
      {isAddSingleStepModalOpen && (
        <div
          className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setIsAddSingleStepModalOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 bg-[#0f3e2e] text-white flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <Plus className="w-5 h-5 text-emerald-200" />
                <div>
                  <h3 className="text-sm font-bold text-white">
                    {singleStageMode === 'existing' ? 'Adicionar Atividade no Bloco' : 'Novo Bloco Avulso'}
                  </h3>
                  <p className="text-[11px] text-emerald-200">
                    Insira 1 checklist ou pesquisa em um novo bloco (ex: Reciclagem) ou em um bloco existente
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsAddSingleStepModalOpen(false)}
                className="text-emerald-200 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmAddSingleStep} className="p-5 space-y-4 text-xs">
              {/* Destino: Novo Bloco ou Bloco Existente */}
              <div className="space-y-2 bg-slate-50 border border-slate-200 rounded-xl p-3.5">
                <label className="block font-bold text-slate-800">
                  Bloco / Etapa de Destino *
                </label>
                {existingStageNames.length > 0 && (
                  <div className="grid grid-cols-2 gap-2 bg-slate-200/70 p-1 rounded-lg">
                    <button
                      type="button"
                      onClick={() => setSingleStageMode('new')}
                      className={`py-1.5 px-2.5 rounded-md font-bold text-[11px] transition-all cursor-pointer ${
                        singleStageMode === 'new'
                          ? 'bg-white text-emerald-950 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Criar Novo Bloco
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSingleStageMode('existing');
                        if (!singleExistingStageName && existingStageNames[0]) {
                          setSingleExistingStageName(existingStageNames[0]);
                        }
                      }}
                      className={`py-1.5 px-2.5 rounded-md font-bold text-[11px] transition-all cursor-pointer ${
                        singleStageMode === 'existing'
                          ? 'bg-white text-emerald-950 shadow-2xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      Bloco Existente ({existingStageNames.length})
                    </button>
                  </div>
                )}

                {singleStageMode === 'new' || existingStageNames.length === 0 ? (
                  <input
                    type="text"
                    required
                    value={singleNewStageName}
                    onChange={(e) => setSingleNewStageName(e.target.value)}
                    placeholder="Ex: Etapa 3, Semana 2, Reciclagem..."
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                ) : (
                  <select
                    value={singleExistingStageName}
                    onChange={(e) => setSingleExistingStageName(e.target.value)}
                    required
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg font-semibold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  >
                    {existingStageNames.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Tipo de Atividade */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-800">Tipo de Atividade</label>
                <div className="grid grid-cols-2 gap-2 bg-slate-100 p-1 rounded-xl">
                  <button
                    type="button"
                    onClick={() => {
                      setSingleStepType('checklist');
                      setSingleStepSearch('');
                      setSingleStepRefId(checklists[0]?.id || '');
                      setSingleStepFilledBy('evaluator');
                    }}
                    className={`py-2 px-3 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      singleStepType === 'checklist'
                        ? 'bg-white text-emerald-950 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Checklist ({checklists.length})</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setSingleStepType('survey');
                      setSingleStepSearch('');
                      setSingleStepRefId(surveys[0]?.id || '');
                      setSingleStepFilledBy('collaborator');
                    }}
                    className={`py-2 px-3 rounded-lg font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      singleStepType === 'survey'
                        ? 'bg-white text-emerald-950 shadow-xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    <ClipboardCheck className="w-3.5 h-3.5" />
                    <span>Pesquisa ({surveys.length})</span>
                  </button>
                </div>
              </div>

              {/* Busca + Filtro por Célula + Seleção da Atividade */}
              <div className="space-y-2">
                <label className="block font-bold text-slate-800">
                  {singleStepType === 'checklist'
                    ? 'Selecionar Checklist *'
                    : 'Selecionar Pesquisa de Satisfação *'}
                </label>

                {singleStepType === 'checklist' && (
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-1 flex-wrap text-[10px]">
                      {[
                        { key: 'all', label: 'Todas' },
                        { key: 'GERAL', label: 'Geral' },
                        { key: 'LAB', label: 'Lab' },
                        { key: 'IMG', label: 'Imagem' },
                        { key: 'CONSULTA', label: 'Consultas' },
                        { key: 'TERAPIA', label: 'Terapias' },
                        { key: 'OPERADORA', label: 'Operadora' },
                      ].map((cellOpt) => (
                        <button
                          key={cellOpt.key}
                          type="button"
                          onClick={() =>
                            setSingleStepCellFilter(cellOpt.key as 'all' | ChecklistCell)
                          }
                          className={`px-2 py-0.5 rounded font-semibold cursor-pointer border transition-colors ${
                            singleStepCellFilter === cellOpt.key
                              ? 'bg-[#0f3e2e] text-white border-[#0f3e2e]'
                              : cellOpt.key === 'GERAL'
                              ? 'bg-teal-50 text-teal-800 border-teal-200 hover:bg-teal-100'
                              : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                          }`}
                        >
                          {cellOpt.label}
                        </button>
                      ))}
                    </div>
                    {singleStepCellFilter !== 'all' && singleStepCellFilter !== 'GERAL' && (
                      <p className="text-[10px] text-teal-800 font-medium flex items-center gap-1">
                        <Globe className="w-3 h-3 shrink-0" />
                        <span>
                          Exibindo checklists de <strong>{getCellName(singleStepCellFilter)}</strong> + checklists <strong>Geral</strong>
                        </span>
                      </p>
                    )}
                  </div>
                )}

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                  <input
                    type="text"
                    value={singleStepSearch}
                    onChange={(e) => setSingleStepSearch(e.target.value)}
                    placeholder="Filtrar por nome ou célula..."
                    className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <select
                  value={singleStepRefId}
                  onChange={(e) => setSingleStepRefId(e.target.value)}
                  required
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-900"
                >
                  <option value="">Selecione uma atividade...</option>
                  {filteredSingleStepOptions.map((item) => {
                    const inSameStage = currentTrack.some(
                      (s) =>
                        s.type === singleStepType &&
                        s.refId === item.id &&
                        normalizeStageName(s.stageName).toLowerCase() ===
                          resolvedSingleStageName.toLowerCase()
                    );
                    const isItemGeral = 'cell' in item && isGeneralCell(item.cell);
                    const cellTag =
                      'cell' in item
                        ? isItemGeral
                          ? 'Geral'
                          : getCellName(item.cell)
                        : item.targetCell || 'Todas';
                    return (
                      <option key={item.id} value={item.id}>
                        {isItemGeral ? `[Geral] ${item.title}` : `${item.title} (${cellTag})`}
                        {inSameStage ? ` · [Já em ${resolvedSingleStageName}]` : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* Responsável pelo Preenchimento */}
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-800">
                  Responsável pelo Preenchimento
                </label>
                {singleStepType === 'checklist' ? (
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setSingleStepFilledBy('evaluator')}
                      className={`p-2.5 rounded-xl border font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                        singleStepFilledBy === 'evaluator'
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-950'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <UserCheck className="w-3.5 h-3.5" />
                      <span>Auxiliar / Avaliador</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSingleStepFilledBy('collaborator')}
                      className={`p-2.5 rounded-xl border font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-all ${
                        singleStepFilledBy === 'collaborator'
                          ? 'bg-emerald-50 border-emerald-500 text-emerald-950'
                          : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                      }`}
                    >
                      <User className="w-3.5 h-3.5" />
                      <span>Colaborador</span>
                    </button>
                  </div>
                ) : (
                  <div className="p-2.5 rounded-xl border border-purple-200 bg-purple-50 text-purple-900 font-semibold flex items-center gap-2">
                    <User className="w-3.5 h-3.5 text-purple-700" />
                    <span>Colaborador (Pesquisas são respondidas pelo próprio colaborador)</span>
                  </div>
                )}
              </div>

              {selectedSingleAlreadyInSameStage && (
                <div className="bg-red-50 border border-red-200 rounded-xl p-3 flex items-start gap-2 text-[11px] text-red-900">
                  <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                  <p>
                    Esta atividade já existe em <strong>{resolvedSingleStageName}</strong>. Duplicatas na mesma etapa são bloqueadas; para repeti-la, selecione ou crie uma nova Etapa/Semana.
                  </p>
                </div>
              )}

              {!selectedSingleAlreadyInSameStage && (selectedSingleInOtherStage || isFinalized) && (
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 flex items-start gap-2 text-[11px] text-amber-900">
                  <AlertTriangle className="w-4 h-4 text-amber-700 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    {selectedSingleInOtherStage && (
                      <p>
                        Esta atividade já foi utilizada em outra etapa e será adicionada em{' '}
                        <strong>{resolvedSingleStageName}</strong> para acompanhamento comparativo.
                      </p>
                    )}
                    {isFinalized && (
                      <p>
                        A trilha está finalizada e será reaberta automaticamente para o colaborador realizar esta etapa.
                      </p>
                    )}
                  </div>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsAddSingleStepModalOpen(false)}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={
                    isAddingSingleStep || !singleStepRefId || selectedSingleAlreadyInSameStage
                  }
                  className="px-5 py-2 font-bold text-white bg-[#0f3e2e] hover:bg-emerald-900 rounded-xl transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isAddingSingleStep
                    ? 'Adicionando...'
                    : `Adicionar em ${resolvedSingleStageName}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
