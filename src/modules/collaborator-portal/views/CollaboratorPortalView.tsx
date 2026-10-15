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
  Lock,
  UserCheck,
  Play,
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
    completeCollaboratorTrackStep,
  } = usePortalStore();


  // Modal de Relatório do Colaborador (Laudo Oficial Concluído)
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


  // Trilha individual sequencial do Colaborador
  const collaboratorTrack = useMemo(() => {
    return currentCollaborator?.track || [];
  }, [currentCollaborator]);

  // Métricas do Colaborador (calculadas com base na trilha individual se configurada)
  const totalStages = collaboratorTrack.length > 0 ? collaboratorTrack.length : myAssignments.length;
  const completedStages =
    collaboratorTrack.length > 0
      ? collaboratorTrack.filter((s) => s.status === 'concluido').length
      : myAssignments.filter((a) => a.status === 'concluido').length;
  const progressPct = totalStages > 0 ? Math.round((completedStages / totalStages) * 100) : 0;

  const averageScore = useMemo(() => {
    if (collaboratorTrack.length > 0) {
      const scores = collaboratorTrack
        .filter((s) => s.status === 'concluido' && typeof s.finalScore === 'number')
        .map((s) => s.finalScore as number);
      if (scores.length === 0) return null;
      const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
      return Number(avg.toFixed(1));
    }
    const scores = myAssignments
      .filter((a) => a.status === 'concluido' && typeof a.finalScore === 'number')
      .map((a) => a.finalScore as number);
    if (scores.length === 0) return null;
    const avg = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    return Number(avg.toFixed(1));
  }, [collaboratorTrack, myAssignments]);

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
      // Se houver etapa correspondente na trilha, conclui
      if (currentCollaborator) {
        const step = (currentCollaborator.track || []).find(
          (s) => s.type === 'survey' && s.refId === activeSurveyToAnswer.id
        );
        if (step) {
          await completeCollaboratorTrackStep(currentCollaborator.id, step.id);
        }
      }
      setTimeout(() => {
        setActiveSurveyToAnswer(null);
      }, 1000);
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
      {/* 2. MINHA TRILHA DE APRENDIZAGEM & AVALIAÇÕES */}
      {/* ========================================================= */}
      <div className="space-y-4">
        <div className="flex items-center justify-between border-b border-slate-200 pb-3">
          <div className="flex items-center gap-2.5 text-emerald-950 font-bold text-sm">
            <BookOpen className="w-4 h-4 text-emerald-700" />
            <span>Minha Trilha & Avaliações</span>
          </div>
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
            {collaboratorTrack.length > 0 ? `${collaboratorTrack.length} etapas` : `${myAssignments.length} checklists`}
          </span>
        </div>
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

          {collaboratorTrack.length === 0 && myAssignments.length === 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center space-y-3">
              <div className="w-12 h-12 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
                <BookOpen className="w-6 h-6" />
              </div>
              <h3 className="font-bold text-sm text-slate-700">
                Nenhuma atividade vinculada à sua trilha no momento
              </h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto">
                Seu instrutor ou administrador configurará em breve as etapas da sua trilha de treinamento.
              </p>
            </div>
          ) : collaboratorTrack.length > 0 ? (
            <div className="space-y-3">
              {collaboratorTrack.map((step, index) => {
                const isChecklist = step.type === 'checklist';
                const isSurvey = step.type === 'survey';
                const isCompleted = step.status === 'concluido';
                const isAvailable = step.status === 'disponivel';
                const isLocked = step.status === 'bloqueado';

                const targetChecklist = isChecklist
                  ? checklists.find((c) => c.id === step.refId)
                  : null;
                const targetSurvey = isSurvey
                  ? surveys.find((s) => s.id === step.refId)
                  : null;
                const assignment = isChecklist
                  ? myAssignments.find(
                      (a) => a.id === step.collaboratorChecklistId || a.checklistId === step.refId
                    )
                  : null;

                const isFilledByCollaborator = step.filledBy === 'collaborator';
                const isFilledByEvaluator = step.filledBy === 'evaluator';

                return (
                  <div
                    key={step.id}
                    className={`bg-white border rounded-2xl p-5 transition-all shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4 ${
                      isCompleted
                        ? 'border-emerald-200 bg-emerald-50/15'
                        : isAvailable
                        ? 'border-emerald-400 ring-1 ring-emerald-200 bg-white'
                        : 'border-slate-200 bg-slate-50/60 opacity-80'
                    }`}
                  >
                    <div className="space-y-2 flex-1">
                      <div className="flex items-center gap-2.5 flex-wrap">
                        <span
                          className={`w-7 h-7 rounded-full font-bold text-xs flex items-center justify-center shrink-0 ${
                            isCompleted
                              ? 'bg-emerald-700 text-white'
                              : isAvailable
                              ? 'bg-[#0f3e2e] text-white'
                              : 'bg-slate-200 text-slate-500'
                          }`}
                        >
                          {index + 1}
                        </span>

                        <h3 className="font-bold text-sm text-slate-900">{step.title}</h3>

                        {/* Badge do Tipo de Atividade */}
                        <span
                          className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
                            isChecklist
                              ? 'bg-emerald-50 text-emerald-900 border-emerald-200'
                              : 'bg-purple-50 text-purple-900 border-purple-200'
                          }`}
                        >
                          {isChecklist ? 'Checklist' : 'Pesquisa de Satisfação'}
                        </span>

                        {/* Badge de Responsável */}
                        <span className="text-[10px] text-slate-500 bg-slate-100 px-2 py-0.5 rounded border border-slate-200 flex items-center gap-1">
                          {isFilledByCollaborator ? (
                            <>
                              <User className="w-3 h-3 text-slate-500" />
                              <span>Preenchido por Você</span>
                            </>
                          ) : (
                            <>
                              <UserCheck className="w-3 h-3 text-emerald-700" />
                              <span>Preenchido pelo Instrutor/Avaliador</span>
                            </>
                          )}
                        </span>

                        {/* Badge de Status */}
                        <span
                          className={`inline-flex items-center gap-1 text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                            isCompleted
                              ? 'bg-emerald-100 text-emerald-900 border-emerald-300'
                              : isAvailable
                              ? 'bg-blue-50 text-blue-900 border-blue-200'
                              : 'bg-slate-100 text-slate-500 border-slate-200'
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
                              <span>Disponível para Realização</span>
                            </>
                          ) : (
                            <>
                              <Lock className="w-3 h-3 text-slate-400" />
                              <span>Bloqueado (Conclua a etapa anterior)</span>
                            </>
                          )}
                        </span>
                      </div>

                      {/* Descrição */}
                      <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                        {isChecklist
                          ? targetChecklist?.description || 'Avaliação operacional com critérios práticos de atendimento.'
                          : targetSurvey?.description || 'Pesquisa de satisfação e percepção sobre o treinamento.'}
                      </p>

                      {/* Feedback ou Observações */}
                      {isCompleted && assignment?.generalObservations && (
                        <div className="p-3 bg-white border border-emerald-200 rounded-xl text-xs space-y-1">
                          <div className="font-bold text-emerald-950 flex items-center gap-1.5 text-[11px]">
                            <MessageSquare className="w-3.5 h-3.5 text-emerald-700" />
                            <span>Observações do Avaliador:</span>
                          </div>
                          <p className="text-slate-700 italic leading-relaxed">
                            &ldquo;{assignment.generalObservations}&rdquo;
                          </p>
                        </div>
                      )}
                    </div>

                    {/* Lado Direito: Ações & Notas */}
                    <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                      {isCompleted && typeof step.finalScore === 'number' && (
                        <div className="text-right">
                          <div className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">
                            Nota Obtida
                          </div>
                          <div className="font-mono text-xl font-bold text-emerald-900 bg-emerald-100/80 px-3 py-1 rounded-lg border border-emerald-300 inline-block mt-0.5">
                            {step.finalScore.toFixed(1)} / 10
                          </div>
                        </div>
                      )}

                      {/* Botão de Ação: Se for Pesquisa e estiver disponível, colaborador pode responder */}
                      {isAvailable && isSurvey && targetSurvey && (
                        <button
                          type="button"
                          onClick={() => handleStartSurvey(targetSurvey)}
                          className="px-4 py-2 text-xs font-bold text-white bg-purple-700 hover:bg-purple-800 rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                        >
                          <ClipboardCheck className="w-3.5 h-3.5" />
                          <span>Responder Pesquisa de Satisfação</span>
                        </button>
                      )}

                      {/* Etapa de Checklist Disponível: aguardando condução da simulação pelo instrutor */}
                      {isAvailable && isChecklist && (
                        <div className="text-xs text-emerald-800 font-semibold bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-emerald-600" />
                          <span>Liberada para Simulação / Avaliação com Instrutor</span>
                        </div>
                      )}

                      {/* Etapa Bloqueada */}
                      {isLocked && (
                        <div className="text-xs text-slate-400 font-medium italic flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                          <Lock className="w-3.5 h-3.5 text-slate-400" />
                          <span>Bloqueada (Etapa Anterior Pendente)</span>
                        </div>
                      )}

                      {/* Botão de Ver Laudo Oficial (se Checklist Concluído) */}
                      {isCompleted && isChecklist && assignment && (
                        <button
                          type="button"
                          onClick={() => setViewReportAssignment(assignment)}
                          className="px-3.5 py-2 text-xs font-bold text-white bg-[#0f3e2e] hover:bg-emerald-900 rounded-xl transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Visualizar Laudo Oficial & Feedback</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
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
                      </div>

                      {chk?.description && (
                        <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed">
                          {chk.description}
                        </p>
                      )}
                    </div>

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

                      {isCompleted && (
                        <button
                          type="button"
                          onClick={() => setViewReportAssignment(asg)}
                          className="px-3.5 py-2 text-xs font-bold text-white bg-[#0f3e2e] hover:bg-emerald-900 rounded-xl transition-colors flex items-center gap-1.5 shadow-xs cursor-pointer"
                        >
                          <FileText className="w-3.5 h-3.5" />
                          <span>Visualizar Laudo Oficial & Feedback</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>


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


    </div>
  );
};
