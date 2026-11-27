import {
  canSeeFinalVerdict,
  canViewRestrictedItem,
  Character,
  Checklist,
  Collaborator,
  CollaboratorChecklist,
  CollaboratorTrackStep,
  Exercise,
  getCellName,
  getCriterionAnswerStatus,
  normalizeStageName,
  Survey,
  SurveyResponse,
  UserProfile,
} from '../types/portal';
import {
  CollaboratorDossierData,
  DossierEvaluationHistoryItem,
  DossierLearningReflectionItem,
  DossierStageChapter,
  DossierSurveySummaryItem,
  DossierTrackItem,
  PdfGeneratedBy,
  StageDossierData,
} from './downloadHelpers';
import { getCollaboratorProgressStatus } from '../modules/collaborators/views/CollaboratorsView';

export interface TrackStageStepEntry {
  step: CollaboratorTrackStep;
  globalIndex: number;
}

export interface TrackStageGroup {
  stageName: string;
  entries: TrackStageStepEntry[];
}

export function groupTrackStepsByStage(steps: CollaboratorTrackStep[]): TrackStageGroup[] {
  const groups: TrackStageGroup[] = [];
  const indexByKey = new Map<string, number>();

  steps.forEach((step, globalIndex) => {
    const stageName = normalizeStageName(step.stageName);
    const key = stageName.toLowerCase();
    const existingIdx = indexByKey.get(key);
    if (existingIdx !== undefined) {
      groups[existingIdx].entries.push({ step, globalIndex });
    } else {
      indexByKey.set(key, groups.length);
      groups.push({
        stageName,
        entries: [{ step, globalIndex }],
      });
    }
  });

  return groups;
}

export interface BuildDossierContext {
  collaborator: Collaborator;
  currentUser: UserProfile | null;
  checklists: Checklist[];
  collaboratorChecklists: CollaboratorChecklist[];
  exercises: Exercise[];
  characters: Character[];
  surveys: Survey[];
  surveyResponses: SurveyResponse[];
  users: UserProfile[];
  generatedBy?: PdfGeneratedBy;
}

