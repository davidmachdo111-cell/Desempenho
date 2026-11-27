import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  FileText,
  Plus,
  Search,
  Eye,
  Edit3,
  Copy,
  Trash2,
  X,
  CreditCard,
  Download,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
} from 'lucide-react';
import { usePortalStore } from '../../../context/PortalStoreContext';
import { useToast } from '../../../context/ToastContext';
import { GuideMirrorModal } from '../../../components/GuideMirrorModal';
import {
  AttachedGuideViewerModal,
  AttachedGuideViewerData,
} from '../../../components/AttachedGuideViewerModal';
import { downloadGuidePdf, downloadMultipleGuidesPdf } from '../../../lib/downloadHelpers';
import {
  Exercise,
  Character,
  ExerciseDifficulty,
  OfficialCell,
  OFFICIAL_CELLS,
  OFFICIAL_CELL_LIST,
  getCharacterGuides,
  normalizePhrases,
} from '../../../types/portal';
import { CUSTOMER_TIER_BADGES } from '../../characters/views/CharactersManagementView';

export const DIFFICULTY_BADGES: Record<
  ExerciseDifficulty,
  { label: string; bg: string; text: string; border: string }
> = {
  Iniciante: {
    label: 'Iniciante',
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-300',
  },
  Simples: {
    label: 'Simples',
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-300',
  },
  Mediano: {
    label: 'Mediano',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-300',
  },
  Intermediário: {
    label: 'Intermediário',
    bg: 'bg-purple-50',
    text: 'text-purple-800',
    border: 'border-purple-300',
  },
  Crítico: {
    label: 'Crítico',
    bg: 'bg-rose-50',
    text: 'text-rose-800',
    border: 'border-rose-300',
  },
};

