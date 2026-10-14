import React, { useState, useMemo } from 'react';
import {
  GraduationCap,
  Plus,
  BookOpen,
  CheckCircle2,
  AlertCircle,
  Users,
  X,
  Trash2,
  Edit3,
  SlidersHorizontal,
  Layers,
  ArrowRight,
  ClipboardCheck,
  Building2,
  Calendar,
  CheckSquare,
  Square,
  Sparkles,
} from 'lucide-react';
import { usePortalStore } from '../../../context/PortalStoreContext';
import {
  LearningTrack,
  Collaborator,
  Checklist,
  Survey,
  CLEAN_CELL_NAMES,
  getCellName,
} from '../../../types/portal';

export const TracksManagementView: React.FC = () => {
  const {
    learningTracks,
    checklists,
    collaborators,
    collaboratorChecklists,
    surveys,
    createLearningTrack,
    updateLearningTrack,
    deleteLearningTrack,
    enrollCollaboratorInTrack,
    unenrollCollaboratorFromTrack,
  } = usePortalStore();

  const [selectedCellFilter, setSelectedCellFilter] = useState('Todas');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  // Modal Construtor de Trilha
  const [showBuilderModal, setShowBuilderModal] = useState(false);
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
  const [builderTitle, setBuilderTitle] = useState('');
  const [builderCell, setBuilderCell] = useState('Laboratório');
  const [builderDescription, setBuilderDescription] = useState('');
  const [builderChecklistIds, setBuilderChecklistIds] = useState<string[]>([]);
  const [builderSurveyId, setBuilderSurveyId] = useState<string>('');
  const [builderCollaboratorIds, setBuilderCollaboratorIds] = useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal de Matrícula
  const [enrollModalTrack, setEnrollModalTrack] = useState<LearningTrack | null>(null);

  // Modal de Confirmação de Exclusão
  const [deleteConfirmTrack, setDeleteConfirmTrack] = useState<LearningTrack | null>(null);

  // Filtragem
  const filteredTracks = useMemo(() => {
    if (selectedCellFilter === 'Todas') return learningTracks;
    return learningTracks.filter(
      (t) => getCellName(t.cell) === selectedCellFilter || t.cell === selectedCellFilter
    );
  }, [learningTracks, selectedCellFilter]);

  // Métricas
  const totalEnrolled = useMemo(() => {
    const ids = new Set<string>();
    learningTracks.forEach((t) => t.collaboratorIds.forEach((id) => ids.add(id)));
    return ids.size;
  }, [learningTracks]);

  const handleOpenCreate = () => {
    setEditingTrackId(null);
    setBuilderTitle('');
    setBuilderCell('Laboratório');
    setBuilderDescription('');
    setBuilderChecklistIds(checklists.slice(0, 3).map((c) => c.id));
    setBuilderSurveyId(surveys[0]?.id || '');
    setBuilderCollaboratorIds([]);
    setShowBuilderModal(true);
  };

  const handleOpenEdit = (track: LearningTrack) => {
    setEditingTrackId(track.id);
    setBuilderTitle(track.title);
    setBuilderCell(getCellName(track.cell));
    setBuilderDescription(track.description);
    setBuilderChecklistIds([...track.checklistIds]);
    setBuilderSurveyId(track.surveyId || '');
    setBuilderCollaboratorIds([...track.collaboratorIds]);
    setShowBuilderModal(true);
  };

  const toggleChecklistInBuilder = (chkId: string) => {
    setBuilderChecklistIds((prev) =>
      prev.includes(chkId) ? prev.filter((id) => id !== chkId) : [...prev, chkId]
    );
  };

  const toggleCollaboratorInBuilder = (collabId: string) => {
    setBuilderCollaboratorIds((prev) =>
      prev.includes(collabId) ? prev.filter((id) => id !== collabId) : [...prev, collabId]
    );
  };

  const handleSaveTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!builderTitle.trim()) {
      setFeedback({ type: 'error', text: 'Informe o título da trilha de aprendizagem.' });
      return;
    }

    if (builderChecklistIds.length === 0) {
      setFeedback({
        type: 'error',
        text: 'Selecione pelo menos 1 checklist para compor as etapas da trilha.',
      });
      return;
    }

    setIsSubmitting(true);
    let res;
    if (editingTrackId) {
      res = await updateLearningTrack(editingTrackId, {
        title: builderTitle.trim(),
        cell: builderCell,
        description: builderDescription.trim(),
        checklistIds: builderChecklistIds,
        surveyId: builderSurveyId || undefined,
        collaboratorIds: builderCollaboratorIds,
      });
    } else {
      res = await createLearningTrack({
        title: builderTitle.trim(),
        cell: builderCell,
        description: builderDescription.trim(),
        checklistIds: builderChecklistIds,
        surveyId: builderSurveyId || undefined,
        collaboratorIds: builderCollaboratorIds,
      });
    }
    setIsSubmitting(false);

    if (res.success) {
      setFeedback({
        type: 'success',
        text: editingTrackId ? 'Trilha atualizada com sucesso!' : 'Trilha de aprendizagem criada com sucesso!',
      });
      setShowBuilderModal(false);
    } else {
      setFeedback({ type: 'error', text: res.message });
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmTrack) return;
    const res = await deleteLearningTrack(deleteConfirmTrack.id);
    setDeleteConfirmTrack(null);
    if (res.success) {
      setFeedback({ type: 'success', text: 'Trilha excluída com sucesso.' });
    } else {
      setFeedback({ type: 'error', text: res.message });
    }
  };

  const handleToggleEnrollment = async (trackId: string, collabId: string, isCurrentlyEnrolled: boolean) => {
    if (isCurrentlyEnrolled) {
      const res = await unenrollCollaboratorFromTrack(trackId, collabId);
      if (res.success) {
        setFeedback({ type: 'success', text: 'Colaborador desmatriculado da trilha.' });
      }
    } else {
      const res = await enrollCollaboratorInTrack(trackId, collabId);
      if (res.success) {
        setFeedback({ type: 'success', text: 'Colaborador matriculado na trilha com sucesso!' });
      }
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Feedback */}
      {feedback && (
        <div
          className={`p-4 rounded-xl flex items-center justify-between shadow-sm animate-in fade-in duration-200 text-xs font-medium border ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
              : 'bg-red-50 text-red-900 border-red-200'
          }`}
        >
          <div className="flex items-center gap-2">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
            )}
            <span>{feedback.text}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedback(null)}
            className="text-slate-400 hover:text-slate-600 font-bold ml-4"
          >
            ✕
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-[#0f3e2e] flex items-center justify-center">
              <GraduationCap className="w-5 h-5 text-emerald-700" />
            </div>
            <h1 className="text-xl font-bold font-display text-slate-900">
              Trilhas de Aprendizagem & Capacitação
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Construa jornadas modulares de desenvolvimento integrando múltiplos checklists, critérios avaliativos e pesquisas de satisfação finais.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="px-4 py-2.5 bg-[#0f3e2e] hover:bg-emerald-900 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>+ Nova Trilha</span>
        </button>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Trilhas Estruturadas
            </div>
            <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
              {learningTracks.length}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-700">
            <Layers className="w-5 h-5 text-emerald-700" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Colaboradores Matriculados
            </div>
            <div className="text-2xl font-bold font-mono text-emerald-800 mt-1">
              {totalEnrolled}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-800">
            <Users className="w-5 h-5 text-emerald-700" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Etapas Totais de Avaliação
            </div>
            <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
              {learningTracks.reduce((acc, t) => acc + t.checklistIds.length, 0)}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-700">
            <BookOpen className="w-5 h-5 text-emerald-700" />
          </div>
        </div>
      </div>

      {/* Barra de Filtros por Célula */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        <button
          type="button"
          onClick={() => setSelectedCellFilter('Todas')}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
            selectedCellFilter === 'Todas'
              ? 'bg-[#0f3e2e] text-white shadow-xs'
              : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
          }`}
        >
          Todas as Trilhas
        </button>

        {CLEAN_CELL_NAMES.map((cellName) => {
          const isActive = selectedCellFilter === cellName;
          return (
            <button
              key={cellName}
              type="button"
              onClick={() => setSelectedCellFilter(cellName)}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer whitespace-nowrap ${
                isActive
                  ? 'bg-[#0f3e2e] text-white shadow-xs'
                  : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'
              }`}
            >
              {cellName}
            </button>
          );
        })}
      </div>

      {/* Grid de Trilhas */}
      {filteredTracks.length === 0 ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
          <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <GraduationCap className="w-6 h-6" />
          </div>
          <h3 className="font-bold text-sm text-slate-700">Nenhuma trilha encontrada</h3>
          <p className="text-xs text-slate-500 max-w-sm mx-auto">
            Crie sua primeira trilha de aprendizagem configurando as etapas de atendimento e checklists necessários.
          </p>
          <button
            type="button"
            onClick={handleOpenCreate}
            className="px-4 py-2 bg-[#0f3e2e] hover:bg-emerald-900 text-white rounded-xl text-xs font-bold transition-all shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Criar Primeira Trilha</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {filteredTracks.map((track) => {
            const linkedSurvey = surveys.find((s) => s.id === track.surveyId);
            const trackChecklists = checklists.filter((c) => track.checklistIds.includes(c.id));
            const enrolledCollabs = collaborators.filter((c) =>
              track.collaboratorIds.includes(c.id)
            );

            // Calcula progresso médio da turma
            let totalStages = 0;
            let completedStages = 0;
            track.collaboratorIds.forEach((cId) => {
              track.checklistIds.forEach((chkId) => {
                totalStages++;
                const asg = collaboratorChecklists.find(
                  (a) => a.collaboratorId === cId && a.checklistId === chkId
                );
                if (asg && asg.status === 'concluido') {
                  completedStages++;
                }
              });
            });
            const progressPct =
              totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0;

            return (
              <div
                key={track.id}
                className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs hover:border-slate-300 transition-all flex flex-col justify-between space-y-4"
              >
                <div className="space-y-3">
                  {/* Topo do Card */}
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full inline-block mb-1.5">
                        {getCellName(track.cell)}
                      </span>
                      <h3 className="font-bold text-base text-slate-900 leading-snug">
                        {track.title}
                      </h3>
                    </div>

                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleOpenEdit(track)}
                        className="p-1.5 text-slate-500 hover:text-emerald-900 hover:bg-slate-100 rounded-lg cursor-pointer"
                        title="Editar Trilha"
                      >
                        <Edit3 className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteConfirmTrack(track)}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg cursor-pointer"
                        title="Excluir Trilha"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">
                    {track.description || 'Sem descrição cadastrada.'}
                  </p>

                  {/* Barra de Progresso Médio da Turma */}
                  <div className="space-y-1 bg-slate-50 p-3 rounded-xl border border-slate-100">
                    <div className="flex items-center justify-between text-xs font-semibold text-slate-700">
                      <span>Progresso Médio da Turma</span>
                      <span className="font-mono text-emerald-800 font-bold">{progressPct}%</span>
                    </div>
                    <div className="w-full bg-slate-200 h-2 rounded-full overflow-hidden">
                      <div
                        className="bg-emerald-600 h-full rounded-full transition-all duration-500"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                  </div>

                  {/* Etapas / Checklists */}
                  <div className="space-y-1.5 pt-1">
                    <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1">
                      <BookOpen className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Etapas Sequenciais ({track.checklistIds.length}):</span>
                    </div>

                    <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
                      {trackChecklists.map((chk, idx) => (
                        <div
                          key={chk.id}
                          className="flex items-center justify-between p-2 rounded-lg bg-slate-50 text-xs border border-slate-100"
                        >
                          <span className="font-medium text-slate-800 truncate">
                            {idx + 1}. {chk.title}
                          </span>
                          <span className="text-[10px] text-slate-400 shrink-0 ml-2">
                            {chk.criteria.length} critério(s)
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Pesquisa de Satisfação Vinculada */}
                  {linkedSurvey ? (
                    <div className="p-2.5 bg-emerald-50/70 border border-emerald-200/80 rounded-xl flex items-center justify-between text-xs text-emerald-950">
                      <div className="flex items-center gap-2 truncate">
                        <ClipboardCheck className="w-4 h-4 text-emerald-700 shrink-0" />
                        <span className="truncate font-semibold">
                          Pesquisa: {linkedSurvey.title}
                        </span>
                      </div>
                      <span className="text-[10px] bg-white border border-emerald-200 px-1.5 py-0.5 rounded text-emerald-800 font-bold shrink-0">
                        Final da Trilha
                      </span>
                    </div>
                  ) : (
                    <div className="text-[11px] text-slate-400 italic">
                      Nenhuma pesquisa de satisfação vinculada.
                    </div>
                  )}
                </div>

                {/* Rodapé do Card com Matrícula */}
                <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                  <div className="text-xs text-slate-600">
                    <strong>{enrolledCollabs.length}</strong> colaborador(es) matriculado(s)
                  </div>

                  <button
                    type="button"
                    onClick={() => setEnrollModalTrack(track)}
                    className="px-3 py-1.5 text-xs font-bold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Users className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Gerenciar Matrículas</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 1: CONSTRUTOR DINÂMICO DE TRILHA */}
      {/* ========================================================= */}
      {showBuilderModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-4 bg-[#0f3e2e] text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center font-bold">
                  <GraduationCap className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">
                    {editingTrackId ? 'Editar Trilha de Aprendizagem' : 'Nova Trilha de Aprendizagem'}
                  </h3>
                  <p className="text-[11px] text-emerald-200">
                    Defina o roteiro modular de avaliação e vincule checklists e pesquisas
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowBuilderModal(false)}
                className="text-emerald-200 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSaveTrack} className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2 space-y-1">
                  <label className="block font-bold text-slate-800">Título da Trilha *</label>
                  <input
                    type="text"
                    required
                    value={builderTitle}
                    onChange={(e) => setBuilderTitle(e.target.value)}
                    placeholder="Ex: Trilha de Excelência no Atendimento Laboratorial"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-900 text-xs"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-800">Célula Principal *</label>
                  <select
                    value={builderCell}
                    onChange={(e) => setBuilderCell(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-900 text-xs"
                  >
                    {CLEAN_CELL_NAMES.map((name) => (
                      <option key={name} value={name}>
                        {name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="block font-bold text-slate-800">
                  Descrição & Objetivos Pedagógicos
                </label>
                <textarea
                  rows={2}
                  value={builderDescription}
                  onChange={(e) => setBuilderDescription(e.target.value)}
                  placeholder="Descreva as competências e resultados esperados desta trilha..."
                  className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-normal text-slate-900 text-xs resize-none"
                />
              </div>

              {/* Seleção de Checklists das Etapas */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-slate-800">
                    Checklists que Compõem as Etapas da Trilha * ({builderChecklistIds.length} selecionado(s))
                  </label>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-48 overflow-y-auto p-1 bg-slate-50 rounded-xl border border-slate-200">
                  {checklists.map((chk) => {
                    const isChecked = builderChecklistIds.includes(chk.id);
                    return (
                      <label
                        key={chk.id}
                        onClick={() => toggleChecklistInBuilder(chk.id)}
                        className={`p-2.5 rounded-lg border text-xs flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 font-medium'
                        }`}
                      >
                        <div className="truncate">
                          <div className="truncate">{chk.title}</div>
                          <div className="text-[10px] text-slate-400 font-normal">
                            {getCellName(chk.cell)} · {chk.criteria.length} critério(s)
                          </div>
                        </div>

                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-emerald-700 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300 shrink-0" />
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Vínculo de Pesquisa de Satisfação Final */}
              <div className="space-y-1 pt-2 border-t border-slate-200">
                <label className="block font-bold text-slate-800">
                  Pesquisa de Satisfação Vinculada (Final da Trilha)
                </label>
                <select
                  value={builderSurveyId}
                  onChange={(e) => setBuilderSurveyId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-900 text-xs"
                >
                  <option value="">Nenhuma pesquisa vinculada</option>
                  {surveys.map((srv) => (
                    <option key={srv.id} value={srv.id}>
                      {srv.title} ({srv.questions.length} perguntas)
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-slate-500">
                  O colaborador será convidado a responder esta pesquisa ao concluir as etapas da trilha.
                </p>
              </div>

              {/* Matrícula de Colaboradores */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <label className="block font-bold text-slate-800">
                  Matricular Colaboradores Imediatamente ({builderCollaboratorIds.length} selecionado(s))
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-40 overflow-y-auto p-1 bg-slate-50 rounded-xl border border-slate-200">
                  {collaborators.map((col) => {
                    const isChecked = builderCollaboratorIds.includes(col.id);
                    return (
                      <label
                        key={col.id}
                        onClick={() => toggleCollaboratorInBuilder(col.id)}
                        className={`p-2.5 rounded-lg border text-xs flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                          isChecked
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-950 font-bold'
                            : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 font-medium'
                        }`}
                      >
                        <div className="truncate">
                          <div className="truncate">{col.fullName}</div>
                          <div className="text-[10px] text-slate-400 font-normal">
                            {col.roleTitle} · {getCellName(col.cellTeam)}
                          </div>
                        </div>

                        {isChecked ? (
                          <CheckSquare className="w-4 h-4 text-emerald-700 shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-slate-300 shrink-0" />
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Botões Rodapé */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowBuilderModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2 bg-[#0f3e2e] hover:bg-emerald-900 text-white font-bold rounded-xl shadow-sm transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Salvando...' : 'Salvar Trilha'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: GERENCIAR MATRÍCULAS DE UMA TRILHA */}
      {/* ========================================================= */}
      {enrollModalTrack && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-[#0f3e2e] text-white flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-sm">Gerenciar Matrículas na Trilha</h3>
                <p className="text-[11px] text-emerald-200">{enrollModalTrack.title}</p>
              </div>
              <button
                type="button"
                onClick={() => setEnrollModalTrack(null)}
                className="text-emerald-200 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-3 text-xs flex-1">
              <p className="text-slate-600">
                Marque os colaboradores que devem cursar esta trilha. Ao matricular, as etapas de checklist da trilha serão automaticamente vinculadas ao colaborador.
              </p>

              <div className="space-y-1.5 divide-y divide-slate-100 border border-slate-200 rounded-xl p-2 bg-slate-50/50">
                {collaborators.map((col) => {
                  const isEnrolled = enrollModalTrack.collaboratorIds.includes(col.id);

                  return (
                    <div
                      key={col.id}
                      className="pt-1.5 first:pt-0 flex items-center justify-between gap-2 p-2 hover:bg-white rounded-lg transition-colors"
                    >
                      <div>
                        <div className="font-bold text-slate-800">{col.fullName}</div>
                        <div className="text-[11px] text-slate-500">
                          {col.roleTitle} · {getCellName(col.cellTeam)}
                          {col.username && (
                            <span className="font-mono text-emerald-800 font-semibold ml-1.5">
                              (@{col.username})
                            </span>
                          )}
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() =>
                          handleToggleEnrollment(enrollModalTrack.id, col.id, isEnrolled)
                        }
                        className={`px-3 py-1.5 rounded-lg font-bold text-xs transition-colors cursor-pointer ${
                          isEnrolled
                            ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                            : 'bg-emerald-700 text-white hover:bg-emerald-800 shadow-xs'
                        }`}
                      >
                        {isEnrolled ? 'Desmatricular' : 'Matricular'}
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setEnrollModalTrack(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Concluir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: CONFIRMAÇÃO DE EXCLUSÃO DE TRILHA */}
      {/* ========================================================= */}
      {deleteConfirmTrack && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                Excluir &ldquo;{deleteConfirmTrack.title}&rdquo;?
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Esta ação removerá a trilha de aprendizagem. Os checklists e históricos de notas dos colaboradores não serão perdidos.
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmTrack(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl cursor-pointer shadow-xs"
              >
                Sim, Excluir Trilha
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