function buildChaptersInternal(ctx: BuildDossierContext): {
  chapters: DossierStageChapter[];
  visibleSteps: CollaboratorTrackStep[];
  allVisibleTrackItems: DossierTrackItem[];
  allVisibleEvaluations: DossierEvaluationHistoryItem[];
  allVisibleSurveys: DossierSurveySummaryItem[];
  allVisibleReflections: DossierLearningReflectionItem[];
} {
  const {
    collaborator,
    currentUser,
    checklists,
    collaboratorChecklists,
    exercises,
    characters,
    surveys,
    surveyResponses,
    users,
  } = ctx;

  const rawSteps = collaborator.track || [];
  const visibleSteps = rawSteps.filter((step) => {
    if (step.type === 'checklist') {
      const chk = checklists.find((c) => c.id === step.refId);
      return canViewRestrictedItem(currentUser, chk?.visibility);
    }
    const srv = surveys.find((s) => s.id === step.refId);
    return canViewRestrictedItem(currentUser, srv?.visibility);
  });

  const collabAssignments = collaboratorChecklists.filter(
    (a) => a.collaboratorId === collaborator.id
  );
  const collabSurveyResponses = surveyResponses.filter(
    (sr) => sr.collaboratorId === collaborator.id
  );

  const claimedAssignmentIds = new Set<string>();
  const claimedResponseIds = new Set<string>();

  const stageGroups = groupTrackStepsByStage(visibleSteps);
  const allVisibleTrackItems: DossierTrackItem[] = [];
  const allVisibleEvaluations: DossierEvaluationHistoryItem[] = [];
  const allVisibleSurveys: DossierSurveySummaryItem[] = [];
  const allVisibleReflections: DossierLearningReflectionItem[] = [];
  const allReflectionsList = Object.values(collaborator.exerciseReflections || {});

  const chapters: DossierStageChapter[] = stageGroups.map((group) => {
    const trackSteps: DossierTrackItem[] = [];
    const evaluations: DossierEvaluationHistoryItem[] = [];
    const stageSurveys: DossierSurveySummaryItem[] = [];
    const stageReflections: DossierLearningReflectionItem[] = [];
    const stageScores: number[] = [];

    group.entries.forEach(({ step }, localIdx) => {
      if (step.type === 'checklist') {
        const chk = checklists.find((c) => c.id === step.refId);
        const isRestricted = chk?.visibility === 'restrito';

        const assignment =
          (step.collaboratorChecklistId
            ? collabAssignments.find((a) => a.id === step.collaboratorChecklistId)
            : undefined) ||
          collabAssignments.find(
            (a) => a.checklistId === step.refId && !claimedAssignmentIds.has(a.id)
          );

        if (assignment) {
          claimedAssignmentIds.add(assignment.id);
        }

        const frozenSnapshot =
          assignment?.status === 'concluido' ? assignment.frozenSnapshot : undefined;
        const baseTitle: string =
          frozenSnapshot?.checklistTitle ||
          (step.status === 'concluido'
            ? step.title || chk?.title
            : chk?.title || step.title) ||
          'Checklist de Avaliação';
        const resolvedTitle: string =
          step.isRecycle && !/\(Reciclagem\)\s*$/i.test(baseTitle)
            ? `${baseTitle} (Reciclagem)`
            : baseTitle;

        const effectiveScore =
          typeof step.finalScore === 'number'
            ? step.finalScore
            : assignment?.status === 'concluido' && typeof assignment.finalScore === 'number'
            ? assignment.finalScore
            : undefined;

        if (step.status === 'concluido' && typeof effectiveScore === 'number') {
          stageScores.push(effectiveScore);
        }

        const item: DossierTrackItem = {
          orderIndex: step.order || localIdx + 1,
          title: isRestricted ? `[RESTRITO] ${resolvedTitle}` : resolvedTitle,
          type: 'checklist',
          status:
            assignment?.status === 'em_andamento' && step.status !== 'concluido'
              ? 'em_andamento'
              : step.status,
          stageName: group.stageName,
          score: effectiveScore,
          completedAt: step.completedAt
            ? new Date(step.completedAt).toLocaleDateString('pt-BR')
            : undefined,
        };
        trackSteps.push(item);
        allVisibleTrackItems.push(item);

        // Coleta registros do Diário de Aprendizado vinculados a esta etapa
        const stepReflections = allReflectionsList.filter(
          (r) => r.stepId === step.id && r.note?.trim()
        );
        stepReflections.forEach((r) => {
          const refRecord: DossierLearningReflectionItem = {
            stageName: group.stageName,
            stepTitle: resolvedTitle,
            exerciseTitle: r.exerciseTitle || resolvedTitle,
            learningObjective:
              r.learningObjective ||
              frozenSnapshot?.checklistLearningObjective ||
              chk?.learningObjective,
            note: r.note.trim(),
            updatedAt: r.updatedAt
              ? new Date(r.updatedAt).toLocaleDateString('pt-BR')
              : undefined,
          };
          stageReflections.push(refRecord);
          allVisibleReflections.push(refRecord);
        });

        if (
          (assignment && assignment.status === 'concluido' && typeof assignment.finalScore === 'number') ||
          (step.status === 'concluido' && typeof step.finalScore === 'number')
        ) {
          let resolvedExerciseTitle: string | undefined;
          let resolvedCharacterName: string | undefined;
          let resolvedCategoryName: string | undefined;

          if (frozenSnapshot) {
            const snapExercises = frozenSnapshot.exercises || [];
            resolvedExerciseTitle =
              snapExercises.length > 0
                ? snapExercises.map((e) => e.title).join(' · ')
                : undefined;
            const snapCharNames = Array.from(
              new Set(
                snapExercises.flatMap((e) =>
                  (e.characters || []).map((c) => c.name).filter(Boolean)
                )
              )
            );
            resolvedCharacterName =
              snapCharNames.length > 0 ? snapCharNames.join(' · ') : undefined;
            resolvedCategoryName =
              frozenSnapshot.checklistCategoryName || chk?.categoryName;
          } else {
            const linkedExs = (chk?.exerciseIds || [])
              .map((exId) => exercises.find((e) => e.id === exId))
              .filter((e): e is Exercise => Boolean(e));
            resolvedExerciseTitle =
              linkedExs.length > 0 ? linkedExs.map((e) => e.title).join(' · ') : undefined;
            const linkedCharNames = Array.from(
              new Set(
                linkedExs.flatMap((e) =>
                  (e.characterIds || [])
                    .map((cId) => characters.find((c) => c.id === cId)?.name)
                    .filter((n): n is string => Boolean(n))
                )
              )
            );
            resolvedCharacterName =
              linkedCharNames.length > 0 ? linkedCharNames.join(' · ') : undefined;
            resolvedCategoryName = chk?.categoryName;
          }

          const evaluator = assignment?.instructorAuxiliarId
            ? users.find((u) => u.id === assignment.instructorAuxiliarId)
            : undefined;

          const sourceCriteriaAnswers =
            frozenSnapshot?.criteriaAnswers && frozenSnapshot.criteriaAnswers.length > 0
              ? frozenSnapshot.criteriaAnswers
              : assignment?.criteriaAnswers;

          const criteriaAnswers =
            sourceCriteriaAnswers && sourceCriteriaAnswers.length > 0
              ? sourceCriteriaAnswers.map((ca) => {
                  const status = getCriterionAnswerStatus(ca);
                  return {
                    name: ca.name,
                    checked: status === 'atendido',
                    status,
                    weight: ca.weight,
                    notes: ca.notes,
                  };
                })
              : (chk?.criteria || []).map((c) => ({
                  name: c.name,
                  checked: false,
                  status: 'nao_atendido' as const,
                  weight: c.weight,
                  notes: undefined,
                }));

          const completedRaw = assignment?.completedAt || step.completedAt;
          const evalRecord: DossierEvaluationHistoryItem = {
            checklistTitle: resolvedTitle,
            categoryName: resolvedCategoryName,
            exerciseTitle: resolvedExerciseTitle,
            characterName: resolvedCharacterName,
            evaluatorName:
              step.filledBy === 'collaborator'
                ? `${collaborator.fullName} (Autoavaliação)`
                : evaluator?.fullName || 'Avaliador Responsável',
            finalScore:
              typeof assignment?.finalScore === 'number'
                ? assignment.finalScore
                : (step.finalScore as number),
            completedAt: completedRaw
              ? new Date(completedRaw).toLocaleDateString('pt-BR')
              : 'Data não informada',
            observations: assignment?.generalObservations || undefined,
            isRestricted,
            isRecycle: Boolean(step.isRecycle),
            recycleReason: step.recycleReason || undefined,
            criteriaAnswers,
          };
          evaluations.push(evalRecord);
          allVisibleEvaluations.push(evalRecord);
        }
      } else {
        const srv = surveys.find((s) => s.id === step.refId);
        const isRestricted = srv?.visibility === 'restrito';
        const resolvedTitle = srv?.title || step.title;

        const response =
          (step.surveyResponseId
            ? collabSurveyResponses.find((sr) => sr.id === step.surveyResponseId)
            : undefined) ||
          collabSurveyResponses.find(
            (sr) => sr.surveyId === step.refId && !claimedResponseIds.has(sr.id)
          );

        if (response) {
          claimedResponseIds.add(response.id);
        }

        const item: DossierTrackItem = {
          orderIndex: step.order || localIdx + 1,
          title: isRestricted ? `[RESTRITO] ${resolvedTitle}` : resolvedTitle,
          type: 'survey',
          status: step.status,
          stageName: group.stageName,
          completedAt: step.completedAt
            ? new Date(step.completedAt).toLocaleDateString('pt-BR')
            : undefined,
        };
        trackSteps.push(item);
        allVisibleTrackItems.push(item);

        if (response) {
          const surveyRecord: DossierSurveySummaryItem = {
            surveyTitle: resolvedTitle,
            completedAt: response.completedAt
              ? new Date(response.completedAt).toLocaleDateString('pt-BR')
              : 'Data não informada',
            isRestricted,
            questions: (srv?.questions || []).map((q) => {
              const ans = response.answers?.[q.id];
              const answerText =
                q.type === 'apenas_observacao'
                  ? ans?.observation?.trim() || 'Sem resposta'
                  : ans?.selectedOption || 'Sem resposta';
              const notesText =
                q.type === 'apenas_observacao' ? undefined : ans?.observation || undefined;
              return {
                questionText: q.text,
                answer: answerText,
                notes: notesText,
              };
            }),
          };
          stageSurveys.push(surveyRecord);
          allVisibleSurveys.push(surveyRecord);
        }
      }
    });

    const completedSteps = group.entries.filter((e) => e.step.status === 'concluido').length;
    const totalSteps = group.entries.length;
    const stageAverage =
      stageScores.length > 0
        ? stageScores.reduce((acc, n) => acc + n, 0) / stageScores.length
        : null;

    return {
      stageName: group.stageName,
      completedSteps,
      totalSteps,
      stageAverage,
      trackSteps,
      evaluations,
      surveys: stageSurveys,
      learningReflections: stageReflections,
    };
  });

  // Se existirem avaliações ou respostas órfãs (sem etapa vinculada na trilha), adiciona ao resumo legado/geral
  const unlinkedAssignments = collabAssignments.filter(
    (a) =>
      a.status === 'concluido' &&
      typeof a.finalScore === 'number' &&
      !claimedAssignmentIds.has(a.id) &&
      canViewRestrictedItem(
        currentUser,
        checklists.find((c) => c.id === a.checklistId)?.visibility
      )
  );
  unlinkedAssignments.forEach((a) => {
    const chk = checklists.find((c) => c.id === a.checklistId);
    const snap = a.frozenSnapshot;
    let exerciseTitle: string | undefined;
    let characterName: string | undefined;

    if (snap) {
      const snapExs = snap.exercises || [];
      exerciseTitle =
        snapExs.length > 0 ? snapExs.map((e) => e.title).join(' · ') : undefined;
      const snapCharNames = Array.from(
        new Set(
          snapExs.flatMap((e) =>
            (e.characters || []).map((c) => c.name).filter(Boolean)
          )
        )
      );
      characterName =
        snapCharNames.length > 0 ? snapCharNames.join(' · ') : undefined;
    } else {
      const linkedExs = (chk?.exerciseIds || [])
        .map((exId) => exercises.find((e) => e.id === exId))
        .filter((e): e is Exercise => Boolean(e));
      exerciseTitle =
        linkedExs.length > 0 ? linkedExs.map((e) => e.title).join(' · ') : undefined;
      const linkedCharNames = Array.from(
        new Set(
          linkedExs.flatMap((e) =>
            (e.characterIds || [])
              .map((cId) => characters.find((c) => c.id === cId)?.name)
              .filter((n): n is string => Boolean(n))
          )
        )
      );
      characterName =
        linkedCharNames.length > 0 ? linkedCharNames.join(' · ') : undefined;
    }

    const evaluator = a.instructorAuxiliarId
      ? users.find((u) => u.id === a.instructorAuxiliarId)
      : undefined;
    allVisibleEvaluations.push({
      checklistTitle: snap?.checklistTitle || chk?.title || 'Checklist de Avaliação',
      categoryName: snap?.checklistCategoryName || chk?.categoryName,
      exerciseTitle,
      characterName,
      evaluatorName: evaluator?.fullName || 'Avaliador Responsável',
      finalScore: a.finalScore as number,
      completedAt: a.completedAt
        ? new Date(a.completedAt).toLocaleDateString('pt-BR')
        : 'Data não informada',
      observations: a.generalObservations || undefined,
      isRestricted: chk?.visibility === 'restrito',
      criteriaAnswers: (
        snap?.criteriaAnswers && snap.criteriaAnswers.length > 0
          ? snap.criteriaAnswers
          : a.criteriaAnswers || []
      ).map((ca) => {
        const status = getCriterionAnswerStatus(ca);
        return {
          name: ca.name,
          checked: status === 'atendido',
          status,
          weight: ca.weight,
          notes: ca.notes,
        };
      }),
    });
  });

  return {
    chapters,
    visibleSteps,
    allVisibleTrackItems,
    allVisibleEvaluations,
    allVisibleSurveys,
    allVisibleReflections,
  };
}

