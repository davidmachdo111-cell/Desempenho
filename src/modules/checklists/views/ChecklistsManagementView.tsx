import React, { useMemo, useState } from 'react';
import {
  BookOpen,
  Plus,
  Search,
  CheckSquare,
  Trash2,
  Edit3,
  Copy,
  X,
  Sparkles,
  Filter,
  Building2,
  Lock,
  Check,
  ListPlus,
  Globe,
  Lightbulb,
} from 'lucide-react';
import { usePortalStore } from '../../../context/PortalStoreContext';
import { useToast } from '../../../context/ToastContext';
import {
  Checklist,
  ChecklistCell,
  OfficialCell,
  OFFICIAL_CELLS,
  OFFICIAL_CELL_LIST,
  VisibilityLevel,
  getChecklistCellMeta,
  isGeneralCell,
  normalizeChecklistCell,
} from '../../../types/portal';

interface ParsedBatchCriterion {
  name: string;
  weight: number;
  weightSource: 'prefix' | 'default';
}

function parseBatchCriteriaLines(
  rawText: string,
  defaultWeight: number
): ParsedBatchCriterion[] {
  const safeDefaultWeight = Math.max(1, Math.floor(Number(defaultWeight) || 1));

  return rawText
    .split(/\r?\n/)
    .map((rawLine): ParsedBatchCriterion | null => {
      const trimmed = rawLine.trim();
      if (!trimmed) return null;

      // 1. Formato numérico no início da linha: "2. Texto", "2) Texto" ou "2 Texto"
      const numericMatch = trimmed.match(/^(\d+)(?:\s*[.)]\s*|\s+)(.+)$/);
      if (numericMatch) {
        const parsedWeight = parseInt(numericMatch[1], 10);
        const weight = Number.isFinite(parsedWeight) && parsedWeight >= 1 ? parsedWeight : 1;
        const cleanedName = numericMatch[2].replace(/^[-*•–—]+\s+/, '').trim();
        if (!cleanedName) return null;
        return {
          name: cleanedName,
          weight,
          weightSource: 'prefix',
        };
      }

      // 2. Linha sem número (ou iniciando com marcador -, *, •) -> usa Peso padrão
      const cleanedName = trimmed.replace(/^[-*•–—]+\s+/, '').trim();
      if (!cleanedName) return null;
      return {
        name: cleanedName,
        weight: safeDefaultWeight,
        weightSource: 'default',
      };
    })
    .filter((item): item is ParsedBatchCriterion => item !== null);
}

