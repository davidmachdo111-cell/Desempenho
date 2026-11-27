import React, { useEffect, useMemo, useState } from 'react';
import {
  Users,
  Plus,
  Search,
  Building2,
  CheckCircle2,
  Play,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  FileText,
  UserCheck,
  X,
  Trash2,
  User,
  Eye,
  CheckSquare,
  Square,
  Sparkles,
  Download,
  GraduationCap,
  Theater,
  CreditCard,
  AlertTriangle,
  Shield,
  Lock,
  RotateCcw,
} from 'lucide-react';
import { usePortalStore } from '../../../context/PortalStoreContext';
import { useToast } from '../../../context/ToastContext';
import { isActorOnlyUser } from '../../../lib/permissions';
import {
  Collaborator,
  CollaboratorStatus,
  Exercise,
  Character,
  OfficialCell,
  OFFICIAL_CELLS,
  getCharacterGuides,
  getExerciseAttachments,
  normalizePhrases,
  getCellName,
  getScorePerformanceMeta,
  generateCorporateUsername,
  isGuardianHostUser,
  canViewRestrictedItem,
  canSeeFinalVerdict,
  normalizeTemplateStageName,
} from '../../../types/portal';
import { CUSTOMER_TIER_BADGES } from '../../characters/views/CharactersManagementView';
import { GuideMirrorModal } from '../../../components/GuideMirrorModal';
import {
  AttachedGuideViewerModal,
  AttachedGuideViewerData,
} from '../../../components/AttachedGuideViewerModal';
import {
  downloadGuidePdf,
  downloadMultipleGuidesPdf,
  downloadCollaboratorDossierPdf,
} from '../../../lib/downloadHelpers';
import { buildFullConsolidatedDossierData } from '../../../lib/dossierBuilders';
import { CollaboratorTrackBuilder } from '../../tracks/views/CollaboratorTrackBuilder';

const CLEAN_CELL_OPTIONS = ['Laboratório', 'Imagem', 'Consultas', 'Terapias', 'Operadora'];

interface CollaboratorsViewProps {
  initialCollaboratorId?: string | null;
  onSelectCollaborator?: (id: string | null) => void;
  onStartEvaluation: (assignmentId: string, collaboratorId?: string) => void;
}

export type CollaboratorProgressKey =
  | 'a_realizar'
  | 'em_treinamento'
  | 'concluido'
  | 'finalizado_aprovado'
  | 'finalizado_validacao'
  | 'finalizado';

export function getCollaboratorProgressStatus(
  col: Collaborator,
  canSeeVerdict: boolean = true
): {
  key: CollaboratorProgressKey;
  label:
    | 'A Realizar'
    | 'Em Treinamento'
    | 'Concluído'
    | 'Apto para Operação'
    | 'Necessita Acompanhamento'
    | 'Finalizado';
  subtitle?: string;
  badgeStyle: string;
  totalSteps: number;
  completedSteps: number;
  progressPct: number;
} {
  const track = col.track || [];
  const totalSteps = track.length;
  const completedSteps = track.filter((s) => s.status === 'concluido').length;
  const progressPct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  // 1. Somente após finalização manual pelo Guardião Anfitrião / Admin
  if (col.isTrackFinalized) {
    if (!canSeeVerdict) {
      return {
        key: 'finalizado',
        label: 'Finalizado',
        badgeStyle: 'bg-slate-100 text-slate-700 border border-slate-300',
        totalSteps,
        completedSteps,
        progressPct: totalSteps > 0 ? progressPct : 100,
      };
    }

    if (col.guardianVerdict === 'necessita_reforco') {
      return {
        key: 'finalizado_validacao',
        label: 'Necessita Acompanhamento',
        subtitle: 'Acompanhamento contínuo e direcionamento junto à liderança',
        badgeStyle: 'bg-amber-50 text-amber-900 border border-amber-300',
        totalSteps,
        completedSteps,
        progressPct: totalSteps > 0 ? progressPct : 100,
      };
    }

    return {
      key: 'finalizado_aprovado',
      label: 'Apto para Operação',
      badgeStyle: 'bg-emerald-50 text-emerald-800 border border-emerald-300',
      totalSteps,
      completedSteps,
      progressPct: totalSteps > 0 ? progressPct : 100,
    };
  }

  // 2. Enquanto não finalizada, status depende exclusivamente das etapas concluídas
  if (totalSteps === 0 || completedSteps === 0) {
    return {
      key: 'a_realizar',
      label: 'A Realizar',
      badgeStyle: 'bg-slate-100 text-slate-700 border border-slate-200',
      totalSteps,
      completedSteps,
      progressPct: 0,
    };
  }

  if (completedSteps === totalSteps) {
    return {
      key: 'concluido',
      label: 'Concluído',
      badgeStyle: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
      totalSteps,
      completedSteps,
      progressPct: 100,
    };
  }

  return {
    key: 'em_treinamento',
    label: 'Em Treinamento',
    badgeStyle: 'bg-amber-50 text-amber-700 border border-amber-200',
    totalSteps,
    completedSteps,
    progressPct,
  };
}