export const ExercisesSimulationView: React.FC = () => {
  const {
    exercises,
    characters,
    categories,
    currentUser,
    hasPermission,
    saveExercise,
    deleteExercise,
  } = usePortalStore();
  const { showToast } = useToast();

  const pdfGeneratedBy = currentUser
    ? { fullName: currentUser.fullName, username: currentUser.username }
    : undefined;

  const exerciseCategories = useMemo(
    () => categories.filter((c) => c.type === 'exercise' || c.type === 'geral'),
    [categories]
  );

  const canManageExercises = hasPermission('can_manage_exercises');

  const ITEMS_PER_PAGE = 18;
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDifficultyFilter, setSelectedDifficultyFilter] = useState<string>('all');
  const [selectedCellFilter, setSelectedCellFilter] = useState<string>('all');
  const [sortOrder, setSortOrder] = useState<'recent' | 'alpha'>('recent');
  const [currentPage, setCurrentPage] = useState(1);
  const [briefingModalExercise, setBriefingModalExercise] = useState<Exercise | null>(null);
  const [briefingActiveCharIndex, setBriefingActiveCharIndex] = useState(0);

  const [editorModalExercise, setEditorModalExercise] = useState<{
    open: boolean;
    exercise?: Exercise;
  }>({ open: false });

  const [deleteConfirmExercise, setDeleteConfirmExercise] = useState<Exercise | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, selectedDifficultyFilter, selectedCellFilter, sortOrder]);

  const filteredExercises = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const filtered = exercises.filter((ex) => {
      const exCell = ex.cell || 'OPERADORA';
      if (selectedCellFilter !== 'all' && exCell !== selectedCellFilter) return false;
      const difficulty = ex.difficulty || 'Mediano';
      if (selectedDifficultyFilter !== 'all' && difficulty !== selectedDifficultyFilter) return false;
      if (!q) return true;
      return (
        ex.title.toLowerCase().includes(q) ||
        exCell.toLowerCase().includes(q) ||
        ex.scenarioInstructions.toLowerCase().includes(q) ||
        difficulty.toLowerCase().includes(q)
      );
    });

    const sorted = [...filtered];
    if (sortOrder === 'alpha') {
      sorted.sort((a, b) =>
        a.title.localeCompare(b.title, 'pt-BR', { sensitivity: 'base' })
      );
    } else {
      sorted.sort((a, b) => {
        const timeA = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const timeB = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return timeB - timeA;
      });
    }
    return sorted;
  }, [exercises, searchQuery, selectedDifficultyFilter, selectedCellFilter, sortOrder]);

  const totalPages = Math.max(1, Math.ceil(filteredExercises.length / ITEMS_PER_PAGE));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * ITEMS_PER_PAGE;
  const endIndex = Math.min(startIndex + ITEMS_PER_PAGE, filteredExercises.length);
  const paginatedExercises = useMemo(
    () => filteredExercises.slice(startIndex, endIndex),
    [filteredExercises, startIndex, endIndex]
  );

  const paginationPages = useMemo(() => {
    const pages: (number | 'ellipsis')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);
      if (safePage > 3) pages.push('ellipsis');
      const start = Math.max(2, safePage - 1);
      const end = Math.min(totalPages - 1, safePage + 1);
      for (let i = start; i <= end; i++) pages.push(i);
      if (safePage < totalPages - 2) pages.push('ellipsis');
      pages.push(totalPages);
    }
    return pages;
  }, [totalPages, safePage]);

  // Estados do formulário de criação/edição vinculando até 4 clientes
  const [guideMirrorChar, setGuideMirrorChar] = useState<Character | null>(null);
  const [attachedGuideModal, setAttachedGuideModal] = useState<AttachedGuideViewerData | null>(null);
  const [formTitle, setFormTitle] = useState('');
  const [formCell, setFormCell] = useState<OfficialCell>('OPERADORA');
  const [formDifficulty, setFormDifficulty] = useState<ExerciseDifficulty>('Mediano');
  const [formCategoryId, setFormCategoryId] = useState('');
  const [formCategoryName, setFormCategoryName] = useState('');
  const [formInstructions, setFormInstructions] = useState('');
  const [formLearningObjective, setFormLearningObjective] = useState('');
  const [formSelectedCharacterIds, setFormSelectedCharacterIds] = useState<string[]>([]);
  const [modalCharCellFilter, setModalCharCellFilter] = useState<string>('all');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const openEditor = (exercise?: Exercise) => {
    setModalCharCellFilter('all');
    if (exercise) {
      const matchedCat =
        exerciseCategories.find(
          (c) => c.id === exercise.categoryId || c.name === exercise.categoryName
        ) || exerciseCategories[0];
      setFormTitle(exercise.title);
      setFormCell(exercise.cell || 'OPERADORA');
      setFormDifficulty(exercise.difficulty || 'Mediano');
      setFormCategoryId(exercise.categoryId || matchedCat?.id || '');
      setFormCategoryName(exercise.categoryName || matchedCat?.name || '');
      setFormInstructions(exercise.scenarioInstructions);
      setFormLearningObjective(exercise.learningObjective || '');
      setFormSelectedCharacterIds(exercise.characterIds || []);
      setEditorModalExercise({ open: true, exercise });
    } else {
      setFormTitle('');
      setFormCell('OPERADORA');
      setFormDifficulty('Mediano');
      setFormCategoryId(exerciseCategories[0]?.id || '');
      setFormCategoryName(exerciseCategories[0]?.name || '');
      setFormInstructions('');
      setFormLearningObjective('');
      // Seleciona o primeiro cliente por padrão se houver
      setFormSelectedCharacterIds(characters.slice(0, 1).map((c) => c.id));
      setEditorModalExercise({ open: true });
    }
  };

  const handleToggleCharacter = (charId: string) => {
    setFormSelectedCharacterIds((prev) => {
      if (prev.includes(charId)) {
        return prev.filter((id) => id !== charId);
      }
      if (prev.length >= 4) {
        showToast('Você pode selecionar até no máximo 4 clientes por exercício.', 'error');
        return prev;
      }
      return [...prev, charId];
    });
  };

  const executeSaveExercise = async (keepOpenForNext: boolean) => {
    if (!formTitle.trim()) {
      showToast('Informe o título do exercício.', 'error');
      return;
    }
    if (!formInstructions.trim()) {
      showToast('Informe as instruções e o roteiro geral do caso.', 'error');
      return;
    }
    if (formSelectedCharacterIds.length === 0) {
      showToast('Vincule ao menos 1 cliente ao exercício (máximo 4).', 'error');
      return;
    }

    setIsSubmitting(true);
    const res = await saveExercise({
      id: editorModalExercise.exercise?.id,
      title: formTitle.trim(),
      cell: formCell,
      difficulty: formDifficulty,
      categoryId: formCategoryId || undefined,
      categoryName: formCategoryName || undefined,
      scenarioInstructions: formInstructions.trim(),
      learningObjective: formLearningObjective.trim() || undefined,
      characterIds: formSelectedCharacterIds.slice(0, 4),
    });
    setIsSubmitting(false);

    if (res.success) {
      if (keepOpenForNext && !editorModalExercise.exercise) {
        showToast(
          'Exercício salvo com sucesso! Preencha os dados do próximo cenário.',
          'success'
        );
        setFormTitle('');
        setFormInstructions('');
        setFormLearningObjective('');
        setFormSelectedCharacterIds([]);
        setModalCharCellFilter('all');
        setTimeout(() => titleInputRef.current?.focus(), 50);
      } else {
        showToast(
          editorModalExercise.exercise
            ? 'Exercício atualizado com sucesso!'
            : 'Novo exercício criado com sucesso e pronto para uso!',
          'success'
        );
        setEditorModalExercise({ open: false });
      }
    } else {
      showToast(res.message, 'error');
    }
  };

  const handleSaveExercise = async (e: React.FormEvent) => {
    e.preventDefault();
    await executeSaveExercise(false);
  };

  const handleDuplicateExercise = async (exercise: Exercise) => {
    const res = await saveExercise({
      title: `${exercise.title} (Cópia)`,
      cell: (exercise.cell as OfficialCell) || 'OPERADORA',
      difficulty: exercise.difficulty || 'Mediano',
      categoryId: exercise.categoryId,
      categoryName: exercise.categoryName,
      scenarioInstructions: exercise.scenarioInstructions,
      learningObjective: exercise.learningObjective,
      characterIds: [...exercise.characterIds],
      attachments: exercise.attachments ? [...exercise.attachments] : undefined,
      attachmentUrl: exercise.attachmentUrl ?? null,
      attachmentName: exercise.attachmentName ?? null,
    });

    if (res.success) {
      showToast(`Exercício "${exercise.title} (Cópia)" criado com sucesso!`, 'success');
    } else {
      showToast(res.message, 'error');
    }
  };

  const handleDeleteExerciseConfirm = async () => {
    if (!deleteConfirmExercise) return;
    const res = await deleteExercise(deleteConfirmExercise.id);
    setDeleteConfirmExercise(null);

    if (res.success) {
      showToast('Exercício removido com sucesso.', 'success');
    } else {
      showToast(res.message, 'error');
    }
  };

  // Clientes do briefing ativo
  const briefingCharacters = useMemo(() => {
    if (!briefingModalExercise) return [];
    return briefingModalExercise.characterIds
      .map((id) => characters.find((c) => c.id === id))
      .filter(Boolean) as Character[];
  }, [briefingModalExercise, characters]);

  const activeBriefingChar = briefingCharacters[briefingActiveCharIndex] || briefingCharacters[0];

  return (
    <div className="space-y-6">
      {/* Header Corporativo do Módulo */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold uppercase tracking-wider mb-1">
            <FileText className="w-4 h-4 text-emerald-600" />
            <span>Módulo 3 · Cenários de Roleplay</span>
          </div>
          <h1 className="text-2xl font-bold font-display text-slate-900 tracking-tight">
            Exercícios de Simulação
          </h1>
          <p className="text-xs text-slate-600 mt-1 max-w-2xl">
            Crie roteiros práticos de atendimento vinculando até 4 clientes do Banco de Clientes com suas respectivas carteirinhas, classificações e guias anexas.
          </p>
        </div>

        {canManageExercises && (
          <button
            type="button"
            onClick={() => openEditor()}
            className="px-5 py-2.5 text-xs font-bold text-white bg-[#0f3e2e] hover:bg-emerald-900 rounded-xl transition-all shadow-sm flex items-center gap-2 cursor-pointer shrink-0"
          >
            <Plus className="w-4 h-4" />
            <span>+ Novo Exercício</span>
          </button>
        )}
      </div>

      {/* Barra de Filtros e Busca */}
      <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs space-y-3">
        {/* Filtro por Célula (Botões de Filtro / Pills) */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-800 uppercase tracking-wide">
              Célula:
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

        {/* Linha de Busca, Dificuldade e Ordenação */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3 pt-0.5">
          <div className="relative w-full lg:w-96">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por caso, instruções ou dificuldade..."
              className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
            />
          </div>

          <div className="flex items-center gap-2.5 flex-wrap w-full lg:w-auto justify-start lg:justify-end">
            <div className="flex items-center gap-1.5">
              <span className="text-xs font-medium text-slate-600">Dificuldade:</span>
              <select
                value={selectedDifficultyFilter}
                onChange={(e) => setSelectedDifficultyFilter(e.target.value)}
                className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="all">Todas as Dificuldades</option>
                <option value="Iniciante">Iniciante</option>
                <option value="Simples">Simples</option>
                <option value="Mediano">Mediano</option>
                <option value="Intermediário">Intermediário</option>
                <option value="Crítico">Crítico</option>
              </select>
            </div>

            <div className="flex items-center gap-1.5">
              <ArrowUpDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <select
                value={sortOrder}
                onChange={(e) => setSortOrder(e.target.value as 'recent' | 'alpha')}
                aria-label="Ordenar exercícios"
                className="text-xs bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 font-medium text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
              >
                <option value="recent">Mais Recentes</option>
                <option value="alpha">Ordem Alfabética A–Z</option>
              </select>
            </div>

            <div className="text-xs text-slate-500 font-semibold pl-1">
              {filteredExercises.length} exercício(s)
            </div>
          </div>
        </div>
      </div>

      {/* Grid de Cards de Exercícios */}
      {filteredExercises.length > 0 ? (
        <div className="space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {paginatedExercises.map((exercise) => {
            const diffBadge =
              DIFFICULTY_BADGES[exercise.difficulty || 'Mediano'] ||
              DIFFICULTY_BADGES['Mediano'];

            const cellKey = (exercise.cell as OfficialCell) || 'OPERADORA';
            const cellInfo = OFFICIAL_CELLS[cellKey] || OFFICIAL_CELLS['OPERADORA'];

            // Busca os clientes vinculados
            const linkedCharacters = exercise.characterIds
              .map((id) => characters.find((c) => c.id === id))
              .filter(Boolean) as Character[];

            return (
              <div
                key={exercise.id}
                className="bg-white border border-slate-200 hover:border-emerald-500 rounded-2xl p-5 flex flex-col justify-between shadow-xs hover:shadow-md transition-all group space-y-4"
              >
                <div className="space-y-3.5">
                  {/* Badge da Célula & Dificuldade & Título */}
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span
                        className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold border border-slate-200 bg-slate-50 text-slate-700 uppercase tracking-wider"
                        title={`Célula do Exercício: ${cellInfo.name}`}
                      >
                        {cellInfo.name}
                      </span>
                      <span
                        className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border uppercase tracking-wider whitespace-nowrap ${diffBadge.bg} ${diffBadge.text} ${diffBadge.border}`}
                      >
                        {diffBadge.label}
                      </span>
                    </div>
                    <span className="text-[11px] text-slate-400 font-medium">
                      {linkedCharacters.length} cliente(s)
                    </span>
                  </div>

                  <h3 className="font-bold text-base text-slate-900 group-hover:text-emerald-900 transition-colors leading-snug">
                    {exercise.title}
                  </h3>

                  {/* Cenário / Instruções */}
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 space-y-1">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Instruções do Caso:
                    </span>
                    <p className="text-xs text-slate-700 line-clamp-3 leading-relaxed">
                      {exercise.scenarioInstructions}
                    </p>
                  </div>

                  {/* Lista de Clientes Vinculados com Badge de Classificação e Carteirinha */}
                  <div className="space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
                      Clientes Vinculados ({linkedCharacters.length}/4):
                    </span>
                    <div className="space-y-1.5">
                      {linkedCharacters.map((char) => {
                        const tierBadge =
                          CUSTOMER_TIER_BADGES[char.customerTier || 'Mediano'] ||
                          CUSTOMER_TIER_BADGES['Mediano'];

                        return (
                          <div
                            key={char.id}
                            className="flex items-center justify-between p-2 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200/80 text-xs transition-colors"
                          >
                            <div className="flex items-center gap-2 truncate pr-2">
                              <div className="w-6 h-6 rounded-md bg-[#0f3e2e] text-white flex items-center justify-center font-bold text-[10px] shrink-0">
                                {char.name.charAt(0)}
                              </div>
                              <div className="truncate">
                                <span className="font-bold text-slate-900 truncate block text-[11px]">
                                  {char.name}
                                </span>
                                <span className="text-[10px] font-mono text-slate-500 flex items-center gap-1">
                                  <CreditCard className="w-3 h-3 text-slate-400" />
                                  <span>{char.cardNumber || 'Sem carteirinha'}</span>
                                </span>
                              </div>
                            </div>

                            <span
                              className={`text-[9px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap shrink-0 ${tierBadge.bg} ${tierBadge.text} ${tierBadge.border}`}
                            >
                              {tierBadge.label}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* Rodapé do Card com Ações */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setBriefingActiveCharIndex(0);
                      setBriefingModalExercise(exercise);
                    }}
                    className="flex-1 py-2 px-3 text-xs font-bold text-emerald-800 bg-emerald-50 hover:bg-emerald-100 rounded-lg flex items-center justify-center gap-1.5 transition-colors cursor-pointer shadow-2xs"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Ver Roteiro</span>
                  </button>

                  {canManageExercises && (
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleDuplicateExercise(exercise)}
                        className="px-2.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                        title="Duplicar Exercício"
                      >
                        <Copy className="w-3.5 h-3.5" />
                        <span>Duplicar</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => openEditor(exercise)}
                        className="p-2 text-slate-400 hover:text-emerald-800 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                        title="Editar Exercício"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmExercise(exercise)}
                        className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                        title="Excluir Exercício"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          </div>

          {/* Paginação Limpa (18 exercícios por página) */}
          <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="text-xs text-slate-600 font-medium">
              Mostrando{' '}
              <span className="font-bold text-slate-900">
                {startIndex + 1}–{endIndex}
              </span>{' '}
              de <span className="font-bold text-slate-900">{filteredExercises.length}</span>{' '}
              exercícios
            </div>

            {totalPages > 1 && (
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={safePage === 1}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-1 cursor-pointer"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span>Anterior</span>
                </button>

                {paginationPages.map((pageItem, idx) =>
                  pageItem === 'ellipsis' ? (
                    <span
                      key={`ellipsis-${idx}`}
                      className="px-2 py-1 text-xs text-slate-400 font-bold select-none"
                    >
                      …
                    </span>
                  ) : (
                    <button
                      key={pageItem}
                      type="button"
                      onClick={() => setCurrentPage(pageItem)}
                      className={`min-w-[32px] px-2.5 py-1.5 text-xs font-bold rounded-lg border transition-colors cursor-pointer ${
                        safePage === pageItem
                          ? 'bg-[#0f3e2e] text-white border-[#0f3e2e] shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {pageItem}
                    </button>
                  )
                )}

                <button
                  type="button"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={safePage === totalPages}
                  className="px-3 py-1.5 text-xs font-bold rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-1 cursor-pointer"
                >
                  <span>Próxima</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-xs">
          <FileText className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-base font-bold text-slate-900">Nenhum exercício encontrado</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-5">
            Cadastre um novo caso prático de atendimento e vincule clientes do Banco de Clientes.
          </p>
          {canManageExercises && (
            <button
              type="button"
              onClick={() => openEditor()}
              className="px-4 py-2 text-xs font-bold text-white bg-[#0f3e2e] hover:bg-emerald-900 rounded-xl transition-colors cursor-pointer"
            >
              Criar Primeiro Exercício
            </button>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: VISUALIZADOR DE BRIEFING DO EXERCÍCIO COM CLIENTES */}
      {/* ========================================================= */}
      {briefingModalExercise && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-3xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
            <div className="px-6 py-4 bg-[#0f3e2e] text-white flex items-center justify-between shrink-0">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                  Roteiro do Atendimento · Dificuldade {briefingModalExercise.difficulty || 'Mediano'}
                </span>
                <h3 className="font-bold text-base text-white mt-0.5">
                  {briefingModalExercise.title}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setBriefingModalExercise(null)}
                  className="text-emerald-200 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div id="printable-roteiro" className="p-6 overflow-y-auto space-y-6 flex-1 text-xs font-sans print:p-8">
              {/* Cabeçalho impresso oficial */}
              <div className="hidden print:block border-b-2 border-emerald-900 pb-3 mb-4">
                <div className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  Portal de Desempenho & Desenvolvimento Operacional
                </div>
                <h1 className="text-xl font-black text-slate-900 mt-0.5">
                  ROTEIRO DE ATENDIMENTO SIMULADO
                </h1>
                <div className="text-xs text-slate-600 mt-1 flex items-center gap-3">
                  <span><strong>Caso:</strong> {briefingModalExercise.title}</span>
                  <span>•</span>
                  <span><strong>Dificuldade:</strong> {briefingModalExercise.difficulty || 'Mediano'}</span>
                </div>
              </div>

              {/* Orientações Gerais do Caso */}
              <div className="bg-emerald-50/50 border border-emerald-200/60 rounded-xl p-4.5 space-y-1.5">
                <span className="text-[11px] font-bold text-emerald-900 uppercase tracking-wider block">
                  Orientações do Caso de Simulação:
                </span>
                <p className="text-slate-800 leading-relaxed text-xs">
                  {briefingModalExercise.scenarioInstructions}
                </p>
              </div>

              {/* Abas dos Clientes Vinculados (Na tela interativa) */}
              <div className="space-y-4">
                <div className="flex items-center justify-between border-b border-slate-200 pb-2 print:hidden">
                  <span className="font-bold text-slate-900 text-sm">
                    Clientes Participantes ({briefingCharacters.length})
                  </span>
                  <div className="flex items-center gap-1.5">
                    {briefingCharacters.map((char, idx) => (
                      <button
                        key={char.id}
                        type="button"
                        onClick={() => setBriefingActiveCharIndex(idx)}
                        className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                          briefingActiveCharIndex === idx
                            ? 'bg-[#0f3e2e] text-white shadow-2xs'
                            : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                        }`}
                      >
                        {char.name.split(' ')[0]}
                      </button>
                    ))}
                  </div>
                </div>

                {activeBriefingChar && (
                  <div className="bg-slate-50 border border-slate-200 rounded-xl p-5 space-y-3.5 print:bg-white print:border-slate-300">
                    {/* Topo do Cliente */}
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="text-base font-bold text-slate-900">
                            {activeBriefingChar.name}
                          </h4>
                          {(() => {
                            const charCellKey = (activeBriefingChar.cell as OfficialCell) || 'OPERADORA';
                            const charCellInfo = OFFICIAL_CELLS[charCellKey] || OFFICIAL_CELLS['OPERADORA'];
                            return (
                              <span
                                className="px-2 py-0.5 rounded-md text-[10px] font-bold border border-slate-200 bg-slate-50 text-slate-700 uppercase tracking-wider"
                                title={`Célula de Atendimento: ${charCellInfo.name}`}
                              >
                                {charCellInfo.name}
                              </span>
                            );
                          })()}
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                              CUSTOMER_TIER_BADGES[activeBriefingChar.customerTier || 'Mediano']?.bg
                            } ${
                              CUSTOMER_TIER_BADGES[activeBriefingChar.customerTier || 'Mediano']?.text
                            } ${
                              CUSTOMER_TIER_BADGES[activeBriefingChar.customerTier || 'Mediano']?.border
                            }`}
                          >
                            {activeBriefingChar.customerTier || 'Mediano'}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-2 mt-1">
                          <span>{activeBriefingChar.age}</span>
                          <span>·</span>
                          <span>{activeBriefingChar.gender}</span>
                          <span>·</span>
                          <span>{activeBriefingChar.city}</span>
                        </div>
                      </div>

                      <div className="bg-white border border-slate-200 px-3 py-1.5 rounded-lg text-right">
                        <span className="text-[10px] text-slate-400 block font-bold uppercase">
                          Carteirinha
                        </span>
                        <span className="font-mono font-bold text-slate-800 text-xs">
                          {activeBriefingChar.cardNumber}
                        </span>
                      </div>
                    </div>

                    {/* Contexto do Atendimento */}
                    <p className="text-slate-700 leading-relaxed text-xs">
                      <strong>Contexto:</strong> {activeBriefingChar.serviceContext || activeBriefingChar.history}
                    </p>

                    <p className="text-slate-700 leading-relaxed text-xs">
                      <strong>Humor:</strong> {activeBriefingChar.temperament}
                    </p>

                    <p className="text-slate-700 leading-relaxed text-xs">
                      <strong>Objetivo:</strong> {activeBriefingChar.objectives}
                    </p>

                    {/* Falas e Objeções em Tópicos Dinâmicos (Bullet Points) */}
                    {(() => {
                      const phrases = normalizePhrases(activeBriefingChar.typicalPhrases);
                      if (phrases.length === 0) return null;
                      return (
                        <div className="space-y-1.5 p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-lg">
                          <span className="text-[10px] font-bold text-emerald-950 uppercase tracking-wider block">
                            Falas e Objeções Típicas do Cliente:
                          </span>
                          <ul className="space-y-1.5 text-slate-800 text-xs">
                            {phrases.map((phrase, idx) => (
                              <li key={idx} className="flex items-start gap-2">
                                <span className="text-emerald-700 font-bold shrink-0">•</span>
                                <span className="italic leading-relaxed font-medium">&ldquo;{phrase}&rdquo;</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })()}

                    {/* Guia do Cliente Anexa */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between p-3 bg-white rounded-lg border border-emerald-200 print:hidden gap-2">
                      {(() => {
                        const charGuides = getCharacterGuides(activeBriefingChar);
                        return (
                          <>
                            <div className="flex items-center gap-2.5 min-w-0">
                              <FileText className="w-5 h-5 text-emerald-700 shrink-0" />
                              <div className="min-w-0">
                                <span className="font-bold text-slate-800 block truncate">
                                  {charGuides.length === 0
                                    ? 'Guia de Atendimento do Paciente'
                                    : charGuides.length === 1
                                    ? charGuides[0].name
                                    : `${charGuides.length} Guias Médicas Anexadas`}
                                </span>
                                <span className="text-[10px] text-slate-500">
                                  Documento técnico e requisição médica do beneficiário
                                </span>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 shrink-0 flex-wrap">
                              {charGuides.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setAttachedGuideModal({
                                      title: `${
                                        charGuides.length > 1 ? 'Guias Médicas' : 'Guia Médica'
                                      } · ${activeBriefingChar.name}`,
                                      subtitle: `${briefingModalExercise?.title || ''}${
                                        activeBriefingChar.cardNumber
                                          ? ` · Carteirinha ${activeBriefingChar.cardNumber}`
                                          : ''
                                      }`,
                                      guides: charGuides,
                                    })
                                  }
                                  className="px-3 py-1.5 text-xs font-bold text-white bg-[#0f3e2e] hover:bg-emerald-900 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                >
                                  <FileText className="w-3.5 h-3.5 text-emerald-200" />
                                  <span>
                                    {charGuides.length > 1
                                      ? `Visualizar Guias (${charGuides.length})`
                                      : 'Visualizar Guia Médica'}
                                  </span>
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => setGuideMirrorChar(activeBriefingChar)}
                                className="px-3 py-1.5 text-xs font-bold text-emerald-900 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>Visualizar Ficha</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => downloadGuidePdf(activeBriefingChar, briefingModalExercise?.title, pdfGeneratedBy)}
                                className="px-3 py-1.5 text-xs font-bold text-white bg-[#064e3b] hover:bg-emerald-900 rounded-lg transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
                                title={`Baixar Cliente_${activeBriefingChar.name.replace(/\s+/g, '_')}.pdf`}
                              >
                                <Download className="w-3.5 h-3.5 text-emerald-200" />
                                <span>Baixar PDF</span>
                              </button>
                            </div>
                          </>
                        );
                      })()}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              {briefingCharacters.length > 1 ? (
                <button
                  type="button"
                  onClick={() => downloadMultipleGuidesPdf(briefingCharacters, briefingModalExercise?.title, undefined, pdfGeneratedBy)}
                  className="px-4 py-2 font-bold text-xs text-white bg-[#064e3b] hover:bg-emerald-900 rounded-xl transition-all shadow-xs flex items-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4 text-emerald-200" />
                  <span>Imprimir Todos ({briefingCharacters.length}) em PDF Único</span>
                </button>
              ) : <div />}
              <button
                type="button"
                onClick={() => setBriefingModalExercise(null)}
                className="px-5 py-2 font-bold text-slate-700 hover:bg-slate-200 rounded-xl transition-colors cursor-pointer text-xs"
              >
                Fechar Roteiro
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: CRIADOR / EDITOR DE EXERCÍCIO */}
      {/* ========================================================= */}
      {editorModalExercise.open && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] flex flex-col">
            <div className="px-6 py-4 bg-[#0f3e2e] text-white flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-base">
                  {editorModalExercise.exercise ? 'Editar Exercício' : '+ Novo Exercício de Simulação'}
                </h3>
                <p className="text-[11px] text-emerald-200">
                  Defina a dificuldade e vincule até 4 clientes do Banco de Clientes
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditorModalExercise({ open: false })}
                className="text-emerald-200 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveExercise} className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
              {/* Título, Célula do Exercício & Dificuldade */}
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Título do Exercício / Caso *
                  </label>
                  <input
                    ref={titleInputRef}
                    type="text"
                    required
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    placeholder="Ex: Simulação de Atendimento SAC - Troca de Guia de Exame"
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Célula do Exercício *
                  </label>
                  <select
                    required
                    value={formCell}
                    onChange={(e) => setFormCell(e.target.value as OfficialCell)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-slate-900"
                  >
                    {OFFICIAL_CELL_LIST.map((cellKey) => {
                      const meta = OFFICIAL_CELLS[cellKey];
                      return (
                        <option key={cellKey} value={cellKey}>
                          {meta.name}
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-bold text-slate-800 mb-1">
                    Dificuldade *
                  </label>
                  <select
                    value={formDifficulty}
                    onChange={(e) => setFormDifficulty(e.target.value as ExerciseDifficulty)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-emerald-900"
                  >
                    <option value="Iniciante">Iniciante</option>
                    <option value="Simples">Simples</option>
                    <option value="Mediano">Mediano</option>
                    <option value="Intermediário">Intermediário</option>
                    <option value="Crítico">Crítico</option>
                  </select>
                </div>
              </div>

              {/* Categoria Padronizada */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Categoria Padronizada
                </label>
                <select
                  value={formCategoryName}
                  disabled={exerciseCategories.length === 0}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFormCategoryName(val);
                    const matched = exerciseCategories.find((c) => c.name === val);
                    setFormCategoryId(matched?.id || '');
                  }}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-900 disabled:bg-slate-100 disabled:text-slate-500"
                >
                  {exerciseCategories.length === 0 ? (
                    <option value="">Nenhuma categoria disponível</option>
                  ) : (
                    <>
                      {formCategoryName &&
                        !exerciseCategories.some((c) => c.name === formCategoryName) && (
                          <option value={formCategoryName}>{formCategoryName}</option>
                        )}
                      {exerciseCategories.map((cat) => (
                        <option key={cat.id} value={cat.name}>
                          {cat.name}
                        </option>
                      ))}
                    </>
                  )}
                </select>
                {exerciseCategories.length === 0 && (
                  <p className="text-[11px] text-amber-700 mt-1">
                    Nenhuma categoria disponível. O cadastro de categorias é realizado em{' '}
                    <strong>Administração &gt; Categorias</strong>.
                  </p>
                )}
              </div>

              {/* Instruções do Caso (Uso Interno — Avaliador / Ator) */}
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Instruções e Roteiro Geral do Caso (Uso Interno — Avaliador/Ator) *
                </label>
                <textarea
                  rows={3}
                  required
                  value={formInstructions}
                  onChange={(e) => setFormInstructions(e.target.value)}
                  placeholder="Orientações internas para o avaliador e ator durante a condução deste exercício (não exibido ao colaborador)..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* Objetivo de Aprendizado — Visível ao Colaborador */}
              <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-3.5 space-y-1.5">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <label className="block text-xs font-bold text-emerald-950">
                    Objetivo de Aprendizado — Visível ao Colaborador
                  </label>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-white text-emerald-800 border border-emerald-200">
                    Exibido no Diário de Aprendizado
                  </span>
                </div>
                <textarea
                  rows={2}
                  value={formLearningObjective}
                  onChange={(e) => setFormLearningObjective(e.target.value)}
                  placeholder="Ex: Neste exercício, você vai aprender como realizar um agendamento 0242 particular"
                  className="w-full px-3 py-2 bg-white border border-emerald-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800 placeholder-slate-400"
                />
                <p className="text-[11px] text-emerald-900/80 leading-relaxed">
                  Apenas o título do exercício e este objetivo ficam visíveis ao colaborador na trilha para ele registrar o que aprendeu — dados do cliente e roteiro do ator permanecem sigilosos.
                </p>
              </div>

              {/* Seleção de Clientes (Até 4) com Filtro por Célula */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <span className="font-bold text-slate-800 text-xs block">
                      Vincular Clientes do Banco ({formSelectedCharacterIds.length}/4) *
                    </span>
                    <p className="text-[11px] text-slate-500">
                      Marque até 4 clientes que participarão deste caso prático.
                    </p>
                  </div>
                  <span className="text-[11px] font-bold text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full shrink-0">
                    {formSelectedCharacterIds.length} selecionado(s)
                  </span>
                </div>

                {/* Filtro por Célula na seleção de clientes do modal */}
                <div className="flex items-center gap-1.5 flex-wrap pt-1 border-t border-slate-200/60">
                  <span className="text-[11px] font-semibold text-slate-600 mr-1">Filtrar por Célula:</span>
                  <button
                    type="button"
                    onClick={() => setModalCharCellFilter('all')}
                    className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer border ${
                      modalCharCellFilter === 'all'
                        ? 'bg-[#0f3e2e] text-white border-[#0f3e2e]'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    Todas
                  </button>
                  {OFFICIAL_CELL_LIST.map((cKey) => {
                    const meta = OFFICIAL_CELLS[cKey];
                    const isSel = modalCharCellFilter === cKey;
                    return (
                      <button
                        key={cKey}
                        type="button"
                        onClick={() => setModalCharCellFilter(cKey)}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold transition-colors cursor-pointer border ${
                          isSel
                            ? 'bg-[#0f3e2e] text-white border-[#0f3e2e]'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {meta.name}
                      </button>
                    );
                  })}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-56 overflow-y-auto p-1">
                  {characters
                    .filter((char) => {
                      if (modalCharCellFilter !== 'all') {
                        return (char.cell || 'OPERADORA') === modalCharCellFilter;
                      }
                      return true;
                    })
                    .map((char) => {
                      const isSelected = formSelectedCharacterIds.includes(char.id);
                      const tierBadge =
                        CUSTOMER_TIER_BADGES[char.customerTier || 'Mediano'] ||
                        CUSTOMER_TIER_BADGES['Mediano'];
                      const charCellKey = (char.cell as OfficialCell) || 'OPERADORA';
                      const charCellInfo = OFFICIAL_CELLS[charCellKey] || OFFICIAL_CELLS['OPERADORA'];

                      return (
                        <div
                          key={char.id}
                          onClick={() => handleToggleCharacter(char.id)}
                          className={`p-2.5 rounded-xl border flex items-center justify-between gap-2 cursor-pointer transition-all ${
                            isSelected
                              ? 'bg-emerald-50 border-emerald-400 shadow-xs'
                              : 'bg-white border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 truncate">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => {}}
                              className="rounded text-emerald-600 focus:ring-emerald-500 pointer-events-none"
                            />
                            <div className="truncate">
                              <span className="font-bold text-slate-900 block truncate text-xs">
                                {char.name}
                              </span>
                              <span className="text-[10px] text-slate-500 font-mono">
                                {char.cardNumber || 'Sem carteirinha'}
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-1 shrink-0">
                            <span
                              className="text-[9px] font-bold px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 text-slate-700 uppercase"
                            >
                              {charCellInfo.name}
                            </span>
                            <span
                              className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full border ${tierBadge.bg} ${tierBadge.text} ${tierBadge.border}`}
                            >
                              {tierBadge.label}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>

              <div className="pt-2 flex flex-wrap items-center justify-end gap-2.5 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditorModalExercise({ open: false })}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                {!editorModalExercise.exercise && (
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={() => void executeSaveExercise(true)}
                    className="px-4 py-2.5 font-bold text-[#0f3e2e] bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                    <span>{isSubmitting ? 'Salvando...' : 'Salvar e Criar Próximo'}</span>
                  </button>
                )}
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 font-bold text-white bg-[#0f3e2e] hover:bg-emerald-900 rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <Plus className="w-4 h-4" />
                  <span>{isSubmitting ? 'Salvando...' : 'Salvar Exercício'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {deleteConfirmExercise && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                Excluir &ldquo;{deleteConfirmExercise.title}&rdquo;?
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Este exercício será removido dos checklists e simulações sem quebrar os históricos já concluídos.
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmExercise(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteExerciseConfirm}
                className="px-5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors cursor-pointer shadow-xs"
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Espelho Oficial da Guia */}
      <GuideMirrorModal
        character={guideMirrorChar}
        exerciseTitle={briefingModalExercise?.title}
        onClose={() => setGuideMirrorChar(null)}
      />

      {/* Visualizador Popup de Guias Médicas Anexadas */}
      <AttachedGuideViewerModal
        attachment={attachedGuideModal}
        onClose={() => setAttachedGuideModal(null)}
      />
    </div>
  );
};
