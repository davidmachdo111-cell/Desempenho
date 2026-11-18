import React, { useState, useMemo } from 'react';
import {
  GraduationCap,
  CheckCircle2,
  Clock,
  ClipboardCheck,
  BookOpen,
  User,
  Send,
  X,
  Lock,
  UserCheck,
  CheckSquare,
  Square,
} from 'lucide-react';
import { usePortalStore } from '../../../context/PortalStoreContext';
import { useToast } from '../../../context/ToastContext';
import {
  canSeeFinalVerdict,
  Checklist,
  CollaboratorChecklist,
  CollaboratorTrackStep,
  CriteriaAnswerSnapshot,
  Survey,
  SurveyAnswerItem,
  getCellName,
  normalizeStageName,
} from '../../../types/portal';

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
    surveys,
    submitSurveyResponse,
    submitCollaboratorChecklistSelfAssessment,
  } = usePortalStore();
  const { showToast } = useToast();
  const canSeeVerdict = canSeeFinalVerdict(currentUser);

  // Modal para Responder Pesquisa
  const [activeSurveyToAnswer, setActiveSurveyToAnswer] = useState<Survey | null>(null);
  const [surveyAnswers, setSurveyAnswers] = useState<Record<string, SurveyAnswerItem>>({});
  const [isSubmittingSurvey, setIsSubmittingSurvey] = useState(false);

  // Modal para Preencher Checklist (etapas com filledBy === 'collaborator')
  const [activeChecklistModal, setActiveChecklistModal] = useState<{
    step: CollaboratorTrackStep;
    checklist: Checklist;
  } | null>(null);
  const [checklistCriteriaAnswers, setChecklistCriteriaAnswers] = useState<CriteriaAnswerSnapshot[]>([]);
  const [checklistObservations, setChecklistObservations] = useState('');
  const [isSubmittingChecklist, setIsSubmittingChecklist] = useState(false);

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
    return byName || null;
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

  // Iniciar Resposta de Pesquisa
  const handleStartSurvey = (survey: Survey) => {
    setActiveSurveyToAnswer(survey);
    const initial: Record<string, SurveyAnswerItem> = {};
    survey.questions.forEach((q) => {
      initial[q.id] = { selectedOption: '', observation: '' };
    });
    setSurveyAnswers(initial);
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
            showToast(`Por favor, responda a pergunta obrigatória: "${q.text}".`, 'error');
            return;
          }
        } else {
          if (!ans?.selectedOption) {
            showToast(
              `Por favor, selecione uma opção para a pergunta obrigatória: "${q.text}".`,
              'error'
            );
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
      showToast(res.message, 'success');
      setActiveSurveyToAnswer(null);
    } else {
      showToast(res.message, 'error');
    }
  };

  // Iniciar Preenchimento de Checklist pelo Colaborador
  const handleStartChecklist = (step: CollaboratorTrackStep, checklist: Checklist) => {
    setActiveChecklistModal({ step, checklist });
    setChecklistCriteriaAnswers(
      checklist.criteria.map((c) => ({
        criterionId: c.id,
        name: c.name,
        weight: c.weight,
        checked: false,
        notes: '',
      }))
    );
    setChecklistObservations('');
  };

  const handleToggleChecklistCriterion = (criterionId: string) => {
    setChecklistCriteriaAnswers((prev) =>
      prev.map((item) =>
        item.criterionId === criterionId ? { ...item, checked: !item.checked } : item
      )
    );
  };

  const handleChecklistCriterionNoteChange = (criterionId: string, notes: string) => {
    setChecklistCriteriaAnswers((prev) =>
      prev.map((item) =>
        item.criterionId === criterionId ? { ...item, notes } : item
      )
    );
  };

  const handleSubmitChecklistForm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChecklistModal || !currentCollaborator) return;

    setIsSubmittingChecklist(true);
    const res = await submitCollaboratorChecklistSelfAssessment({
      collaboratorId: currentCollaborator.id,
      stepId: activeChecklistModal.step.id,
      checklistId: activeChecklistModal.checklist.id,
      criteriaAnswers: checklistCriteriaAnswers,
      generalObservations: checklistObservations,
    });
    setIsSubmittingChecklist(false);

    if (res.success) {
      showToast(res.message, 'success');
      setActiveChecklistModal(null);
    } else {
      showToast(res.message, 'error');
    }
  };



  if (!currentCollaborator || collaboratorTrack.length === 0) {
    return (
      <div className="min-h-[65vh] flex items-center justify-center p-4">
        <div className="bg-white border border-slate-200 rounded-2xl shadow-xs max-w-lg w-full p-8 sm:p-10 text-center space-y-4">
          <div className="w-14 h-14 rounded-2xl bg-emerald-50 border border-emerald-200 text-[#0f3e2e] flex items-center justify-center mx-auto">
            <GraduationCap className="w-7 h-7 text-emerald-700" />
          </div>

          <div className="space-y-1.5">
            <h1 className="text-lg font-black text-slate-900">
              Nenhum vínculo registrado para o colaborador.
            </h1>
            <p className="text-xs text-slate-600 leading-relaxed max-w-md mx-auto">
              Seu perfil corporativo está ativo, mas ainda aguarda a configuração e vinculação da trilha de desenvolvimento pela liderança ou equipe de treinamento.
            </p>
          </div>

          {currentUser && (
            <div className="pt-3 border-t border-slate-100 flex items-center justify-center gap-2 text-[11px] text-slate-500">
              <span className="font-semibold text-slate-700">{currentUser.fullName}</span>
              <span>·</span>
              <span className="font-mono text-emerald-800 font-bold">@{currentUser.username}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

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

          {/* Cartão de Resumo das Etapas */}
          <div className="bg-white/10 backdrop-blur-xs border border-white/15 rounded-xl p-4 flex items-center gap-5 shrink-0">
            <div>
              <div className="text-[11px] text-emerald-200 font-semibold uppercase tracking-wider">
                Status da Trilha
              </div>
              <div className="text-sm font-bold text-white mt-1 flex items-center gap-1.5">
                {currentCollaborator?.isTrackFinalized ? (
                  canSeeVerdict ? (
                    currentCollaborator.guardianVerdict === 'necessita_reforco' ? (
                      <span
                        title="Verificar a continuidade com a liderança do colaborador"
                        className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-amber-100 text-amber-900 border border-amber-300"
                      >
                        <span>Validação da liderança</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-900 border border-emerald-300">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Aprovado</span>
                      </span>
                    )
                  ) : (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-slate-100 text-slate-700 border border-slate-300">
                      <span>Finalizado</span>
                    </span>
                  )
                ) : totalStages > 0 && completedStages === totalStages ? (
                  <>
                    <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                    <span>Concluído</span>
                  </>
                ) : completedStages > 0 ? (
                  <span>Em Treinamento</span>
                ) : (
                  <span>A Realizar</span>
                )}
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
                Acompanhe o status de cada etapa concluída e responda às pesquisas da sua trilha.
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

                const isFilledByCollaborator = step.filledBy === 'collaborator';

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

                        {/* Badge da Etapa / Semana */}
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                          {normalizeStageName(step.stageName)}
                        </span>

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

                    </div>

                    {/* Lado Direito: Ações */}
                    <div className="flex items-center gap-3 shrink-0 self-end md:self-center">
                      {isCompleted && (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-xs">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Concluído</span>
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

                      {/* Etapa de Checklist Disponível: preenchimento pelo colaborador OU simulação com instrutor */}
                      {isAvailable &&
                        isChecklist &&
                        (isFilledByCollaborator &&
                        targetChecklist &&
                        !currentCollaborator?.isTrackFinalized ? (
                          <button
                            type="button"
                            onClick={() => handleStartChecklist(step, targetChecklist)}
                            className="px-4 py-2 text-xs font-bold text-white bg-[#0f3e2e] hover:bg-emerald-900 rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                          >
                            <ClipboardCheck className="w-3.5 h-3.5" />
                            <span>Preencher Checklist</span>
                          </button>
                        ) : (
                          <div className="text-xs text-emerald-800 font-semibold bg-emerald-50 border border-emerald-200 px-3 py-1.5 rounded-xl flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Liberada para Simulação / Avaliação com Instrutor</span>
                          </div>
                        ))}

                      {/* Etapa Bloqueada */}
                      {isLocked && (
                        <div className="text-xs text-slate-400 font-medium italic flex items-center gap-1.5 bg-slate-100 px-3 py-1.5 rounded-xl border border-slate-200">
                          <Lock className="w-3.5 h-3.5 text-slate-400" />
                          <span>Bloqueada (Etapa Anterior Pendente)</span>
                        </div>
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
                      {isCompleted ? (
                        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-800 border border-emerald-200 font-bold text-xs">
                          <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                          <span>Concluído</span>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 italic">
                          Aguardando avaliação
                        </div>
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
      {/* MODAL PARA PREENCHIMENTO DE CHECKLIST PELO COLABORADOR */}
      {/* ========================================================= */}
      {activeChecklistModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-[#0f3e2e] text-white flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-emerald-600 flex items-center justify-center font-bold">
                  <ClipboardCheck className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="font-bold text-sm">{activeChecklistModal.checklist.title}</h3>
                  <p className="text-[11px] text-emerald-200">
                    Marque os critérios realizados e registre observações opcionais
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setActiveChecklistModal(null)}
                className="text-emerald-200 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmitChecklistForm} className="flex-1 overflow-y-auto p-6 space-y-5 text-xs">
              {activeChecklistModal.checklist.description && (
                <div className="p-3 bg-emerald-50/60 border border-emerald-200/80 rounded-xl text-emerald-950 text-xs leading-relaxed">
                  {activeChecklistModal.checklist.description}
                </div>
              )}

              <div className="space-y-3">
                <div className="text-[11px] font-bold text-slate-600 uppercase tracking-wider">
                  Critérios do Checklist ({checklistCriteriaAnswers.length})
                </div>

                {checklistCriteriaAnswers.length === 0 ? (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl text-slate-500 text-center">
                    Este checklist não possui critérios cadastrados. Adicione observações e conclua a etapa.
                  </div>
                ) : (
                  checklistCriteriaAnswers.map((criterion, idx) => (
                    <div
                      key={criterion.criterionId}
                      className={`p-4 rounded-xl border transition-all space-y-2.5 ${
                        criterion.checked
                          ? 'bg-emerald-50/50 border-emerald-300'
                          : 'bg-slate-50/70 border-slate-200'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => handleToggleChecklistCriterion(criterion.criterionId)}
                        className="w-full flex items-start gap-2.5 text-left cursor-pointer"
                      >
                        <span className="mt-0.5 shrink-0">
                          {criterion.checked ? (
                            <CheckSquare className="w-4 h-4 text-emerald-700" />
                          ) : (
                            <Square className="w-4 h-4 text-slate-400" />
                          )}
                        </span>
                        <span
                          className={`font-semibold text-xs leading-snug ${
                            criterion.checked ? 'text-emerald-950' : 'text-slate-800'
                          }`}
                        >
                          {idx + 1}. {criterion.name}
                        </span>
                      </button>

                      <input
                        type="text"
                        value={criterion.notes || ''}
                        onChange={(e) =>
                          handleChecklistCriterionNoteChange(criterion.criterionId, e.target.value)
                        }
                        placeholder="Observação opcional sobre este critério..."
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                      />
                    </div>
                  ))
                )}
              </div>

              <div className="space-y-1.5">
                <label className="block font-bold text-slate-800 text-xs">
                  Observações Gerais (Opcional)
                </label>
                <textarea
                  rows={3}
                  value={checklistObservations}
                  onChange={(e) => setChecklistObservations(e.target.value)}
                  placeholder="Descreva percepções, dúvidas ou comentários sobre esta etapa..."
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 text-xs resize-none"
                />
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setActiveChecklistModal(null)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingChecklist}
                  className="px-5 py-2 bg-[#0f3e2e] hover:bg-emerald-900 text-white font-bold rounded-xl shadow-sm transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isSubmittingChecklist ? 'Enviando...' : 'Concluir Checklist'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
