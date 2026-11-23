import React, { useMemo, useState } from 'react';
import {
  GitBranch,
  Plus,
  Search,
  Building2,
  BookOpen,
  ClipboardCheck,
  Edit3,
  Copy,
  Trash2,
  ArrowUp,
  ArrowDown,
  ArrowRight,
  User,
  UserCheck,
  X,
  CheckCircle2,
  Lock,
  Layers,
  Globe,
} from 'lucide-react';
import { usePortalStore } from '../../../context/PortalStoreContext';
import { useToast } from '../../../context/ToastContext';
import {
  CLEAN_CELL_NAMES,
  ChecklistCell,
  TrackTemplate,
  TrackTemplateStep,
  getCellName,
  isGeneralCell,
  normalizeChecklistCell,
  normalizeTemplateStageName,
} from '../../../types/portal';

const CELL_FILTER_OPTIONS = [
  'Todas',
  ...CLEAN_CELL_NAMES,
  'Geral',
] as const;

export interface TemplateBlockGroup {
  stageName: string;
  steps: Array<{ step: TrackTemplateStep; flatIndex: number }>;
}

export function groupTemplateStepsByStage(steps: TrackTemplateStep[]): TemplateBlockGroup[] {
  const groups: TemplateBlockGroup[] = [];
  const indexByKey = new Map<string, number>();

  steps.forEach((step, flatIndex) => {
    const stageName = normalizeTemplateStageName(step.stageName);
    const key = stageName.toLowerCase();
    const existingIdx = indexByKey.get(key);
    if (existingIdx !== undefined) {
      groups[existingIdx].steps.push({ step: { ...step, stageName }, flatIndex });
    } else {
      indexByKey.set(key, groups.length);
      groups.push({
        stageName,
        steps: [{ step: { ...step, stageName }, flatIndex }],
      });
    }
  });

  return groups;
}

