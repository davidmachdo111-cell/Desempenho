import React, { useState, useMemo } from 'react';
import {
  GraduationCap,
  Award,
  CheckCircle2,
  Clock,
  AlertCircle,
  FileText,
  ClipboardCheck,
  Printer,
  Download,
  BookOpen,
  User,
  Building2,
  Sparkles,
  ChevronRight,
  Eye,
  MessageSquare,
  Send,
  HelpCircle,
  X,
} from 'lucide-react';
import { usePortalStore } from '../../../context/PortalStoreContext';
import {
  Collaborator,
  CollaboratorChecklist,
  Checklist,
  LearningTrack,
  Survey,
  SurveyResponse,
  SurveyAnswerItem,
  getCellName,
  Exercise,
  Character,
} from '../../../types/portal';
import { GuideMirrorModal } from '../../../components/GuideMirrorModal';
import { downloadGuidePdf, downloadReportPdf } from '../../../lib/downloadHelpers';

interface CollaboratorPortalViewProps {
  onOpenReportModal?: (assignment: CollaboratorChecklist) => void;
}

export const CollaboratorPortalView: React.FC<CollaboratorPortalViewProps> = () => {
  const {
    currentUser,
    collaborators,
    collaboratorChecklists,
    learningTracks,
    checklists,
    exercises,
    characters,
    surveys,
    surveyResponses,
    submitSurveyResponse,
  } = usePortalStore();

  const [activeTab, setActiveTab] = useState<'track' | 'surveys' | 'guides'>('track');
  const [guideMirrorChar, setGuideMirrorChar] = useState<Character | null>(null);
  const [guideMirrorExerciseTitle, setGuideMirrorExerciseTitle] = useState<string | undefined>(
    undefined
  );

  // Modal de Relatório do Colaborador
  const [viewReportAssignment, setViewReportAssignment] = useState<CollaboratorChecklist | null>(
    null
  );

  // Modal para Responder Pesquisa
  const [activeSurveyToAnswer, setActiveSurveyToAnswer] = useState<Survey | null>(null);
  const [surveyAnswers, setSurveyAnswers] = useState<Record<string, SurveyAnswerItem>>({});
  const [isSubmittingSurvey, setIsSubmittingSurvey] = useState(false);
  const [surveyFeedback, setSurveyFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );

  // Localiza o colaborador correspondente ao usuário logado
  const currentCollaborator = useMemo(() => {
    if (!currentUser) return null;
    // 1. Busca por collaboratorId direto
    if (currentUser.collaboratorId) {
      const found = collaborators.find((c) => c.id === currentUser.collaboratorId);
      if (found) return found;
    }
    // 2. Busca por username idêntico
    const byUsername = collaborators.find(
      (c) => c.username?.toLowerCase() === currentUser.username.toLowerCase()
    );
    if (byUsername) return byUsername;
    // 3. Busca por nome completo
    const byName = collaborators.find(
      (c) => c.fullName.toLowerCase() === currentUser.fullName.toLowerCase()
    );
    if (byName) return byName;
    // Fallback: se não achar, utiliza o primeiro colaborador cadastrado para testes
    return collaborators[0] || null;
  }, [currentUser, collaborators]);

  // Checklists atribuídos ao colaborador
  const myAssignments = useMemo(() => {
    if (!currentCollaborator) return [];
    return collaboratorChecklists.filter((a) => a.collaboratorId === currentCollaborator.id);
  }, [currentCollaborator, collaboratorChecklists]);

  // Trilha de Aprendizagem atribuída
  const myTrack = useMemo(() => {
    if (!currentCollaborator) return null;
    return (
      learningTracks.find(
        (t) =>
          t.id === currentCollaborator.learningTrackId ||
          t.collaboratorIds.includes(currentCollaborator.id)
      ) || learningTracks[0] || null
    );
  }, [currentCollaborator, learningTracks]);

  // Pesquisas atribuídas / disponíveis
  const mySurveys = useMemo(() => {
    if (!surveys || surveys.length === 0) return [];
    // Retorna as pesquisas ativas para a célula do colaborador ou todas
    const collabCell = currentCollaborator ? getCellName(currentCollaborator.cellTeam) : 'Laboratório';
    return surveys.filter((s) => s.targetCell === 'Todas' || s.targetCell === collabCell || s.targetCell === undefined);
  }, [surveys, currentCollaborator]);

  // Respostas já enviadas pelo colaborador
  const myResponses = useMemo(() => {
    if (!currentCollaborator) return [];
    return surveyResponses.filter(
      (r) =>
        r.collaboratorId === currentCollaborator.id ||
        r.collaboratorUsername.toLowerCase() === (currentCollaborator.username || '').toLowerCase()
    );
  }, [currentCollaborator, surveyResponses]);

  // Métricas do Colaborador
  const totalStages = myAssignments.length;
  const completedStages = myAssignments.filter((a) => a.status === 'concluido').length;
  const progressPct = totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0;

  const averageScore = useMemo(() => {
    const scores = myAssignments
      .filter((a) => a.status === 'concluido' && typeof a.finalScore === 'number')
      .map((a) => a.finalScore as number);
    if (scores.length === 0) return null;
    const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    return Number(avg.toFixed(1));
  }, [myAssignments]);

  // Iniciar Resposta de Pesquisa
  const handleStartSurvey = (survey: Survey) => {
    setActiveSurveyToAnswer(survey);
    const initial: Record<string, SurveyAnswerItem> = {};
    survey.questions.forEach((q) => {
      initial[q.id] = { selectedOption: '', observation: '' };
    });
    setSurveyAnswers(initial);
    setSurveyFeedback(null);
  };

  const handleAnswerOptionChange = (questionId: string, option: string) => {
    setSurveyAnswers((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        selectedOption: option,
      },
    }));
  };

  const handleAnswerObservationChange = (questionId: string, text: string) => {
    setSurveyAnswers((prev) => ({
      ...prev,
      [questionId]: {
        ...prev[questionId],
        observation: text,
      },
    }));
  };

  const handleSubmitSurveyForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeSurveyToAnswer || !currentCollaborator) return;

    // Validação de perguntas obrigatórias
    for (const q of activeSurveyToAnswer.questions) {
      if (q.required) {
        const ans = surveyAnswers[q.id];
        if (q.type === 'apenas_observacao') {
          if (!ans?.observation || !ans.observation.trim()) {
            setSurveyFeedback({
              type: 'error',
              text: `Por favor, responda a pergunta obrigatória: "${q.text}".`,
            });
            return;
          }
        } else {
          if (!ans?.selectedOption) {
            setSurveyFeedback({
              type: 'error',
              text: `Por favor, selecione uma opção para a pergunta obrigatória: "${q.text}".`,
            });
            return;
          }
        }
      }
    }

    setIsSubmittingSurvey(true);
    const res = await submitSurveyResponse({
      surveyId: activeSurveyToAnswer.id,
      collaboratorId: currentCollaborator.id,
      answers: surveyAnswers,
    });
    setIsSubmittingSurvey(false);

    if (res.success) {
      setSurveyFeedback({ type: 'success', text: res.message });
      setTimeout(() => {
        setActiveSurveyToAnswer(null);
        setActiveTab('surveys');
      }, 1200);
    } else {
      setSurveyFeedback({ type: 'error', text: res.message });
    }
  };

  return (
    <div className="space-y-6">
      {/* ========================================================= */}
      {/* 1. CABEÇALHO DE BOAS-VINDAS E EVOLUÇÃO INDIVIDUAL */}
      {/* ========================================================= */}
      <div className="bg-gradient-to-r from-[#0f3e2e] to-[#064e3b] text-white rounded-2xl p-6 sm:p-8 shadow-sm relative overflow-hidden">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-800/80 border border-emerald-700/80 text-emerald-200 text-xs font-semibold">
              <GraduationCap className="w-3.5 h-3.5 text-emerald-300" />
              <span>Portal de Desenvolvimento do Colaborador</span>
            </div>

            <h1 className="text-2xl sm:text-3xl font-black font-display tracking-tight text-white">
              Olá, {currentCollaborator ? currentCollaborator.fullName : currentUser?.fullName}!
            </h1>

            <div className="flex items-center gap-3 text-xs text-emerald-100 flex-wrap">
              <span>
                Célula: <strong>{currentCollaborator ? getCellName(currentCollaborator.cellTeam) : 'Laboratório'}</strong>
              </span>
              <span>·</span>
              <span>
                Cargo: <strong>{currentCollaborator ? currentCollaborator.roleTitle : 'Atendente'}</strong>
              </span>
              <span>·</span>
              <span className="font-mono bg-white/10 px-2 py-0.5 rounded text-[11px] font-bold text-emerald-200">
                Login: @{currentCollaborator?.username || currentUser?.username}
              </span>
              {currentCollaborator?.registrationCode && (
                <>
                  <span>·</span>
                  <span className="font-mono text-[11px]">
                    Matrícula: {currentCollaborator.registrationCode}
                  </span>
                </>
              )}
            </div>
          </div>

          {/* Cartão de Desempenho e Média */}
          <div className="bg-white/10 backdrop-blur-xs border border-white/15 rounded-xl p-4 flex items-center gap-5 shrink-0">
            <div>
              <div className="text-[11px] text-emerald-200 font-semibold uppercase tracking-wider">
                Média Geral
              </div>
              <div className="text-2xl font-black font-mono text-white mt-0.5">
                {averageScore !== null ? `${averageScore} / 10` : '---'}
              </div>
            </div>
            <div className="w-px h-10 bg-white/20" />
            <div>
              <div className="text-[11px] text-emerald-200 font-semibold uppercase tracking-wider">
                Etapas Concluídas
              </div>
              <div className="text-2xl font-black font-mono text-emerald-300 mt-0.5">
                {completedStages} / {totalStages}
              </div>
            </div>
          </div>
        </div>

        {/* Barra de Progresso da Trilha */}
        <div className="mt-6 pt-5 border-t border-white/15 space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-100">
            <span>
              {myTrack ? myTrack.title : 'Progresso da sua Trilha de Aprendizagem'}
            </span>
            <span className="font-mono font-bold text-white text-sm">{progressPct}% Concluído</span>
          </div>
          <div className="w-full bg-white/20 h-3 rounded-full overflow-hidden p-0.5 shadow-inner">
            <div
              className="bg-emerald-400 h-full rounded-full transition-all duration-700 ease-out shadow-xs"
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      </div>

      {/* ========================================================= */}
      {/* 2. ABAS DE NAVEGAÇÃO DO COLABORADOR */}
      {/* ========================================================= */}
      <div className="flex items-center gap-2 border-b border-slate-200 pb-px">
        <button
          type="button"
          onClick={() => setActiveTab('track')}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
            activeTab === 'track'
              ? 'border-emerald-700 text-emerald-900 bg-emerald-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <BookOpen className="w-4 h-4" />
          <span>Minha Trilha & Avaliações ({myAssignments.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('surveys')}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
            activeTab === 'surveys'
              ? 'border-emerald-700 text-emerald-900 bg-emerald-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <ClipboardCheck className="w-4 h-4" />
          <span>Pesquisas de Satisfação ({mySurveys.length})</span>
          {mySurveys.length > myResponses.length && (
            <span className="w-2 h-2 rounded-full bg-amber-500 animate-pulse" />
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('guides')}
          className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
            activeTab === 'guides'
              ? 'border-emerald-700 text-emerald-900 bg-emerald-50/50'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-4 h-4" />
          <span>Guias Médicas & Roteiros</span>
        </button>
      </div>

      {/* ========================================================= */}
      {/* ABA 1: MINHA TRILHA DE APRENDIZAGEM */}
      {/* ========================================================= */}
      {activeTab === 'track' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-slate-900">
                Etapas de Simulação e Critérios de Atendimento
              </h2>
              <p className="text-xs text-slate-500">
                Acompanhe o status de cada checklist avaliado pelos instrutores e acesse seus laudos oficiais.
              </p>
            </div>
          </div>

          {myAssignments.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <BookOpen className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-sm text-slate-700">
                Nenhum checklist vinculado no momento
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Seu instrutor ou administrador atribuirá em breve as etapas da sua trilha de treinamento.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {myAssignments.map((asg, index) => {
                const chk = checklists.find((c) => c.id === asg.checklistId);
                const isCompleted = asg.status === 'concluido';
                const isInProgress = asg.status === 'em_andamento';

                return (
                  <div
                    key={asg.id}
                    className={`bg-white border rounded-2xl p-5 transition-all shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                      isCompleted
                        ? 'border-emerald-200 bg-emerald-50/15'
                        : isInProgress
                        ? 'border-amber-200 bg-amber-50/10'
                        : 'border-slate-200'
                    }`}
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span className="w-6 h-6 rounded-full bg-[#0f3e2e] text-white font-bold text-xs flex items-center justify-center shrink-0">
                          {index + 1}
                        </span>

                        <h3 className="font-bold text-sm text-slate-900">
                          {chk ? chk.title : 'Checklist de Avaliação'}
                        </h3>

                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                            isCompleted
                              ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                              : isInProgress
                              ? 'bg-amber-100 text-amber-800 border-amber-300'
                              : 'bg-slate-100 text-slate-600 border-slate-200'
                          }`}
                        >
                          {isCompleted
                            ? 'Concluído'
                            : isInProgress
                            ? 'Em Andamento'
                            : 'Pendente'}
                        </span>

                        {chk?.categoryName && (
                          <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {chk.categoryName}
                          </span>
                        )}
                      </div>

                      {chk?.description && (
                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                          {chk.description}
                        </p>
                      )}

                      {/* Feedback do Avaliador se Concluído */}
                      {isCompleted && asg.generalObservations && (
                        <div className="p-3 bg-white border border-emerald-200 rounded-xl text-xs space-y-1">
                          <div className="font-bold text-emerald-950 flex items-center gap-1.5 text-[11px]">
                            <MessageSquare className="w-3.5 h-3.5 text-emerald-700" />
                            <span>Observações do Avaliador:</span>
                          </div>
                          <p className="text-slate-700 italic leading-relaxed">
                            &ldquo;{asg.generalObservations}&rdquo;
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Lado Direito: Nota e Ações */}
                    <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                      {isCompleted && typeof asg.finalScore === 'number' ? (
                        <div className="text-right">
                          <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                            Nota Obtida
                          </div>
                          <div className="font-mono text-xl font-bold text-emerald-900 bg-emerald-100/80 px-3 py-1 rounded-lg border border-emerald-300 inline-block mt-0.5">
                            {asg.finalScore.toFixed(1)} / 10
                          </div>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 italic">
                          Aguardando avaliação
                        </div>
                      )}

                      {/* Botão de Ver Laudo Oficial */}
                      {isCompleted && (
                        <button
                          type="button"
                          onClick={() => setViewReportAssignment(asg)}
                          className="px-3.5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Ver Laudo / Relatório</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ========================================================= */}
      {/* ABA 2: PESQUISAS DE SATISFAÇÃO */}
      {/* ========================================================= */}
      {activeTab === 'surveys' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Pesquisas de Satisfação & Percepção do Treinamento
            </h2>
            <p className="text-xs text-slate-500">
              Sua opinião fundamenta a evolução das simulações, guias e roteiros.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {mySurveys.map((survey) => {
              const response = myResponses.find((r) => r.surveyId === survey.id);
              const isAnswered = !!response;

              return (
                <div
                  key={survey.id}
                  className={`bg-white border rounded-2xl p-6 transition-all shadow-xs flex flex-col justify-between space-y-4 ${
                    isAnswered
                      ? 'border-emerald-200 bg-emerald-50/20'
                      : 'border-slate-200 hover:border-emerald-300'
                  }`}
                >
                  <div className="space-y-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full inline-block">
                        {survey.targetCell || 'Todas as Células'}
                      </span>

                      {isAnswered ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-full">
                          <CheckCircle2 className="w-3 h-3 text-emerald-700" />
                          <span>Respondida</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2.5 py-0.5 rounded-full">
                          <Clock className="w-3 h-3 text-amber-700" />
                          <span>Pendente</span>
                        </span>
                      )}
                    </div>

                    <h3 className="font-bold text-base text-slate-900 leading-snug">
                      {survey.title}
                    </h3>

                    <p className="text-xs text-slate-500 leading-relaxed">
                      {survey.description || 'Avalie as etapas do treinamento e deixe suas sugestões.'}
                    </p>

                    <div className="text-xs text-slate-500 flex items-center gap-1">
                      <HelpCircle className="w-3.5 h-3.5 text-slate-400" />
                      <span>{survey.questions.length} pergunta(s) estruturada(s)</span>
                    </div>
                  </div>

                  <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                    {isAnswered ? (
                      <span className="text-[11px] text-emerald-800 font-medium">
                        Enviada em {new Date(response.completedAt).toLocaleDateString('pt-BR')}
                      </span>
                    ) : (
                      <span className="text-[11px] text-amber-700 font-medium">
                        Aguardando seu preenchimento
                      </span>
                    )}

                    <button
                      type="button"
                      onClick={() => handleStartSurvey(survey)}
                      className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shadow-xs ${
                        isAnswered
                          ? 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          : 'bg-[#0f3e2e] hover:bg-emerald-900 text-white'
                      }`}
                    >
                      <ClipboardCheck className="w-3.5 h-3.5" />
                      <span>{isAnswered ? 'Revisar / Reenviar' : 'Responder Pesquisa'}</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* ABA 3: GUIAS MÉDICAS E ROTEIROS */}
      {/* ========================================================= */}
      {activeTab === 'guides' && (
        <div className="space-y-4">
          <div>
            <h2 className="text-sm font-bold text-slate-900">
              Banco de Guias Médicas dos Casos Clínicos
            </h2>
            <p className="text-xs text-slate-500">
              Consulte e baixe em PDF oficial as fichas das guias médicas para estudo dos critérios de conferência.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {characters.slice(0, 9).map((char) => (
              <div
                key={char.id}
                className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col justify-between space-y-3 hover:border-emerald-300 transition-colors"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                      {getCellName(char.cell)}
                    </span>
                    <span className="text-xs text-slate-400 font-mono">
                      {char.cardNumber}
                    </span>
                  </div>

                  <h3 className="font-bold text-sm text-slate-900">{char.name}</h3>
                  <div className="text-xs text-slate-500">
                    {char.age} · {char.gender} · {char.city}
                  </div>

                  <p className="text-xs text-slate-600 line-clamp-2 leading-relaxed bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                    {char.serviceContext}
                  </p>
                </div>

                <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setGuideMirrorChar(char);
                      setGuideMirrorExerciseTitle('Guia Médica de Treinamento');
                    }}
                    className="px-2.5 py-1.5 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1 transition-colors cursor-pointer"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    <span>Visualizar</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => downloadGuidePdf(char, 'Guia Médica de Treinamento')}
                    className="px-3 py-1.5 text-xs font-bold text-white bg-[#0f3e2e] hover:bg-emerald-900 rounded-lg flex items-center gap-1 transition-colors cursor-pointer shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Baixar PDF</span>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL PARA RESPONDER PESQUISA DE SATISFAÇÃO */}
      {/* ========================================================= */}
      {activeSurveyToAnswer && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="px-6 py-4 bg-[#0f3e2e] text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center font-bold">
                  <ClipboardCheck className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">{activeSurveyToAnswer.title}</h3>
                  <p className="text-[11px] text-emerald-200">
                    Preencha suas percepções e justifique suas respostas
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveSurveyToAnswer(null)}
                className="text-emerald-200 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleSubmitSurveyForm} className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
              {surveyFeedback && (
                <div
                  className={`p-3.5 rounded-xl flex items-center gap-2 text-xs font-medium border ${
                    surveyFeedback.type === 'success'
                      ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                      : 'bg-red-50 text-red-900 border-red-200'
                  }`}
                >
                  {surveyFeedback.type === 'success' ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-600 shrink-0" />
                  )}
                  <span>{surveyFeedback.text}</span>
                </div>
              )}

              {activeSurveyToAnswer.description && (
                <div className="p-3 bg-emerald-50/60 border border-emerald-200/80 rounded-xl text-emerald-950 text-xs leading-relaxed">
                  {activeSurveyToAnswer.description}
                </div>
              )}

              <div className="space-y-5">
                {activeSurveyToAnswer.questions.map((question, qIdx) => {
                  const currentAnswer = surveyAnswers[question.id] || {
                    selectedOption: '',
                    observation: '',
                  };

                  return (
                    <div
                      key={question.id}
                      className="p-5 bg-slate-50/70 border border-slate-200 rounded-xl space-y-3"
                    >
                      <div className="flex items-start gap-2.5">
                        <span className="w-6 h-6 rounded-full bg-[#0f3e2e] text-white font-bold text-xs flex items-center justify-center shrink-0 mt-0.5">
                          {qIdx + 1}
                        </span>
                        <div>
                          <h4 className="font-bold text-sm text-slate-900">
                            {question.text}
                            {question.required && (
                              <span className="text-red-500 ml-1 font-bold">*</span>
                            )}
                          </h4>
                        </div>
                      </div>

                      {/* Alternativas se Múltipla Escolha */}
                      {question.type !== 'apenas_observacao' && (
                        <div className="space-y-2 pt-2 border-t border-slate-200">
                          {question.options.map((opt) => {
                            const isSelected = currentAnswer.selectedOption === opt;
                            return (
                              <label
                                key={opt}
                                onClick={() => handleAnswerOptionChange(question.id, opt)}
                                className={`p-3 rounded-lg border text-xs flex items-center gap-3 cursor-pointer transition-all ${
                                  isSelected
                                    ? 'bg-emerald-50 border-emerald-400 text-emerald-950 font-bold shadow-xs'
                                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100 font-medium'
                                }`}
                              >
                                <span
                                  className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 ${
                                    isSelected
                                      ? 'border-emerald-700 bg-emerald-700'
                                      : 'border-slate-300 bg-white'
                                  }`}
                                >
                                  {isSelected && (
                                    <span className="w-1.5 h-1.5 rounded-full bg-white" />
                                  )}
                                </span>
                                <span>{opt}</span>
                              </label>
                            );
                          })}
                        </div>
                      )}

                      {/* Campo de Observação (se Múltipla com Observação OU se Apenas Observação) */}
                      {(question.type === 'multipla_com_observacao' ||
                        question.type === 'apenas_observacao') && (
                        <div className="space-y-1 pt-2">
                          <label className="block font-bold text-slate-700 text-[11px]">
                            {question.type === 'apenas_observacao'
                              ? 'Sua Resposta Dissertativa / Comentário:'
                              : 'Justificativa ou Comentário Adicional (Opcional):'}
                          </label>
                          <textarea
                            rows={3}
                            value={currentAnswer.observation || ''}
                            onChange={(e) =>
                              handleAnswerObservationChange(question.id, e.target.value)
                            }
                            placeholder="Descreva detalhes, exemplos práticos ou sugestões..."
                            className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-900 text-xs resize-none"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Rodapé */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setActiveSurveyToAnswer(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingSurvey}
                  className="px-5 py-2 bg-[#0f3e2e] hover:bg-emerald-900 text-white font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmittingSurvey ? 'Enviando...' : 'Enviar Resposta'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* MODAL DE LAUDO / RELATÓRIO DO COLABORADOR */}
      {/* ========================================================= */}
      {viewReportAssignment && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-[#0f3e2e] text-white flex items-center justify-between shrink-0">
              <div>
                <h3 className="font-bold text-sm">Laudo Oficial da Avaliação</h3>
                <p className="text-[11px] text-emerald-200">
                  {checklists.find((c) => c.id === viewReportAssignment.checklistId)?.title ||
                    'Checklist'}
                </p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const chk = checklists.find((c) => c.id === viewReportAssignment.checklistId);
                    downloadReportPdf({
                      collaboratorName: currentCollaborator?.fullName || 'Colaborador',
                      department: currentCollaborator?.cellTeam || 'Laboratório',
                      cell: currentCollaborator?.cellTeam || 'Laboratório',
                      checklistTitle: chk?.title || 'Checklist de Avaliação',
                      checklistCategory: chk?.categoryName || 'Geral',
                      finalScore: viewReportAssignment.finalScore || 0,
                      evaluatedAt: viewReportAssignment.completedAt || new Date().toISOString(),
                      evaluatorName: 'Equipe de Avaliação e Treinamento',
                      notes: viewReportAssignment.generalObservations || undefined,
                      items: viewReportAssignment.criteriaAnswers.map((ans) => ({
                        name: ans.name,
                        weight: ans.weight,
                        checked: ans.checked,
                      })),
                    });
                  }}
                  className="px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-500 rounded-lg transition-colors flex items-center gap-1 cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Baixar PDF</span>
                </button>

                <button
                  type="button"
                  onClick={() => setViewReportAssignment(null)}
                  className="text-emerald-200 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs flex-1">
              <div className="flex items-center justify-between bg-slate-50 p-4 rounded-xl border border-slate-200">
                <div>
                  <div className="text-[11px] text-slate-500 font-semibold uppercase">
                    Status e Data
                  </div>
                  <div className="text-sm font-bold text-slate-900 mt-0.5">
                    Concluído em{' '}
                    {viewReportAssignment.completedAt
                      ? new Date(viewReportAssignment.completedAt).toLocaleDateString('pt-BR')
                      : '---'}
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-[11px] text-slate-500 font-semibold uppercase">
                    Nota Final
                  </div>
                  <div className="text-2xl font-black font-mono text-emerald-800">
                    {viewReportAssignment.finalScore?.toFixed(1)} / 10
                  </div>
                </div>
              </div>

              {/* Lista dos Critérios */}
              <div className="space-y-2">
                <div className="font-bold text-slate-900 text-xs">
                  Detalhamento dos Critérios Avaliados:
                </div>
                <div className="space-y-1.5 border border-slate-200 rounded-xl p-3 bg-slate-50/50">
                  {viewReportAssignment.criteriaAnswers.map((crit, idx) => (
                    <div
                      key={crit.criterionId || idx}
                      className="flex items-center justify-between p-2 rounded-lg bg-white border border-slate-100 text-xs"
                    >
                      <div className="flex items-center gap-2">
                        {crit.checked ? (
                          <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        ) : (
                          <span className="w-4 h-4 rounded-full border border-slate-300 flex items-center justify-center shrink-0">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                          </span>
                        )}
                        <span className={crit.checked ? 'font-medium text-slate-800' : 'text-slate-500'}>
                          {crit.name}
                        </span>
                      </div>
                      <span className="text-[11px] font-mono font-bold text-slate-500 shrink-0 ml-2">
                        Peso {crit.weight}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Observações */}
              {viewReportAssignment.generalObservations && (
                <div className="p-4 bg-emerald-50/60 border border-emerald-200/80 rounded-xl space-y-1">
                  <div className="font-bold text-emerald-950 text-xs">
                    Comentários e Orientações do Instrutor:
                  </div>
                  <p className="text-slate-700 italic leading-relaxed">
                    &ldquo;{viewReportAssignment.generalObservations}&rdquo;
                  </p>
                </div>
              )}
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex justify-end shrink-0">
              <button
                type="button"
                onClick={() => setViewReportAssignment(null)}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Espelho da Guia Médica */}
      {guideMirrorChar && (
        <GuideMirrorModal
          character={guideMirrorChar}
          exerciseTitle={guideMirrorExerciseTitle}
          onClose={() => setGuideMirrorChar(null)}
        />
      )}
    </div>
  );
};