export const ChecklistsManagementView: React.FC = () => {
  const {
    checklists,
    exercises,
    categories,
    hasPermission,
    saveChecklist,
    deleteChecklist,
  } = usePortalStore();
  const { showToast } = useToast();

  const canManageChecklists = hasPermission('can_manage_checklists');

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('all');
  const [selectedCellFilter, setSelectedCellFilter] = useState<string>('all');
  const [linkExerciseCellFilter, setLinkExerciseCellFilter] = useState<'all' | OfficialCell>('all');
  const [modalState, setModalState] = useState<{
    open: boolean;
    checklist?: Checklist;
  }>({ open: false });

  // Modal de Confirmação de Exclusão do Checklist
  const [deleteConfirmChecklist, setDeleteConfirmChecklist] = useState<Checklist | null>(null);

  const checklistCategories = useMemo(() => {
    return categories.filter((c) => c.type === 'checklist' || c.type === 'geral');
  }, [categories]);

  const filteredChecklists = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return checklists.filter((chk) => {
      const chkCell = normalizeChecklistCell(chk.cell || 'OPERADORA');
      if (selectedCellFilter !== 'all' && chkCell !== selectedCellFilter) return false;
      const categoryName = chk.categoryName || 'Geral';
      if (selectedCategoryFilter !== 'all' && categoryName !== selectedCategoryFilter) return false;
      if (!q) return true;
      const cellMeta = getChecklistCellMeta(chkCell);
      return (
        chk.title.toLowerCase().includes(q) ||
        chk.description.toLowerCase().includes(q) ||
        categoryName.toLowerCase().includes(q) ||
        chkCell.toLowerCase().includes(q) ||
        cellMeta.name.toLowerCase().includes(q)
      );
    });
  }, [checklists, searchQuery, selectedCategoryFilter, selectedCellFilter]);

  // Estados do Modal Criador Visual de Checklists
  const [formTitle, setFormTitle] = useState('');
  const [formCell, setFormCell] = useState<ChecklistCell>('GERAL');
  const [formDescription, setFormDescription] = useState('');
  const [formLearningObjective, setFormLearningObjective] = useState('');
  const [formCategoryId, setFormCategoryId] = useState(checklistCategories[0]?.id || '');
  const [formCategoryName, setFormCategoryName] = useState(checklistCategories[0]?.name || '');
  const [formVisibility, setFormVisibility] = useState<VisibilityLevel>('padrao');
  const [formHasExercises, setFormHasExercises] = useState(false);

  // Critérios diretos do checklist
  const [activeCriteriaItems, setActiveCriteriaItems] = useState<
    Array<{ id?: string; name: string; weight: number }>
  >([]);

  // Campo de adicionar critério na hora
  const [quickCriterionName, setQuickCriterionName] = useState('');
  const [quickCriterionWeight, setQuickCriterionWeight] = useState(1);

  // Edição inline de critério existente
  const [editingCriterionIndex, setEditingCriterionIndex] = useState<number | null>(null);
  const [editingCriterionName, setEditingCriterionName] = useState('');
  const [editingCriterionWeight, setEditingCriterionWeight] = useState(1);

  // Adição em lote de critérios
  const [isBatchCriteriaOpen, setIsBatchCriteriaOpen] = useState(false);
  const [batchCriteriaText, setBatchCriteriaText] = useState('');
  const [batchCriteriaWeight, setBatchCriteriaWeight] = useState(1);

  const detectedBatchItems = useMemo(
    () => parseBatchCriteriaLines(batchCriteriaText, batchCriteriaWeight),
    [batchCriteriaText, batchCriteriaWeight]
  );

  const detectedBatchTotalWeight = useMemo(
    () => detectedBatchItems.reduce((sum, item) => sum + item.weight, 0),
    [detectedBatchItems]
  );

  // Exercícios vinculados por checkbox
  const [selectedExerciseIds, setSelectedExerciseIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openCreator = (chk?: Checklist) => {
    setEditingCriterionIndex(null);
    setEditingCriterionName('');
    setEditingCriterionWeight(1);
    setIsBatchCriteriaOpen(false);
    setBatchCriteriaText('');
    setBatchCriteriaWeight(1);
    setQuickCriterionName('');
    setQuickCriterionWeight(1);

    if (chk) {
      const normalizedCell = normalizeChecklistCell(chk.cell || 'OPERADORA');
      setFormTitle(chk.title);
      setFormCell(normalizedCell);
      setFormDescription(chk.description || '');
      setFormLearningObjective(chk.learningObjective || '');
      const matchedCat =
        checklistCategories.find((c) => c.id === chk.categoryId || c.name === chk.categoryName) ||
        checklistCategories[0];
      setFormCategoryId(chk.categoryId || matchedCat?.id || '');
      setFormCategoryName(chk.categoryName || matchedCat?.name || '');
      setFormVisibility(chk.visibility || 'padrao');
      setFormHasExercises(chk.hasExercises);
      setActiveCriteriaItems(
        chk.criteria.map((c) => ({
          id: c.id,
          name: c.name,
          weight: c.weight,
        }))
      );
      setSelectedExerciseIds(chk.exerciseIds || []);
      setLinkExerciseCellFilter(normalizedCell === 'GERAL' ? 'all' : normalizedCell);
      setModalState({ open: true, checklist: chk });
    } else {
      setFormTitle('');
      setFormCell('GERAL');
      setFormDescription('');
      setFormLearningObjective('');
      setFormCategoryId(checklistCategories[0]?.id || '');
      setFormCategoryName(checklistCategories[0]?.name || '');
      setFormVisibility('padrao');
      setFormHasExercises(false);
      setActiveCriteriaItems([
        { id: `crit-${Date.now()}-1`, name: 'Abertura profissional com saudação cordial e identificação', weight: 2 },
        { id: `crit-${Date.now()}-2`, name: 'Escuta ativa e confirmação das necessidades do cliente', weight: 2 },
        { id: `crit-${Date.now()}-3`, name: 'Consulta correta aos sistemas e normas de atendimento', weight: 3 },
        { id: `crit-${Date.now()}-4`, name: 'Clareza na explicação da solução e resolução assertiva', weight: 3 },
      ]);
      setSelectedExerciseIds([]);
      setLinkExerciseCellFilter('all');
      setModalState({ open: true });
    }
  };

  const handleAddQuickCriterion = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!quickCriterionName.trim()) return;

    const newItem = {
      id: `crit-custom-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
      name: quickCriterionName.trim(),
      weight: Math.max(1, Number(quickCriterionWeight) || 1),
    };

    setActiveCriteriaItems((prev) => [...prev, newItem]);
    setQuickCriterionName('');
    setQuickCriterionWeight(1);
  };

  const handleStartEditCriterion = (index: number) => {
    const target = activeCriteriaItems[index];
    if (!target) return;
    setEditingCriterionIndex(index);
    setEditingCriterionName(target.name);
    setEditingCriterionWeight(target.weight || 1);
  };

  const handleCancelEditCriterion = () => {
    setEditingCriterionIndex(null);
    setEditingCriterionName('');
    setEditingCriterionWeight(1);
  };

  const handleSaveEditCriterion = (index: number) => {
    const trimmed = editingCriterionName.trim();
    if (!trimmed) {
      showToast('O texto do critério não pode ficar vazio.', 'error');
      return;
    }
    const sanitizedWeight = Math.min(10, Math.max(1, Number(editingCriterionWeight) || 1));
    setActiveCriteriaItems((prev) =>
      prev.map((item, idx) =>
        idx === index ? { ...item, name: trimmed, weight: sanitizedWeight } : item
      )
    );
    handleCancelEditCriterion();
    showToast('Critério atualizado!', 'success');
  };

  const handleImportBatchCriteria = () => {
    const parsedItems = parseBatchCriteriaLines(batchCriteriaText, batchCriteriaWeight);
    if (parsedItems.length === 0) {
      showToast('Cole ao menos uma linha válida para importar critérios.', 'error');
      return;
    }
    const baseTs = Date.now();
    const newItems = parsedItems.map((item, idx) => ({
      id: `crit-batch-${baseTs}-${idx}-${Math.floor(Math.random() * 1000)}`,
      name: item.name,
      weight: Math.max(1, item.weight),
    }));

    setActiveCriteriaItems((prev) => [...prev, ...newItems]);
    setBatchCriteriaText('');
    setBatchCriteriaWeight(1);
    setIsBatchCriteriaOpen(false);
    showToast(
      `${newItems.length} ${newItems.length === 1 ? 'critério importado' : 'critérios importados'} com sucesso!`,
      'success'
    );
  };

  const handleRemoveCriterion = (indexToRemove: number) => {
    if (editingCriterionIndex === indexToRemove) {
      handleCancelEditCriterion();
    } else if (editingCriterionIndex !== null && editingCriterionIndex > indexToRemove) {
      setEditingCriterionIndex(editingCriterionIndex - 1);
    }
    setActiveCriteriaItems((prev) => prev.filter((_, idx) => idx !== indexToRemove));
  };

  const handleUpdateCriterionWeight = (index: number, newWeight: number) => {
    setActiveCriteriaItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, weight: Math.max(1, newWeight) } : item))
    );
  };

  const handleToggleExercise = (exerciseId: string) => {
    setSelectedExerciseIds((prev) =>
      prev.includes(exerciseId) ? prev.filter((id) => id !== exerciseId) : [...prev, exerciseId]
    );
  };

  const handleSaveChecklist = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTitle.trim()) {
      showToast('Informe o título do checklist.', 'error');
      return;
    }

    // Se houver uma edição inline aberta com texto válido, aplica automaticamente antes de salvar
    let finalCriteria = activeCriteriaItems;
    if (editingCriterionIndex !== null && editingCriterionName.trim()) {
      const sanitizedWeight = Math.min(10, Math.max(1, Number(editingCriterionWeight) || 1));
      finalCriteria = activeCriteriaItems.map((item, idx) =>
        idx === editingCriterionIndex
          ? { ...item, name: editingCriterionName.trim(), weight: sanitizedWeight }
          : item
      );
      setActiveCriteriaItems(finalCriteria);
      handleCancelEditCriterion();
    }

    if (finalCriteria.length === 0) {
      showToast('Adicione ao menos um critério de avaliação.', 'error');
      return;
    }

    setIsSubmitting(true);
    const res = await saveChecklist({
      id: modalState.checklist?.id,
      title: formTitle.trim(),
      cell: formCell,
      description: formDescription.trim(),
      learningObjective: formLearningObjective.trim() || undefined,
      categoryId: formCategoryId || undefined,
      categoryName: formCategoryName,
      visibility: formVisibility,
      hasExercises: formHasExercises && selectedExerciseIds.length > 0,
      exerciseIds: formHasExercises ? selectedExerciseIds : [],
      criteria: finalCriteria,
    });
    setIsSubmitting(false);

    if (res.success) {
      showToast(
        modalState.checklist
          ? 'Checklist atualizado com sucesso!'
          : 'Checklist completo salvo e disponível para colaboradores!',
        'success'
      );
      setModalState({ open: false });
    } else {
      showToast(res.message, 'error');
    }
  };

  const handleDuplicateChecklist = async (chk: Checklist) => {
    const res = await saveChecklist({
      title: `${chk.title} (Cópia)`,
      cell: normalizeChecklistCell(chk.cell || 'OPERADORA'),
      description: chk.description || '',
      learningObjective: chk.learningObjective,
      categoryId: chk.categoryId,
      categoryName: chk.categoryName,
      visibility: chk.visibility || 'padrao',
      hasExercises: chk.hasExercises,
      exerciseIds: [...(chk.exerciseIds || [])],
      criteria: chk.criteria.map((c) => ({
        name: c.name,
        weight: c.weight,
      })),
    });

    if (res.success) {
      showToast(`Checklist "${chk.title} (Cópia)" criado com sucesso!`, 'success');
    } else {
      showToast(res.message, 'error');
    }
  };

  const handleDeleteClick = (chk: Checklist) => {
    setDeleteConfirmChecklist(chk);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfirmChecklist) return;
    const res = await deleteChecklist(deleteConfirmChecklist.id);
    setDeleteConfirmChecklist(null);
    showToast(res.message, res.success ? 'success' : 'error');
  };

  return (
    <div className="space-y-6">
      {/* Header Corporativo do Módulo */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold uppercase tracking-wider mb-1">
            <BookOpen className="w-4 h-4 text-emerald-600" />
            <span>Módulo 2 · Avaliação Flexível</span>
          </div>
          <h1 className="text-2xl font-bold font-display text-slate-900 tracking-tight">
            Checklists de Avaliação
          </h1>
          <p className="text-xs text-slate-600 mt-1 max-w-2xl">
            Crie e gerencie modelos de verificação com critérios ponderados. Checklists podem ser puramente teóricos/operacionais ou conter exercícios simulados integrados.
          </p>
        </div>

        {canManageChecklists && (
          <button
            type="button"
            onClick={() => openCreator()}
            className="px-4 py-2.5 text-xs font-bold text-white bg-[#0f3e2e] hover:bg-emerald-900 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>+ Novo Checklist</span>
          </button>
        )}
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
        {/* Filtro por Célula (Banners / Botões Instantâneos) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-emerald-700 shrink-0" />
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              Célula do Checklist:
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            <button
              type="button"
              onClick={() => setSelectedCellFilter('all')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                selectedCellFilter === 'all'
                  ? 'bg-[#0f3e2e] text-white border-[#0f3e2e] shadow-xs'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
            >
              Todas
            </button>
            <button
              type="button"
              onClick={() => setSelectedCellFilter('GERAL')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border inline-flex items-center gap-1 ${
                selectedCellFilter === 'GERAL'
                  ? 'bg-[#0f3e2e] text-white border-[#0f3e2e] shadow-xs'
                  : 'bg-teal-50/70 border-teal-200 text-teal-800 hover:bg-teal-100/70'
              }`}
            >
              <Globe className="w-3.5 h-3.5" />
              <span>Geral</span>
            </button>
            {OFFICIAL_CELL_LIST.map((cellKey) => {
              const meta = OFFICIAL_CELLS[cellKey];
              const isSelected = selectedCellFilter === cellKey;

              return (
                <button
                  key={cellKey}
                  type="button"
                  onClick={() => setSelectedCellFilter(cellKey)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                    isSelected
                      ? 'bg-[#0f3e2e] text-white border-[#0f3e2e] shadow-xs'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {meta.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Linha de Busca e Filtro de Categoria */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-0.5">
          <div className="relative w-full sm:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por título, descrição ou célula..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
            />
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto">
            <Filter className="w-3.5 h-3.5 text-slate-500" />
            <span className="text-xs font-medium text-slate-600">Categoria:</span>
            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
            >
              <option value="all">Todas as Categorias</option>
              {checklistCategories.map((cat) => (
                <option key={cat.id} value={cat.name}>
                  {cat.name}
                </option>
              ))}
            </select>
            <div className="text-xs text-slate-500 font-medium ml-2">
              {filteredChecklists.length} checklist(s)
            </div>
          </div>
        </div>
      </div>

      {/* Grid de Checklists Cadastrados */}
      {filteredChecklists.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-xs">
          <BookOpen className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900">Nenhum checklist encontrado</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-5">
            Crie o primeiro checklist definindo os critérios de excelência e vinculando exercícios se desejar.
          </p>
          {canManageChecklists && (
            <button
              type="button"
              onClick={() => openCreator()}
              className="px-4 py-2 text-xs font-bold text-white bg-[#0f3e2e] hover:bg-emerald-900 rounded-xl transition-colors cursor-pointer"
            >
              Criar Primeiro Checklist
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredChecklists.map((chk) => {
            const cellMeta = getChecklistCellMeta(chk.cell);
            const isGeral = isGeneralCell(chk.cell);

            return (
              <div
                key={chk.id}
                className="bg-white border border-slate-200 hover:border-emerald-500 rounded-2xl p-5 flex flex-col justify-between shadow-xs hover:shadow-md transition-all group"
              >
                <div className="space-y-3.5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md border inline-flex items-center gap-1 ${
                            isGeral
                              ? 'border-teal-200 bg-teal-50 text-teal-800'
                              : 'border-slate-200 bg-slate-50 text-slate-700'
                          }`}
                        >
                          {isGeral ? (
                            <Globe className="w-3 h-3 text-teal-600" />
                          ) : (
                            <Building2 className="w-3 h-3 text-slate-500" />
                          )}
                          <span>{cellMeta.name}</span>
                        </span>
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 border border-emerald-200/60 px-2 py-0.5 rounded-full uppercase tracking-wider">
                          {chk.categoryName || 'Geral'}
                        </span>
                        {chk.visibility === 'restrito' && (
                          <span
                            title="Acesso restrito ao Guardião Anfitrião / Admin"
                            className="inline-flex items-center gap-1 text-[10px] font-bold text-amber-900 bg-amber-50 border border-amber-300 px-2 py-0.5 rounded-full"
                          >
                            <Lock className="w-2.5 h-2.5 text-amber-700" />
                            <span>Restrito</span>
                          </span>
                        )}
                      </div>
                      <h3 className="text-base font-bold text-slate-900 group-hover:text-emerald-900 transition-colors">
                        {chk.title}
                      </h3>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 ${
                        chk.isActive ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-100 text-slate-500'
                      }`}
                    >
                      {chk.isActive ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>

                <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed">
                  {chk.description || 'Modelo de avaliação operacional de atendimento.'}
                </p>

                {chk.learningObjective && (
                  <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-lg px-2.5 py-2 text-[11px] text-emerald-950 flex items-start gap-1.5">
                    <Lightbulb className="w-3.5 h-3.5 text-emerald-700 shrink-0 mt-0.5" />
                    <span className="line-clamp-2 leading-snug">
                      <strong className="text-[#0f3e2e]">Objetivo: </strong>
                      {chk.learningObjective}
                    </span>
                  </div>
                )}

                {/* Métricas do Checklist */}
                <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-100 text-xs">
                  <div className="bg-slate-50 rounded-lg p-2.5">
                    <div className="text-[11px] text-slate-500 font-medium">Critérios</div>
                    <div className="text-sm font-bold text-slate-900 font-mono">
                      {chk.criteria.length} itens
                    </div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-2.5">
                    <div className="text-[11px] text-slate-500 font-medium">Exercícios</div>
                    <div className="text-sm font-bold text-emerald-800 font-mono">
                      {chk.hasExercises ? `${chk.exerciseIds.length} caso(s)` : 'Sem exercícios'}
                    </div>
                  </div>
                </div>
              </div>

              {/* Ações */}
              {canManageChecklists && (
                <div className="mt-5 pt-4 border-t border-slate-100 flex items-center gap-1.5 justify-end">
                  <button
                    type="button"
                    onClick={() => openCreator(chk)}
                    className="flex-1 py-2 px-3 text-xs font-bold text-[#0f3e2e] bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Editar</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDuplicateChecklist(chk)}
                    className="py-2 px-2.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    title="Duplicar checklist"
                  >
                    <Copy className="w-3.5 h-3.5" />
                    <span>Duplicar</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleDeleteClick(chk)}
                    className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                    title="Excluir checklist"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              )}
            </div>
          );
        })}
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: CRIADOR / EDITOR VISUAL DE CHECKLIST */}
      {/* ========================================================= */}
      {modalState.open && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl my-8 border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            {/* Header Modal */}
            <div className="px-6 py-4.5 bg-[#0f3e2e] text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <BookOpen className="w-5 h-5 text-emerald-400" />
                <div>
                  <h3 className="font-bold text-base">
                    {modalState.checklist ? 'Editar Checklist' : 'Novo Checklist de Avaliação'}
                  </h3>
                  <p className="text-[11px] text-emerald-200">
                    Defina critérios ponderados e vincule exercícios práticos opcionais
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalState({ open: false })}
                className="text-emerald-200 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Body */}
            <form onSubmit={handleSaveChecklist} className="p-6 overflow-y-auto space-y-6 flex-1 text-xs">
              {/* BLOCO 1: Informações Gerais */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4.5 space-y-4">
                <div className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>1. Dados Básicos do Checklist</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1 md:col-span-2">
                    <label className="block text-xs font-bold text-slate-800">
                      Título do Checklist *
                    </label>
                    <input
                      type="text"
                      required
                      value={formTitle}
                      onChange={(e) => setFormTitle(e.target.value)}
                      placeholder="Ex: Checklist de Atendimento SAC e Resolução de Reclamações"
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-900"
                    />
                  </div>

                  {/* Campo Célula do Checklist */}
                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-800">
                      Célula do Checklist *
                    </label>
                    <select
                      value={formCell}
                      onChange={(e) => {
                        const nextCell = e.target.value as ChecklistCell;
                        setFormCell(nextCell);
                        if (nextCell === 'GERAL') {
                          setLinkExerciseCellFilter('all');
                        } else {
                          setLinkExerciseCellFilter(nextCell);
                        }
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-slate-900"
                    >
                      <option value="GERAL">Geral (Todas as Células)</option>
                      {OFFICIAL_CELL_LIST.map((cellKey) => (
                        <option key={cellKey} value={cellKey}>
                          {OFFICIAL_CELLS[cellKey].name}
                        </option>
                      ))}
                    </select>
                    <p className="text-[11px] text-slate-500">
                      {getChecklistCellMeta(formCell).description}
                    </p>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-800">
                      Categoria Padronizada
                    </label>
                    <select
                      value={formCategoryName}
                      disabled={checklistCategories.length === 0}
                      onChange={(e) => {
                        const val = e.target.value;
                        setFormCategoryName(val);
                        const matched = checklistCategories.find((c) => c.name === val);
                        setFormCategoryId(matched?.id || '');
                      }}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-900 disabled:bg-slate-100 disabled:text-slate-500"
                    >
                      {checklistCategories.length === 0 ? (
                        <option value="">Nenhuma categoria disponível</option>
                      ) : (
                        <>
                          {formCategoryName &&
                            !checklistCategories.some((c) => c.name === formCategoryName) && (
                              <option value={formCategoryName}>{formCategoryName}</option>
                            )}
                          {checklistCategories.map((c) => (
                            <option key={c.id} value={c.name}>
                              {c.name}
                            </option>
                          ))}
                        </>
                      )}
                    </select>
                    {checklistCategories.length === 0 && (
                      <p className="text-[11px] text-amber-700 mt-1">
                        Nenhuma categoria disponível. O cadastro de categorias é realizado em{' '}
                        <strong>Administração &gt; Categorias</strong>.
                      </p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-800">
                      Nível de Visibilidade
                    </label>
                    <select
                      value={formVisibility}
                      onChange={(e) => setFormVisibility(e.target.value as VisibilityLevel)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-semibold text-slate-900"
                    >
                      <option value="padrao">Padrão (Todos os gestores)</option>
                      <option value="restrito">Restrito (Guardião Anfitrião / Admin)</option>
                    </select>
                    <p className="text-[11px] text-slate-500">
                      Itens restritos ocultam notas e detalhes para usuários sem a tag Guardião Anfitrião.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <label className="block text-xs font-bold text-slate-800">
                      Possui Exercícios de Simulação?
                    </label>
                    <div className="flex items-center gap-3 pt-2">
                      <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-800">
                        <input
                          type="checkbox"
                          checked={formHasExercises}
                          onChange={(e) => setFormHasExercises(e.target.checked)}
                          className="rounded text-emerald-700 focus:ring-emerald-500 h-4 w-4"
                        />
                        <span>Sim, vincular casos/exercícios práticos</span>
                      </label>
                    </div>
                  </div>

                  <div className="space-y-1 md:col-span-2">
                    <label className="block text-xs font-bold text-slate-800">
                      Instruções / Descrição (Uso Interno do Avaliador)
                    </label>
                    <textarea
                      rows={2}
                      value={formDescription}
                      onChange={(e) => setFormDescription(e.target.value)}
                      placeholder="Orientações aos avaliadores sobre como aplicar esta avaliação..."
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 resize-none"
                    />
                  </div>

                  <div className="space-y-1.5 md:col-span-2 bg-emerald-50/60 border border-emerald-200 rounded-xl p-3.5">
                    <label className="flex items-center gap-1.5 text-xs font-bold text-[#0f3e2e]">
                      <Lightbulb className="w-3.5 h-3.5 text-emerald-700 shrink-0" />
                      <span>Orientação / Objetivo de Aprendizado (Visível ao Colaborador)</span>
                    </label>
                    <textarea
                      rows={2}
                      value={formLearningObjective}
                      onChange={(e) => setFormLearningObjective(e.target.value)}
                      placeholder="Ex: Neste exercício, você vai aprender como realizar um agendamento 0242 particular"
                      className="w-full px-3 py-2 bg-white border border-emerald-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 placeholder-slate-400 resize-y"
                    />
                    <p className="text-[11px] text-emerald-900/80 leading-relaxed">
                      Este texto é exibido com segurança no Diário de Aprendizado do Portal do Colaborador, sem expor roteiros, personas ou dados internos de clientes.
                    </p>
                  </div>
                </div>
              </div>

              {/* BLOCO 2: Critérios de Avaliação (Checklist Real) */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4.5 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                    <CheckSquare className="w-3.5 h-3.5" />
                    <span>2. Critérios de Avaliação ({activeCriteriaItems.length} itens)</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsBatchCriteriaOpen((prev) => !prev)}
                      className={`px-3 py-1.5 rounded-lg text-[11px] font-bold inline-flex items-center gap-1.5 border transition-colors cursor-pointer ${
                        isBatchCriteriaOpen
                          ? 'bg-[#0f3e2e] text-white border-[#0f3e2e]'
                          : 'bg-white hover:bg-emerald-50 text-[#0f3e2e] border-emerald-300'
                      }`}
                    >
                      <ListPlus className="w-3.5 h-3.5" />
                      <span>+ Adicionar em Lote</span>
                    </button>
                  </div>
                </div>

                {/* Painel Expansível: Adicionar Critérios em Lote */}
                {isBatchCriteriaOpen && (
                  <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3.5 space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                          <ListPlus className="w-3.5 h-3.5 text-emerald-700" />
                          <span>Importar Critérios em Lote</span>
                        </div>
                        <p className="text-[11px] text-emerald-900/85 mt-0.5 leading-relaxed">
                          Cole um critério por linha. O número no início define o <strong>peso</strong> automaticamente (ex.:{' '}
                          <code className="px-1 py-0.5 bg-white/90 border border-emerald-200 rounded font-mono text-[10px]">3. Texto</code>,{' '}
                          <code className="px-1 py-0.5 bg-white/90 border border-emerald-200 rounded font-mono text-[10px]">2) Texto</code> ou{' '}
                          <code className="px-1 py-0.5 bg-white/90 border border-emerald-200 rounded font-mono text-[10px]">2 Texto</code>). Linhas sem número ou com <strong>-</strong>, <strong>*</strong>, <strong>•</strong> recebem o <strong>Peso padrão</strong>.
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => setIsBatchCriteriaOpen(false)}
                        className="p-1 text-emerald-700 hover:bg-emerald-100 rounded-lg cursor-pointer shrink-0"
                        title="Fechar painel em lote"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    <textarea
                      rows={5}
                      value={batchCriteriaText}
                      onChange={(e) => setBatchCriteriaText(e.target.value)}
                      placeholder={
                        '1. Realizou a saudação ao paciente\n3. Realizou o cadastro e o agendamento corretamente\n2. Encaminhou todas as orientações de preparo'
                      }
                      className="w-full px-3 py-2 bg-white border border-emerald-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 leading-relaxed"
                    />

                    {/* Pré-visualização dinâmica dos critérios e pesos identificados */}
                    {detectedBatchItems.length > 0 && (
                      <div className="bg-white border border-emerald-200/90 rounded-lg overflow-hidden shadow-2xs">
                        <div className="px-3 py-2 bg-emerald-100/60 border-b border-emerald-200/80 flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[11px] font-bold text-emerald-950">
                            Pré-visualização ({detectedBatchItems.length}{' '}
                            {detectedBatchItems.length === 1
                              ? 'critério será importado'
                              : 'critérios serão importados'}
                            )
                          </span>
                          <span className="text-[10px] font-mono font-bold text-emerald-900 bg-white/90 border border-emerald-200 px-2 py-0.5 rounded-md">
                            Soma: {detectedBatchTotalWeight} pt{detectedBatchTotalWeight > 1 ? 's' : ''}
                          </span>
                        </div>
                        <div className="max-h-40 overflow-y-auto divide-y divide-slate-100">
                          {detectedBatchItems.map((item, idx) => (
                            <div
                              key={`${idx}-${item.name.slice(0, 16)}`}
                              className="px-3 py-2 flex items-center justify-between gap-2.5 text-xs"
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <span className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-800 font-mono font-bold flex items-center justify-center text-[10px] shrink-0">
                                  {idx + 1}
                                </span>
                                <span className="text-slate-800 font-medium break-words">
                                  {item.name}
                                </span>
                              </div>
                              <span
                                title={
                                  item.weightSource === 'prefix'
                                    ? 'Peso identificado pelo número no início da linha'
                                    : 'Peso padrão aplicado automaticamente'
                                }
                                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-md border shrink-0 ${
                                  item.weight >= 3
                                    ? 'bg-[#0f3e2e] text-white border-[#0f3e2e]'
                                    : item.weight === 2
                                    ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                                    : 'bg-slate-100 text-slate-700 border-slate-200'
                                }`}
                              >
                                Peso {item.weight}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3 flex-wrap">
                        <label className="flex items-center gap-1.5 text-[11px] font-bold text-slate-700">
                          <span>Peso padrão (sem prefixo):</span>
                          <select
                            value={batchCriteriaWeight}
                            onChange={(e) =>
                              setBatchCriteriaWeight(Math.max(1, Number(e.target.value) || 1))
                            }
                            className="px-2.5 py-1 font-mono font-bold bg-white border border-emerald-300 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                          >
                            {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((w) => (
                              <option key={w} value={w}>
                                Peso {w}
                              </option>
                            ))}
                          </select>
                        </label>
                        {detectedBatchItems.length === 0 && (
                          <span className="text-[11px] font-medium text-slate-500">
                            Cole as linhas acima para ver a pré-visualização
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            setBatchCriteriaText('');
                            setIsBatchCriteriaOpen(false);
                          }}
                          className="px-3 py-1.5 text-[11px] font-semibold text-slate-600 hover:bg-white/80 rounded-lg cursor-pointer"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          disabled={detectedBatchItems.length === 0}
                          onClick={handleImportBatchCriteria}
                          className="px-3.5 py-1.5 bg-[#0f3e2e] hover:bg-emerald-900 text-white font-bold rounded-lg text-xs inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-45 transition-colors shadow-xs"
                        >
                          <ListPlus className="w-3.5 h-3.5" />
                          <span>
                            Importar Critérios
                            {detectedBatchItems.length > 0 ? ` (${detectedBatchItems.length})` : ''}
                          </span>
                        </button>
                      </div>
                    </div>
                  </div>
                )}

                {/* Adicionar critério na hora */}
                <div className="bg-white border border-slate-200 rounded-lg p-3 space-y-2">
                  <div className="text-[11px] font-bold text-slate-700">
                    + Adicionar Critério Individual
                  </div>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <input
                      type="text"
                      value={quickCriterionName}
                      onChange={(e) => setQuickCriterionName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAddQuickCriterion();
                        }
                      }}
                      placeholder="Nome do critério (ex: Clareza na explicação do cálculo)"
                      className="flex-1 px-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                    />
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] text-slate-500 font-medium whitespace-nowrap">
                        Peso:
                      </span>
                      <input
                        type="number"
                        min="1"
                        max="10"
                        value={quickCriterionWeight}
                        onChange={(e) => setQuickCriterionWeight(Number(e.target.value) || 1)}
                        className="w-14 px-2 py-1.5 text-center font-bold border border-slate-200 rounded-lg bg-slate-50 text-xs"
                      />
                      <button
                        type="button"
                        onClick={handleAddQuickCriterion}
                        className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-bold rounded-lg text-xs whitespace-nowrap cursor-pointer transition-colors"
                      >
                        Inserir
                      </button>
                    </div>
                  </div>
                </div>

                {/* Lista de Critérios Ativos (com edição inline e remoção) */}
                <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                  {activeCriteriaItems.length === 0 ? (
                    <div className="p-4 bg-white border border-dashed border-slate-200 rounded-lg text-center text-slate-500">
                      Nenhum critério adicionado ainda. Adicione individualmente ou importe em lote acima.
                    </div>
                  ) : (
                    activeCriteriaItems.map((item, idx) => {
                      const isEditingThis = editingCriterionIndex === idx;
                      return (
                        <div
                          key={item.id || idx}
                          className={`p-3 rounded-lg border shadow-2xs transition-colors ${
                            isEditingThis
                              ? 'bg-emerald-50/70 border-emerald-400'
                              : 'bg-white border-slate-200'
                          }`}
                        >
                          {isEditingThis ? (
                            <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                              <span className="w-5 h-5 rounded-full bg-emerald-700 text-white font-mono font-bold flex items-center justify-center text-[10px] shrink-0">
                                {idx + 1}
                              </span>
                              <input
                                type="text"
                                autoFocus
                                value={editingCriterionName}
                                onChange={(e) => setEditingCriterionName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    e.preventDefault();
                                    handleSaveEditCriterion(idx);
                                  } else if (e.key === 'Escape') {
                                    e.preventDefault();
                                    handleCancelEditCriterion();
                                  }
                                }}
                                placeholder="Texto do critério..."
                                className="flex-1 px-2.5 py-1.5 bg-white border border-emerald-400 rounded-lg text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                              />
                              <div className="flex items-center gap-1.5 shrink-0">
                                <label className="flex items-center gap-1 text-[11px] font-semibold text-slate-600">
                                  <span>Peso:</span>
                                  <input
                                    type="number"
                                    min="1"
                                    max="10"
                                    value={editingCriterionWeight}
                                    onChange={(e) =>
                                      setEditingCriterionWeight(
                                        Math.min(10, Math.max(1, Number(e.target.value) || 1))
                                      )
                                    }
                                    className="w-12 px-1.5 py-1 text-center font-mono font-bold text-slate-900 border border-emerald-300 rounded-md bg-white text-xs"
                                  />
                                </label>
                                <button
                                  type="button"
                                  onClick={() => handleSaveEditCriterion(idx)}
                                  className="px-2.5 py-1 bg-[#0f3e2e] hover:bg-emerald-900 text-white font-bold rounded-md text-[11px] inline-flex items-center gap-1 cursor-pointer transition-colors"
                                  title="Salvar alteração do critério"
                                >
                                  <Check className="w-3 h-3" />
                                  <span>Salvar</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={handleCancelEditCriterion}
                                  className="p-1 text-slate-500 hover:text-slate-800 hover:bg-white rounded-md transition-colors cursor-pointer"
                                  title="Cancelar edição"
                                >
                                  <X className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-between gap-3">
                              <div className="flex items-center gap-2.5 flex-1 min-w-0">
                                <span className="w-5 h-5 rounded-full bg-emerald-50 text-emerald-800 font-mono font-bold flex items-center justify-center text-[10px] shrink-0">
                                  {idx + 1}
                                </span>
                                <span className="font-medium text-slate-800 text-xs break-words">
                                  {item.name}
                                </span>
                              </div>

                              <div className="flex items-center gap-1.5 shrink-0">
                                <label className="flex items-center gap-1 text-[11px] text-slate-500">
                                  <span>Peso:</span>
                                  <input
                                    type="number"
                                    min="1"
                                    max="10"
                                    value={item.weight}
                                    onChange={(e) =>
                                      handleUpdateCriterionWeight(idx, Number(e.target.value) || 1)
                                    }
                                    className="w-10 px-1 py-0.5 text-center font-mono font-bold text-slate-900 border border-slate-200 rounded bg-slate-50"
                                  />
                                </label>

                                <button
                                  type="button"
                                  onClick={() => handleStartEditCriterion(idx)}
                                  className="p-1 text-slate-400 hover:text-emerald-700 hover:bg-emerald-50 rounded transition-colors cursor-pointer"
                                  title="Editar critério"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>

                                <button
                                  type="button"
                                  onClick={() => handleRemoveCriterion(idx)}
                                  className="p-1 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors cursor-pointer"
                                  title="Remover critério"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              {/* BLOCO 3: Exercícios Vinculados (Opcional se formHasExercises for verdadeiro) */}
              {formHasExercises && (
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4.5 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                      3. Exercícios Vinculados ({selectedExerciseIds.length} selecionados)
                    </div>
                    <span className="text-[11px] text-slate-500">
                      {formCell === 'GERAL'
                        ? 'Checklist Geral: você pode vincular exercícios de qualquer célula'
                        : 'Marque os casos práticos a serem simulados'}
                    </span>
                  </div>

                  {/* Barra de Filtros por Célula */}
                  <div className="flex items-center gap-1.5 flex-wrap pt-1 pb-1 border-t border-slate-200/60">
                    <span className="text-[11px] font-semibold text-slate-500 mr-1">Célula:</span>
                    {[
                      { key: 'all', label: 'Todas' },
                      { key: 'LAB', label: 'Laboratório' },
                      { key: 'IMG', label: 'Imagem' },
                      { key: 'CONSULTA', label: 'Consultas' },
                      { key: 'TERAPIA', label: 'Terapias' },
                      { key: 'OPERADORA', label: 'Operadora' },
                    ].map((item) => {
                      const isSel = linkExerciseCellFilter === item.key;
                      return (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => setLinkExerciseCellFilter(item.key as 'all' | OfficialCell)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] transition-colors cursor-pointer ${
                            isSel
                              ? 'bg-[#0f3e2e] text-white border border-[#0f3e2e] font-bold shadow-xs'
                              : 'bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 font-medium'
                          }`}
                        >
                          {item.label}
                        </button>
                      );
                    })}
                  </div>

                  {exercises.length === 0 ? (
                    <div className="p-4 bg-white border border-dashed border-slate-200 rounded-lg text-center text-slate-500">
                      Nenhum exercício cadastrado no sistema ainda. Crie exercícios na aba "Exercícios & Clientes".
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-52 overflow-y-auto pr-1">
                      {exercises
                        .filter((ex) => {
                          if (linkExerciseCellFilter === 'all') return true;
                          return (ex.cell || 'OPERADORA') === linkExerciseCellFilter;
                        })
                        .map((ex) => {
                          const isChecked = selectedExerciseIds.includes(ex.id);
                          return (
                            <label
                              key={ex.id}
                              className={`p-3 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                                isChecked
                                  ? 'bg-emerald-50/80 border-emerald-500 shadow-xs'
                                  : 'bg-white border-slate-200 hover:border-slate-300'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isChecked}
                                onChange={() => handleToggleExercise(ex.id)}
                                className="mt-0.5 rounded text-emerald-700 focus:ring-emerald-500 h-4 w-4"
                              />
                              <div className="min-w-0">
                                <div className="font-bold text-slate-900 text-xs truncate">
                                  {ex.title}
                                </div>
                                <div className="text-[11px] text-slate-500 truncate">
                                  {ex.categoryName || 'Exercício'} · {ex.characterIds.length} cliente(s)
                                </div>
                              </div>
                            </label>
                          );
                        })}
                    </div>
                  )}
                </div>
              )}

              {/* Rodapé e Ações do Formulário */}
              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setModalState({ open: false })}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2 font-bold text-white bg-[#0f3e2e] hover:bg-emerald-900 rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <CheckSquare className="w-4 h-4" />
                  <span>{isSubmitting ? 'Salvando...' : 'Salvar Checklist'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO DE CHECKLIST */}
      {deleteConfirmChecklist && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                Tem certeza que deseja excluir o checklist &ldquo;{deleteConfirmChecklist.title}&rdquo;?
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Os colaboradores vinculados a ele serão desvinculados automaticamente (exclusão em cascata).
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmChecklist(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="px-5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors cursor-pointer shadow-xs"
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