export const TrackTemplatesView: React.FC = () => {
  const {
    trackTemplates,
    checklists,
    surveys,
    saveTrackTemplate,
    duplicateTrackTemplate,
    deleteTrackTemplate,
  } = usePortalStore();
  const { showToast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCellFilter, setSelectedCellFilter] = useState<string>('Todas');

  // Modal de Criação / Edição do Modelo com Blocos / Etapas
  const [isBuilderOpen, setIsBuilderOpen] = useState(false);
  const [editingTemplateId, setEditingTemplateId] = useState<string | undefined>(undefined);
  const [draftName, setDraftName] = useState('');
  const [draftCell, setDraftCell] = useState<string>('Geral');
  const [draftDescription, setDraftDescription] = useState('');
  const [draftBlocks, setDraftBlocks] = useState<string[]>(['Etapa 1']);
  const [activeBlockIndex, setActiveBlockIndex] = useState<number>(0);
  const [draftSteps, setDraftSteps] = useState<TrackTemplateStep[]>([]);
  const [isSaving, setIsSaving] = useState(false);

  // Biblioteca interna do Construtor
  const [libraryTab, setLibraryTab] = useState<'checklists' | 'surveys'>('checklists');
  const [librarySearch, setLibrarySearch] = useState('');
  const [libraryCellFilter, setLibraryCellFilter] = useState<'all' | ChecklistCell>('all');

  // Modal de Confirmação de Exclusão
  const [deleteTarget, setDeleteTarget] = useState<TrackTemplate | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const safeActiveBlockIndex =
    activeBlockIndex >= 0 && activeBlockIndex < draftBlocks.length ? activeBlockIndex : 0;
  const activeBlockName = draftBlocks[safeActiveBlockIndex] || 'Etapa 1';

  const filteredTemplates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return trackTemplates.filter((tpl) => {
      if (selectedCellFilter !== 'Todas') {
        const normalizedCell = tpl.cell === 'Geral' ? 'Geral' : getCellName(tpl.cell);
        if (normalizedCell !== selectedCellFilter) return false;
      }
      if (!q) return true;
      return (
        tpl.name.toLowerCase().includes(q) ||
        (tpl.description && tpl.description.toLowerCase().includes(q)) ||
        tpl.cell.toLowerCase().includes(q)
      );
    });
  }, [trackTemplates, searchQuery, selectedCellFilter]);

  const filteredLibraryChecklists = useMemo(() => {
    const q = librarySearch.trim().toLowerCase();
    return checklists
      .filter((chk) => {
        const chkCell = normalizeChecklistCell(chk.cell);
        if (libraryCellFilter === 'GERAL') {
          if (!isGeneralCell(chkCell)) return false;
        } else if (libraryCellFilter !== 'all') {
          // Ao filtrar por uma célula específica, exibe checklists da célula + checklists marcados como Geral
          if (chkCell !== libraryCellFilter && !isGeneralCell(chkCell)) return false;
        }
        if (!q) return true;
        return (
          chk.title.toLowerCase().includes(q) ||
          (chk.categoryName && chk.categoryName.toLowerCase().includes(q)) ||
          chk.description.toLowerCase().includes(q) ||
          getCellName(chkCell).toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        if (libraryCellFilter !== 'all' && libraryCellFilter !== 'GERAL') {
          const aExact = normalizeChecklistCell(a.cell) === libraryCellFilter ? 0 : 1;
          const bExact = normalizeChecklistCell(b.cell) === libraryCellFilter ? 0 : 1;
          if (aExact !== bExact) return aExact - bExact;
        }
        return a.title.localeCompare(b.title, 'pt-BR');
      });
  }, [checklists, librarySearch, libraryCellFilter]);

  const filteredLibrarySurveys = useMemo(() => {
    const q = librarySearch.trim().toLowerCase();
    return surveys.filter((srv) => {
      if (!q) return true;
      return (
        srv.title.toLowerCase().includes(q) ||
        srv.description.toLowerCase().includes(q) ||
        (srv.targetCell && srv.targetCell.toLowerCase().includes(q))
      );
    });
  }, [surveys, librarySearch]);

  const openCreateBuilder = () => {
    setEditingTemplateId(undefined);
    setDraftName('');
    setDraftCell('Geral');
    setDraftDescription('');
    setDraftBlocks(['Etapa 1']);
    setActiveBlockIndex(0);
    setDraftSteps([]);
    setLibraryTab('checklists');
    setLibrarySearch('');
    setLibraryCellFilter('all');
    setIsBuilderOpen(true);
  };

  const openEditBuilder = (tpl: TrackTemplate) => {
    const groups = groupTemplateStepsByStage(tpl.steps);
    const blocks = groups.length > 0 ? groups.map((g) => g.stageName) : ['Etapa 1'];
    setEditingTemplateId(tpl.id);
    setDraftName(tpl.name);
    setDraftCell(tpl.cell === 'Geral' ? 'Geral' : getCellName(tpl.cell));
    setDraftDescription(tpl.description || '');
    setDraftBlocks(blocks);
    setActiveBlockIndex(0);
    setDraftSteps(
      tpl.steps.map((s) => ({
        ...s,
        stageName: normalizeTemplateStageName(s.stageName),
      }))
    );
    setLibraryTab('checklists');
    setLibrarySearch('');
    setLibraryCellFilter('all');
    setIsBuilderOpen(true);
  };

  const handleAddBlock = () => {
    const existingLower = new Set(draftBlocks.map((b) => b.trim().toLowerCase()));
    let num = draftBlocks.length + 1;
    while (existingLower.has(`etapa ${num}`)) {
      num++;
    }
    const newBlockName = `Etapa ${num}`;
    setDraftBlocks((prev) => [...prev, newBlockName]);
    setActiveBlockIndex(draftBlocks.length);
  };

  const handleRenameBlock = (blockIdx: number, nextRawName: string) => {
    const oldName = draftBlocks[blockIdx];
    setDraftBlocks((prev) => prev.map((b, idx) => (idx === blockIdx ? nextRawName : b)));
    setDraftSteps((prev) =>
      prev.map((step) =>
        normalizeTemplateStageName(step.stageName).toLowerCase() ===
        normalizeTemplateStageName(oldName).toLowerCase()
          ? { ...step, stageName: nextRawName }
          : step
      )
    );
  };

  const handleMoveBlock = (blockIdx: number, direction: 'up' | 'down') => {
    const targetIdx = direction === 'up' ? blockIdx - 1 : blockIdx + 1;
    if (targetIdx < 0 || targetIdx >= draftBlocks.length) return;

    setDraftBlocks((prev) => {
      const next = [...prev];
      const [moved] = next.splice(blockIdx, 1);
      next.splice(targetIdx, 0, moved);
      return next;
    });
    if (safeActiveBlockIndex === blockIdx) {
      setActiveBlockIndex(targetIdx);
    } else if (safeActiveBlockIndex === targetIdx) {
      setActiveBlockIndex(blockIdx);
    }
  };

  const handleRemoveBlock = (blockIdx: number) => {
    if (draftBlocks.length <= 1) {
      showToast('O modelo precisa ter ao menos 1 Bloco / Etapa.', 'info');
      return;
    }
    const targetName = normalizeTemplateStageName(draftBlocks[blockIdx]).toLowerCase();
    setDraftBlocks((prev) => prev.filter((_, idx) => idx !== blockIdx));
    setDraftSteps((prev) =>
      prev.filter(
        (step) => normalizeTemplateStageName(step.stageName).toLowerCase() !== targetName
      )
    );
    if (safeActiveBlockIndex >= blockIdx && safeActiveBlockIndex > 0) {
      setActiveBlockIndex(safeActiveBlockIndex - 1);
    }
  };

  const handleAddStepToActiveBlock = (type: 'checklist' | 'survey', refId: string) => {
    const targetStage = normalizeTemplateStageName(activeBlockName);
    const alreadyInBlock = draftSteps.some(
      (s) =>
        s.type === type &&
        s.refId === refId &&
        normalizeTemplateStageName(s.stageName).toLowerCase() === targetStage.toLowerCase()
    );
    if (alreadyInBlock) {
      showToast(
        `Esta atividade já foi incluída em "${targetStage}". Selecione outro bloco para repeti-la.`,
        'info'
      );
      return;
    }
    setDraftSteps((prev) => [
      ...prev,
      {
        stageName: targetStage,
        type,
        refId,
        filledBy: type === 'checklist' ? 'evaluator' : 'collaborator',
      },
    ]);
  };

  const handleMoveStepWithinBlock = (
    blockName: string,
    indexInBlock: number,
    direction: 'up' | 'down'
  ) => {
    const targetInBlock = direction === 'up' ? indexInBlock - 1 : indexInBlock + 1;
    const blockLower = normalizeTemplateStageName(blockName).toLowerCase();

    const blockIndices: number[] = [];
    draftSteps.forEach((step, flatIdx) => {
      if (normalizeTemplateStageName(step.stageName).toLowerCase() === blockLower) {
        blockIndices.push(flatIdx);
      }
    });

    if (targetInBlock < 0 || targetInBlock >= blockIndices.length) return;
    const flatA = blockIndices[indexInBlock];
    const flatB = blockIndices[targetInBlock];

    setDraftSteps((prev) => {
      const next = [...prev];
      const temp = next[flatA];
      next[flatA] = next[flatB];
      next[flatB] = temp;
      return next;
    });
  };

  const handleRemoveDraftStep = (flatIndex: number) => {
    setDraftSteps((prev) => prev.filter((_, idx) => idx !== flatIndex));
  };

  const handleChangeDraftFilledBy = (
    flatIndex: number,
    filledBy: 'collaborator' | 'evaluator'
  ) => {
    setDraftSteps((prev) =>
      prev.map((step, idx) => (idx === flatIndex ? { ...step, filledBy } : step))
    );
  };

  const handleSaveBuilder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!draftName.trim()) {
      showToast('Informe um nome para o modelo de trilha.', 'error');
      return;
    }

    // Valida nomes dos blocos (sem vazios nem duplicados)
    const normalizedBlockNames = draftBlocks.map((b) => b.trim());
    if (normalizedBlockNames.some((b) => !b)) {
      showToast('Todos os Blocos / Etapas precisam ter um nome válido.', 'error');
      return;
    }
    const lowerSet = new Set(normalizedBlockNames.map((b) => b.toLowerCase()));
    if (lowerSet.size !== normalizedBlockNames.length) {
      showToast('Existem dois Blocos / Etapas com o mesmo nome. Utilize nomes distintos.', 'error');
      return;
    }

    // Ordena steps seguindo a ordem dos blocos configurados
    const orderedSteps: TrackTemplateStep[] = [];
    normalizedBlockNames.forEach((blockName) => {
      const blockLower = blockName.toLowerCase();
      draftSteps.forEach((step) => {
        if (normalizeTemplateStageName(step.stageName).toLowerCase() === blockLower) {
          orderedSteps.push({
            ...step,
            stageName: blockName,
          });
        }
      });
    });

    if (orderedSteps.length === 0) {
      showToast('Adicione ao menos 1 checklist ou pesquisa em algum bloco do modelo.', 'error');
      return;
    }

    setIsSaving(true);
    const res = await saveTrackTemplate({
      id: editingTemplateId,
      name: draftName.trim(),
      description: draftDescription.trim(),
      cell: draftCell,
      steps: orderedSteps,
    });
    setIsSaving(false);

    if (res.success) {
      showToast(res.message, 'success');
      setIsBuilderOpen(false);
    } else {
      showToast(res.message, 'error');
    }
  };

  const handleDuplicate = async (tpl: TrackTemplate) => {
    const res = await duplicateTrackTemplate(tpl.id);
    showToast(res.message, res.success ? 'success' : 'error');
  };

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    const res = await deleteTrackTemplate(deleteTarget.id);
    setIsDeleting(false);
    setDeleteTarget(null);
    showToast(res.message, res.success ? 'success' : 'error');
  };

  const resolveStepTitle = (step: TrackTemplateStep) => {
    if (step.type === 'checklist') {
      return checklists.find((c) => c.id === step.refId)?.title || 'Checklist removido';
    }
    return surveys.find((s) => s.id === step.refId)?.title || 'Pesquisa removida';
  };

  return (
    <div className="space-y-5">
      {/* Header Corporativo do Módulo */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold uppercase tracking-wider mb-1">
            <GitBranch className="w-4 h-4 text-emerald-600" />
            <span>Jornadas Padronizadas por Blocos</span>
          </div>
          <h1 className="text-2xl font-bold font-display text-slate-900 tracking-tight">
            Modelos de Trilha
          </h1>
          <p className="text-xs text-slate-600 mt-1 max-w-2xl">
            Estruture jornadas reutilizáveis divididas em Blocos / Etapas (ex.: Etapa 1, Etapa 2, Semana 1, Semana 2) para aplicar em 1 clique nos colaboradores.
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateBuilder}
          className="px-4 py-2.5 text-xs font-bold text-white bg-[#0f3e2e] hover:bg-emerald-900 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>+ Novo Modelo de Trilha</span>
        </button>
      </div>

      {/* Barra de Filtros por Célula e Busca */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              Célula:
            </span>
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            {CELL_FILTER_OPTIONS.map((cellName) => {
              const isSelected = selectedCellFilter === cellName;
              return (
                <button
                  key={cellName}
                  type="button"
                  onClick={() => setSelectedCellFilter(cellName)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                    isSelected
                      ? 'bg-[#0f3e2e] text-white border-[#0f3e2e] shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {cellName}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="relative w-full sm:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar modelo de trilha por nome ou descrição..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
            />
          </div>
          <div className="text-xs text-slate-500 font-semibold">
            {filteredTemplates.length} modelo(s) cadastrado(s)
          </div>
        </div>
      </div>

      {/* Lista de Cards Visuais dos Modelos */}
      {filteredTemplates.length === 0 ? (
        <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-12 text-center space-y-3 shadow-xs">
          <GitBranch className="w-12 h-12 text-slate-300 mx-auto" />
          <h3 className="text-base font-bold text-slate-900">
            {trackTemplates.length === 0
              ? 'Nenhum modelo de trilha criado ainda'
              : 'Nenhum modelo encontrado para os filtros aplicados'}
          </h3>
          <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
            Padronize o onboarding e as reciclagens das equipes organizando blocos e etapas com checklists técnicos e pesquisas de satisfação.
          </p>
          <button
            type="button"
            onClick={openCreateBuilder}
            className="px-4 py-2 text-xs font-bold text-white bg-[#0f3e2e] hover:bg-emerald-900 rounded-xl transition-colors cursor-pointer inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            <span>Criar Primeiro Modelo de Trilha</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {filteredTemplates.map((tpl) => {
            const cellLabel = tpl.cell === 'Geral' ? 'Geral' : getCellName(tpl.cell);
            const blockGroups = groupTemplateStepsByStage(tpl.steps);
            const techEvaluationsCount = tpl.steps.filter(
              (s) => s.type === 'checklist' && s.filledBy === 'evaluator'
            ).length;
            const collaboratorStepsCount = tpl.steps.filter(
              (s) => s.type === 'survey' || s.filledBy === 'collaborator'
            ).length;

            return (
              <div
                key={tpl.id}
                className="bg-white border border-slate-200 hover:border-emerald-300 rounded-2xl p-5 shadow-xs transition-all flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  {/* Cabeçalho do Card */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-base font-bold text-slate-900 leading-snug">
                          {tpl.name}
                        </h2>
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-900 border border-emerald-200">
                          <Building2 className="w-3 h-3 text-emerald-700" />
                          <span>{cellLabel}</span>
                        </span>
                      </div>

                      {tpl.description && (
                        <p className="text-xs text-slate-600 leading-relaxed line-clamp-2">
                          {tpl.description}
                        </p>
                      )}

                      {/* Resumo Agrupado por Blocos */}
                      <div className="flex items-center gap-1.5 flex-wrap text-[11px] font-semibold text-[#0f3e2e] pt-0.5">
                        <Layers className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                        <span>
                          {blockGroups
                            .map(
                              (g) =>
                                `${g.stageName} (${g.steps.length} ${
                                  g.steps.length === 1 ? 'atividade' : 'atividades'
                                })`
                            )
                            .join(' · ')}
                        </span>
                      </div>

                      {/* Contagem por responsável */}
                      <div className="flex items-center gap-2 flex-wrap text-[11px] text-slate-500 font-medium">
                        <span>{tpl.steps.length} atividade(s) no total</span>
                        <span>•</span>
                        <span>{techEvaluationsCount} avaliação(ões) técnica(s)</span>
                        <span>·</span>
                        <span>{collaboratorStepsCount} pesquisa(s)/colaborador</span>
                      </div>
                    </div>

                    {/* Ações: Editar, Duplicar, Excluir */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => openEditBuilder(tpl)}
                        className="p-2 text-slate-500 hover:text-[#0f3e2e] hover:bg-emerald-50 rounded-lg transition-colors cursor-pointer"
                        title="Editar modelo"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDuplicate(tpl)}
                        className="p-2 text-slate-500 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                        title="Duplicar modelo"
                      >
                        <Copy className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(tpl)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Excluir modelo"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Fluxo Visual Agrupado por Blocos */}
                  <div className="bg-slate-50/80 border border-slate-200/80 rounded-xl p-3 space-y-2.5">
                    {blockGroups.map((group, bIdx) => (
                      <div key={`${tpl.id}-block-${bIdx}`} className="space-y-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-900 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded">
                            {group.stageName}
                          </span>
                          <span className="text-[10px] text-slate-400 font-semibold">
                            {group.steps.length} atividade(s)
                          </span>
                        </div>
                        <div className="flex items-center flex-wrap gap-1.5">
                          {group.steps.map(({ step, flatIndex }, localIdx) => {
                            const title = resolveStepTitle(step);
                            const isSurvey = step.type === 'survey';
                            const isEvaluator = !isSurvey && step.filledBy === 'evaluator';

                            return (
                              <React.Fragment key={`${tpl.id}-step-${flatIndex}`}>
                                <div
                                  title={`${group.stageName} · ${localIdx + 1}. ${title} (${
                                    isSurvey
                                      ? 'Pesquisa · Colaborador'
                                      : isEvaluator
                                      ? 'Checklist · Avaliador'
                                      : 'Checklist · Colaborador'
                                  })`}
                                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-[11px] font-semibold max-w-[230px] ${
                                    isSurvey
                                      ? 'bg-purple-50 text-purple-900 border-purple-200'
                                      : 'bg-white text-slate-800 border-slate-200 shadow-2xs'
                                  }`}
                                >
                                  <span className="w-4 h-4 rounded-full bg-[#0f3e2e] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                                    {flatIndex + 1}
                                  </span>
                                  {isSurvey ? (
                                    <ClipboardCheck className="w-3 h-3 text-purple-700 shrink-0" />
                                  ) : (
                                    <BookOpen className="w-3 h-3 text-emerald-700 shrink-0" />
                                  )}
                                  <span className="truncate">{title}</span>
                                  <span
                                    className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                                      isEvaluator
                                        ? 'bg-emerald-50 text-emerald-800'
                                        : 'bg-amber-50 text-amber-800'
                                    }`}
                                  >
                                    {isEvaluator ? 'Aval.' : 'Colab.'}
                                  </span>
                                </div>
                                {localIdx < group.steps.length - 1 && (
                                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                                )}
                              </React.Fragment>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Rodapé discreto */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-400">
                  <span>
                    Criado em {new Date(tpl.createdAt).toLocaleDateString('pt-BR')}
                    {tpl.updatedAt &&
                      tpl.updatedAt !== tpl.createdAt &&
                      ` · Atualizado em ${new Date(tpl.updatedAt).toLocaleDateString('pt-BR')}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => openEditBuilder(tpl)}
                    className="text-xs font-bold text-[#0f3e2e] hover:text-emerald-700 cursor-pointer"
                  >
                    Editar Blocos e Etapas →
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL CONSTRUTOR DEDICADO POR BLOCOS / ETAPAS */}
      {/* ========================================================= */}
      {isBuilderOpen && (
        <div
          className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setIsBuilderOpen(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[92vh] border border-slate-200 overflow-hidden flex flex-col animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header Modal */}
            <div className="px-6 py-4 bg-[#0f3e2e] text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-3">
                <GitBranch className="w-5 h-5 text-emerald-300" />
                <div>
                  <h3 className="text-base font-bold text-white">
                    {editingTemplateId ? 'Editar Modelo de Trilha' : 'Novo Modelo de Trilha'}
                  </h3>
                  <p className="text-[11px] text-emerald-200">
                    Divida o modelo em Blocos / Etapas (ex.: Etapa 1, Etapa 2) e organize a sequência de atividades
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsBuilderOpen(false)}
                className="text-emerald-200 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveBuilder} className="flex-1 overflow-hidden flex flex-col">
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                {/* Campos de Identificação do Modelo */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-50 border border-slate-200 rounded-2xl p-4 text-xs">
                  <div className="md:col-span-2 space-y-1">
                    <label className="block font-bold text-slate-800">Nome do Modelo *</label>
                    <input
                      type="text"
                      required
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      placeholder="Ex: Onboarding Completo · Laboratório"
                      className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-900"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-slate-800">Célula *</label>
                    <select
                      value={draftCell}
                      onChange={(e) => setDraftCell(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-900"
                    >
                      <option value="Geral">Geral (Todas as Células)</option>
                      {CLEAN_CELL_NAMES.map((cellName) => (
                        <option key={cellName} value={cellName}>
                          {cellName}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="md:col-span-3 space-y-1">
                    <label className="block font-bold text-slate-800">
                      Descrição (Opcional)
                    </label>
                    <input
                      type="text"
                      value={draftDescription}
                      onChange={(e) => setDraftDescription(e.target.value)}
                      placeholder="Descreva o objetivo deste modelo ou público indicado..."
                      className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-900"
                    />
                  </div>
                </div>

                {/* Construtor 2 Colunas: Biblioteca vs Blocos do Modelo */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
                  {/* Biblioteca de Seleção */}
                  <div className="lg:col-span-5 border border-slate-200 rounded-2xl overflow-hidden bg-white">
                    <div className="p-3.5 bg-slate-50 border-b border-slate-200 space-y-2.5">
                      <div className="flex items-center justify-between gap-2">
                        <div className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                          Biblioteca de Atividades
                        </div>
                        <span className="text-[10px] font-bold text-emerald-900 bg-emerald-100 border border-emerald-300 px-2 py-0.5 rounded-full truncate max-w-[180px]">
                          Destino: {normalizeTemplateStageName(activeBlockName)}
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-1.5 bg-slate-200/70 p-1 rounded-xl text-xs font-bold">
                        <button
                          type="button"
                          onClick={() => setLibraryTab('checklists')}
                          className={`py-1.5 px-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
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
                          className={`py-1.5 px-2.5 rounded-lg flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                            libraryTab === 'surveys'
                              ? 'bg-white text-emerald-950 shadow-xs'
                              : 'text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          <ClipboardCheck className="w-3.5 h-3.5" />
                          <span>Pesquisas ({surveys.length})</span>
                        </button>
                      </div>

                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          value={librarySearch}
                          onChange={(e) => setLibrarySearch(e.target.value)}
                          placeholder={
                            libraryTab === 'checklists'
                              ? 'Buscar checklist...'
                              : 'Buscar pesquisa...'
                          }
                          className="w-full pl-8 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                        />
                      </div>

                      {libraryTab === 'checklists' && (
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
                                  setLibraryCellFilter(cellOpt.key as 'all' | ChecklistCell)
                                }
                                className={`px-2 py-0.5 rounded font-semibold cursor-pointer border ${
                                  libraryCellFilter === cellOpt.key
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
                          {libraryCellFilter !== 'all' && libraryCellFilter !== 'GERAL' && (
                            <p className="text-[10px] text-teal-800 font-medium flex items-center gap-1">
                              <Globe className="w-3 h-3 shrink-0" />
                              <span>
                                Exibindo checklists de <strong>{getCellName(libraryCellFilter)}</strong> + checklists <strong>Geral</strong>
                              </span>
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    <div className="p-3 space-y-2 max-h-[420px] overflow-y-auto">
                      {libraryTab === 'checklists' ? (
                        filteredLibraryChecklists.length === 0 ? (
                          <div className="text-center py-8 text-xs text-slate-400">
                            Nenhum checklist encontrado.
                          </div>
                        ) : (
                          filteredLibraryChecklists.map((chk) => {
                            const isAddedInBlock = draftSteps.some(
                              (s) =>
                                s.type === 'checklist' &&
                                s.refId === chk.id &&
                                normalizeTemplateStageName(s.stageName).toLowerCase() ===
                                  normalizeTemplateStageName(activeBlockName).toLowerCase()
                            );
                            return (
                              <div
                                key={chk.id}
                                className={`p-3 rounded-xl border flex items-center justify-between gap-2.5 ${
                                  isAddedInBlock
                                    ? 'bg-emerald-50/40 border-emerald-200'
                                    : 'bg-white border-slate-200 hover:border-emerald-300'
                                }`}
                              >
                                <div className="min-w-0">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    {isGeneralCell(chk.cell) ? (
                                      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-teal-800 bg-teal-50 border border-teal-200 px-1.5 py-0.5 rounded">
                                        <Globe className="w-2.5 h-2.5" />
                                        Geral
                                      </span>
                                    ) : (
                                      <span className="text-[10px] font-bold text-slate-500">
                                        {getCellName(chk.cell)}
                                      </span>
                                    )}
                                    {chk.visibility === 'restrito' && (
                                      <span className="inline-flex items-center gap-0.5 text-[9px] font-bold text-amber-800 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                                        <Lock className="w-2.5 h-2.5" />
                                        Restrito
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-xs font-bold text-slate-900 truncate">
                                    {chk.title}
                                  </div>
                                </div>
                                <button
                                  type="button"
                                  disabled={isAddedInBlock}
                                  onClick={() => handleAddStepToActiveBlock('checklist', chk.id)}
                                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 inline-flex items-center gap-1 ${
                                    isAddedInBlock
                                      ? 'bg-emerald-100 text-emerald-800 cursor-not-allowed'
                                      : 'bg-[#0f3e2e] hover:bg-emerald-900 text-white cursor-pointer'
                                  }`}
                                >
                                  {isAddedInBlock ? (
                                    <>
                                      <CheckCircle2 className="w-3 h-3" />
                                      <span>No bloco</span>
                                    </>
                                  ) : (
                                    <>
                                      <Plus className="w-3 h-3" />
                                      <span>Adicionar</span>
                                    </>
                                  )}
                                </button>
                              </div>
                            );
                          })
                        )
                      ) : filteredLibrarySurveys.length === 0 ? (
                        <div className="text-center py-8 text-xs text-slate-400">
                          Nenhuma pesquisa encontrada.
                        </div>
                      ) : (
                        filteredLibrarySurveys.map((srv) => {
                          const isAddedInBlock = draftSteps.some(
                            (s) =>
                              s.type === 'survey' &&
                              s.refId === srv.id &&
                              normalizeTemplateStageName(s.stageName).toLowerCase() ===
                                normalizeTemplateStageName(activeBlockName).toLowerCase()
                          );
                          return (
                            <div
                              key={srv.id}
                              className={`p-3 rounded-xl border flex items-center justify-between gap-2.5 ${
                                isAddedInBlock
                                  ? 'bg-purple-50/40 border-purple-200'
                                  : 'bg-white border-slate-200 hover:border-purple-300'
                              }`}
                            >
                              <div className="min-w-0">
                                <span className="text-[10px] font-bold text-purple-800">
                                  {srv.targetCell || 'Todas'}
                                </span>
                                <div className="text-xs font-bold text-slate-900 truncate">
                                  {srv.title}
                                </div>
                              </div>
                              <button
                                type="button"
                                disabled={isAddedInBlock}
                                onClick={() => handleAddStepToActiveBlock('survey', srv.id)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold shrink-0 inline-flex items-center gap-1 ${
                                  isAddedInBlock
                                    ? 'bg-purple-100 text-purple-800 cursor-not-allowed'
                                    : 'bg-[#0f3e2e] hover:bg-emerald-900 text-white cursor-pointer'
                                }`}
                              >
                                {isAddedInBlock ? (
                                  <>
                                    <CheckCircle2 className="w-3 h-3" />
                                    <span>No bloco</span>
                                  </>
                                ) : (
                                  <>
                                    <Plus className="w-3 h-3" />
                                    <span>Adicionar</span>
                                  </>
                                )}
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>

                  {/* Blocos / Etapas Montadas do Modelo */}
                  <div className="lg:col-span-7 border border-slate-200 rounded-2xl overflow-hidden bg-white">
                    <div className="p-3.5 bg-slate-50 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                      <div>
                        <div className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                          Blocos / Etapas do Modelo ({draftBlocks.length})
                        </div>
                        <p className="text-[11px] text-slate-500">
                          Clique em um bloco para selecioná-lo como destino das atividades à esquerda.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={handleAddBlock}
                        className="px-3 py-1.5 text-xs font-bold text-white bg-[#0f3e2e] hover:bg-emerald-900 rounded-lg transition-colors inline-flex items-center gap-1.5 cursor-pointer shrink-0 shadow-2xs"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>+ Adicionar Bloco / Etapa</span>
                      </button>
                    </div>

                    <div className="p-3.5 space-y-3.5 max-h-[450px] overflow-y-auto">
                      {draftBlocks.map((blockName, bIdx) => {
                        const isBlockActive = bIdx === safeActiveBlockIndex;
                        const blockLower = normalizeTemplateStageName(blockName).toLowerCase();
                        const stepsInBlock = draftSteps
                          .map((step, flatIndex) => ({ step, flatIndex }))
                          .filter(
                            ({ step }) =>
                              normalizeTemplateStageName(step.stageName).toLowerCase() ===
                              blockLower
                          );

                        return (
                          <div
                            key={`builder-block-${bIdx}`}
                            onClick={() => setActiveBlockIndex(bIdx)}
                            className={`rounded-xl border-2 transition-all overflow-hidden cursor-pointer ${
                              isBlockActive
                                ? 'border-[#0f3e2e] bg-emerald-50/20 shadow-xs'
                                : 'border-slate-200 bg-slate-50/40 hover:border-slate-300'
                            }`}
                          >
                            {/* Cabeçalho do Bloco Editável */}
                            <div
                              className={`px-3.5 py-2.5 border-b flex items-center justify-between gap-2 ${
                                isBlockActive
                                  ? 'bg-emerald-50 border-emerald-200'
                                  : 'bg-white border-slate-200'
                              }`}
                            >
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <span
                                  className={`w-5 h-5 rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 ${
                                    isBlockActive
                                      ? 'bg-[#0f3e2e] text-white'
                                      : 'bg-slate-200 text-slate-700'
                                  }`}
                                >
                                  {bIdx + 1}
                                </span>
                                <input
                                  type="text"
                                  value={blockName}
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setActiveBlockIndex(bIdx);
                                  }}
                                  onChange={(e) => handleRenameBlock(bIdx, e.target.value)}
                                  placeholder="Nome do Bloco (ex: Etapa 1 - Básico)"
                                  className="flex-1 min-w-0 px-2.5 py-1 bg-white border border-slate-300 rounded-lg text-xs font-bold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                                {isBlockActive && (
                                  <span className="text-[10px] font-bold text-[#0f3e2e] bg-white border border-emerald-300 px-2 py-0.5 rounded-full shrink-0 hidden sm:inline">
                                    Bloco Selecionado
                                  </span>
                                )}
                              </div>

                              <div
                                className="flex items-center gap-1 shrink-0"
                                onClick={(e) => e.stopPropagation()}
                              >
                                <span className="text-[10px] font-bold text-slate-500 mr-1">
                                  {stepsInBlock.length} ativ.
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleMoveBlock(bIdx, 'up')}
                                  disabled={bIdx === 0}
                                  className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded disabled:opacity-30 cursor-pointer"
                                  title="Mover bloco para cima"
                                >
                                  <ArrowUp className="w-3.5 h-3.5" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleMoveBlock(bIdx, 'down')}
                                  disabled={bIdx === draftBlocks.length - 1}
                                  className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded disabled:opacity-30 cursor-pointer"
                                  title="Mover bloco para baixo"
                                >
                                  <ArrowDown className="w-3.5 h-3.5" />
                                </button>
                                {draftBlocks.length > 1 && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveBlock(bIdx)}
                                    className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer ml-0.5"
                                    title="Remover bloco"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>

                            {/* Atividades dentro do Bloco */}
                            <div className="p-3 space-y-2">
                              {stepsInBlock.length === 0 ? (
                                <div className="border border-dashed border-slate-300 rounded-lg p-4 text-center text-[11px] text-slate-500 bg-white/70">
                                  {isBlockActive
                                    ? 'Bloco ativo! Clique em "+ Adicionar" na biblioteca à esquerda para incluir atividades aqui.'
                                    : 'Bloco vazio. Clique neste bloco para selecioná-lo e adicionar atividades.'}
                                </div>
                              ) : (
                                stepsInBlock.map(({ step, flatIndex }, idxInBlock) => {
                                  const title = resolveStepTitle(step);
                                  const isChecklist = step.type === 'checklist';

                                  return (
                                    <div
                                      key={`${step.type}-${step.refId}-${flatIndex}`}
                                      onClick={(e) => e.stopPropagation()}
                                      className="border border-slate-200 rounded-xl p-2.5 bg-white space-y-2 shadow-2xs"
                                    >
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-2 min-w-0">
                                          <span className="w-5 h-5 rounded-full bg-[#0f3e2e] text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                                            {idxInBlock + 1}
                                          </span>
                                          <div className="min-w-0">
                                            <div className="text-xs font-bold text-slate-900 truncate">
                                              {title}
                                            </div>
                                            <span
                                              className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded-full border mt-0.5 ${
                                                isChecklist
                                                  ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                                                  : 'bg-purple-50 text-purple-900 border-purple-200'
                                              }`}
                                            >
                                              {isChecklist
                                                ? 'Checklist'
                                                : 'Pesquisa de Satisfação'}
                                            </span>
                                          </div>
                                        </div>

                                        <div className="flex items-center gap-1 shrink-0">
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleMoveStepWithinBlock(
                                                blockName,
                                                idxInBlock,
                                                'up'
                                              )
                                            }
                                            disabled={idxInBlock === 0}
                                            className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded disabled:opacity-30 cursor-pointer"
                                            title="Subir atividade"
                                          >
                                            <ArrowUp className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() =>
                                              handleMoveStepWithinBlock(
                                                blockName,
                                                idxInBlock,
                                                'down'
                                              )
                                            }
                                            disabled={idxInBlock === stepsInBlock.length - 1}
                                            className="p-1 text-slate-400 hover:text-slate-800 hover:bg-slate-100 rounded disabled:opacity-30 cursor-pointer"
                                            title="Descer atividade"
                                          >
                                            <ArrowDown className="w-3.5 h-3.5" />
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => handleRemoveDraftStep(flatIndex)}
                                            className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer ml-0.5"
                                            title="Remover atividade"
                                          >
                                            <Trash2 className="w-3.5 h-3.5" />
                                          </button>
                                        </div>
                                      </div>

                                      <div className="pt-1.5 border-t border-slate-100 flex items-center justify-between gap-2 text-[11px]">
                                        <span className="text-slate-500 font-medium">
                                          Quem preenche?
                                        </span>
                                        {isChecklist ? (
                                          <div className="inline-flex rounded-lg bg-slate-100 p-0.5 border border-slate-200">
                                            <button
                                              type="button"
                                              onClick={() =>
                                                handleChangeDraftFilledBy(
                                                  flatIndex,
                                                  'collaborator'
                                                )
                                              }
                                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
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
                                                handleChangeDraftFilledBy(flatIndex, 'evaluator')
                                              }
                                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1 ${
                                                step.filledBy === 'evaluator'
                                                  ? 'bg-white text-emerald-950 shadow-2xs'
                                                  : 'text-slate-500 hover:text-slate-800'
                                              }`}
                                            >
                                              <UserCheck className="w-3 h-3" />
                                              <span>Auxiliar / Avaliador</span>
                                            </button>
                                          </div>
                                        ) : (
                                          <span className="inline-flex items-center gap-1 text-purple-900 font-semibold bg-purple-50 px-2 py-0.5 rounded-md border border-purple-200 text-[10px]">
                                            <User className="w-3 h-3" />
                                            <span>Colaborador</span>
                                          </span>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>

              {/* Rodapé do Modal */}
              <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0 text-xs">
                <span className="text-[11px] text-slate-500">
                  {editingTemplateId
                    ? 'Alterações neste modelo não modificam trilhas já em andamento nos colaboradores.'
                    : 'Todos os blocos configurados serão aplicados automaticamente ao colaborador.'}
                </span>

                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setIsBuilderOpen(false)}
                    className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving}
                    className="px-5 py-2 font-bold text-white bg-[#0f3e2e] hover:bg-emerald-900 rounded-xl transition-colors shadow-sm cursor-pointer disabled:opacity-50"
                  >
                    {isSaving
                      ? 'Salvando...'
                      : editingTemplateId
                      ? 'Salvar Alterações'
                      : 'Criar Modelo de Trilha'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {/* ========================================================= */}
      {deleteTarget && (
        <div
          className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4"
          onClick={() => setDeleteTarget(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                Excluir &ldquo;{deleteTarget.name}&rdquo;?
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                O modelo será removido do catálogo, mas as trilhas já atribuídas aos colaboradores permanecerão intactas.
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isDeleting}
                onClick={handleConfirmDelete}
                className="px-5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors cursor-pointer shadow-xs disabled:opacity-50"
              >
                {isDeleting ? 'Excluindo...' : 'Confirmar Exclusão'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
