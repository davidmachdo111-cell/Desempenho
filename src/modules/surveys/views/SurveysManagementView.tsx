import React, { useState, useMemo } from 'react';
import {
  ClipboardCheck,
  Plus,
  Trash2,
  Edit3,
  BarChart3,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  X,
  MessageSquare,
  Users,
  Calendar,
  Layers,
  ArrowRight,
  ListPlus,
  Building2,
  FileText,
} from 'lucide-react';
import { usePortalStore } from '../../../context/PortalStoreContext';
import {
  Survey,
  SurveyQuestion,
  SurveyQuestionType,
  SurveyResponse,
  CLEAN_CELL_NAMES,
} from '../../../types/portal';

export const SurveysManagementView: React.FC = () => {
  const { surveys, surveyResponses, createSurvey, updateSurvey, deleteSurvey, currentUser } =
    usePortalStore();

  const [activeTab, setActiveTab] = useState<'surveys' | 'responses'>('surveys');
  const [selectedSurveyForResults, setSelectedSurveyForResults] = useState<Survey | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  // Estados do Modal Construtor de Pesquisa
  const [showBuilderModal, setShowBuilderModal] = useState(false);
  const [editingSurveyId, setEditingSurveyId] = useState<string | null>(null);
  const [builderTitle, setBuilderTitle] = useState('');
  const [builderDescription, setBuilderDescription] = useState('');
  const [builderTargetCell, setBuilderTargetCell] = useState('Todas');
  const [builderQuestions, setBuilderQuestions] = useState<SurveyQuestion[]>([
    {
      id: `q-${Date.now()}-1`,
      text: '',
      type: 'multipla_simples',
      options: ['Excelente', 'Bom', 'Regular', 'Insatisfatório'],
      required: true,
    },
  ]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Modal de Confirmação de Exclusão
  const [deleteConfirmSurvey, setDeleteConfirmSurvey] = useState<Survey | null>(null);

  // Métricas Consolidadas
  const totalQuestions = useMemo(
    () => surveys.reduce((acc, s) => acc + s.questions.length, 0),
    [surveys]
  );
  const totalResponses = surveyResponses.length;

  const handleOpenCreate = () => {
    setEditingSurveyId(null);
    setBuilderTitle('');
    setBuilderDescription('');
    setBuilderTargetCell('Todas');
    setBuilderQuestions([
      {
        id: `q-${Date.now()}-1`,
        text: 'Como você avalia a fidelidade das simulações e guias médicas?',
        type: 'multipla_com_observacao',
        options: [
          'Excelente — Muito claras e realistas',
          'Boa — Compreensíveis',
          'Regular — Alguns pontos confusos',
          'Insatisfatória — Não reflete a rotina',
        ],
        required: true,
      },
      {
        id: `q-${Date.now()}-2`,
        text: 'O checklist de critérios é suficiente para orientar sua conduta?',
        type: 'multipla_simples',
        options: ['Sim, totalmente claro', 'Parcialmente claro', 'Não é claro'],
        required: true,
      },
      {
        id: `q-${Date.now()}-3`,
        text: 'Deixe aqui suas sugestões e comentários para melhoria contínua:',
        type: 'apenas_observacao',
        options: [],
        required: false,
      },
    ]);
    setShowBuilderModal(true);
  };

  const handleOpenEdit = (survey: Survey) => {
    setEditingSurveyId(survey.id);
    setBuilderTitle(survey.title);
    setBuilderDescription(survey.description);
    setBuilderTargetCell(survey.targetCell || 'Todas');
    setBuilderQuestions(
      survey.questions.map((q) => ({
        ...q,
        options: [...q.options],
      }))
    );
    setShowBuilderModal(true);
  };

  const handleAddQuestion = () => {
    const newQ: SurveyQuestion = {
      id: `q-${Date.now()}-${builderQuestions.length + 1}`,
      text: '',
      type: 'multipla_simples',
      options: ['Opção 1', 'Opção 2', 'Opção 3'],
      required: true,
    };
    setBuilderQuestions((prev) => [...prev, newQ]);
  };

  const handleRemoveQuestion = (index: number) => {
    if (builderQuestions.length <= 1) {
      setFeedback({ type: 'error', text: 'A pesquisa deve conter pelo menos 1 pergunta.' });
      return;
    }
    setBuilderQuestions((prev) => prev.filter((_, idx) => idx !== index));
  };

  const handleUpdateQuestion = (index: number, updates: Partial<SurveyQuestion>) => {
    setBuilderQuestions((prev) =>
      prev.map((q, idx) => (idx === index ? { ...q, ...updates } : q))
    );
  };

  const handleAddOption = (questionIndex: number) => {
    setBuilderQuestions((prev) =>
      prev.map((q, idx) => {
        if (idx !== questionIndex) return q;
        const optNum = q.options.length + 1;
        return {
          ...q,
          options: [...q.options, `Nova Opção ${optNum}`],
        };
      })
    );
  };

  const handleRemoveOption = (questionIndex: number, optionIndex: number) => {
    setBuilderQuestions((prev) =>
      prev.map((q, idx) => {
        if (idx !== questionIndex) return q;
        if (q.options.length <= 2) {
          alert('Perguntas de múltipla escolha necessitam de pelo menos 2 alternativas.');
          return q;
        }
        return {
          ...q,
          options: q.options.filter((_, oIdx) => oIdx !== optionIndex),
        };
      })
    );
  };

  const handleOptionChange = (questionIndex: number, optionIndex: number, value: string) => {
    setBuilderQuestions((prev) =>
      prev.map((q, idx) => {
        if (idx !== questionIndex) return q;
        const newOpts = [...q.options];
        newOpts[optionIndex] = value;
        return { ...q, options: newOpts };
      })
    );
  };

  const handleSaveSurvey = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeedback(null);

    if (!builderTitle.trim()) {
      setFeedback({ type: 'error', text: 'Informe o título da pesquisa.' });
      return;
    }

    if (builderQuestions.length === 0) {
      setFeedback({ type: 'error', text: 'Adicione pelo menos 1 pergunta à pesquisa.' });
      return;
    }

    for (let i = 0; i < builderQuestions.length; i++) {
      const q = builderQuestions[i];
      if (!q.text.trim()) {
        setFeedback({
          type: 'error',
          text: `Preencha o enunciado da pergunta ${i + 1}.`,
        });
        return;
      }
      if (q.type !== 'apenas_observacao' && q.options.length < 2) {
        setFeedback({
          type: 'error',
          text: `A pergunta ${i + 1} necessita de pelo menos 2 alternativas de múltipla escolha.`,
        });
        return;
      }
    }

    setIsSubmitting(true);
    let res;
    if (editingSurveyId) {
      res = await updateSurvey(editingSurveyId, {
        title: builderTitle.trim(),
        description: builderDescription.trim(),
        targetCell: builderTargetCell,
        questions: builderQuestions,
      });
    } else {
      res = await createSurvey({
        title: builderTitle.trim(),
        description: builderDescription.trim(),
        targetCell: builderTargetCell,
        questions: builderQuestions,
      });
    }
    setIsSubmitting(false);

    if (res.success) {
      setFeedback({
        type: 'success',
        text: editingSurveyId ? 'Pesquisa atualizada com sucesso!' : 'Pesquisa criada com sucesso!',
      });
      setShowBuilderModal(false);
    } else {
      setFeedback({ type: 'error', text: res.message });
    }
  };

  const handleDeleteSurveyConfirm = async () => {
    if (!deleteConfirmSurvey) return;
    const res = await deleteSurvey(deleteConfirmSurvey.id);
    setDeleteConfirmSurvey(null);
    if (res.success) {
      setFeedback({ type: 'success', text: 'Pesquisa excluída com sucesso.' });
      if (selectedSurveyForResults?.id === deleteConfirmSurvey.id) {
        setSelectedSurveyForResults(null);
      }
    } else {
      setFeedback({ type: 'error', text: res.message });
    }
  };

  return (
    <div className="space-y-6">
      {/* Feedback Toast */}
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

      {/* Header Corporativo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 text-[#0f3e2e] flex items-center justify-center">
              <ClipboardCheck className="w-5 h-5 text-emerald-700" />
            </div>
            <h1 className="text-xl font-bold font-display text-slate-900">
              Pesquisas de Satisfação & Feedback
            </h1>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Construa questionários dinâmicos com perguntas de múltipla escolha e observações abertas para mensurar a evolução dos treinamentos.
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="px-4 py-2.5 bg-[#0f3e2e] hover:bg-emerald-900 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-2 cursor-pointer shrink-0"
        >
          <Plus className="w-4 h-4" />
          <span>+ Nova Pesquisa</span>
        </button>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Pesquisas Ativas
            </div>
            <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
              {surveys.length}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-700">
            <Layers className="w-5 h-5 text-emerald-700" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Perguntas Cadastradas
            </div>
            <div className="text-2xl font-bold font-mono text-slate-900 mt-1">
              {totalQuestions}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center text-slate-700">
            <HelpCircle className="w-5 h-5 text-emerald-700" />
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <div className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Respostas Recebidas
            </div>
            <div className="text-2xl font-bold font-mono text-emerald-800 mt-1">
              {totalResponses}
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-800">
            <MessageSquare className="w-5 h-5 text-emerald-700" />
          </div>
        </div>
      </div>

      {/* Lista de Pesquisas Cadastradas */}
      <div className="bg-white border border-slate-200 rounded-2xl shadow-xs overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50/60 flex items-center justify-between">
          <div>
            <h2 className="font-bold text-sm text-slate-900">Pesquisas Disponíveis</h2>
            <p className="text-[11px] text-slate-500">
              Gerencie perguntas, alternativas e visualize as respostas consolidadas
            </p>
          </div>
          <span className="text-xs font-semibold text-slate-500 bg-white px-2.5 py-1 rounded-lg border border-slate-200">
            {surveys.length} registro(s)
          </span>
        </div>

        {surveys.length === 0 ? (
          <div className="text-center py-16 px-4 space-y-3">
            <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
              <ClipboardCheck className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-sm text-slate-700">Nenhuma pesquisa criada ainda</h3>
            <p className="text-xs text-slate-500 max-w-sm mx-auto">
              Crie questionários para coletar avaliações dos colaboradores sobre os casos clínicos, guias e roteiros.
            </p>
            <button
              type="button"
              onClick={handleOpenCreate}
              className="px-4 py-2 bg-[#0f3e2e] hover:bg-emerald-900 text-white rounded-xl text-xs font-bold transition-all shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Criar Primeira Pesquisa</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-slate-100">
            {surveys.map((survey) => {
              const responses = surveyResponses.filter((r) => r.surveyId === survey.id);

              return (
                <div
                  key={survey.id}
                  className="p-6 hover:bg-slate-50/70 transition-colors flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <h3 className="font-bold text-sm text-slate-900">{survey.title}</h3>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                        {survey.targetCell || 'Todas as Células'}
                      </span>
                    </div>

                    <p className="text-xs text-slate-500 line-clamp-2 max-w-2xl leading-relaxed">
                      {survey.description || 'Sem descrição cadastrada.'}
                    </p>

                    <div className="flex items-center gap-4 text-xs text-slate-500 pt-1">
                      <span className="flex items-center gap-1">
                        <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                        <span>{survey.questions.length} pergunta(s)</span>
                      </span>
                      <span className="flex items-center gap-1">
                        <Users className="w-3.5 h-3.5 text-emerald-600" />
                        <span className="font-semibold text-emerald-800">
                          {responses.length} resposta(s) recebida(s)
                        </span>
                      </span>
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => setSelectedSurveyForResults(survey)}
                      className="px-3 py-1.5 text-xs font-bold text-emerald-900 bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer"
                      title="Ver gráficos e justificativas consolidadas"
                    >
                      <BarChart3 className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Visualizar Respostas ({responses.length})</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleOpenEdit(survey)}
                      className="p-1.5 text-slate-600 hover:text-emerald-900 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
                      title="Editar Pesquisa"
                    >
                      <Edit3 className="w-4 h-4" />
                    </button>

                    <button
                      type="button"
                      onClick={() => setDeleteConfirmSurvey(survey)}
                      className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                      title="Excluir Pesquisa"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ========================================================= */}
      {/* MODAL 1: CONSTRUTOR DINÂMICO DE PESQUISAS */}
      {/* ========================================================= */}
      {showBuilderModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            {/* Header Modal */}
            <div className="px-6 py-4 bg-[#0f3e2e] text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center font-bold">
                  <ClipboardCheck className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">
                    {editingSurveyId ? 'Editar Pesquisa de Satisfação' : 'Nova Pesquisa de Satisfação'}
                  </h3>
                  <p className="text-[11px] text-emerald-200">
                    Configure título, enunciados, alternativas e regras de preenchimento
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

            {/* Conteúdo Formulário */}
            <form onSubmit={handleSaveSurvey} className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
              {/* Informações Gerais */}
              <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div className="md:col-span-2 space-y-1">
                    <label className="block font-bold text-slate-800">Título da Pesquisa *</label>
                    <input
                      type="text"
                      required
                      value={builderTitle}
                      onChange={(e) => setBuilderTitle(e.target.value)}
                      placeholder="Ex: Avaliação do Programa de Simulação Laboratorial"
                      className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-900 text-xs"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block font-bold text-slate-800">Célula / Público Alvo</label>
                    <select
                      value={builderTargetCell}
                      onChange={(e) => setBuilderTargetCell(e.target.value)}
                      className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-900 text-xs"
                    >
                      <option value="Todas">Todas as Células</option>
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
                    Descrição & Instruções aos Respondentes
                  </label>
                  <textarea
                    rows={2}
                    value={builderDescription}
                    onChange={(e) => setBuilderDescription(e.target.value)}
                    placeholder="Instruções claras para o colaborador preencher a pesquisa com sinceridade..."
                    className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-normal text-slate-900 text-xs resize-none"
                  />
                </div>
              </div>

              {/* Lista Dinâmica de Perguntas */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                    <HelpCircle className="w-4 h-4 text-emerald-800" />
                    <span>Perguntas da Pesquisa ({builderQuestions.length})</span>
                  </h4>

                  <button
                    type="button"
                    onClick={handleAddQuestion}
                    className="px-3 py-1.5 text-xs font-bold text-[#0f3e2e] bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                  >
                    <ListPlus className="w-3.5 h-3.5" />
                    <span>+ Adicionar Pergunta</span>
                  </button>
                </div>

                <div className="space-y-4">
                  {builderQuestions.map((question, qIdx) => (
                    <div
                      key={question.id}
                      className="p-4 bg-white border border-slate-200 rounded-xl space-y-3 relative hover:border-slate-300 transition-colors shadow-xs"
                    >
                      {/* Linha 1: Número, Enunciado e Remover */}
                      <div className="flex items-start gap-3">
                        <span className="w-6 h-6 rounded-full bg-slate-100 text-slate-700 font-bold text-xs flex items-center justify-center shrink-0 mt-1">
                          {qIdx + 1}
                        </span>

                        <div className="flex-1 space-y-1">
                          <label className="block font-bold text-slate-800">
                            Enunciado da Pergunta *
                          </label>
                          <input
                            type="text"
                            required
                            value={question.text}
                            onChange={(e) =>
                              handleUpdateQuestion(qIdx, { text: e.target.value })
                            }
                            placeholder="Ex: Como você avalia a clareza das guias médicas apresentadas?"
                            className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-900 text-xs"
                          />
                        </div>

                        <button
                          type="button"
                          onClick={() => handleRemoveQuestion(qIdx)}
                          className="p-1 text-slate-400 hover:text-red-600 rounded cursor-pointer mt-1"
                          title="Remover pergunta"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>

                      {/* Linha 2: Tipo de Pergunta e Obrigatoriedade */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                        <div className="space-y-1">
                          <label className="block font-bold text-slate-700 text-[11px]">
                            Tipo da Pergunta:
                          </label>
                          <select
                            value={question.type}
                            onChange={(e) =>
                              handleUpdateQuestion(qIdx, {
                                type: e.target.value as SurveyQuestionType,
                                options:
                                  e.target.value === 'apenas_observacao'
                                    ? []
                                    : question.options.length >= 2
                                    ? question.options
                                    : ['Excelente', 'Bom', 'Regular', 'Insatisfatório'],
                              })
                            }
                            className="w-full px-2.5 py-1.5 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-800 text-xs"
                          >
                            <option value="multipla_simples">
                              Múltipla Escolha Simples (Radio)
                            </option>
                            <option value="multipla_com_observacao">
                              Múltipla Escolha COM Campo de Observação (Radio + Justificativa)
                            </option>
                            <option value="apenas_observacao">
                              Apenas Observação (Texto Livre / Dissertativo)
                            </option>
                          </select>
                        </div>

                        <div className="flex items-center gap-2 pt-5">
                          <label className="flex items-center gap-2 cursor-pointer select-none">
                            <input
                              type="checkbox"
                              checked={question.required}
                              onChange={(e) =>
                                handleUpdateQuestion(qIdx, { required: e.target.checked })
                              }
                              className="w-4 h-4 rounded text-emerald-700 focus:ring-emerald-500 border-slate-300 cursor-pointer"
                            />
                            <span className="font-semibold text-slate-700 text-xs">
                              Resposta Obrigatória
                            </span>
                          </label>
                        </div>
                      </div>

                      {/* Linha 3: Alternativas de Múltipla Escolha (se aplicável) */}
                      {question.type !== 'apenas_observacao' ? (
                        <div className="space-y-2 pt-2 border-t border-slate-100 bg-slate-50/50 p-3 rounded-lg">
                          <div className="flex items-center justify-between">
                            <span className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                              Alternativas de Escolha:
                            </span>
                            <button
                              type="button"
                              onClick={() => handleAddOption(qIdx)}
                              className="text-xs font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                              <span>+ Adicionar Alternativa</span>
                            </button>
                          </div>

                          <div className="space-y-1.5">
                            {question.options.map((option, optIdx) => (
                              <div key={optIdx} className="flex items-center gap-2">
                                <span className="w-3.5 h-3.5 rounded-full border border-slate-300 flex items-center justify-center shrink-0">
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                </span>
                                <input
                                  type="text"
                                  required
                                  value={option}
                                  onChange={(e) =>
                                    handleOptionChange(qIdx, optIdx, e.target.value)
                                  }
                                  placeholder={`Alternativa ${optIdx + 1}`}
                                  className="flex-1 px-2.5 py-1 bg-white border border-slate-200 rounded text-xs font-medium text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                />
                                <button
                                  type="button"
                                  onClick={() => handleRemoveOption(qIdx, optIdx)}
                                  className="text-slate-400 hover:text-red-500 p-1 cursor-pointer"
                                  title="Excluir alternativa"
                                >
                                  ✕
                                </button>
                              </div>
                            ))}
                          </div>

                          {question.type === 'multipla_com_observacao' && (
                            <div className="mt-2 text-[11px] text-emerald-800 italic bg-emerald-50/80 p-2 rounded border border-emerald-200/60">
                              ℹ️ O respondente terá um campo de texto aberto (textarea) abaixo destas alternativas para detalhar ou justificar sua escolha.
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="p-3 bg-slate-50 rounded-lg text-slate-500 text-xs italic border border-slate-200">
                          ℹ️ Campo de texto aberto: o colaborador poderá redigir um comentário ou justificativa dissertativa livre.
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Botões do Rodapé */}
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
                  {isSubmitting ? 'Salvando...' : 'Salvar Pesquisa'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 2: VISUALIZAÇÃO CONSOLIDADA DE RESPOSTAS */}
      {/* ========================================================= */}
      {selectedSurveyForResults && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-4 bg-[#0f3e2e] text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center font-bold">
                  <BarChart3 className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">Respostas Consolidadas da Pesquisa</h3>
                  <p className="text-[11px] text-emerald-200">
                    {selectedSurveyForResults.title}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSelectedSurveyForResults(null)}
                className="text-emerald-200 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Conteúdo do Relatório */}
            <div className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
              {(() => {
                const responses = surveyResponses.filter(
                  (r) => r.surveyId === selectedSurveyForResults.id
                );

                if (responses.length === 0) {
                  return (
                    <div className="text-center py-16 space-y-3">
                      <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                        <MessageSquare className="w-6 h-6" />
                      </div>
                      <h4 className="font-bold text-sm text-slate-700">
                        Nenhuma resposta registrada ainda
                      </h4>
                      <p className="text-xs text-slate-500 max-w-sm mx-auto">
                        Quando os colaboradores responderem a esta pesquisa através do perfil deles, as estatísticas e observações serão consolidadas aqui em tempo real.
                      </p>
                    </div>
                  );
                }

                return (
                  <div className="space-y-6">
                    {/* Barra de Resumo */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-emerald-50/60 p-4 rounded-xl border border-emerald-200/80">
                      <div>
                        <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                          Total de Respondentes
                        </div>
                        <div className="text-xl font-bold font-mono text-emerald-950 mt-0.5">
                          {responses.length} colaborador(es)
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                          Célula Alvo
                        </div>
                        <div className="text-xs font-semibold text-emerald-950 mt-1">
                          {selectedSurveyForResults.targetCell || 'Todas'}
                        </div>
                      </div>
                      <div>
                        <div className="text-[11px] font-bold text-emerald-800 uppercase tracking-wider">
                          Última Resposta
                        </div>
                        <div className="text-xs font-medium text-emerald-950 mt-1">
                          {responses[0]?.completedAt
                            ? new Date(responses[0].completedAt).toLocaleString('pt-BR')
                            : '---'}
                        </div>
                      </div>
                    </div>

                    {/* Consolidação por Pergunta */}
                    <div className="space-y-6">
                      {selectedSurveyForResults.questions.map((q, qIndex) => {
                        // Calcula contagem das alternativas
                        const optionCounts: Record<string, number> = {};
                        q.options.forEach((opt) => {
                          optionCounts[opt] = 0;
                        });

                        const observationsList: Array<{
                          author: string;
                          username?: string;
                          cell: string;
                          date: string;
                          text: string;
                          option?: string;
                        }> = [];

                        responses.forEach((resp) => {
                          const ans = resp.answers[q.id];
                          if (ans) {
                            if (ans.selectedOption) {
                              optionCounts[ans.selectedOption] =
                                (optionCounts[ans.selectedOption] || 0) + 1;
                            }
                            if (ans.observation && ans.observation.trim().length > 0) {
                              observationsList.push({
                                author: resp.collaboratorName,
                                username: resp.collaboratorUsername,
                                cell: resp.cellTeam,
                                date: resp.completedAt,
                                text: ans.observation.trim(),
                                option: ans.selectedOption,
                              });
                            }
                          }
                        });

                        return (
                          <div
                            key={q.id}
                            className="bg-white border border-slate-200 rounded-xl p-5 space-y-4 shadow-xs"
                          >
                            <div className="flex items-start gap-2.5">
                              <span className="w-6 h-6 rounded-full bg-[#0f3e2e] text-white font-bold text-xs flex items-center justify-center shrink-0">
                                {qIndex + 1}
                              </span>
                              <div className="space-y-0.5">
                                <h4 className="font-bold text-sm text-slate-900">{q.text}</h4>
                                <span className="text-[10px] font-medium text-slate-400 uppercase">
                                  {q.type === 'multipla_simples'
                                    ? 'Múltipla Escolha'
                                    : q.type === 'multipla_com_observacao'
                                    ? 'Múltipla Escolha com Observação'
                                    : 'Apenas Observação / Dissertativo'}
                                </span>
                              </div>
                            </div>

                            {/* Gráficos de Barra Percentual para Alternativas */}
                            {q.type !== 'apenas_observacao' && (
                              <div className="space-y-2 pt-2 border-t border-slate-100">
                                {q.options.map((opt) => {
                                  const count = optionCounts[opt] || 0;
                                  const pct =
                                    responses.length > 0
                                      ? Math.round((count / responses.length) * 100)
                                      : 0;

                                  return (
                                    <div key={opt} className="space-y-1">
                                      <div className="flex items-center justify-between text-xs font-medium text-slate-700">
                                        <span>{opt}</span>
                                        <span className="font-mono font-bold text-emerald-800">
                                          {count} ({pct}%)
                                        </span>
                                      </div>
                                      <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden">
                                        <div
                                          className="bg-emerald-700 h-full rounded-full transition-all duration-500"
                                          style={{ width: `${pct}%` }}
                                        />
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            )}

                            {/* Listagem de Observações / Justificativas Qualitativas */}
                            {observationsList.length > 0 && (
                              <div className="space-y-2 pt-3 border-t border-slate-100">
                                <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider flex items-center gap-1.5">
                                  <MessageSquare className="w-3.5 h-3.5 text-emerald-700" />
                                  <span>
                                    Observações & Justificativas Registradas ({observationsList.length}):
                                  </span>
                                </div>

                                <div className="space-y-2">
                                  {observationsList.map((obs, idx) => (
                                    <div
                                      key={idx}
                                      className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1.5"
                                    >
                                      <div className="flex items-center justify-between text-[11px] text-slate-500">
                                        <span className="font-bold text-slate-800">
                                          {obs.author}{' '}
                                          {obs.username && (
                                            <span className="font-mono text-emerald-800 font-normal">
                                              (@{obs.username})
                                            </span>
                                          )}{' '}
                                          · <span className="text-slate-600 font-medium">{obs.cell}</span>
                                        </span>
                                        <span>{new Date(obs.date).toLocaleDateString('pt-BR')}</span>
                                      </div>

                                      {obs.option && (
                                        <div className="text-[11px] text-emerald-900 font-medium bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200/60 inline-block">
                                          Opção escolhida: <strong>{obs.option}</strong>
                                        </div>
                                      )}

                                      <p className="text-slate-700 leading-relaxed italic">
                                        &ldquo;{obs.text}&rdquo;
                                      </p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}
            </div>

            {/* Rodapé */}
            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setSelectedSurveyForResults(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL 3: CONFIRMAÇÃO DE EXCLUSÃO */}
      {/* ========================================================= */}
      {deleteConfirmSurvey && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                Excluir &ldquo;{deleteConfirmSurvey.title}&rdquo;?
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Esta ação removerá a pesquisa e desvinculará quaisquer trilhas que a utilizavam. As respostas recebidas serão mantidas no histórico de auditoria.
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmSurvey(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteSurveyConfirm}
                className="px-4 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl cursor-pointer shadow-xs"
              >
                Sim, Excluir Pesquisa
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