export const CollaboratorsView: React.FC<CollaboratorsViewProps> = ({
  initialCollaboratorId,
  onSelectCollaborator,
  onStartEvaluation,
}) => {
  const {
    collaborators,
    checklists,
    collaboratorChecklists,
    learningTracks,
    trackTemplates,
    exercises,
    characters,
    users,
    currentUser,
    hasPermission,
    surveys,
    surveyResponses,
    createCollaborator,
    deleteCollaborator,
    finalizeCollaboratorTrack,
    reopenCollaboratorTrack,
  } = usePortalStore();
  const { showToast } = useToast();

  const isAdmin = currentUser?.role === 'admin';
  const isGuardianHost = isGuardianHostUser(currentUser);
  const canActAsGuardianOrAdmin = isAdmin || isGuardianHost;
  const canSeeVerdict = canSeeFinalVerdict(currentUser);
  const canOpenFinalizedFicha = canSeeVerdict;
  const canApplyEvaluations = hasPermission('can_apply_evaluations');
  const canManageCollaborators = hasPermission('can_manage_collaborators');
  const isActorOnlyMode = isActorOnlyUser(currentUser);

  const pdfGeneratedBy = currentUser
    ? { fullName: currentUser.fullName, username: currentUser.username }
    : undefined;

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedStatusFilter, setSelectedStatusFilter] = useState<string>('all');
  const [selectedCellFilter, setSelectedCellFilter] = useState<string>('all');
  const [activeCollaboratorId, setActiveCollaboratorId] = useState<string | null>(
    initialCollaboratorId || null
  );
  const [usedActorPhrases, setUsedActorPhrases] = useState<Record<string, boolean>>({});
  const [activeActorSceneIndex, setActiveActorSceneIndex] = useState<number>(0);

  const selectCollaborator = (id: string | null) => {
    if (id) {
      const target = collaborators.find((c) => c.id === id);
      if (target?.isTrackFinalized && !canOpenFinalizedFicha) {
        showToast(
          'Esta trilha já foi finalizada. O acesso à ficha e ao roteiro está bloqueado para este perfil.',
          'info'
        );
        setActiveCollaboratorId(null);
        onSelectCollaborator?.(null);
        return;
      }
    }
    setActiveCollaboratorId(id);
    onSelectCollaborator?.(id);
  };

  useEffect(() => {
    setActiveCollaboratorId(initialCollaboratorId || null);
  }, [initialCollaboratorId]);

  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeCollabViewTab, setActiveCollabViewTab] = useState<'track_builder' | 'exercises'>('track_builder');
  const [selectedBriefingExercise, setSelectedBriefingExercise] = useState<Exercise | null>(null);

  // Modal de Finalização / Parecer Oficial do Guardião Anfitrião
  const [showFinalizeModal, setShowFinalizeModal] = useState(false);
  const [finalizeVerdict, setFinalizeVerdict] = useState<'aprovado' | 'necessita_reforco'>('aprovado');
  const [finalizeOpinion, setFinalizeOpinion] = useState('');
  const [isFinalizingTrack, setIsFinalizingTrack] = useState(false);
  const [isReopeningTrack, setIsReopeningTrack] = useState(false);
  const [acknowledgeIncompleteTrack, setAcknowledgeIncompleteTrack] = useState(false);

  const [deleteConfirmCollaborator, setDeleteConfirmCollaborator] = useState<Collaborator | null>(null);

  // Estados do formulário de criação (+ Novo Colaborador)
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newRoleTitle, setNewRoleTitle] = useState('Atendente de Recepção e Triagem');
  const [newCellTeam, setNewCellTeam] = useState('Laboratório');
  const [newRegCode, setNewRegCode] = useState('');
  const [newStatus, setNewStatus] = useState<CollaboratorStatus>('novo');
  const [newTrackTemplateId, setNewTrackTemplateId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const compatibleTrackTemplates = useMemo(() => {
    const selectedCellName = getCellName(newCellTeam);
    return trackTemplates
      .filter(
        (tpl) =>
          !tpl.cell ||
          tpl.cell === 'Geral' ||
          getCellName(tpl.cell) === selectedCellName
      )
      .sort((a, b) => {
        const aExact = getCellName(a.cell) === selectedCellName && a.cell !== 'Geral' ? 0 : 1;
        const bExact = getCellName(b.cell) === selectedCellName && b.cell !== 'Geral' ? 0 : 1;
        return aExact - bExact;
      });
  }, [trackTemplates, newCellTeam]);

  // Geração em tempo real do Usuário de Acesso Corporativo no padrão nome.sobrenome
  const autoGeneratedUsername = useMemo(() => {
    return generateCorporateUsername(newFirstName, newLastName);
  }, [newFirstName, newLastName]);

  // Mapa consolidado de Média Geral por colaborador (avaliações concluídas visíveis ao usuário atual)
  const collaboratorAverageMap = useMemo(() => {
    const map = new Map<string, { average: number | null; count: number }>();
    collaborators.forEach((col) => {
      const completed = collaboratorChecklists.filter((asg) => {
        if (
          asg.collaboratorId !== col.id ||
          asg.status !== 'concluido' ||
          typeof asg.finalScore !== 'number'
        ) {
          return false;
        }
        const chk = checklists.find((c) => c.id === asg.checklistId);
        return canViewRestrictedItem(currentUser, chk?.visibility);
      });
      if (completed.length === 0) {
        map.set(col.id, { average: null, count: 0 });
      } else {
        const sum = completed.reduce((acc, curr) => acc + (curr.finalScore as number), 0);
        map.set(col.id, { average: sum / completed.length, count: completed.length });
      }
    });
    return map;
  }, [collaborators, collaboratorChecklists, checklists, currentUser]);

  // Contadores dos indicadores resumidos clicáveis (respeitando filtro de célula e sigilo de veredito)
  const statusSummaryCounts = useMemo(() => {
    const base = collaborators.filter((col) => {
      if (selectedCellFilter !== 'all') {
        if (getCellName(col.cellTeam) !== selectedCellFilter) return false;
      }
      return true;
    });

    const statuses = base.map((c) => getCollaboratorProgressStatus(c, canSeeVerdict));

    return {
      all: base.length,
      a_realizar: statuses.filter((s) => s.key === 'a_realizar').length,
      em_treinamento: statuses.filter((s) => s.key === 'em_treinamento').length,
      concluido: statuses.filter((s) => s.key === 'concluido').length,
      finalizado_aprovado: statuses.filter((s) => s.key === 'finalizado_aprovado').length,
      finalizado_validacao: statuses.filter((s) => s.key === 'finalizado_validacao').length,
      finalizado: statuses.filter((s) => s.key === 'finalizado').length,
    };
  }, [collaborators, selectedCellFilter, canSeeVerdict]);

  // Filtro de listagem reativo pelo status calculado e indicadores rápidos
  const filteredCollaborators = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return collaborators.filter((col) => {
      const statusInfo = getCollaboratorProgressStatus(col, canSeeVerdict);
      if (selectedStatusFilter !== 'all' && statusInfo.key !== selectedStatusFilter) {
        return false;
      }
      if (selectedCellFilter !== 'all') {
        const colCell = getCellName(col.cellTeam);
        if (colCell !== selectedCellFilter) return false;
      }
      if (!q) return true;
      return (
        col.fullName.toLowerCase().includes(q) ||
        col.roleTitle.toLowerCase().includes(q) ||
        col.cellTeam.toLowerCase().includes(q) ||
        (col.registrationCode && col.registrationCode.toLowerCase().includes(q)) ||
        (col.username && col.username.toLowerCase().includes(q))
      );
    });
  }, [
    collaborators,
    searchQuery,
    selectedStatusFilter,
    selectedCellFilter,
    canSeeVerdict,
  ]);

  const rawActiveCollaborator = useMemo(
    () => collaborators.find((c) => c.id === activeCollaboratorId) || null,
    [collaborators, activeCollaboratorId]
  );

  const isBlockedFinalizedView = Boolean(
    rawActiveCollaborator?.isTrackFinalized && !canOpenFinalizedFicha
  );

  const activeCollaborator = isBlockedFinalizedView ? null : rawActiveCollaborator;

  useEffect(() => {
    if (isBlockedFinalizedView && activeCollaboratorId) {
      setActiveCollaboratorId(null);
      onSelectCollaborator?.(null);
    }
  }, [isBlockedFinalizedView, activeCollaboratorId, onSelectCollaborator]);

  // Checklists atribuídos ao colaborador ativo
  const activeAssignments = useMemo(() => {
    if (!activeCollaborator) return [];
    return collaboratorChecklists.filter((c) => c.collaboratorId === activeCollaborator.id);
  }, [collaboratorChecklists, activeCollaborator]);

  // Etapa ativa atual da trilha (status === 'disponivel') para sincronização estrita da Visão do Ator
  const currentAvailableTrackStep = useMemo(() => {
    if (!activeCollaborator) return null;
    return (activeCollaborator.track || []).find((step) => step.status === 'disponivel') || null;
  }, [activeCollaborator]);

  const currentAvailableStepNumber = useMemo(() => {
    if (!activeCollaborator || !currentAvailableTrackStep) return null;
    const idx = (activeCollaborator.track || []).findIndex(
      (step) => step.id === currentAvailableTrackStep.id
    );
    return idx >= 0 ? idx + 1 : null;
  }, [activeCollaborator, currentAvailableTrackStep]);

  // Exercícios vinculados:
  // - No modo Ator/Auxiliar (isActorOnlyMode): olha EXCLUSIVAMENTE para a etapa atualmente liberada (status === 'disponivel').
  // - Sem nenhum fallback para exercícios da célula ou exercícios gerais do sistema.
  const activeLinkedExercises = useMemo(() => {
    if (!activeCollaborator) return [];

    if (isActorOnlyMode) {
      const currentAvailableStep = (activeCollaborator.track || []).find(
        (s) => s.status === 'disponivel'
      );
      if (!currentAvailableStep || currentAvailableStep.type !== 'checklist') {
        return [];
      }

      const chk = checklists.find((c) => c.id === currentAvailableStep.refId);
      if (!chk || !chk.exerciseIds || chk.exerciseIds.length === 0) {
        return [];
      }
      if (!canViewRestrictedItem(currentUser, chk.visibility)) {
        return [];
      }

      return chk.exerciseIds
        .map((exId) => exercises.find((e) => e.id === exId))
        .filter(Boolean) as Exercise[];
    }

    const exerciseIdSet = new Set<string>();

    activeAssignments.forEach((asg) => {
      const chk = checklists.find((c) => c.id === asg.checklistId);
      if (chk && chk.exerciseIds && canViewRestrictedItem(currentUser, chk.visibility)) {
        chk.exerciseIds.forEach((id) => exerciseIdSet.add(id));
      }
    });

    (activeCollaborator.track || []).forEach((step) => {
      if (step.type === 'checklist') {
        const chk = checklists.find((c) => c.id === step.refId);
        if (chk && chk.exerciseIds && canViewRestrictedItem(currentUser, chk.visibility)) {
          chk.exerciseIds.forEach((id) => exerciseIdSet.add(id));
        }
      } else if (exercises.some((e) => e.id === step.refId)) {
        exerciseIdSet.add(step.refId);
      }
    });

    return Array.from(exerciseIdSet)
      .map((exId) => exercises.find((e) => e.id === exId))
      .filter(Boolean) as Exercise[];
  }, [activeCollaborator, isActorOnlyMode, activeAssignments, checklists, exercises, currentUser]);

  useEffect(() => {
    if (isActorOnlyMode && activeCollaboratorId) {
      setActiveCollabViewTab('exercises');
    } else if (!isActorOnlyMode && activeCollaboratorId) {
      setActiveCollabViewTab('track_builder');
    }
  }, [isActorOnlyMode, activeCollaboratorId]);

  useEffect(() => {
    setActiveActorSceneIndex(0);
  }, [activeCollaboratorId, currentAvailableTrackStep?.id]);

  const safeActorSceneIndex =
    activeLinkedExercises.length > 0 &&
    activeActorSceneIndex >= 0 &&
    activeActorSceneIndex < activeLinkedExercises.length
      ? activeActorSceneIndex
      : 0;
  const currentActorScene = activeLinkedExercises[safeActorSceneIndex] || null;

  // Exportação consolidada do Dossiê do Colaborador em PDF (com capítulos por Etapa/Semana e sigilo RBAC)
  const handleExportCollaboratorDossier = () => {
    if (!activeCollaborator) return;

    const dossierData = buildFullConsolidatedDossierData({
      collaborator: activeCollaborator,
      currentUser,
      checklists,
      collaboratorChecklists,
      exercises,
      characters,
      surveys,
      surveyResponses,
      users,
      generatedBy: pdfGeneratedBy,
    });

    downloadCollaboratorDossierPdf(dossierData);
  };

  const [guideMirrorCharacter, setGuideMirrorCharacter] = useState<Character | null>(null);
  const [attachedGuideViewer, setAttachedGuideViewer] = useState<AttachedGuideViewerData | null>(null);

  const handleCreateCollaborator = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFirstName.trim() || !newLastName.trim()) {
      showToast('Preencha o Nome e o Sobrenome do colaborador.', 'error');
      return;
    }
    if (!newRoleTitle.trim()) {
      showToast('Informe o Cargo / Função do colaborador.', 'error');
      return;
    }

    setIsSubmitting(true);
    const res = await createCollaborator({
      firstName: newFirstName.trim(),
      lastName: newLastName.trim(),
      username: autoGeneratedUsername,
      roleTitle: newRoleTitle.trim(),
      cellTeam: newCellTeam,
      registrationCode: newRegCode.trim() || undefined,
      initialTrackTemplateId: newTrackTemplateId || undefined,
      status: newStatus,
    });
    setIsSubmitting(false);

    if (res.success) {
      showToast(
        res.message || `Colaborador cadastrado! Usuário: @${autoGeneratedUsername}`,
        'success'
      );
      setShowCreateModal(false);
      setNewFirstName('');
      setNewLastName('');
      setNewRegCode('');
      setNewTrackTemplateId('');
      if (res.collaboratorId) {
        selectCollaborator(res.collaboratorId);
      }
    } else {
      showToast(res.message, 'error');
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmCollaborator) return;
    const res = await deleteCollaborator(deleteConfirmCollaborator.id);
    const targetId = deleteConfirmCollaborator.id;
    setDeleteConfirmCollaborator(null);
    if (res.success) {
      showToast('Colaborador removido com sucesso.', 'success');
      if (activeCollaboratorId === targetId) {
        selectCollaborator(null);
      }
    } else {
      showToast(res.message, 'error');
    }
  };

  const toggleActorPhraseUsed = (key: string) => {
    setUsedActorPhrases((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="space-y-6">
      {/* ======================================================== */}
      {/* MODO FICHA COMPLETA DO COLABORADOR COM GERENCIADOR DE VÍNCULOS */}
      {/* ======================================================== */}
      {activeCollaborator ? (
        <div className="space-y-6 animate-in fade-in duration-200">
          {/* Voltar para a listagem */}
          <div className="flex items-center justify-between flex-wrap gap-2">
            <button
              type="button"
              onClick={() => selectCollaborator(null)}
              className="inline-flex items-center gap-2 text-xs font-bold text-slate-600 hover:text-[#0f3e2e] bg-white border border-slate-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Voltar para Lista de Colaboradores</span>
            </button>

            <div className="flex items-center gap-2 flex-wrap">
              {!isActorOnlyMode && (
                <button
                  type="button"
                  onClick={handleExportCollaboratorDossier}
                  className="px-3.5 py-1.5 text-xs font-bold text-white bg-[#0f3e2e] hover:bg-emerald-900 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Imprimir Dossiê Final Completo</span>
                </button>
              )}

              {!isActorOnlyMode && canActAsGuardianOrAdmin && !activeCollaborator.isTrackFinalized && (
                <button
                  type="button"
                  onClick={() => {
                    const avgInfo = collaboratorAverageMap.get(activeCollaborator.id);
                    const defaultVerdict =
                      avgInfo?.average !== null && avgInfo?.average !== undefined && avgInfo.average < 7
                        ? 'necessita_reforco'
                        : 'aprovado';
                    setFinalizeVerdict(defaultVerdict);
                    setFinalizeOpinion(activeCollaborator.guardianOpinion || '');
                    setAcknowledgeIncompleteTrack(false);
                    setShowFinalizeModal(true);
                  }}
                  className="px-3.5 py-1.5 text-xs font-bold text-amber-950 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded-lg transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                >
                  <Shield className="w-3.5 h-3.5 text-amber-800" />
                  <span>Finalizar Trilha &amp; Emitir Parecer</span>
                </button>
              )}

              {canManageCollaborators && (
                <button
                  type="button"
                  onClick={() => setDeleteConfirmCollaborator(activeCollaborator)}
                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                  title="Excluir Colaborador"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Cartão de Identificação do Colaborador */}
          <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-[#0f3e2e] flex items-center justify-center font-display font-bold text-xl shrink-0">
                {activeCollaborator.fullName.slice(0, 2).toUpperCase()}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2.5">
                  <h1 className="text-xl font-bold font-display text-slate-900">
                    {activeCollaborator.fullName}
                  </h1>
                  {(() => {
                    const statusInfo = getCollaboratorProgressStatus(
                      activeCollaborator,
                      canSeeVerdict
                    );
                    const isNeutralFinalized = statusInfo.key === 'finalizado';
                    return (
                      <span
                        title={statusInfo.subtitle}
                        className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-bold text-xs whitespace-nowrap shrink-0 ${statusInfo.badgeStyle}`}
                      >
                        {(statusInfo.key === 'concluido' ||
                          statusInfo.key === 'finalizado_aprovado' ||
                          statusInfo.key === 'finalizado') && (
                          <CheckCircle2
                            className={`w-3.5 h-3.5 ${
                              isNeutralFinalized ? 'text-slate-500' : 'text-emerald-600'
                            }`}
                          />
                        )}
                        {statusInfo.key === 'finalizado_validacao' && (
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-700" />
                        )}
                        <span>{statusInfo.label}</span>
                      </span>
                    );
                  })()}
                </div>
                <div className="text-xs text-slate-600 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                  <span>
                    Cargo: <strong>{activeCollaborator.roleTitle}</strong>
                  </span>
                  <span>
                    Setor/Célula: <strong>{getCellName(activeCollaborator.cellTeam)}</strong>
                  </span>
                  {activeCollaborator.username && (
                    <span className="font-mono bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded text-[11px] font-semibold flex items-center gap-1">
                      <User className="w-3 h-3 text-emerald-600" />
                      Login: @{activeCollaborator.username}
                    </span>
                  )}
                  {activeCollaborator.registrationCode && (
                    <span className="font-mono bg-slate-100 px-1.5 py-0.5 rounded text-[11px]">
                      Matrícula: {activeCollaborator.registrationCode}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Painel Resumo Compacto de Métricas */}
            {(() => {
              if (isActorOnlyMode) {
                return (
                  <div className="flex items-center gap-3 bg-emerald-50/90 border border-emerald-200/90 px-4 py-3 rounded-xl shrink-0">
                    <div className="w-9 h-9 rounded-lg bg-[#0f3e2e] text-white flex items-center justify-center font-bold">
                      <Theater className="w-5 h-5 text-emerald-300" />
                    </div>
                    <div>
                      <div className="text-[11px] font-bold text-emerald-950 uppercase tracking-wide">
                        Perfil Cênico · Ator da Simulação
                      </div>
                      <div className="text-xs text-emerald-800 font-medium">
                        {activeLinkedExercises.length} roteiro(s) de simulação vinculado(s)
                      </div>
                    </div>
                  </div>
                );
              }

              const trackList = activeCollaborator.track || [];
              const doneTrack = trackList.filter((s) => s.status === 'concluido').length;
              const totalTrack = trackList.length;
              const trackPct = totalTrack > 0 ? Math.round((doneTrack / totalTrack) * 100) : 0;

              const avgInfo = collaboratorAverageMap.get(activeCollaborator.id);
              const avgScoreValue = avgInfo?.average ?? null;
              const completedCount = avgInfo?.count ?? 0;
              const avgScore = avgScoreValue !== null ? avgScoreValue.toFixed(1) : '—';

              return (
                <div className="flex flex-col sm:flex-row items-center gap-4 bg-slate-50 p-4 rounded-xl border border-slate-200 shrink-0">
                  <div>
                    <div className="text-[11px] text-slate-500 font-medium">Progresso na Trilha</div>
                    <div className="text-base font-bold font-mono text-[#0f3e2e] flex items-center gap-2">
                      <span>{doneTrack} de {totalTrack} ({trackPct}%)</span>
                    </div>
                    <div className="w-28 bg-slate-200 h-1.5 rounded-full overflow-hidden mt-1">
                      <div
                        className="bg-emerald-600 h-full rounded-full transition-all"
                        style={{ width: `${trackPct}%` }}
                      />
                    </div>
                  </div>

                  <div className="hidden sm:block w-px h-10 bg-slate-200" />

                  <div>
                    <div className="text-[11px] text-slate-500 font-medium">Média de Desempenho</div>
                    <div
                      className={`text-base font-bold font-mono ${getScorePerformanceMeta(avgScoreValue).textClass}`}
                    >
                      {avgScore !== '—' ? `${avgScore} / 10` : 'Pendente'}
                    </div>
                    <div className="text-[10px] text-slate-400">
                      {completedCount} avaliação(ões)
                    </div>
                  </div>

                  <div className="hidden sm:block w-px h-10 bg-slate-200" />

                  <button
                    type="button"
                    onClick={handleExportCollaboratorDossier}
                    className="px-3 py-1.5 text-xs font-bold text-emerald-950 bg-emerald-100 hover:bg-emerald-200 border border-emerald-300 rounded-lg flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                    title="Baixar dossiê consolidado com métricas, histórico e parecer"
                  >
                    <Download className="w-3.5 h-3.5 text-emerald-800" />
                    <span>Dossiê PDF</span>
                  </button>
                </div>
              );
            })()}
          </div>

          {/* Card de Parecer Oficial do Guardião Anfitrião (visível exclusivamente para Admin e Guardião Anfitrião) */}
          {!isActorOnlyMode && activeCollaborator.isTrackFinalized && canSeeVerdict && (
            <div
              className={`rounded-2xl border-2 p-5 shadow-xs space-y-3 ${
                activeCollaborator.guardianVerdict === 'necessita_reforco'
                  ? 'bg-amber-50/70 border-amber-300'
                  : 'bg-emerald-50/70 border-emerald-300'
              }`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-2.5 flex-wrap">
                  <div
                    className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                      activeCollaborator.guardianVerdict === 'necessita_reforco'
                        ? 'bg-amber-600 text-white'
                        : 'bg-[#0f3e2e] text-white'
                    }`}
                  >
                    <Shield className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h2 className="text-sm font-bold text-slate-900">
                        Parecer Oficial do Guardião Anfitrião
                      </h2>
                      <span
                        className={`text-[10px] font-extrabold uppercase tracking-wider px-2.5 py-0.5 rounded-full border ${
                          activeCollaborator.guardianVerdict === 'necessita_reforco'
                            ? 'bg-amber-100 text-amber-900 border-amber-300'
                            : 'bg-emerald-100 text-emerald-900 border-emerald-300'
                        }`}
                      >
                        {activeCollaborator.guardianVerdict === 'necessita_reforco'
                          ? 'Necessita Acompanhamento'
                          : 'Apto para Operação'}
                      </span>
                    </div>
                    {activeCollaborator.guardianVerdict === 'necessita_reforco' && (
                      <p className="text-[11px] font-semibold text-amber-900 mt-0.5">
                        Acompanhamento direcionado junto à liderança e plano de desenvolvimento contínuo.
                      </p>
                    )}
                    <p className="text-[11px] text-slate-600 mt-0.5">
                      Finalizado por{' '}
                      <strong>{activeCollaborator.guardianFinalizedBy || 'Guardião Anfitrião'}</strong>
                      {activeCollaborator.guardianFinalizedAt && (
                        <>
                          {' '}
                          em{' '}
                          {new Date(activeCollaborator.guardianFinalizedAt).toLocaleString('pt-BR', {
                            dateStyle: 'short',
                            timeStyle: 'short',
                          })}
                        </>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  <button
                    type="button"
                    onClick={handleExportCollaboratorDossier}
                    className="px-3.5 py-2 text-xs font-bold text-white bg-[#0f3e2e] hover:bg-emerald-900 rounded-xl transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Imprimir Dossiê Final Completo</span>
                  </button>

                  {isAdmin && (
                    <button
                      type="button"
                      disabled={isReopeningTrack}
                      onClick={async () => {
                        setIsReopeningTrack(true);
                        const res = await reopenCollaboratorTrack(activeCollaborator.id);
                        setIsReopeningTrack(false);
                        showToast(res.message, res.success ? 'success' : 'error');
                      }}
                      className="px-3 py-2 text-xs font-bold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                      title="Reabrir trilha para ajustes (Acesso exclusivo Administrador)"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Reabrir Trilha</span>
                    </button>
                  )}
                </div>
              </div>

              <div className="bg-white/90 border border-slate-200/80 rounded-xl p-3.5 text-xs text-slate-800 leading-relaxed whitespace-pre-line">
                {activeCollaborator.guardianOpinion || 'Sem parecer descritivo registrado.'}
              </div>
            </div>
          )}

          {/* Modo Leitura Rápida de Alto Contraste (exclusivo para perfil somente roteiros/ator) */}
          {isActorOnlyMode ? (
            <div className="space-y-4 pt-2">
              <div className="bg-[#0f3e2e] text-white border border-emerald-900 rounded-2xl p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-emerald-300 text-xs font-bold uppercase tracking-wider">
                    <Theater className="w-4 h-4" />
                    <span>Modo Leitura Rápida · Roteiro da Etapa Atual</span>
                  </div>
                  <h2 className="text-lg font-bold text-white">
                    Roteiro Cênico para {activeCollaborator.fullName}
                  </h2>
                  {currentAvailableTrackStep ? (
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-emerald-950/70 border border-emerald-500/40 text-xs font-semibold text-emerald-100 mt-1">
                      <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                      <span>
                        Etapa Atual em Andamento:{' '}
                        <strong className="text-white">
                          Etapa {String(currentAvailableStepNumber || 1).padStart(2, '0')} •{' '}
                          {currentAvailableTrackStep.title}
                        </strong>
                      </span>
                    </div>
                  ) : (
                    <p className="text-xs text-amber-200 font-medium mt-0.5">
                      Nenhuma etapa com status &ldquo;Disponível&rdquo; encontrada na trilha atual.
                    </p>
                  )}
                  <p className="text-xs text-emerald-100/90 pt-0.5">
                    Consulte rapidamente a carteirinha, a guia médica anexada, o contexto do atendimento e marque as falas utilizadas durante a encenação.
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <span className="text-xs font-bold px-3.5 py-1.5 rounded-xl bg-white/10 border border-white/20 text-white">
                    {activeLinkedExercises.length > 1
                      ? `Cena ${safeActorSceneIndex + 1} de ${activeLinkedExercises.length}`
                      : `${activeLinkedExercises.length} Cenário(s) Ativo(s)`}
                  </span>
                </div>
              </div>

              {activeLinkedExercises.length === 0 ? (
                <div className="bg-white border border-dashed border-slate-300 rounded-2xl p-8 text-center space-y-2.5">
                  <Theater className="w-10 h-10 text-slate-300 mx-auto mb-1" />
                  <h4 className="font-bold text-sm text-slate-800">
                    Nenhuma simulação ativa liberada no momento para este colaborador.
                  </h4>
                  <p className="text-xs text-slate-500 max-w-lg mx-auto leading-relaxed">
                    {(() => {
                      const track = activeCollaborator.track || [];
                      if (track.length === 0) {
                        return 'Status da trilha: Nenhuma etapa configurada na trilha de desenvolvimento até o momento.';
                      }
                      if (!currentAvailableTrackStep) {
                        const allDone = track.every((s) => s.status === 'concluido');
                        return allDone
                          ? 'Status da trilha: Todas as etapas da trilha já foram concluídas e não há simulação ativa pendente.'
                          : 'Status da trilha: Aguardando liberação de etapa pelo administrador ou guardião.';
                      }
                      if (currentAvailableTrackStep.type === 'survey') {
                        return `Status da trilha: Etapa de pesquisa de feedback em andamento (${currentAvailableTrackStep.title}), sem roteiro de simulação vinculado.`;
                      }
                      return `Status da trilha: A etapa liberada atualmente (${currentAvailableTrackStep.title}) é um checklist direto sem exercícios de simulação vinculados.`;
                    })()}
                  </p>
                </div>
              ) : currentActorScene ? (
                <div className="space-y-4">
                  {/* Barra de Navegação Focada de Cenas (apenas 1 exercício visível por vez) */}
                  {activeLinkedExercises.length > 1 && (
                    <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-2xs space-y-3">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                        <div className="min-w-0">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 block">
                            Navegação de Cenas da Etapa ({activeLinkedExercises.length} exercícios vinculados)
                          </span>
                          <h3 className="text-sm font-bold text-slate-900 truncate mt-0.5">
                            Cena {safeActorSceneIndex + 1} de {activeLinkedExercises.length}: {currentActorScene.title}
                          </h3>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() =>
                              setActiveActorSceneIndex((prev) => Math.max(0, prev - 1))
                            }
                            disabled={safeActorSceneIndex === 0}
                            className="px-3 py-1.5 text-xs font-bold rounded-xl border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-1 cursor-pointer"
                          >
                            <ChevronLeft className="w-3.5 h-3.5" />
                            <span>Anterior</span>
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setActiveActorSceneIndex((prev) =>
                                Math.min(activeLinkedExercises.length - 1, prev + 1)
                              )
                            }
                            disabled={safeActorSceneIndex >= activeLinkedExercises.length - 1}
                            className="px-3.5 py-1.5 text-xs font-bold rounded-xl bg-[#0f3e2e] text-white hover:bg-emerald-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors inline-flex items-center gap-1 cursor-pointer shadow-2xs"
                          >
                            <span>Próxima Cena</span>
                            <ChevronRight className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center gap-2 flex-wrap pt-2 border-t border-slate-100">
                        {activeLinkedExercises.map((sceneEx, idx) => {
                          const isSelectedScene = idx === safeActorSceneIndex;
                          return (
                            <button
                              key={sceneEx.id}
                              type="button"
                              onClick={() => setActiveActorSceneIndex(idx)}
                              className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer max-w-full truncate ${
                                isSelectedScene
                                  ? 'bg-[#0f3e2e] text-white shadow-xs'
                                  : 'bg-slate-50 text-slate-700 border border-slate-200 hover:border-emerald-600 hover:bg-emerald-50/40'
                              }`}
                            >
                              Cena {idx + 1} de {activeLinkedExercises.length}: {sceneEx.title}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {[currentActorScene].map((ex) => {
                    const exChars = ex.characterIds
                      .map((cId) => characters.find((c) => c.id === cId))
                      .filter(Boolean) as Character[];
                    const exAttachments = getExerciseAttachments(ex);

                    return (
                      <div
                        key={ex.id}
                        className="bg-white border-2 border-slate-200 rounded-2xl p-6 shadow-sm space-y-5"
                      >
                        {/* Header do Roteiro */}
                        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 pb-4 border-b border-slate-200">
                          <div>
                            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                              <span className="text-[10px] font-bold text-emerald-950 bg-emerald-100 border border-emerald-300 px-2.5 py-0.5 rounded-full uppercase">
                                Célula: {getCellName(ex.cell)}
                              </span>
                              <span className="text-[10px] font-bold text-slate-800 bg-slate-100 border border-slate-300 px-2.5 py-0.5 rounded-full uppercase">
                                Dificuldade: {ex.difficulty || 'Mediano'}
                              </span>
                            </div>
                            <h3 className="text-lg font-bold text-slate-900">{ex.title}</h3>
                          </div>

                          <div className="flex items-center gap-2 shrink-0 flex-wrap">
                            {exChars.length > 1 && (
                              <button
                                type="button"
                                onClick={() => downloadMultipleGuidesPdf(exChars, ex.title, undefined, pdfGeneratedBy)}
                                className="px-3.5 py-2 text-xs font-bold text-[#0f3e2e] bg-emerald-100 hover:bg-emerald-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>Baixar Roteiros (PDF)</span>
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setSelectedBriefingExercise(ex)}
                              className="px-4 py-2 text-xs font-bold text-white bg-[#0f3e2e] hover:bg-emerald-900 rounded-xl transition-all shadow-xs flex items-center gap-1.5 cursor-pointer"
                            >
                              <Play className="w-4 h-4 text-emerald-300" />
                              <span>Abrir Modal Completo</span>
                            </button>
                          </div>
                        </div>

                        {/* Anexo(s) de apoio do próprio exercício (se houver) */}
                        {exAttachments.length > 0 && (
                          <div className="flex items-center justify-between gap-2 bg-emerald-50 border border-emerald-200 rounded-xl px-3.5 py-2.5">
                            <div className="flex items-center gap-2 min-w-0">
                              <FileText className="w-4 h-4 text-emerald-700 shrink-0" />
                              <span className="text-xs font-semibold text-emerald-950 truncate">
                                {exAttachments.length === 1
                                  ? exAttachments[0].name
                                  : `${exAttachments.length} Documentos de Apoio do Cenário`}
                              </span>
                            </div>
                            <button
                              type="button"
                              onClick={() =>
                                setAttachedGuideViewer({
                                  title: `Documento do Caso · ${ex.title}`,
                                  guides: exAttachments,
                                })
                              }
                              className="px-3 py-1.5 text-xs font-bold text-white bg-[#0f3e2e] hover:bg-emerald-900 rounded-lg transition-colors cursor-pointer shrink-0"
                            >
                              {exAttachments.length > 1
                                ? `Visualizar Guias (${exAttachments.length})`
                                : 'Visualizar Guia Médica'}
                            </button>
                          </div>
                        )}

                        {/* Instruções do Cenário para o Ator */}
                        <div className="space-y-2">
                          <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                            <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                            <span>Instruções da Cena / Comportamento do Ator</span>
                          </h4>
                          <div className="bg-slate-900 text-slate-100 rounded-xl p-4 text-xs leading-relaxed font-medium whitespace-pre-line">
                            {ex.scenarioInstructions}
                          </div>
                        </div>

                        {/* Cards de Alto Contraste dos Personagens para Leitura Rápida */}
                        {exChars.length > 0 && (
                          <div className="space-y-3">
                            <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                              <UserCheck className="w-3.5 h-3.5 text-emerald-700" />
                              <span>Fichas de Leitura Rápida do(s) Cliente(s) ({exChars.length})</span>
                            </h4>
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                              {exChars.map((char) => {
                                const phrases = normalizePhrases(char.typicalPhrases);
                                const usedCount = phrases.filter(
                                  (_, pIdx) => usedActorPhrases[`${ex.id}-${char.id}-${pIdx}`]
                                ).length;

                                return (
                                  <div
                                    key={char.id}
                                    className="bg-white border-2 border-emerald-700/25 rounded-2xl overflow-hidden shadow-xs flex flex-col justify-between"
                                  >
                                    {/* Cabeçalho de Alto Contraste */}
                                    <div className="bg-[#0f3e2e] text-white p-4 space-y-3">
                                      <div className="flex items-start justify-between gap-2">
                                        <div className="flex items-center gap-2.5">
                                          <div className="w-9 h-9 rounded-xl bg-emerald-500 text-emerald-950 font-black text-sm flex items-center justify-center shrink-0">
                                            {char.name.charAt(0)}
                                          </div>
                                          <div>
                                            <div className="font-bold text-sm text-white leading-tight">
                                              {char.name}
                                            </div>
                                            <div className="text-[11px] text-emerald-200">
                                              {char.age} · {char.gender} · {char.city}
                                            </div>
                                          </div>
                                        </div>
                                        <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded-full bg-white/15 text-emerald-100 shrink-0">
                                          {char.customerTier || 'Mediano'}
                                        </span>
                                      </div>

                                      {/* Destaque: Número da Carteirinha */}
                                      <div className="bg-emerald-950/80 border border-emerald-600/50 rounded-xl px-3.5 py-2.5 flex items-center justify-between gap-2">
                                        <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-300 flex items-center gap-1.5">
                                          <CreditCard className="w-4 h-4" />
                                          <span>Nº da Carteirinha</span>
                                        </span>
                                        <span className="font-mono text-sm font-black text-white tracking-wide select-all">
                                          {char.cardNumber || 'Não informada'}
                                        </span>
                                      </div>
                                    </div>

                                    <div className="p-4 space-y-3.5 text-xs flex-1">
                                      {/* Destaque: Contexto do Atendimento */}
                                      <div className="bg-amber-50 border-l-4 border-amber-500 rounded-r-xl p-3 space-y-1">
                                        <div className="text-[10px] font-extrabold uppercase tracking-wider text-amber-900">
                                          Contexto do Atendimento
                                        </div>
                                        <p className="text-slate-900 font-semibold leading-relaxed">
                                          {char.serviceContext || char.history || 'Sem contexto cadastrado.'}
                                        </p>
                                      </div>

                                      <div className="grid grid-cols-1 gap-2 bg-slate-50 border border-slate-200 rounded-xl p-3">
                                        <div>
                                          <span className="font-bold text-slate-800">Temperamento / Humor: </span>
                                          <span className="text-slate-700">{char.temperament}</span>
                                        </div>
                                        {char.objectives && (
                                          <div>
                                            <span className="font-bold text-slate-800">Objetivo na Cena: </span>
                                            <span className="text-slate-700">{char.objectives}</span>
                                          </div>
                                        )}
                                      </div>

                                      {/* Lista Interativa de Falas / Objeções com Checkbox Local ("Fala utilizada") */}
                                      {phrases.length > 0 && (
                                        <div className="space-y-2 pt-1">
                                          <div className="flex items-center justify-between">
                                            <span className="text-[10px] font-extrabold text-emerald-950 uppercase tracking-wider">
                                              Falas & Objeções ({usedCount}/{phrases.length} utilizadas)
                                            </span>
                                            {usedCount > 0 && (
                                              <button
                                                type="button"
                                                onClick={() => {
                                                  setUsedActorPhrases((prev) => {
                                                    const next = { ...prev };
                                                    phrases.forEach((_, idx) => {
                                                      delete next[`${ex.id}-${char.id}-${idx}`];
                                                    });
                                                    return next;
                                                  });
                                                }}
                                                className="text-[10px] font-bold text-slate-500 hover:text-slate-800 underline cursor-pointer"
                                              >
                                                Limpar marcações
                                              </button>
                                            )}
                                          </div>

                                          <div className="space-y-1.5">
                                            {phrases.map((phrase, pIdx) => {
                                              const phraseKey = `${ex.id}-${char.id}-${pIdx}`;
                                              const isUsed = Boolean(usedActorPhrases[phraseKey]);
                                              return (
                                                <button
                                                  key={pIdx}
                                                  type="button"
                                                  onClick={() => toggleActorPhraseUsed(phraseKey)}
                                                  className={`w-full text-left p-2.5 rounded-xl border transition-all flex items-start gap-2.5 cursor-pointer ${
                                                    isUsed
                                                      ? 'bg-emerald-50/70 border-emerald-300 text-slate-500'
                                                      : 'bg-white border-slate-300 hover:border-emerald-600 text-slate-900 shadow-2xs'
                                                  }`}
                                                >
                                                  {isUsed ? (
                                                    <CheckSquare className="w-4 h-4 text-emerald-700 shrink-0 mt-0.5" />
                                                  ) : (
                                                    <Square className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                                                  )}
                                                  <div className="flex-1 min-w-0">
                                                    <span
                                                      className={`block text-xs font-medium leading-snug ${
                                                        isUsed ? 'line-through text-slate-400' : 'text-slate-900'
                                                      }`}
                                                    >
                                                      &ldquo;{phrase}&rdquo;
                                                    </span>
                                                    <span className="text-[10px] font-bold uppercase tracking-wide text-emerald-800 mt-0.5 block">
                                                      {isUsed ? 'Fala utilizada ✓' : 'Fala utilizada'}
                                                    </span>
                                                  </div>
                                                </button>
                                              );
                                            })}
                                          </div>
                                        </div>
                                      )}
                                    </div>

                                    {(() => {
                                      const charGuides = getCharacterGuides(char);
                                      return (
                                        <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex items-center gap-2 flex-wrap">
                                          {charGuides.length > 0 && (
                                            <button
                                              type="button"
                                              onClick={() =>
                                                setAttachedGuideViewer({
                                                  title: `${
                                                    charGuides.length > 1 ? 'Guias Médicas' : 'Guia Médica'
                                                  } · ${char.name}`,
                                                  subtitle: `${ex.title}${
                                                    char.cardNumber
                                                      ? ` · Carteirinha ${char.cardNumber}`
                                                      : ''
                                                  }`,
                                                  guides: charGuides,
                                                })
                                              }
                                              className="flex-1 min-w-[155px] py-1.5 px-3 text-xs font-bold text-white bg-[#0f3e2e] hover:bg-emerald-900 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-2xs"
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
                                            onClick={() => setGuideMirrorCharacter(char)}
                                            className={`${
                                              charGuides.length > 0 ? '' : 'flex-1 '
                                            }py-1.5 px-3 text-xs font-bold text-emerald-900 bg-emerald-100 hover:bg-emerald-200 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer`}
                                          >
                                            <Eye className="w-3.5 h-3.5" />
                                            <span>Visualizar Ficha</span>
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => downloadGuidePdf(char, ex.title, pdfGeneratedBy)}
                                            className="py-1.5 px-3 text-xs font-bold text-slate-800 bg-white hover:bg-slate-100 border border-slate-300 rounded-lg transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
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
              ) : null}
            </div>
          ) : (
            <>
              {/* Abas de Navegação Interna da Ficha do Colaborador (Admin e Avaliador) */}
              <div className="flex items-center gap-2 border-b border-slate-200 pb-px">
                <button
                  type="button"
                  onClick={() => setActiveCollabViewTab('track_builder')}
                  className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
                    activeCollabViewTab === 'track_builder'
                      ? 'border-emerald-700 text-emerald-900 bg-emerald-50/50'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <GraduationCap className="w-4 h-4" />
                  <span>
                    {canManageCollaborators
                      ? `Configurar Trilha / Linha do Tempo (${activeCollaborator.track?.length || 0})`
                      : `Trilha de Desenvolvimento (${activeCollaborator.track?.length || 0})`}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveCollabViewTab('exercises')}
                  className={`px-4 py-2.5 text-xs font-bold transition-all border-b-2 cursor-pointer flex items-center gap-2 ${
                    activeCollabViewTab === 'exercises'
                      ? 'border-emerald-700 text-emerald-900 bg-emerald-50/50'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <FileText className="w-4 h-4" />
                  <span>Cenários de Simulação ({activeLinkedExercises.length})</span>
                </button>
              </div>

              {/* CONTEÚDO DA ABA SELECIONADA */}
              {activeCollabViewTab === 'track_builder' && (
                <CollaboratorTrackBuilder
                  collaborator={activeCollaborator}
                  readOnly={!canManageCollaborators}
                  onStartEvaluation={onStartEvaluation}
                />
              )}

          {/* ========================================================= */}
          {/* SEÇÃO 2: EXERCÍCIOS E CLIENTES VINCULADOS (ROTEIRO) */}
          {/* ========================================================= */}
          {activeCollabViewTab === 'exercises' && (
          <div className="space-y-3 pt-4">
            <div>
              <h2 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <FileText className="w-4 h-4 text-emerald-700" />
                <span>Cenários de Simulação Vinculados aos Checklists</span>
              </h2>
              <p className="text-[11px] text-slate-500">
                Casos práticos de simulação que o colaborador enfrentará nestas avaliações
              </p>
            </div>

            {activeLinkedExercises.length === 0 ? (
              <div className="bg-white border border-dashed border-slate-200 rounded-xl p-6 text-center text-xs text-slate-500">
                Os checklists vinculados a este colaborador não possuem exercícios de simulação anexados.
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {activeLinkedExercises.map((ex) => (
                  <div
                    key={ex.id}
                    className="bg-white border border-slate-200 rounded-xl p-4.5 flex flex-col justify-between shadow-2xs space-y-3"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] font-bold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-full uppercase">
                          Dificuldade: {ex.difficulty || 'Mediano'}
                        </span>
                        <span className="text-[10px] text-slate-500 font-medium">
                          {ex.characterIds.length} cliente(s)
                        </span>
                      </div>
                      <h3 className="font-bold text-slate-900 text-sm">{ex.title}</h3>
                      <p className="text-[11px] text-slate-600 line-clamp-2">
                        {ex.scenarioInstructions}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                      <button
                        type="button"
                        onClick={() => setSelectedBriefingExercise(ex)}
                        className="text-xs font-bold text-emerald-800 hover:text-emerald-950 flex items-center gap-1 cursor-pointer"
                      >
                        <Play className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Abrir Simulação</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
          )}
        </>
      )}
    </div>
      ) : (
        /* ======================================================== */
        /* MODO LISTAGEM GERAL DE COLABORADORES (TABELA + CADASTRO) */
        /* ======================================================== */
        <div className="space-y-4">
          {/* Header Corporativo do Módulo */}
          <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-emerald-800 text-xs font-bold uppercase tracking-wider mb-1">
                <Users className="w-4 h-4 text-emerald-600" />
                <span>Módulo 1 · Gestão de Pessoas</span>
              </div>
              <h1 className="text-2xl font-bold font-display text-slate-900 tracking-tight">
                Colaboradores em Treinamento
              </h1>
              <p className="text-xs text-slate-600 mt-1 max-w-2xl">
                Acompanhe o desenvolvimento individual, status de aprovação, histórico de notas e gerencie as trilhas de treinamento e simulação.
              </p>
            </div>

            {canManageCollaborators && (
              <button
                type="button"
                onClick={() => setShowCreateModal(true)}
                className="px-4 py-2.5 text-xs font-bold text-white bg-[#0f3e2e] hover:bg-emerald-900 rounded-xl transition-all shadow-sm flex items-center justify-center gap-2 cursor-pointer shrink-0"
              >
                <Plus className="w-4 h-4" />
                <span>+ Novo Colaborador</span>
              </button>
            )}
          </div>

          {/* Indicadores Resumidos Clicáveis (Filtros Rápidos de Ação) */}
          <div
            className={`grid gap-2.5 ${
              canSeeVerdict
                ? 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'
                : 'grid-cols-2 lg:grid-cols-4'
            }`}
          >
            {[
              {
                key: 'all',
                label: 'Todos',
                count: statusSummaryCounts.all,
                accent: 'border-slate-200 bg-white text-slate-900 hover:border-[#0f3e2e]',
                active: 'border-[#0f3e2e] bg-[#0f3e2e] text-white shadow-sm',
                subActive: 'text-emerald-200',
              },
              {
                key: 'a_realizar',
                label: 'A Realizar',
                count: statusSummaryCounts.a_realizar,
                accent: 'border-slate-200 bg-white text-slate-900 hover:border-slate-400',
                active: 'border-slate-800 bg-slate-800 text-white shadow-sm',
                subActive: 'text-slate-300',
              },
              {
                key: 'em_treinamento',
                label: 'Em Treinamento',
                count: statusSummaryCounts.em_treinamento,
                accent: 'border-amber-200 bg-amber-50/40 text-amber-950 hover:border-amber-400',
                active: 'border-amber-600 bg-amber-600 text-white shadow-sm',
                subActive: 'text-amber-100',
              },
              {
                key: 'concluido',
                label: 'Concluído',
                count: statusSummaryCounts.concluido,
                accent: 'border-emerald-200 bg-emerald-50/40 text-emerald-950 hover:border-emerald-500',
                active: 'border-emerald-700 bg-emerald-700 text-white shadow-sm',
                subActive: 'text-emerald-100',
              },
              ...(canSeeVerdict
                ? [
                    {
                      key: 'finalizado_aprovado',
                      label: 'Apto para Operação',
                      count: statusSummaryCounts.finalizado_aprovado,
                      accent: 'border-emerald-300 bg-emerald-50/70 text-emerald-950 hover:border-emerald-600',
                      active: 'border-[#0f3e2e] bg-[#0f3e2e] text-white shadow-sm',
                      subActive: 'text-emerald-200',
                    },
                    {
                      key: 'finalizado_validacao',
                      label: 'Necessita Acompanhamento',
                      count: statusSummaryCounts.finalizado_validacao,
                      accent: 'border-amber-300 bg-amber-50/70 text-amber-950 hover:border-amber-500',
                      active: 'border-amber-700 bg-amber-700 text-white shadow-sm',
                      subActive: 'text-amber-100',
                    },
                  ]
                : []),
            ].map((item) => {
              const isSelected = selectedStatusFilter === item.key;
              return (
                <button
                  key={item.key}
                  type="button"
                  onClick={() => setSelectedStatusFilter(item.key)}
                  className={`p-3.5 py-2.5 rounded-2xl border text-left transition-all cursor-pointer flex flex-col justify-between gap-0.5 ${
                    isSelected ? item.active : item.accent
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-bold leading-snug">{item.label}</span>
                    {item.key === 'finalizado_validacao' && (
                      <AlertTriangle
                        className={`w-3.5 h-3.5 shrink-0 ${
                          isSelected ? 'text-white' : 'text-amber-700'
                        }`}
                      />
                    )}
                  </div>
                  <div className="flex items-baseline justify-between">
                    <span className="text-xl font-black font-mono tracking-tight">
                      {item.count}
                    </span>
                    <span
                      className={`text-[10px] font-semibold ${
                        isSelected ? item.subActive : 'text-slate-500'
                      }`}
                    >
                      {isSelected ? 'Ativo' : 'Filtrar'}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Barra de Filtros e Busca */}
          <div className="bg-white border border-slate-200 rounded-2xl p-3.5 shadow-xs space-y-2.5">
            {/* Filtro por Célula (Padrão Corporativo Limpo) */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2.5 border-b border-slate-100">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-emerald-700 shrink-0" />
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
                {CLEAN_CELL_OPTIONS.map((cellName) => {
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

            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-0.5">
              <div className="relative w-full sm:w-96">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar por nome, cargo ou matrícula..."
                  className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>

              <div className="text-xs text-slate-500 font-semibold">
                {filteredCollaborators.length} colaborador(es)
              </div>
            </div>
          </div>

          {/* Tabela de Colaboradores */}
          {filteredCollaborators.length > 0 ? (
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
              <table className="w-full text-left border-collapse">
                <thead className="bg-slate-50 border-b border-slate-200 text-xs font-semibold text-slate-600">
                  <tr>
                    <th className="px-5 py-3.5">Colaborador</th>
                    <th className="px-5 py-3.5">Célula / Setor</th>
                    <th className="px-5 py-3.5">Status</th>
                    <th className="px-5 py-3.5">Trilha Atribuída</th>
                    <th className="px-5 py-3.5 text-center">
                      {isActorOnlyMode ? 'Roteiro da Simulação' : 'Média Geral'}
                    </th>
                    <th className="px-5 py-3.5 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-xs">
                  {filteredCollaborators.map((col) => {
                    const avgInfo = collaboratorAverageMap.get(col.id);
                    const averageScore = avgInfo?.average ?? null;
                    const evaluationCount = avgInfo?.count ?? 0;
                    const scoreMeta = getScorePerformanceMeta(averageScore);
                    const statusInfo = getCollaboratorProgressStatus(col, canSeeVerdict);
                    const isNeutralFinalized = statusInfo.key === 'finalizado';
                    const isLockedForRole = Boolean(col.isTrackFinalized) && !canOpenFinalizedFicha;

                    return (
                      <tr key={col.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="px-5 py-4">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {isLockedForRole ? (
                              <span
                                title="Trilha finalizada: acesso à ficha e ao roteiro bloqueado para este perfil"
                                className="font-bold text-slate-600 text-sm text-left"
                              >
                                {col.fullName}
                              </span>
                            ) : (
                              <button
                                type="button"
                                onClick={() => selectCollaborator(col.id)}
                                className="font-bold text-slate-900 hover:text-emerald-800 text-sm text-left cursor-pointer"
                              >
                                {col.fullName}
                              </button>
                            )}
                            {col.username && (
                              <span className="font-mono text-[10px] text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200 font-semibold">
                                @{col.username}
                              </span>
                            )}
                          </div>
                          <div className="text-slate-500 text-[11px] mt-0.5">
                            {col.roleTitle}{' '}
                            {col.registrationCode && `· Matrícula: ${col.registrationCode}`}
                          </div>
                        </td>

                        <td className="px-5 py-4 font-medium text-slate-700">
                          {getCellName(col.cellTeam) || 'Geral'}
                        </td>

                        <td className="px-5 py-4">
                          <span
                            title={statusInfo.subtitle}
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full font-bold text-[11px] whitespace-nowrap shrink-0 border ${statusInfo.badgeStyle}`}
                          >
                            {(statusInfo.key === 'concluido' ||
                              statusInfo.key === 'finalizado_aprovado' ||
                              statusInfo.key === 'finalizado') && (
                              <CheckCircle2
                                className={`w-3 h-3 ${
                                  isNeutralFinalized ? 'text-slate-500' : 'text-emerald-600'
                                }`}
                              />
                            )}
                            {statusInfo.key === 'finalizado_validacao' && (
                              <AlertTriangle className="w-3 h-3 text-amber-700" />
                            )}
                            <span>{statusInfo.label}</span>
                          </span>
                        </td>

                        <td className="px-5 py-4 text-slate-600">
                          {(() => {
                            const trackList = col.track || [];
                            const total = trackList.length;
                            const done = trackList.filter((s) => s.status === 'concluido').length;
                            const pct = total > 0 ? Math.round((done / total) * 100) : 0;
                            const barColor = pct === 100 ? 'bg-emerald-600' : 'bg-emerald-500';

                            if (total === 0) {
                              const track = learningTracks.find(
                                (t) => t.id === col.learningTrackId || t.collaboratorIds.includes(col.id)
                              );
                              if (track) {
                                return (
                                  <span className="font-semibold text-emerald-900 bg-emerald-50/90 border border-emerald-200 px-2 py-0.5 rounded-md inline-block text-xs">
                                    {track.title}
                                  </span>
                                );
                              }
                              return <span className="text-slate-400 italic text-xs">Sem trilha configurada</span>;
                            }

                            let pendingBadge: { label: string; className: string } | null = null;
                            if (!col.isTrackFinalized) {
                              if (done === total) {
                                pendingBadge = {
                                  label: 'Pronto p/ Finalizar',
                                  className: 'bg-blue-50 text-blue-800 border-blue-200',
                                };
                              } else {
                                const availableStep = trackList.find(
                                  (s) => s.status === 'disponivel'
                                );
                                if (availableStep) {
                                  if (
                                    availableStep.type === 'checklist' &&
                                    availableStep.filledBy === 'evaluator'
                                  ) {
                                    pendingBadge = {
                                      label: 'Aguardando Avaliação',
                                      className: 'bg-emerald-50 text-emerald-800 border-emerald-200',
                                    };
                                  } else if (
                                    availableStep.type === 'survey' ||
                                    (availableStep.type === 'checklist' &&
                                      availableStep.filledBy === 'collaborator')
                                  ) {
                                    pendingBadge = {
                                      label: 'Aguardando Colaborador',
                                      className: 'bg-amber-50 text-amber-800 border-amber-200',
                                    };
                                  }
                                }
                              }
                            }

                            return (
                              <div className="flex flex-col gap-1.5 min-w-[130px] max-w-[165px]">
                                <div className="flex items-center justify-between text-xs">
                                  <span className="font-semibold text-slate-700">{pct}%</span>
                                  <span className="text-slate-500">{done} de {total}</span>
                                </div>
                                <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden border border-slate-200/60">
                                  <div
                                    className={`h-full ${barColor} rounded-full transition-all duration-300`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                {pendingBadge && (
                                  <span
                                    className={`inline-flex items-center w-fit text-[10px] font-bold px-2 py-0.5 rounded-full border whitespace-nowrap ${pendingBadge.className}`}
                                  >
                                    {pendingBadge.label}
                                  </span>
                                )}
                              </div>
                            );
                          })()}
                        </td>

                        <td className="px-5 py-4 text-center">
                          {isActorOnlyMode ? (
                            col.isTrackFinalized ? (
                              <span className="inline-flex items-center gap-1.5 font-semibold text-xs text-slate-500 bg-slate-100 px-2.5 py-1 rounded-lg border border-slate-200">
                                <Lock className="w-3.5 h-3.5 text-slate-400" />
                                <span>Roteiro Encerrado</span>
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1.5 font-bold text-xs text-emerald-800 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                                <Theater className="w-3.5 h-3.5 text-emerald-600" />
                                <span>Roteiro Disponível</span>
                              </span>
                            )
                          ) : averageScore !== null ? (
                            <span
                              className={`font-mono font-bold text-sm px-2.5 py-1 rounded-lg border ${scoreMeta.badgeClass}`}
                              title={`${scoreMeta.label} · Média em ${evaluationCount} avaliação(ões) concluída(s)`}
                            >
                              {averageScore.toFixed(1)}
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono text-[11px]">—</span>
                          )}
                        </td>

                        <td className="px-5 py-4 text-right">
                          {isLockedForRole ? (
                            <button
                              type="button"
                              disabled
                              title="Trilha finalizada: acesso à ficha e ao roteiro bloqueado para este perfil"
                              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-400 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded-lg cursor-not-allowed opacity-85"
                            >
                              <Lock className="w-3.5 h-3.5 text-slate-400" />
                              <span>Finalizado</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => selectCollaborator(col.id)}
                              className="inline-flex items-center gap-1 text-xs font-bold text-emerald-800 hover:text-emerald-950 bg-emerald-50 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                            >
                              <span>{isActorOnlyMode ? 'Ver Roteiro' : 'Abrir Ficha'}</span>
                              <ChevronRight className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center shadow-xs">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-bold text-slate-900">Nenhum colaborador encontrado</h3>
              <p className="text-xs text-slate-500 max-w-sm mx-auto mt-1 mb-5">
                Cadastre o primeiro colaborador para atribuir checklists e simular atendimentos.
              </p>
              {canManageCollaborators && (
                <button
                  type="button"
                  onClick={() => setShowCreateModal(true)}
                  className="px-4 py-2 text-xs font-bold text-white bg-[#0f3e2e] hover:bg-emerald-900 rounded-xl transition-colors cursor-pointer"
                >
                  Cadastrar Primeiro Colaborador
                </button>
              )}
            </div>
          )}
        </div>
      )}



      {/* ========================================================= */}
      {/* MODAL: ROTEIRO DO ATENDIMENTO (ROLEPLAY) */}
      {/* ========================================================= */}
      {selectedBriefingExercise && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] flex flex-col">
            <div className="px-6 py-4 bg-[#0f3e2e] text-white flex items-center justify-between shrink-0">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-300">
                  Roteiro do Atendimento · Dificuldade {selectedBriefingExercise.difficulty || 'Mediano'}
                </span>
                <h3 className="text-base font-bold text-white mt-0.5">
                  {selectedBriefingExercise.title}
                </h3>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedBriefingExercise(null)}
                  className="text-emerald-200 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div id="printable-roteiro" className="p-6 overflow-y-auto space-y-4 text-xs font-sans print:p-8">
              {/* Cabeçalho impresso oficial */}
              <div className="hidden print:block border-b-2 border-emerald-900 pb-3 mb-4">
                <div className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                  Portal de Desempenho & Desenvolvimento Operacional
                </div>
                <h1 className="text-xl font-black text-slate-900 mt-0.5">
                  ROTEIRO DE ATENDIMENTO SIMULADO
                </h1>
                <div className="text-xs text-slate-600 mt-1 flex items-center gap-3">
                  <span><strong>Caso:</strong> {selectedBriefingExercise.title}</span>
                  <span>•</span>
                  <span><strong>Dificuldade:</strong> {selectedBriefingExercise.difficulty || 'Mediano'}</span>
                </div>
              </div>

              <div className="space-y-1">
                <span className="font-bold text-slate-800 uppercase text-[10px]">
                  Roteiro de Atuação e Instruções do Caso:
                </span>
                <p className="text-slate-700 mt-1 whitespace-pre-line leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200 font-medium">
                  {selectedBriefingExercise.scenarioInstructions}
                </p>
              </div>

              {/* Clientes Vinculados a Este Exercício */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <span className="font-bold text-slate-800 uppercase text-[10px]">
                  Clientes a Serem Interpretados ({selectedBriefingExercise.characterIds.length}):
                </span>
                {selectedBriefingExercise.characterIds.length === 0 ? (
                  <div className="p-3 bg-slate-50 rounded-lg text-slate-500">
                    Nenhum cliente cadastrado neste exercício.
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedBriefingExercise.characterIds.map((charId) => {
                      const char = characters.find((c) => c.id === charId);
                      if (!char) return null;
                      const tierBadge =
                        CUSTOMER_TIER_BADGES[char.customerTier || 'Mediano'] ||
                        CUSTOMER_TIER_BADGES['Mediano'];

                      return (
                        <div
                          key={char.id}
                          className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 space-y-2.5 print:bg-white print:border-slate-300 print:break-inside-avoid"
                        >
                          {(() => {
                            const cellKey = (char.cell || 'OPERADORA') as OfficialCell;
                            const cellMeta = OFFICIAL_CELLS[cellKey] || OFFICIAL_CELLS['OPERADORA'];

                            return (
                              <div className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <span
                                    className="text-[9px] font-bold px-2 py-0.5 rounded-md border border-slate-200 bg-slate-50 text-slate-700 inline-flex items-center gap-1"
                                  >
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
                            );
                          })()}

                          <div className="text-[11px] text-slate-600">
                            <strong>Carteirinha:</strong> {char.cardNumber} ·{' '}
                            <strong>Cidade:</strong> {char.city}
                          </div>

                          <p className="text-slate-700 leading-relaxed text-[11px]">
                            <strong>Contexto:</strong> {char.serviceContext || char.history}
                          </p>

                          <p className="text-slate-700 leading-relaxed text-[11px]">
                            <strong>Humor:</strong> {char.temperament}
                          </p>

                          <p className="text-slate-700 leading-relaxed text-[11px]">
                            <strong>Objetivo:</strong> {char.objectives}
                          </p>

                          {(() => {
                            const phrases = normalizePhrases(char.typicalPhrases);
                            if (phrases.length === 0) return null;
                            return (
                              <div className="bg-emerald-100/60 p-3 rounded-xl border border-emerald-200/80 space-y-1.5">
                                <div className="text-[10px] font-bold uppercase tracking-wider text-emerald-900 flex items-center gap-1">
                                  <span>Falas e Objeções Típicas do Cliente ({phrases.length}):</span>
                                </div>
                                <ul className="space-y-1 pl-1">
                                  {phrases.map((phrase, pIdx) => (
                                    <li key={pIdx} className="text-slate-800 text-[11px] leading-relaxed flex items-start gap-1.5">
                                      <span className="text-emerald-700 font-bold shrink-0">•</span>
                                      <span className="italic">"{phrase}"</span>
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            );
                          })()}

                          {(() => {
                            const charGuides = getCharacterGuides(char);
                            return (
                              <div className="pt-2 flex items-center gap-2 flex-wrap">
                                {charGuides.length > 0 && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setAttachedGuideViewer({
                                        title: `${
                                          charGuides.length > 1 ? 'Guias Médicas' : 'Guia Médica'
                                        } · ${char.name}`,
                                        subtitle: `${selectedBriefingExercise?.title || ''}${
                                          char.cardNumber ? ` · Carteirinha ${char.cardNumber}` : ''
                                        }`,
                                        guides: charGuides,
                                      })
                                    }
                                    className="px-2.5 py-1 text-xs font-bold text-white bg-[#0f3e2e] hover:bg-emerald-900 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
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
                                  onClick={() => setGuideMirrorCharacter(char)}
                                  className="px-2.5 py-1 text-xs font-bold text-emerald-800 bg-emerald-100 hover:bg-emerald-200 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>Visualizar Ficha</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={() => downloadGuidePdf(char, selectedBriefingExercise?.title, pdfGeneratedBy)}
                                  className="px-2.5 py-1 text-xs font-bold text-white bg-[#064e3b] hover:bg-emerald-900 rounded-lg flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                                  title={`Baixar Cliente_${char.name.replace(/\s+/g, '_')}.pdf`}
                                >
                                  <Download className="w-3.5 h-3.5 text-emerald-200" />
                                  <span>Baixar PDF</span>
                                </button>
                              </div>
                            );
                          })()}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
              {selectedBriefingExercise.characterIds.length > 1 ? (
                <button
                  type="button"
                  onClick={() => {
                    const chars = selectedBriefingExercise.characterIds
                      .map((id) => characters.find((c) => c.id === id))
                      .filter(Boolean) as Character[];
                    downloadMultipleGuidesPdf(chars, selectedBriefingExercise.title, undefined, pdfGeneratedBy);
                  }}
                  className="px-4 py-2 font-bold text-xs text-white bg-[#064e3b] hover:bg-emerald-900 rounded-xl transition-all shadow-xs flex items-center gap-2 cursor-pointer"
                >
                  <Download className="w-4 h-4 text-emerald-200" />
                  <span>Imprimir Todos ({selectedBriefingExercise.characterIds.length}) em PDF Único</span>
                </button>
              ) : <div />}
              <button
                type="button"
                onClick={() => setSelectedBriefingExercise(null)}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 font-bold rounded-xl cursor-pointer text-xs"
              >
                Fechar Roteiro
              </button>
            </div>
          </div>
        </div>
      )}



      {/* ========================================================= */}
      {/* MODAL: NOVO COLABORADOR */}
      {/* ========================================================= */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4.5 bg-[#0f3e2e] text-white flex items-center justify-between">
              <div>
                <h3 className="font-bold text-base">Novo Colaborador em Treinamento</h3>
                <p className="text-[11px] text-emerald-200">
                  Preencha os dados e gere as credenciais corporativas de acesso
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateModal(false)}
                className="text-emerald-200 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateCollaborator} className="p-6 space-y-4 text-xs">
              {/* Nome e Sobrenome Obrigatórios */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-800">Nome *</label>
                  <input
                    type="text"
                    required
                    value={newFirstName}
                    onChange={(e) => setNewFirstName(e.target.value)}
                    placeholder="Ex: Lucas"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-900"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-800">Sobrenome *</label>
                  <input
                    type="text"
                    required
                    value={newLastName}
                    onChange={(e) => setNewLastName(e.target.value)}
                    placeholder="Ex: Silveira"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-900"
                  />
                </div>
              </div>

              {/* Usuário de Acesso Corporativo (Somente Leitura / Gerado Automaticamente) */}
              <div className="space-y-1.5 p-3.5 bg-emerald-50/70 border border-emerald-200 rounded-xl">
                <div className="flex items-center justify-between">
                  <label className="block font-bold text-emerald-950 flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Usuário de Acesso (Gerado Automaticamente)</span>
                  </label>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-800 bg-white px-2 py-0.5 rounded border border-emerald-200">
                    Credencial de Login
                  </span>
                </div>
                <div className="relative">
                  <input
                    type="text"
                    readOnly
                    value={autoGeneratedUsername ? `@${autoGeneratedUsername}` : '@nome.sobrenome'}
                    className="w-full px-3.5 py-2 bg-white/90 border border-emerald-300 rounded-lg font-mono font-bold text-emerald-900 cursor-not-allowed select-all focus:outline-none shadow-xs text-sm"
                  />
                </div>
                <p className="text-[11px] text-emerald-800 leading-tight">
                  Identificador corporativo único gerado no formato padronizado{' '}
                  <span className="font-mono font-semibold">nome.sobrenome</span> sem acentos.
                </p>
              </div>

              {/* Célula e Cargo */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-800">Célula / Equipe *</label>
                  <select
                    value={newCellTeam}
                    onChange={(e) => {
                      const nextCell = e.target.value;
                      setNewCellTeam(nextCell);
                      const stillValid = trackTemplates.some(
                        (tpl) =>
                          tpl.id === newTrackTemplateId &&
                          (!tpl.cell ||
                            tpl.cell === 'Geral' ||
                            getCellName(tpl.cell) === getCellName(nextCell))
                      );
                      if (!stillValid) {
                        setNewTrackTemplateId('');
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-900"
                  >
                    {CLEAN_CELL_OPTIONS.map((cellName) => (
                      <option key={cellName} value={cellName}>
                        {cellName}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-800">Cargo / Função *</label>
                  <input
                    type="text"
                    required
                    value={newRoleTitle}
                    onChange={(e) => setNewRoleTitle(e.target.value)}
                    placeholder="Ex: Atendente de Recepção"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-900"
                  />
                </div>
              </div>

              {/* Iniciar com Modelo de Trilha (Opcional) */}
              <div className="space-y-2 p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-800">
                    Iniciar com Modelo de Trilha (Opcional)
                  </label>
                  <select
                    value={newTrackTemplateId}
                    onChange={(e) => setNewTrackTemplateId(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-900"
                  >
                    <option value="">Sem modelo inicial (montar depois)</option>
                    {compatibleTrackTemplates.map((tpl) => {
                      const blockCount = new Set(
                        tpl.steps.map((s) =>
                          normalizeTemplateStageName(s.stageName).toLowerCase()
                        )
                      ).size;
                      return (
                        <option key={tpl.id} value={tpl.id}>
                          {tpl.name} ({blockCount} bloco(s) · {tpl.steps.length} atividade(s) ·{' '}
                          {tpl.cell === 'Geral' ? 'Geral' : getCellName(tpl.cell)})
                        </option>
                      );
                    })}
                  </select>
                </div>

                {newTrackTemplateId ? (
                  (() => {
                    const chosenTpl = trackTemplates.find((t) => t.id === newTrackTemplateId);
                    const blockNames: string[] = [];
                    const seen = new Set<string>();
                    (chosenTpl?.steps || []).forEach((s) => {
                      const name = normalizeTemplateStageName(s.stageName);
                      const key = name.toLowerCase();
                      if (!seen.has(key)) {
                        seen.add(key);
                        blockNames.push(name);
                      }
                    });
                    return (
                      <p className="text-[11px] text-emerald-700 font-medium">
                        O colaborador herdará automaticamente os blocos e atividades configurados neste modelo
                        {blockNames.length > 0 ? `: ${blockNames.join(' · ')}` : ''}, com a 1ª atividade já liberada.
                      </p>
                    );
                  })()
                ) : compatibleTrackTemplates.length === 0 ? (
                  <p className="text-[11px] text-slate-400">
                    Nenhum modelo compatível cadastrado para {getCellName(newCellTeam)}. Você pode criar modelos no menu &ldquo;Modelos de Trilha&rdquo;.
                  </p>
                ) : (
                  <p className="text-[11px] text-slate-500">
                    Escolha um modelo para herdar automaticamente todos os blocos e etapas configurados nele.
                  </p>
                )}
              </div>

              {/* Matrícula e Trilha de Aprendizagem */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold text-slate-800">Matrícula (Opcional)</label>
                  <input
                    type="text"
                    value={newRegCode}
                    onChange={(e) => setNewRegCode(e.target.value)}
                    placeholder="Ex: COL-842"
                    className="w-full px-3.5 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono text-slate-900"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block font-bold text-slate-800">Status Inicial</label>
                  <select
                    value={newStatus}
                    onChange={(e) => setNewStatus(e.target.value as CollaboratorStatus)}
                    className="w-full px-3 py-2 bg-slate-50 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-900"
                  >
                    <option value="novo">Novo</option>
                    <option value="em_treinamento">Em Treinamento</option>
                    <option value="aprovado">Apto para Operação</option>
                    <option value="necessita_reforco">Necessita Acompanhamento</option>
                  </select>
                </div>
              </div>


              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-xl font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !newFirstName.trim() || !newLastName.trim()}
                  className="px-5 py-2 bg-[#0f3e2e] hover:bg-emerald-900 text-white font-bold rounded-xl shadow-sm cursor-pointer disabled:opacity-50"
                >
                  {isSubmitting ? 'Cadastrando...' : 'Cadastrar Colaborador'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO */}
      {deleteConfirmCollaborator && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                Excluir &ldquo;{deleteConfirmCollaborator.fullName}&rdquo;?
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Este colaborador será removido do sistema juntamente com seus vínculos de avaliação.
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmCollaborator(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="px-5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors cursor-pointer shadow-xs"
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: FINALIZAR TRILHA & EMITIR PARECER OFICIAL (GUARDIÃO ANFITRIÃO) */}
      {showFinalizeModal && activeCollaborator && (() => {
        const trackItems = activeCollaborator.track || [];
        const totalTrackSteps = trackItems.length;
        const completedTrackSteps = trackItems.filter((s) => s.status === 'concluido').length;
        const remainingTrackSteps = Math.max(0, totalTrackSteps - completedTrackSteps);
        const isTrackIncomplete = totalTrackSteps === 0 || completedTrackSteps < totalTrackSteps;

        return (
          <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
              <div className="px-6 py-4 bg-[#0f3e2e] text-white flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-8 h-8 rounded-lg bg-amber-400/20 border border-amber-300/40 flex items-center justify-center">
                    <Shield className="w-4 h-4 text-amber-300" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">Finalizar Trilha &amp; Emitir Parecer Oficial</h3>
                    <p className="text-[11px] text-emerald-200">
                      Colaborador: {activeCollaborator.fullName}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowFinalizeModal(false)}
                  className="text-emerald-200 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (isTrackIncomplete && !acknowledgeIncompleteTrack) {
                    showToast(
                      'Confirme que está ciente da finalização com etapas pendentes.',
                      'error'
                    );
                    return;
                  }
                  if (!finalizeOpinion.trim()) {
                    showToast('Escreva o parecer conclusivo do Guardião Anfitrião.', 'error');
                    return;
                  }
                  setIsFinalizingTrack(true);
                  const res = await finalizeCollaboratorTrack(activeCollaborator.id, {
                    verdict: finalizeVerdict,
                    opinion: finalizeOpinion.trim(),
                  });
                  setIsFinalizingTrack(false);
                  if (res.success) {
                    showToast(res.message, 'success');
                    setShowFinalizeModal(false);
                  } else {
                    showToast(res.message, 'error');
                  }
                }}
                className="p-6 space-y-4 text-xs"
              >
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-950 text-[11px] leading-relaxed">
                  Ao finalizar a trilha, o histórico é congelado para edições operacionais e o parecer oficial passará a integrar o <strong>Dossiê Completo (PDF)</strong> para os perfis autorizados.
                </div>

                {isTrackIncomplete && (
                  <div className="p-3.5 bg-red-50 border border-red-200 rounded-xl space-y-2.5">
                    <div className="flex items-start gap-2 text-red-900">
                      <AlertTriangle className="w-4 h-4 text-red-600 shrink-0 mt-0.5" />
                      <div className="text-[11px] leading-relaxed">
                        <div className="font-bold">Atenção: Trilha com etapas pendentes</div>
                        <p className="mt-0.5 text-red-800">
                          {totalTrackSteps === 0
                            ? 'Esta trilha ainda não possui nenhuma etapa cadastrada.'
                            : `Atualmente ${completedTrackSteps} de ${totalTrackSteps} etapa(s) foram concluídas (restam ${remainingTrackSteps} etapa(s) pendente(s)).`}
                        </p>
                      </div>
                    </div>

                    <label className="flex items-start gap-2.5 pt-2 border-t border-red-200/80 cursor-pointer select-none text-red-950">
                      <input
                        type="checkbox"
                        checked={acknowledgeIncompleteTrack}
                        onChange={(e) => setAcknowledgeIncompleteTrack(e.target.checked)}
                        className="mt-0.5 w-4 h-4 rounded text-red-700 border-red-300 focus:ring-red-500 cursor-pointer shrink-0"
                      />
                      <span className="text-[11px] font-semibold leading-snug">
                        Estou ciente de que a trilha não está 100% concluída e desejo finalizá-la mesmo assim.
                      </span>
                    </label>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="block font-bold text-slate-800">Parecer Conclusivo *</label>
                  <div className="grid grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setFinalizeVerdict('aprovado')}
                      className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                        finalizeVerdict === 'aprovado'
                          ? 'bg-emerald-50 border-emerald-600 text-emerald-950 shadow-xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <div className="font-bold text-xs flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>Apto para Operação</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">
                        Apto para atuar no fluxo operacional padrão com autonomia.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setFinalizeVerdict('necessita_reforco')}
                      className={`p-3 rounded-xl border-2 text-left transition-all cursor-pointer ${
                        finalizeVerdict === 'necessita_reforco'
                          ? 'bg-amber-50 border-amber-500 text-amber-950 shadow-xs'
                          : 'bg-white border-slate-200 text-slate-700 hover:border-slate-300'
                      }`}
                    >
                      <div className="font-bold text-xs flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>Necessita Acompanhamento</span>
                      </div>
                      <p className="text-[10px] text-slate-500 mt-1">
                        Requer acompanhamento próximo e reforço junto à liderança.
                      </p>
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="block font-bold text-slate-800">
                    Parecer Oficial do Guardião Anfitrião *
                  </label>
                  <textarea
                    rows={4}
                    required
                    value={finalizeOpinion}
                    onChange={(e) => setFinalizeOpinion(e.target.value)}
                    placeholder="Descreva os pontos fortes observados, recomendações finais e decisão oficial de finalização..."
                    className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 leading-relaxed resize-none"
                  />
                </div>

                <div className="flex justify-end gap-2.5 pt-2 border-t border-slate-200">
                  <button
                    type="button"
                    onClick={() => setShowFinalizeModal(false)}
                    className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={
                      isFinalizingTrack ||
                      !finalizeOpinion.trim() ||
                      (isTrackIncomplete && !acknowledgeIncompleteTrack)
                    }
                    className="px-5 py-2 font-bold text-white bg-[#0f3e2e] hover:bg-emerald-900 rounded-xl shadow-sm cursor-pointer disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <Shield className="w-3.5 h-3.5 text-amber-300" />
                    <span>{isFinalizingTrack ? 'Finalizando...' : 'Finalizar & Emitir Parecer'}</span>
                  </button>
                </div>
              </form>
            </div>
          </div>
        );
      })()}

      {/* Modal de Espelho da Guia */}
      <GuideMirrorModal
        character={guideMirrorCharacter}
        exerciseTitle={selectedBriefingExercise?.title}
        onClose={() => setGuideMirrorCharacter(null)}
      />

      {/* Visualizador Popup de Guia Médica Anexada */}
      <AttachedGuideViewerModal
        attachment={attachedGuideViewer}
        onClose={() => setAttachedGuideViewer(null)}
      />
    </div>
  );
};
