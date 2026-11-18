import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Eye,
  FileText,
  Download,
  CheckSquare,
  CheckCheck,
  Check,
  Building2,
  Lock,
  Save,
} from 'lucide-react';
import { usePortalStore } from '../../../context/PortalStoreContext';
import { useToast } from '../../../context/ToastContext';
import {
  canSeeFinalVerdict,
  canViewRestrictedItem,
  CollaboratorStatus,
  CriteriaAnswerSnapshot,
  Character,
  Exercise,
  OfficialCell,
  OFFICIAL_CELLS,
  getCharacterGuides,
  getExerciseAttachments,
  normalizePhrases,
} from '../../../types/portal';
import { CUSTOMER_TIER_BADGES } from '../../characters/views/CharactersManagementView';
import { GuideMirrorModal } from '../../../components/GuideMirrorModal';
import {
  AttachedGuideViewerModal,
  AttachedGuideViewerData,
} from '../../../components/AttachedGuideViewerModal';
import { downloadGuidePdf, downloadMultipleGuidesPdf } from '../../../lib/downloadHelpers';

interface EvaluationExecutionViewProps {
  assignmentId: string;
  onBack: (collaboratorId?: string) => void;
}

function calculateWeightedScore(criteria: CriteriaAnswerSnapshot[]): number {
  if (criteria.length === 0) return 10;
  let totalPossibleWeight = 0;
  let earnedWeight = 0;

  criteria.forEach((item) => {
    const w = item.weight || 1;
    totalPossibleWeight += w;
    if (item.checked) {
      earnedWeight += w;
    }
  });

  if (totalPossibleWeight === 0) return 10;
  return Math.round((earnedWeight / totalPossibleWeight) * 100) / 10;
}