export function buildStageDossierData(
  ctx: BuildDossierContext,
  stageName: string
): StageDossierData | null {
  const { collaborator, generatedBy } = ctx;
  const { chapters } = buildChaptersInternal(ctx);
  const targetChapter = chapters.find(
    (ch) => ch.stageName.toLowerCase() === normalizeStageName(stageName).toLowerCase()
  );
  if (!targetChapter) return null;

  return {
    collaboratorName: collaborator.fullName,
    corporateUsername: collaborator.username ? `@${collaborator.username}` : undefined,
    roleTitle: collaborator.roleTitle,
    registrationCode: collaborator.registrationCode || '',
    cellTeam: getCellName(collaborator.cellTeam),
    stageName: targetChapter.stageName,
    completedSteps: targetChapter.completedSteps,
    totalSteps: targetChapter.totalSteps,
    stageAverage: targetChapter.stageAverage,
    trackSteps: targetChapter.trackSteps,
    evaluations: targetChapter.evaluations,
    surveys: targetChapter.surveys,
    learningReflections: targetChapter.learningReflections,
    generatedBy,
    generatedAt: new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
  };
}

export function buildFullConsolidatedDossierData(
  ctx: BuildDossierContext
): CollaboratorDossierData {
  const { collaborator, currentUser, generatedBy } = ctx;
  const canSeeVerdict = canSeeFinalVerdict(currentUser);
  const {
    chapters,
    visibleSteps,
    allVisibleTrackItems,
    allVisibleEvaluations,
    allVisibleSurveys,
    allVisibleReflections,
  } = buildChaptersInternal(ctx);

  const visibleCompletedCount = visibleSteps.filter((s) => s.status === 'concluido').length;
  const visibleCompletionRate =
    visibleSteps.length > 0
      ? Math.round((visibleCompletedCount / visibleSteps.length) * 100)
      : 0;

  const avgScore =
    allVisibleEvaluations.length > 0
      ? allVisibleEvaluations.reduce((acc, item) => acc + item.finalScore, 0) /
        allVisibleEvaluations.length
      : 0;

  const statusInfo = getCollaboratorProgressStatus(
    { ...collaborator, track: visibleSteps },
    canSeeVerdict
  );

  return {
    collaboratorName: collaborator.fullName,
    corporateUsername: collaborator.username
      ? `@${collaborator.username}`
      : `@${collaborator.fullName.toLowerCase().replace(/\s+/g, '.')}`,
    roleTitle: collaborator.roleTitle,
    registrationCode: collaborator.registrationCode || '',
    cellTeam: getCellName(collaborator.cellTeam),
    status: statusInfo.label,
    averageScore: avgScore,
    completionRate: visibleCompletionRate,
    totalTrackSteps: visibleSteps.length,
    totalEvaluations: allVisibleEvaluations.length,
    totalSurveys: allVisibleSurveys.length,
    trackSteps: allVisibleTrackItems,
    evaluationHistory: allVisibleEvaluations,
    surveyResponsesSummary: allVisibleSurveys,
    learningReflections: allVisibleReflections,
    stages: chapters,
    isTrackFinalized: Boolean(collaborator.isTrackFinalized),
    isTrackComplete:
      (collaborator.track?.length || 0) > 0 &&
      (collaborator.track || []).every((s) => s.status === 'concluido'),
    guardianFinalization:
      collaborator.isTrackFinalized && canSeeVerdict
        ? {
            isFinalized: true,
            hideVerdict: false,
            verdict: collaborator.guardianVerdict || 'aprovado',
            opinion: collaborator.guardianOpinion || '',
            finalizedBy: collaborator.guardianFinalizedBy || 'Guardião Anfitrião',
            finalizedAt: collaborator.guardianFinalizedAt
              ? new Date(collaborator.guardianFinalizedAt).toLocaleString('pt-BR', {
                  dateStyle: 'short',
                  timeStyle: 'short',
                })
              : '',
          }
        : undefined,
    generatedBy,
    generatedAt: new Date().toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }),
  };
}