export const EvaluationExecutionView: React.FC<EvaluationExecutionViewProps> = ({
  assignmentId,
  onBack,
}) => {
  const {
    collaboratorChecklists,
    collaborators,
    checklists,
    exercises,
    characters,
    currentUser,
    hasPermission,
    saveEvaluationProgress,
    completeEvaluation,
  } = usePortalStore();
  const { showToast } = useToast();

  const canApplyEvaluations = hasPermission('can_apply_evaluations');
  const pdfGeneratedBy = currentUser
    ? { fullName: currentUser.fullName, username: currentUser.username }
    : undefined;
  const [guideModalChar, setGuideModalChar] = useState<Character | null>(null);
  const [guideModalExerciseTitle, setGuideModalExerciseTitle] = useState<string | undefined>(undefined);
  const [attachedGuideModal, setAttachedGuideModal] = useState<AttachedGuideViewerData | null>(null);
  const [selectedExerciseTab, setSelectedExerciseTab] = useState<string>('0');

  // Localiza a atribuição ativa
  const assignment = useMemo(
    () => collaboratorChecklists.find((c) => c.id === assignmentId),
    [collaboratorChecklists, assignmentId]
  );

  const collaborator = useMemo(
    () => (assignment ? collaborators.find((c) => c.id === assignment.collaboratorId) : null),
    [assignment, collaborators]
  );

  const checklist = useMemo(
    () => (assignment ? checklists.find((c) => c.id === assignment.checklistId) : null),
    [assignment, checklists]
  );

  // Todos os cenários de exercícios vinculados ao checklist (na ordem configurada)
  const linkedExercises = useMemo(() => {
    if (!checklist || !checklist.exerciseIds || checklist.exerciseIds.length === 0) return [];
    return checklist.exerciseIds
      .map((id) => exercises.find((e) => e.id === id))
      .filter(Boolean) as Exercise[];
  }, [checklist, exercises]);

  const displayedExercises = useMemo(() => {
    if (linkedExercises.length === 0) return [];
    if (linkedExercises.length === 1 || selectedExerciseTab === 'all') {
      return linkedExercises;
    }
    const idx = Number(selectedExerciseTab);
    const chosen = Number.isInteger(idx) && linkedExercises[idx] ? linkedExercises[idx] : linkedExercises[0];
    return chosen ? [chosen] : [];
  }, [linkedExercises, selectedExerciseTab]);

  const allLinkedCharacters = useMemo(() => {
    const seen = new Set<string>();
    const list: Character[] = [];
    linkedExercises.forEach((ex) => {
      ex.characterIds.forEach((id) => {
        if (!seen.has(id)) {
          const found = characters.find((c) => c.id === id);
          if (found) {
            seen.add(id);
            list.push(found);
          }
        }
      });
    });
    return list;
  }, [linkedExercises, characters]);

  const buildInitialCriteria = (): CriteriaAnswerSnapshot[] => {
    if (assignment && assignment.criteriaAnswers && assignment.criteriaAnswers.length > 0) {
      return assignment.criteriaAnswers;
    }
    if (checklist) {
      return checklist.criteria.map((c) => ({
        criterionId: c.id,
        name: c.name,
        weight: c.weight,
        checked: false,
        notes: '',
      }));
    }
    return [];
  };

  // Critérios diretos do checklist
  const [criteriaState, setCriteriaState] = useState<CriteriaAnswerSnapshot[]>(buildInitialCriteria);
  const [generalObservations, setGeneralObservations] = useState<string>(
    assignment?.generalObservations || ''
  );
  const [selectedResultStatus, setSelectedResultStatus] = useState<CollaboratorStatus>('aprovado');
  const [isFinishing, setIsFinishing] = useState(false);
  const [lastAutoSavedAt, setLastAutoSavedAt] = useState<string | null>(null);
  const [hasAutoSavedDraft, setHasAutoSavedDraft] = useState(false);

  const autoSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const latestCriteriaRef = useRef<CriteriaAnswerSnapshot[]>(criteriaState);
  const latestObservationsRef = useRef<string>(generalObservations);

  latestCriteriaRef.current = criteriaState;
  latestObservationsRef.current = generalObservations;

  const draftStorageKey = useMemo(() => {
    if (!assignment) return null;
    return `portal_eval_draft_${assignment.collaboratorId}_${assignment.checklistId}`;
  }, [assignment]);

  const writeLocalDraft = (
    nextCriteria: CriteriaAnswerSnapshot[],
    nextObservations: string
  ) => {
    if (!draftStorageKey) return;
    try {
      const nowTime = new Date().toLocaleTimeString('pt-BR', {
        hour: '2-digit',
        minute: '2-digit',
      });
      localStorage.setItem(
        draftStorageKey,
        JSON.stringify({
          criteriaAnswers: nextCriteria,
          generalObservations: nextObservations,
          savedAt: new Date().toISOString(),
        })
      );
      setHasAutoSavedDraft(true);
      setLastAutoSavedAt(nowTime);
    } catch {
      // ignora erro de quota do localStorage
    }
  };

  const clearLocalDraft = () => {
    if (!draftStorageKey) return;
    try {
      localStorage.removeItem(draftStorageKey);
    } catch {
      // ignore
    }
    setHasAutoSavedDraft(false);
  };

  // Ressincroniza estados locais apenas quando mudar de avaliação (assignmentId) e restaura rascunho se houver
  useEffect(() => {
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    const baseCriteria: CriteriaAnswerSnapshot[] =
      assignment && assignment.criteriaAnswers && assignment.criteriaAnswers.length > 0
        ? assignment.criteriaAnswers
        : checklist
        ? checklist.criteria.map((c) => ({
            criterionId: c.id,
            name: c.name,
            weight: c.weight,
            checked: false,
            notes: '',
          }))
        : [];

    let restoredCriteria = baseCriteria;
    let restoredObservations = assignment?.generalObservations || '';
    let restoredSavedAt: string | null = null;
    let restoredFromLocalDraft = false;

    if (
      draftStorageKey &&
      canApplyEvaluations &&
      !collaborator?.isTrackFinalized
    ) {
      try {
        const rawDraft = localStorage.getItem(draftStorageKey);
        if (rawDraft) {
          const parsed = JSON.parse(rawDraft) as {
            criteriaAnswers?: CriteriaAnswerSnapshot[];
            generalObservations?: string;
            savedAt?: string;
          };

          if (Array.isArray(parsed.criteriaAnswers) && parsed.criteriaAnswers.length > 0) {
            const draftMap = new Map(
              parsed.criteriaAnswers.map((item) => [item.criterionId, item])
            );
            restoredCriteria = baseCriteria.map((item) => {
              const matched = draftMap.get(item.criterionId);
              if (!matched) return item;
              return {
                ...item,
                checked: Boolean(matched.checked),
                notes: typeof matched.notes === 'string' ? matched.notes : item.notes || '',
              };
            });
            restoredFromLocalDraft = true;
          }

          if (typeof parsed.generalObservations === 'string') {
            restoredObservations = parsed.generalObservations;
            restoredFromLocalDraft = true;
          }

          if (parsed.savedAt) {
            const parsedDate = new Date(parsed.savedAt);
            if (!Number.isNaN(parsedDate.getTime())) {
              restoredSavedAt = parsedDate.toLocaleTimeString('pt-BR', {
                hour: '2-digit',
                minute: '2-digit',
              });
            }
          }
        }
      } catch {
        // ignora rascunho corrompido
      }
    }

    setCriteriaState(restoredCriteria);
    setGeneralObservations(restoredObservations);
    setHasAutoSavedDraft(restoredFromLocalDraft);
    setLastAutoSavedAt(restoredSavedAt);
    setSelectedExerciseTab('0');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [assignmentId, draftStorageKey]);

  useEffect(() => {
    return () => {
      if (autoSaveTimerRef.current) {
        clearTimeout(autoSaveTimerRef.current);
      }
    };
  }, []);

  // Cálculo da nota ponderada em tempo real (0 a 10)
  const currentScore = useMemo(() => calculateWeightedScore(criteriaState), [criteriaState]);

  const allCriteriaChecked = useMemo(
    () => criteriaState.length > 0 && criteriaState.every((c) => c.checked),
    [criteriaState]
  );

  // Ciclo de vida dinâmico: sugere automaticamente status baseado na pontuação (>= 7.0: Aprovado, < 7.0: Validação da liderança)
  useEffect(() => {
    setSelectedResultStatus(currentScore >= 7.0 ? 'aprovado' : 'necessita_reforco');
  }, [currentScore]);

  if (!assignment || !collaborator || !checklist) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center max-w-lg mx-auto shadow-xs space-y-4">
        <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto" />
        <h2 className="text-lg font-bold text-slate-900">Avaliação não encontrada</h2>
        <p className="text-xs text-slate-500">
          O registro de avaliação solicitado não existe ou foi removido.
        </p>
        <button
          type="button"
          onClick={() => onBack(collaborator?.id)}
          className="px-4 py-2 text-xs font-bold text-white bg-[#0f3e2e] hover:bg-emerald-900 rounded-xl transition-colors cursor-pointer"
        >
          Voltar para a Ficha
        </button>
      </div>
    );
  }

  if (!canViewRestrictedItem(currentUser, checklist.visibility)) {
    return (
      <div className="bg-white border border-amber-200 rounded-2xl p-12 text-center max-w-lg mx-auto shadow-xs space-y-4">
        <Lock className="w-12 h-12 text-amber-600 mx-auto" />
        <h2 className="text-lg font-bold text-slate-900">Conteúdo Restrito</h2>
        <p className="text-xs text-slate-600 leading-relaxed">
          Este checklist está classificado como <strong>Restrito</strong>. Apenas Administradores ou usuários com a tag <strong>Guardião Anfitrião</strong> podem visualizar ou aplicar esta avaliação.
        </p>
        <button
          type="button"
          onClick={() => onBack(collaborator.id)}
          className="px-4 py-2 text-xs font-bold text-white bg-[#0f3e2e] hover:bg-emerald-900 rounded-xl transition-colors cursor-pointer"
        >
          Voltar para a Ficha
        </button>
      </div>
    );
  }

  if (collaborator.isTrackFinalized && !canSeeFinalVerdict(currentUser)) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center max-w-lg mx-auto shadow-xs space-y-4">
        <Lock className="w-12 h-12 text-slate-500 mx-auto" />
        <h2 className="text-lg font-bold text-slate-900">Trilha Finalizada</h2>
        <p className="text-xs text-slate-600 leading-relaxed">
          Esta trilha já foi finalizada. O acesso à ficha, ao roteiro e aos detalhes da avaliação está bloqueado para este perfil.
        </p>
        <button
          type="button"
          onClick={() => onBack()}
          className="px-4 py-2 text-xs font-bold text-white bg-[#0f3e2e] hover:bg-emerald-900 rounded-xl transition-colors cursor-pointer"
        >
          Voltar para Colaboradores
        </button>
      </div>
    );
  }

  const isTrackLocked = Boolean(collaborator.isTrackFinalized);
  const canEditEvaluation = canApplyEvaluations && !isTrackLocked;

  const persistProgressNow = (
    nextCriteria: CriteriaAnswerSnapshot[],
    nextObservations: string
  ) => {
    if (!canEditEvaluation || isFinishing) return;
    writeLocalDraft(nextCriteria, nextObservations);
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    const nextScore = calculateWeightedScore(nextCriteria);
    void saveEvaluationProgress({
      collaboratorChecklistId: assignment.id,
      instructorAuxiliarId: currentUser?.id,
      criteriaAnswers: nextCriteria,
      finalScore: nextScore,
      generalObservations: nextObservations.trim() || undefined,
    }).then(() => {
      setLastAutoSavedAt(
        new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
      );
    });
  };

  const scheduleDebouncedAutoSave = (
    nextCriteria: CriteriaAnswerSnapshot[],
    nextObservations: string
  ) => {
    if (!canEditEvaluation || isFinishing) return;
    writeLocalDraft(nextCriteria, nextObservations);
    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
    }
    autoSaveTimerRef.current = setTimeout(() => {
      autoSaveTimerRef.current = null;
      const nextScore = calculateWeightedScore(nextCriteria);
      void saveEvaluationProgress({
        collaboratorChecklistId: assignment.id,
        instructorAuxiliarId: currentUser?.id,
        criteriaAnswers: nextCriteria,
        finalScore: nextScore,
        generalObservations: nextObservations.trim() || undefined,
      }).then(() => {
        setLastAutoSavedAt(
          new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
        );
      });
    }, 450);
  };

  const handleToggleCheck = (criterionId: string) => {
    if (!canEditEvaluation) return;
    const nextCriteria = criteriaState.map((item) =>
      item.criterionId === criterionId ? { ...item, checked: !item.checked } : item
    );
    setCriteriaState(nextCriteria);
    persistProgressNow(nextCriteria, latestObservationsRef.current);
  };

  const handleToggleAllCriteria = () => {
    if (!canEditEvaluation || criteriaState.length === 0) return;
    const targetChecked = !allCriteriaChecked;
    const nextCriteria = criteriaState.map((item) => ({ ...item, checked: targetChecked }));
    setCriteriaState(nextCriteria);
    persistProgressNow(nextCriteria, latestObservationsRef.current);
  };

  const handleUpdateNotes = (criterionId: string, notes: string) => {
    if (!canEditEvaluation) return;
    const nextCriteria = criteriaState.map((item) =>
      item.criterionId === criterionId ? { ...item, notes } : item
    );
    setCriteriaState(nextCriteria);
    scheduleDebouncedAutoSave(nextCriteria, latestObservationsRef.current);
  };

  const handleUpdateGeneralObservations = (value: string) => {
    setGeneralObservations(value);
    if (!canEditEvaluation) return;
    scheduleDebouncedAutoSave(latestCriteriaRef.current, value);
  };

  const handleFinishEvaluation = async () => {
    if (!canEditEvaluation) {
      showToast(
        isTrackLocked
          ? 'Esta trilha já foi finalizada e não permite alterações.'
          : 'Você não possui permissão para finalizar avaliações.',
        'error'
      );
      return;
    }

    if (autoSaveTimerRef.current) {
      clearTimeout(autoSaveTimerRef.current);
      autoSaveTimerRef.current = null;
    }

    setIsFinishing(true);
    const res = await completeEvaluation({
      collaboratorChecklistId: assignment.id,
      criteriaAnswers: criteriaState,
      finalScore: currentScore,
      generalObservations: generalObservations.trim() || undefined,
      instructorAuxiliarId: currentUser?.id,
      updateCollaboratorStatus: selectedResultStatus,
    });
    setIsFinishing(false);

    if (res.success) {
      clearLocalDraft();
      showToast('Avaliação concluída e registrada com sucesso!', 'success');
      onBack(collaborator?.id);
    } else {
      showToast(res.message, 'error');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header com Botão de Voltar e Identificação */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          type="button"
          onClick={() => onBack(collaborator?.id)}
          className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-[#0f3e2e] bg-white border border-slate-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Voltar para a Ficha do Colaborador</span>
        </button>

        <div className="flex items-center gap-3 flex-wrap text-xs text-slate-500 font-medium">
          {(hasAutoSavedDraft || lastAutoSavedAt) && canEditEvaluation && (
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full">
              <Save className="w-3.5 h-3.5 text-emerald-600" />
              <span>
                Rascunho salvo automaticamente
                {lastAutoSavedAt ? ` · ${lastAutoSavedAt}` : ''}
              </span>
            </span>
          )}
          <span>
            Avaliador Atual: <strong>{currentUser?.fullName}</strong>
          </span>
        </div>
      </div>

      {/* Banner Principal com Placar de Nota em Tempo Real */}
      <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full uppercase tracking-wider">
              {checklist.categoryName || 'Avaliação Operacional'}
            </span>
            <span className="text-xs text-slate-400">·</span>
            <span className="text-xs text-slate-500 font-medium">
              Colaborador: <strong>{collaborator.fullName}</strong> ({collaborator.roleTitle})
            </span>
          </div>

          <h1 className="text-2xl font-bold font-display text-slate-900 tracking-tight">
            {checklist.title}
          </h1>

          <p className="text-xs text-slate-600 max-w-2xl leading-relaxed">
            {checklist.description ||
              'Marque os critérios atendidos durante o atendimento simulado. O progresso parcial é salvo automaticamente em andamento.'}
          </p>
        </div>

        {/* Card de Pontuação Dinâmica */}
        <div className="bg-[#0f3e2e] text-white p-5 rounded-2xl flex items-center gap-5 shrink-0 shadow-md">
          <div className="space-y-0.5">
            <div className="text-[10px] text-emerald-300 font-bold uppercase tracking-wider">
              Nota Calculada
            </div>
            <div className="text-4xl font-black font-mono tracking-tight text-white">
              {currentScore.toFixed(1)}
            </div>
            <div className="text-[10px] text-emerald-200">em tempo real</div>
          </div>
          <div className="h-10 w-px bg-emerald-800" />
          <div className="text-right">
            <span className="text-[10px] uppercase font-bold text-emerald-300 block">Status</span>
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded-md inline-block mt-0.5 ${
                currentScore >= 7
                  ? 'bg-emerald-800/80 text-emerald-100'
                  : 'bg-amber-800/80 text-amber-100'
              }`}
            >
              {currentScore >= 7 ? 'Pontuação Apta' : 'Abaixo da Média'}
            </span>
          </div>
        </div>
      </div>

      {/* Split View: Coluna Esquerda Fixa/Sticky (Briefing do Caso e Guia) & Coluna Direita (Critérios e Conclusão) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* COLUNA ESQUERDA (FIXA/STICKY NO DESKTOP): CENÁRIO, DADOS DO CLIENTE, FALAS E GUIA MÉDICA */}
        <div
          id="printable-roteiro"
          className="lg:col-span-5 lg:sticky lg:top-20 lg:max-h-[calc(100vh-6rem)] lg:overflow-y-auto bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5 print:static print:max-h-none print:overflow-visible print:p-8 print:border-none"
        >
          <div className="flex items-center justify-between gap-2 border-b border-slate-100 pb-3 flex-wrap">
            <div className="flex items-center gap-2 text-slate-900 font-bold text-sm">
              <FileText className="w-4 h-4 text-emerald-700" />
              <span>Cenário & Dados do Cliente</span>
              {linkedExercises.length > 0 && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-900">
                  {linkedExercises.length} {linkedExercises.length === 1 ? 'caso' : 'casos'}
                </span>
              )}
            </div>
            {allLinkedCharacters.length > 1 && (
              <button
                type="button"
                onClick={() => {
                  downloadMultipleGuidesPdf(
                    allLinkedCharacters,
                    checklist?.title || 'Checklist de Simulação',
                    undefined,
                    pdfGeneratedBy
                  );
                }}
                className="px-2.5 py-1 text-[11px] font-bold text-white bg-[#064e3b] hover:bg-emerald-900 rounded-lg flex items-center gap-1 cursor-pointer transition-colors shadow-2xs no-print"
                title="Baixar todos os roteiros dos casos vinculados em um único arquivo PDF"
              >
                <Download className="w-3 h-3 text-emerald-200" />
                <span>Imprimir Todos ({allLinkedCharacters.length})</span>
              </button>
            )}
          </div>

          {/* Barra de seleção quando houver 2 ou mais casos vinculados */}
          {linkedExercises.length >= 2 && (
            <div className="flex items-center gap-1.5 flex-wrap bg-slate-50 p-1.5 rounded-xl border border-slate-200">
              {linkedExercises.map((ex, idx) => {
                const tabVal = String(idx);
                const isActive = selectedExerciseTab === tabVal;
                return (
                  <button
                    key={ex.id}
                    type="button"
                    onClick={() => setSelectedExerciseTab(tabVal)}
                    className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer max-w-full truncate ${
                      isActive
                        ? 'bg-[#0f3e2e] text-white shadow-xs'
                        : 'bg-white text-slate-700 border border-slate-200 hover:border-emerald-400'
                    }`}
                    title={`Caso ${idx + 1}: ${ex.title}`}
                  >
                    Caso {idx + 1}: {ex.title}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setSelectedExerciseTab('all')}
                className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold transition-all cursor-pointer ${
                  selectedExerciseTab === 'all'
                    ? 'bg-[#0f3e2e] text-white shadow-xs'
                    : 'bg-white text-slate-700 border border-slate-200 hover:border-emerald-400'
                }`}
              >
                Ver Todos ({linkedExercises.length})
              </button>
            </div>
          )}

          {displayedExercises.length > 0 ? (
            <div className="space-y-6 text-xs">
              {displayedExercises.map((ex) => {
                const exIndex = linkedExercises.findIndex((item) => item.id === ex.id);
                const exCharacters = ex.characterIds
                  .map((id) => characters.find((c) => c.id === id))
                  .filter(Boolean) as Character[];

                return (
                  <div
                    key={ex.id}
                    className={`space-y-4 ${
                      displayedExercises.length > 1 ? 'pb-6 border-b-2 border-slate-100 last:pb-0 last:border-b-0' : ''
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {linkedExercises.length >= 2 && (
                            <span className="text-[10px] font-extrabold px-2 py-0.5 rounded-md bg-[#0f3e2e] text-white uppercase">
                              Caso {exIndex + 1} de {linkedExercises.length}
                            </span>
                          )}
                          {ex.cell && OFFICIAL_CELLS[ex.cell] && (
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded-md border border-slate-200 bg-slate-50 text-slate-700 inline-flex items-center gap-1">
                              <Building2 className="w-3 h-3 text-slate-500" />
                              <span>{OFFICIAL_CELLS[ex.cell].name}</span>
                            </span>
                          )}
                          <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2.5 py-0.5 rounded-full uppercase">
                            {ex.categoryName || 'Exercício'}
                          </span>
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-700">
                            Dificuldade: {ex.difficulty || 'Mediano'}
                          </span>
                        </div>

                        {exCharacters.length > 1 && (
                          <button
                            type="button"
                            onClick={() =>
                              downloadMultipleGuidesPdf(
                                exCharacters,
                                ex.title,
                                undefined,
                                pdfGeneratedBy
                              )
                            }
                            className="px-2 py-1 text-[10px] font-bold text-emerald-900 bg-emerald-100 hover:bg-emerald-200 rounded-lg flex items-center gap-1 cursor-pointer transition-colors no-print"
                            title="Baixar roteiros deste caso em PDF único"
                          >
                            <Download className="w-3 h-3" />
                            <span>PDF do Caso</span>
                          </button>
                        )}
                      </div>

                      <h3 className="text-base font-bold text-slate-900 leading-snug mt-1.5">
                        {ex.title}
                      </h3>
                    </div>

                    {/* Anexo(s) do Próprio Exercício (se existir) */}
                    {(() => {
                      const exAttachments = getExerciseAttachments(ex);
                      if (exAttachments.length === 0) return null;
                      return (
                        <div className="flex items-center justify-between gap-2 bg-emerald-50/70 border border-emerald-200 rounded-xl px-3 py-2">
                          <div className="flex items-center gap-2 min-w-0">
                            <FileText className="w-4 h-4 text-emerald-700 shrink-0" />
                            <span className="text-[11px] font-semibold text-emerald-950 truncate">
                              {exAttachments.length === 1
                                ? exAttachments[0].name
                                : `${exAttachments.length} Documentos de Apoio do Cenário`}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              setAttachedGuideModal({
                                title: `Documento do Caso · ${ex.title}`,
                                guides: exAttachments,
                              })
                            }
                            className="px-2.5 py-1 text-[11px] font-bold text-white bg-[#0f3e2e] hover:bg-emerald-900 rounded-lg transition-colors cursor-pointer shrink-0"
                          >
                            {exAttachments.length > 1
                              ? `Visualizar Guias (${exAttachments.length})`
                              : 'Visualizar Guia Médica'}
                          </button>
                        </div>
                      );
                    })()}

                    {/* Roteiro e Orientações do Caso */}
                    <div className="space-y-1.5">
                      <div className="font-bold text-slate-800 uppercase text-[11px] tracking-wide">
                        Orientações do Caso:
                      </div>
                      <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl text-slate-700 leading-relaxed font-medium whitespace-pre-line">
                        {ex.scenarioInstructions}
                      </div>
                    </div>

                    {/* Clientes a Serem Interpretados */}
                    {exCharacters.length > 0 && (
                      <div className="space-y-2.5 pt-2 border-t border-slate-100">
                        <div className="font-bold text-slate-800 uppercase text-[11px] tracking-wide">
                          Cliente / Paciente ({exCharacters.length}):
                        </div>
                        <div className="space-y-3">
                          {exCharacters.map((char) => {
                            const tierBadge =
                              CUSTOMER_TIER_BADGES[char.customerTier || 'Mediano'] ||
                              CUSTOMER_TIER_BADGES['Mediano'];
                            const cellKey = (char.cell || 'OPERADORA') as OfficialCell;
                            const cellMeta = OFFICIAL_CELLS[cellKey] || OFFICIAL_CELLS['OPERADORA'];

                            return (
                              <div
                                key={char.id}
                                className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-4 space-y-2.5"
                              >
                                <div className="flex items-center justify-between gap-2">
                                  <div className="flex items-center gap-1.5 flex-wrap">
                                    <span className="text-[9px] font-bold px-2 py-0.5 rounded-md border border-slate-200 bg-slate-50 text-slate-700 inline-flex items-center gap-1">
                                      <Building2 className="w-2.5 h-2.5 text-slate-500" />
                                      <span>{cellMeta.name}</span>
                                    </span>
                                    <span className="font-bold text-emerald-950 text-xs">
                                      {char.name} ({char.age})
                                    </span>
                                  </div>
                                  <span
                                    className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${tierBadge.bg} ${tierBadge.text} ${tierBadge.border}`}
                                  >
                                    {tierBadge.label}
                                  </span>
                                </div>

                                <div className="text-[11px] text-slate-700 bg-white/80 border border-emerald-200/70 rounded-lg px-2.5 py-1.5">
                                  <strong>Carteirinha:</strong>{' '}
                                  <span className="font-mono font-bold text-emerald-950">
                                    {char.cardNumber}
                                  </span>{' '}
                                  · <strong>Cidade:</strong> {char.city}
                                </div>

                                <p className="text-slate-700 text-[11px] leading-relaxed">
                                  <strong>Contexto:</strong> {char.serviceContext || char.history}
                                </p>

                                <p className="text-slate-700 text-[11px] leading-relaxed">
                                  <strong>Humor:</strong> {char.temperament}
                                </p>

                                <p className="text-slate-700 text-[11px] leading-relaxed">
                                  <strong>Objetivo:</strong> {char.objectives}
                                </p>

                                {(() => {
                                  const phrases = normalizePhrases(char.typicalPhrases);
                                  if (phrases.length === 0) return null;
                                  return (
                                    <div className="bg-emerald-100/60 p-3 rounded-xl border border-emerald-200/80 space-y-1.5">
                                      <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-900">
                                        Falas Típicas do Cliente ({phrases.length}):
                                      </div>
                                      <ul className="space-y-1 pl-1">
                                        {phrases.map((phrase, pIdx) => (
                                          <li
                                            key={pIdx}
                                            className="text-slate-800 text-[11px] leading-relaxed flex items-start gap-1.5"
                                          >
                                            <span className="text-emerald-700 font-bold shrink-0">•</span>
                                            <span className="italic">&ldquo;{phrase}&rdquo;</span>
                                          </li>
                                        ))}
                                      </ul>
                                    </div>
                                  );
                                })()}

                                {(() => {
                                  const charGuides = getCharacterGuides(char);
                                  return (
                                    <div className="pt-1 flex items-center gap-2 flex-wrap">
                                      {charGuides.length > 0 && (
                                        <button
                                          type="button"
                                          onClick={() =>
                                            setAttachedGuideModal({
                                              title: `${
                                                charGuides.length > 1 ? 'Guias Médicas' : 'Guia Médica'
                                              } · ${char.name}`,
                                              subtitle: `${ex.title}${
                                                char.cardNumber ? ` · Carteirinha ${char.cardNumber}` : ''
                                              }`,
                                              guides: charGuides,
                                            })
                                          }
                                          className="flex-1 min-w-[155px] py-2 px-3 bg-[#0f3e2e] hover:bg-emerald-900 text-white font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer text-xs shadow-2xs"
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
                                        onClick={() => {
                                          setGuideModalChar(char);
                                          setGuideModalExerciseTitle(ex.title);
                                        }}
                                        className={`${
                                          charGuides.length > 0 ? '' : 'flex-1 '
                                        }py-2 px-3 bg-emerald-100 hover:bg-emerald-200 text-emerald-950 font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer text-xs`}
                                      >
                                        <Eye className="w-3.5 h-3.5 text-emerald-800" />
                                        <span>Ficha do Cliente</span>
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() =>
                                          downloadGuidePdf(char, ex.title, pdfGeneratedBy)
                                        }
                                        className="py-2 px-3 bg-white hover:bg-slate-100 border border-slate-300 text-slate-800 font-bold rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer text-xs"
                                        title={`Baixar Cliente_${char.name.replace(/\s+/g, '_')}.pdf`}
                                      >
                                        <Download className="w-3.5 h-3.5 text-slate-700" />
                                        <span>PDF</span>
                                      </button>
                                    </div>
                                  );
                                })()}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-8 text-center text-slate-500 text-xs space-y-2 border border-dashed border-slate-200 rounded-xl">
              <FileText className="w-8 h-8 text-slate-300 mx-auto" />
              <p>Este checklist não possui cenários de roleplay ou clientes associados.</p>
              <p className="text-[11px] text-slate-400">
                A avaliação é conduzida com base unicamente na observação direta dos critérios.
              </p>
            </div>
          )}
        </div>

        {/* COLUNA DIREITA: LISTA DE CRITÉRIOS INTERATIVOS E CONCLUSÃO */}
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
            <div>
              <h2 className="font-bold text-slate-900 text-sm flex items-center gap-2">
                <CheckSquare className="w-4 h-4 text-emerald-700" />
                <span>Critérios de Avaliação ({criteriaState.length})</span>
              </h2>
              <span className="text-[11px] text-slate-500">
                Clique nos itens atendidos para pontuar e salvar automaticamente
              </span>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {canEditEvaluation && criteriaState.length > 0 && (
                <button
                  type="button"
                  onClick={handleToggleAllCriteria}
                  className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors flex items-center gap-1.5 cursor-pointer ${
                    allCriteriaChecked
                      ? 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300'
                      : 'bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border-emerald-300'
                  }`}
                >
                  <CheckCheck className="w-3.5 h-3.5" />
                  <span>
                    {allCriteriaChecked
                      ? 'Desmarcar todos os critérios'
                      : 'Marcar todos os critérios'}
                  </span>
                </button>
              )}

              <span className="text-xs font-mono font-bold text-emerald-800 bg-emerald-50 px-2.5 py-1.5 rounded-lg border border-emerald-200/70">
                {criteriaState.filter((c) => c.checked).length} / {criteriaState.length} Concluídos
              </span>
            </div>
          </div>

          <div className="space-y-3">
            {criteriaState.map((crit) => (
              <div
                key={crit.criterionId}
                onClick={() => handleToggleCheck(crit.criterionId)}
                className={`p-4 rounded-xl border transition-all cursor-pointer ${
                  crit.checked
                    ? 'bg-emerald-50/60 border-emerald-300 shadow-2xs'
                    : 'bg-slate-50/70 border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start gap-3">
                  <div className="pt-0.5">
                    {crit.checked ? (
                      <div className="w-5 h-5 rounded-md bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                        <Check className="w-3.5 h-3.5 stroke-[3]" />
                      </div>
                    ) : (
                      <div className="w-5 h-5 rounded-md border-2 border-slate-300 bg-white" />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-xs text-slate-900 leading-snug">
                        {crit.name}
                      </span>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-mono shrink-0">
                        Peso {crit.weight}
                      </span>
                    </div>

                    {/* Observação / Feedback Opcional */}
                    <div
                      className="mt-2.5 pt-2 border-t border-slate-100/80"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="text"
                        value={crit.notes || ''}
                        onChange={(e) => handleUpdateNotes(crit.criterionId, e.target.value)}
                        placeholder="Adicionar apontamento ou observação deste critério..."
                        className="w-full text-[11px] px-2.5 py-1 bg-slate-50 border border-slate-200 rounded-md focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 text-slate-800 placeholder-slate-400"
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Seção de Conclusão da Avaliação */}
          <div className="pt-5 border-t border-slate-200 space-y-4">
            {/* Campo Amplo: Observações Gerais / Feedback do Instrutor */}
            <div className="space-y-1.5">
              <label className="block text-xs font-bold text-slate-900 flex items-center justify-between">
                <span>Observações Gerais / Feedback do Instrutor</span>
                <span className="text-[10px] text-slate-400 font-normal">
                  Exibido no Relatório de Avaliação
                </span>
              </label>
              <textarea
                rows={4}
                value={generalObservations}
                onChange={(e) => handleUpdateGeneralObservations(e.target.value)}
                placeholder="Digite anotações gerais sobre o desempenho, postura, empatia, aderência aos processos e oportunidades de melhoria do colaborador durante o atendimento..."
                className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:bg-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-800 text-xs placeholder-slate-400 leading-relaxed resize-y"
              />
            </div>

            <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="block text-xs font-bold text-slate-900">
                  Resultado / Próximo Status do Colaborador:
                </label>
                <span className="text-[11px] text-slate-500 font-medium">
                  Pontuação: <strong className="text-slate-800">{currentScore.toFixed(1)}/10</strong> (
                  {Math.round(currentScore * 10)}%)
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <button
                  type="button"
                  onClick={() => setSelectedResultStatus('aprovado')}
                  className={`p-3 rounded-xl border text-center font-bold cursor-pointer transition-all ${
                    selectedResultStatus === 'aprovado'
                      ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div>✓ Aprovado na Etapa</div>
                  {currentScore >= 7.0 && (
                    <div className="text-[10px] font-medium opacity-90 mt-0.5">
                      (Sugerido por pontuação ≥ 70%)
                    </div>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedResultStatus('necessita_reforco')}
                  className={`p-3 rounded-xl border text-center font-bold cursor-pointer transition-all ${
                    selectedResultStatus === 'necessita_reforco'
                      ? 'bg-red-600 text-white border-red-600 shadow-sm'
                      : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-100'
                  }`}
                >
                  <div>⚠ Validação da liderança</div>
                  {currentScore < 7.0 && (
                    <div className="text-[10px] font-medium opacity-90 mt-0.5">
                      (Sugerido por pontuação &lt; 70%)
                    </div>
                  )}
                </button>
              </div>
            </div>

            {/* Apenas usuários com permissão can_apply_evaluations e trilha aberta podem concluir e registrar */}
            {!canApplyEvaluations ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-800 text-center font-medium">
                Visualização Somente Leitura: O registro e a finalização de avaliações exigem a permissão de aplicar avaliações.
              </div>
            ) : isTrackLocked ? (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 text-center font-semibold">
                Trilha finalizada pelo Guardião Anfitrião: novas edições ou registros de avaliação estão bloqueados.
              </div>
            ) : (
              <button
                type="button"
                disabled={isFinishing || !canEditEvaluation}
                onClick={handleFinishEvaluation}
                className="w-full py-3.5 bg-[#0f3e2e] hover:bg-emerald-900 text-white font-bold rounded-xl transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 text-sm"
              >
                <CheckCircle2 className="w-5 h-5" />
                <span>{isFinishing ? 'Gravando Resultado...' : 'Finalizar e Registrar Avaliação'}</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Espelho Oficial da Guia */}
      <GuideMirrorModal
        character={guideModalChar}
        exerciseTitle={guideModalExerciseTitle}
        onClose={() => {
          setGuideModalChar(null);
          setGuideModalExerciseTitle(undefined);
        }}
      />

      {/* Visualizador Popup de Guia Médica Anexada */}
      <AttachedGuideViewerModal
        attachment={attachedGuideModal}
        onClose={() => setAttachedGuideModal(null)}
      />
    </div>
  );
};
