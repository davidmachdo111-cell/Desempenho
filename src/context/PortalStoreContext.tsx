import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import {
  INITIAL_AUDIT_LOGS,
  INITIAL_CATEGORIES,
  INITIAL_CELLS,
  INITIAL_CHARACTERS,
  INITIAL_CHECKLISTS,
  INITIAL_COLLABORATOR_CHECKLISTS,
  INITIAL_COLLABORATORS,
  INITIAL_EXERCISES,
  INITIAL_LEARNING_TRACKS,
  INITIAL_SURVEYS,
  INITIAL_SURVEY_RESPONSES,
  INITIAL_USERS,
} from '../data/initialPortalData';
import { useToast } from './ToastContext';
import {
  checkUserPermission,
  loadRoleDefaultPermissions,
  normalizeRoleDefaultPermissions,
  saveRoleDefaultPermissions,
} from '../lib/permissions';
import { isSupabaseConfigured, supabase } from '../lib/supabaseClient';
import {
  AttachedGuideItem,
  AuditLogEntry,
  Category,
  CategoryType,
  Cell,
  Character,
  Checklist,
  ChecklistCriterion,
  Collaborator,
  CollaboratorTrackStep,
  CollaboratorChecklist,
  CollaboratorStatus,
  CriteriaAnswerSnapshot,
  Criterion,
  Exercise,
  LearningTrack,
  OfficialCell,
  PermissionKey,
  Survey,
  SurveyAnswerItem,
  SurveyQuestion,
  SurveyResponse,
  TrackTemplate,
  TrackTemplateStep,
  UserProfile,
  UserRole,
  UserStatus,
  VisibilityLevel,
  normalizePhrases,
  getCellName,
  CustomerTier,
  ExerciseDifficulty,
  generateCorporateUsername,
  isGuardianHostUser,
} from '../types/portal';

interface MutationResult {
  success: boolean;
  message: string;
}

export interface LoginResult {
  success: boolean;
  status?: UserStatus;
  user?: UserProfile;
  message: string;
}

interface PortalStoreContextValue {
  // Autenticação & Sessão Corporativa
  currentUser: UserProfile | null;
  users: UserProfile[];
  loginWithUsername: (username: string, password?: string) => LoginResult;
  loginWithEmail: (email: string, password?: string) => MutationResult;
  requestAccess: (fullName: string, requestedUsername: string) => Promise<MutationResult>;
  setPassword: (username: string, newPassword: string) => Promise<MutationResult>;
  approveUser: (userId: string, role: UserRole) => Promise<MutationResult>;
  rejectOrBlockUser: (userId: string) => Promise<MutationResult>;
  unblockUser: (userId: string) => Promise<MutationResult>;
  archiveUser: (userId: string) => Promise<MutationResult>;
  restoreArchivedUser: (userId: string) => Promise<MutationResult>;
  unlockPasswordChange: (userId: string) => Promise<MutationResult>;
  switchDemoUser: (userId: string) => MutationResult;
  logout: () => void;
  hasPermission: (perm: PermissionKey) => boolean;

  // Sincronização em Nuvem / Realtime
  isSupabaseSynced: boolean;
  isSyncing: boolean;
  lastSyncedAt: string | null;
  syncNow: () => Promise<void>;

  // Dados Centrais
  categories: Category[];
  cells: Cell[];
  criteria: Criterion[];
  characters: Character[];
  exercises: Exercise[];
  checklists: Checklist[];
  collaborators: Collaborator[];
  collaboratorChecklists: CollaboratorChecklist[];
  learningTracks: LearningTrack[];
  trackTemplates: TrackTemplate[];
  surveys: Survey[];
  surveyResponses: SurveyResponse[];
  auditLogs: AuditLogEntry[];

  // 1. Categorias Padronizadas
  createCategory: (payload: {
    name: string;
    type?: CategoryType;
    description?: string;
  }) => Promise<MutationResult & { category?: Category }>;
  updateCategory: (
    id: string,
    payload: {
      name: string;
      type: CategoryType;
      description?: string;
    }
  ) => Promise<MutationResult & { category?: Category }>;
  deleteCategory: (id: string) => Promise<MutationResult>;

  // 2. Banco de Clientes / Personagens Independentes (CRUD)
  saveCharacter: (payload: {
    id?: string;
    name: string;
    cell: OfficialCell; // Célula de Atendimento
    age: string;
    gender: 'Masculino' | 'Feminino' | 'Outro';
    city: string;
    cardNumber: string;
    customerTier: CustomerTier;
    serviceContext: string;
    temperament: string;
    objectives: string;
    typicalPhrases: string[] | string;
    guideAttachments?: AttachedGuideItem[];
    guideAttachmentUrl?: string | null;
    guideAttachmentName?: string | null;
  }) => Promise<MutationResult & { characterId?: string }>;
  batchImportCharacters: (
    items: Array<{
      name: string;
      cell: OfficialCell;
      age: string;
      gender: 'Masculino' | 'Feminino' | 'Outro';
      city: string;
      cardNumber: string;
      customerTier: CustomerTier;
      serviceContext: string;
      temperament: string;
      objectives: string;
      typicalPhrases: string[];
    }>
  ) => Promise<MutationResult & { importedCount?: number }>;
  deleteCharacter: (characterId: string) => Promise<MutationResult>;
  uploadClientGuide: (
    file: File
  ) => Promise<{ success: boolean; message: string; url?: string; fileName?: string }>;

  // 3. Exercícios e Cenários (CRUD com até 4 Clientes)
  saveExercise: (payload: {
    id?: string;
    title: string;
    cell: OfficialCell; // Célula do Exercício
    difficulty: ExerciseDifficulty;
    categoryId?: string;
    categoryName?: string;
    scenarioInstructions: string;
    characterIds: string[];
    attachments?: AttachedGuideItem[];
    attachmentUrl?: string | null;
    attachmentName?: string | null;
  }) => Promise<MutationResult & { exerciseId?: string }>;
  deleteExercise: (exerciseId: string) => Promise<MutationResult>;
  uploadExerciseGuide: (
    file: File
  ) => Promise<{ success: boolean; message: string; url?: string; fileName?: string }>;

  // 4. Checklists Flexíveis (com ou sem exercícios) (CRUD)
  saveChecklist: (payload: {
    id?: string;
    title: string;
    cell: OfficialCell; // Célula do Checklist
    description: string;
    categoryId?: string;
    categoryName?: string;
    visibility?: VisibilityLevel;
    hasExercises: boolean;
    exerciseIds: string[];
    criteria: Array<{ id?: string; name: string; weight: number }>;
  }) => Promise<MutationResult & { checklistId?: string }>;
  deleteChecklist: (checklistId: string) => Promise<MutationResult>;

  // 5. Colaboradores & Vínculos (CRUD com Edição)
  createCollaborator: (payload: {
    firstName?: string;
    lastName?: string;
    fullName?: string;
    username?: string;
    roleTitle: string;
    cellTeam: string;
    registrationCode?: string;
    learningTrackId?: string;
    status?: CollaboratorStatus;
    initialChecklistIds?: string[];
  }) => Promise<MutationResult & { collaboratorId?: string; username?: string }>;
  updateCollaborator: (payload: {
    id: string;
    fullName: string;
    roleTitle: string;
    cellTeam: string;
    registrationCode?: string;
    learningTrackId?: string;
    status: CollaboratorStatus;
  }) => Promise<MutationResult>;
  deleteCollaborator: (collaboratorId: string) => Promise<MutationResult>;
  updateCollaboratorChecklistAssignments: (
    collaboratorId: string,
    checklistIds: string[]
  ) => Promise<MutationResult>;
  ensureCollaboratorChecklistAssignment: (
    collaboratorId: string,
    checklistId: string,
    preferredId?: string
  ) => string;
  updateCollaboratorTrack: (
    collaboratorId: string,
    steps: CollaboratorTrackStep[]
  ) => Promise<MutationResult>;
  addStepToCollaboratorTrack: (
    collaboratorId: string,
    step: Omit<CollaboratorTrackStep, 'id' | 'order' | 'status' | 'filledBy'> & {
      filledBy?: CollaboratorTrackStep['filledBy'];
    }
  ) => Promise<MutationResult>;
  removeStepFromCollaboratorTrack: (
    collaboratorId: string,
    stepId: string
  ) => Promise<MutationResult>;
  completeCollaboratorTrackStep: (
    collaboratorId: string,
    stepId: string,
    resultData?: {
      finalScore?: number | null;
      collaboratorChecklistId?: string | null;
      surveyResponseId?: string | null;
    }
  ) => Promise<MutationResult>;
  submitCollaboratorChecklistSelfAssessment: (payload: {
    collaboratorId: string;
    stepId: string;
    checklistId: string;
    criteriaAnswers: CriteriaAnswerSnapshot[];
    generalObservations?: string;
  }) => Promise<MutationResult>;
  finalizeCollaboratorTrack: (
    collaboratorId: string,
    payload: {
      verdict: 'aprovado' | 'necessita_reforco';
      opinion: string;
    }
  ) => Promise<MutationResult>;
  reopenCollaboratorTrack: (collaboratorId: string) => Promise<MutationResult>;
  saveTrackTemplate: (
    name: string,
    cell: string,
    steps: TrackTemplateStep[]
  ) => Promise<MutationResult & { template?: TrackTemplate }>;
  deleteTrackTemplate: (templateId: string) => Promise<MutationResult>;

  // 6. Trilhas de Aprendizagem Dinâmicas (CRUD)
  createLearningTrack: (payload: {
    title: string;
    description: string;
    cell: string;
    checklistIds: string[];
    surveyId?: string;
    collaboratorIds?: string[];
  }) => Promise<MutationResult & { trackId?: string }>;
  updateLearningTrack: (id: string, payload: Partial<LearningTrack>) => Promise<MutationResult>;
  deleteLearningTrack: (id: string) => Promise<MutationResult>;
  enrollCollaboratorInTrack: (trackId: string, collaboratorId: string) => Promise<MutationResult>;
  unenrollCollaboratorFromTrack: (trackId: string, collaboratorId: string) => Promise<MutationResult>;

  // 7. Pesquisas de Satisfação Dinâmicas (CRUD & Respostas)
  createSurvey: (payload: {
    title: string;
    description: string;
    targetCell?: string;
    visibility?: VisibilityLevel;
    questions: SurveyQuestion[];
  }) => Promise<MutationResult & { surveyId?: string }>;
  updateSurvey: (id: string, payload: Partial<Survey>) => Promise<MutationResult>;
  deleteSurvey: (id: string) => Promise<MutationResult>;
  submitSurveyResponse: (payload: {
    surveyId: string;
    collaboratorId: string;
    answers: Record<string, SurveyAnswerItem>;
  }) => Promise<MutationResult>;

  // 6. Condução e Execução de Avaliação
  saveEvaluationProgress: (payload: {
    collaboratorChecklistId: string;
    instructorAuxiliarId?: string | null;
    criteriaAnswers: CriteriaAnswerSnapshot[];
    finalScore: number;
    generalObservations?: string;
  }) => Promise<void>;
  completeEvaluation: (payload: {
    collaboratorChecklistId: string;
    instructorAuxiliarId?: string | null;
    actorAuxiliarId?: string | null;
    criteriaAnswers: CriteriaAnswerSnapshot[];
    finalScore: number;
    generalObservations?: string;
    updateCollaboratorStatus?: CollaboratorStatus;
  }) => Promise<MutationResult>;

  // 7. Governança e Usuários
  roleDefaultPermissions: Record<UserRole, PermissionKey[]>;
  updateRoleDefaultPermissions: (
    role: UserRole,
    permissions: PermissionKey[]
  ) => Promise<MutationResult>;
  updateUserPermissions: (payload: {
    targetUserId: string;
    role: UserRole;
    isActive: boolean;
    individualPermissions: PermissionKey[];
    isGuardianHost?: boolean;
  }) => Promise<MutationResult>;
  createNewUser: (payload: {
    fullName: string;
    email: string;
    role: UserRole;
    department: string;
    individualPermissions: PermissionKey[];
    isGuardianHost?: boolean;
  }) => Promise<MutationResult>;
}

const PortalStoreContext = createContext<PortalStoreContextValue | null>(null);

export function calculateWeightedScore(criteriaAnswers: CriteriaAnswerSnapshot[]): number {
  let totalScoreWeight = 0;
  let totalPossibleWeight = 0;

  for (const item of criteriaAnswers) {
    const weight = Number(item.weight) || 1;
    totalPossibleWeight += weight;
    if (item.checked) {
      totalScoreWeight += weight;
    }
  }

  if (totalPossibleWeight === 0) return 0;
  const scoreOnTen = (totalScoreWeight / totalPossibleWeight) * 10;
  return Number(scoreOnTen.toFixed(1));
}

function mapUserProfileToDbRow(u: UserProfile) {
  return {
    id: u.id,
    username: u.username.trim().toLowerCase(),
    full_name: u.fullName,
    email: u.email,
    role: u.role,
    status: u.status,
    can_change_password: Boolean(u.canChangePassword),
    password: u.password ?? null,
    is_active: Boolean(u.isActive),
    department: u.department || null,
    collaborator_id: u.collaboratorId || null,
    individual_permissions: Array.isArray(u.individualPermissions) ? u.individualPermissions : [],
    is_guardian_host: Boolean(u.isGuardianHost),
    created_at: u.createdAt || new Date().toISOString(),
    last_login_at: u.lastLoginAt ? u.lastLoginAt : null,
  };
}

function mapDbRowToUserProfile(row: any): UserProfile {
  return {
    id: row.id,
    username: row.username || '',
    fullName: row.full_name || '',
    email: row.email || '',
    role: (row.role as UserRole) || 'auxiliar',
    status: (row.status as UserStatus) || 'pendente_aprovacao',
    canChangePassword: Boolean(row.can_change_password),
    password: row.password ?? undefined,
    isActive: row.is_active ?? true,
    department: row.department || 'Operações',
    collaboratorId: row.collaborator_id || undefined,
    individualPermissions: Array.isArray(row.individual_permissions)
      ? (row.individual_permissions as PermissionKey[])
      : [],
    isGuardianHost: Boolean(row.is_guardian_host),
    createdAt: row.created_at || new Date().toISOString(),
    lastLoginAt: row.last_login_at || '',
  };
}

function mapCollaboratorToDbRow(col: Collaborator) {
  return {
    id: col.id,
    full_name: col.fullName,
    username: col.username || null,
    role_title: col.roleTitle,
    cell_team: col.cellTeam,
    registration_code: col.registrationCode || null,
    learning_track_id: col.learningTrackId || null,
    track: Array.isArray(col.track) ? col.track : [],
    is_track_finalized: Boolean(col.isTrackFinalized),
    guardian_verdict: col.guardianVerdict || null,
    guardian_opinion: col.guardianOpinion || null,
    guardian_finalized_by: col.guardianFinalizedBy || null,
    guardian_finalized_at: col.guardianFinalizedAt || null,
    status: col.status || 'novo',
    created_at: col.createdAt || new Date().toISOString(),
    updated_at: col.updatedAt || new Date().toISOString(),
  };
}

export const PortalStoreProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { showToast } = useToast();
  const [isSyncing, setIsSyncing] = useState(false);
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);
  const isFetchingRef = useRef(false);
  const pendingRefetchRef = useRef(false);
  const [users, setUsers] = useState<UserProfile[]>(() => {
    try {
      const stored = localStorage.getItem('portal_users_store');
      if (stored) {
        const parsed: UserProfile[] = JSON.parse(stored);
        if (Array.isArray(parsed) && parsed.length > 0) {
          // Preserva todos os usuários cadastrados e garante os perfis corporativos essenciais
          const combined = [...parsed];
          INITIAL_USERS.forEach((def) => {
            if (!combined.some((u) => u.username === def.username || u.id === def.id)) {
              combined.push(def);
            }
          });
          return combined;
        }
      }
    } catch {
      // fallback para dados iniciais
    }
    return INITIAL_USERS;
  });

  const [currentUserId, setCurrentUserId] = useState<string | null>(() => {
    try {
      const saved = localStorage.getItem('portal_current_user_id');
      if (saved !== null && saved !== '') {
        return saved;
      }
    } catch {
      // fallback
    }
    return INITIAL_USERS[0]?.id || 'usr-admin-master';
  });

  // Persistência automática
  React.useEffect(() => {
    try {
      localStorage.setItem('portal_users_store', JSON.stringify(users));
    } catch {
      // ignore
    }
  }, [users]);

  const [roleDefaultPermissions, setRoleDefaultPermissions] = useState<
    Record<UserRole, PermissionKey[]>
  >(() => loadRoleDefaultPermissions());

  React.useEffect(() => {
    saveRoleDefaultPermissions(roleDefaultPermissions);
  }, [roleDefaultPermissions]);

  React.useEffect(() => {
    try {
      if (currentUserId) {
        localStorage.setItem('portal_current_user_id', currentUserId);
      } else {
        localStorage.removeItem('portal_current_user_id');
      }
    } catch {
      // ignore
    }
  }, [currentUserId]);

  // Inicialização e atualização de dados padrão (versão v8 com Trilhas e Pesquisas)
  const [categories, setCategories] = useState<Category[]>(() => {
    try {
      const s = localStorage.getItem('portal_categories_store');
      if (s !== null) {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return INITIAL_CATEGORIES;
  });

  const [cells] = useState<Cell[]>(() => {
    try {
      const s = localStorage.getItem('portal_cells_store');
      if (s !== null) {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) {
          return parsed.map((c: Cell) => ({
            ...c,
            name: getCellName(c.name),
            coordinatorName: c.coordinatorName?.includes('Convênio')
              ? c.coordinatorName.replace('Convênio', 'Operadora')
              : c.coordinatorName,
          }));
        }
      }
    } catch {}
    return INITIAL_CELLS;
  });

  const [criteria] = useState<Criterion[]>(() => {
    try {
      const s = localStorage.getItem('portal_criteria_store');
      if (s !== null) {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const [characters, setCharacters] = useState<Character[]>(() => {
    try {
      const s = localStorage.getItem('portal_characters_store');
      if (s !== null) {
        const parsed: Character[] = JSON.parse(s);
        if (Array.isArray(parsed)) {
          return parsed.map((c) => ({
            ...c,
            cell: c.cell || 'LAB',
            typicalPhrases: normalizePhrases(c.typicalPhrases),
          }));
        }
      }
    } catch {}
    return INITIAL_CHARACTERS;
  });

  const [exercises, setExercises] = useState<Exercise[]>(() => {
    try {
      const s = localStorage.getItem('portal_exercises_store');
      if (s !== null) {
        const parsed: Exercise[] = JSON.parse(s);
        if (Array.isArray(parsed)) {
          return parsed.map((ex) => ({
            ...ex,
            cell: ex.cell || 'LAB',
          }));
        }
      }
    } catch {}
    return INITIAL_EXERCISES;
  });

  const [checklists, setChecklists] = useState<Checklist[]>(() => {
    try {
      const s = localStorage.getItem('portal_checklists_store');
      if (s !== null) {
        const parsed: Checklist[] = JSON.parse(s);
        if (Array.isArray(parsed)) {
          return parsed.map((chk) => ({
            ...chk,
            cell: chk.cell || 'LAB',
            visibility: chk.visibility || 'padrao',
          }));
        }
      }
    } catch {}
    return INITIAL_CHECKLISTS;
  });

  const [collaborators, setCollaborators] = useState<Collaborator[]>(() => {
    try {
      const s = localStorage.getItem('portal_collaborators_store');
      if (s !== null) {
        const parsed: Collaborator[] = JSON.parse(s);
        if (Array.isArray(parsed)) {
          return parsed.map((col: Collaborator) => ({
            ...col,
            cellTeam: getCellName(col.cellTeam),
            track: (col.track || []).filter(
              (step) =>
                step.refId !== 'chk-lab-03' &&
                !step.title?.toLowerCase().includes('orientações de coleta')
            ),
          }));
        }
      }
    } catch {}
    return INITIAL_COLLABORATORS;
  });

  const [collaboratorChecklists, setCollaboratorChecklists] = useState<CollaboratorChecklist[]>(() => {
    try {
      const s = localStorage.getItem('portal_collaborator_checklists_store');
      if (s !== null) {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) {
          return parsed
            .filter((asg: CollaboratorChecklist) => asg.checklistId !== 'chk-lab-03')
            .map((asg: CollaboratorChecklist) => {
              if (asg.collaboratorId === 'col-lucas-silveira') {
                return { ...asg, collaboratorId: 'col-colaborador-teste' };
              }
              return asg;
            });
        }
      }
    } catch {}
    return INITIAL_COLLABORATOR_CHECKLISTS;
  });

  const [learningTracks, setLearningTracks] = useState<LearningTrack[]>(() => {
    try {
      const s = localStorage.getItem('portal_learning_tracks_store');
      if (s !== null) {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) {
          return parsed.map((track: LearningTrack) => ({
            ...track,
            collaboratorIds: (track.collaboratorIds || []).map((cid) =>
              cid === 'col-lucas-silveira' ? 'col-colaborador-teste' : cid
            ),
          }));
        }
      }
    } catch {}
    return INITIAL_LEARNING_TRACKS;
  });

  const [trackTemplates, setTrackTemplates] = useState<TrackTemplate[]>(() => {
    try {
      const s = localStorage.getItem('portal_track_templates_store');
      if (s !== null) {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return [];
  });

  const [surveys, setSurveys] = useState<Survey[]>(() => {
    try {
      const s = localStorage.getItem('portal_surveys_store');
      if (s !== null) {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) {
          return parsed.map((sv: Survey) => ({
            ...sv,
            visibility: sv.visibility || 'padrao',
          }));
        }
      }
    } catch {}
    return INITIAL_SURVEYS;
  });

  const [surveyResponses, setSurveyResponses] = useState<SurveyResponse[]>(() => {
    try {
      const s = localStorage.getItem('portal_survey_responses_store');
      if (s !== null) {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return INITIAL_SURVEY_RESPONSES;
  });

  const [auditLogs, setAuditLogs] = useState<AuditLogEntry[]>(() => {
    try {
      const s = localStorage.getItem('portal_audit_logs_store');
      if (s !== null) {
        const parsed = JSON.parse(s);
        if (Array.isArray(parsed)) return parsed;
      }
    } catch {}
    return INITIAL_AUDIT_LOGS;
  });

  // Persistência local contínua para prevenir perda ou retorno de dados excluídos
  React.useEffect(() => {
    try {
      localStorage.setItem('portal_characters_store', JSON.stringify(characters));
    } catch {}
  }, [characters]);

  React.useEffect(() => {
    try {
      localStorage.setItem('portal_exercises_store', JSON.stringify(exercises));
    } catch {}
  }, [exercises]);

  React.useEffect(() => {
    try {
      localStorage.setItem('portal_checklists_store', JSON.stringify(checklists));
    } catch {}
  }, [checklists]);

  React.useEffect(() => {
    try {
      localStorage.setItem('portal_collaborators_store', JSON.stringify(collaborators));
    } catch {}
  }, [collaborators]);

  React.useEffect(() => {
    try {
      localStorage.setItem('portal_collaborator_checklists_store', JSON.stringify(collaboratorChecklists));
    } catch {}
  }, [collaboratorChecklists]);

  React.useEffect(() => {
    try {
      localStorage.setItem('portal_categories_store', JSON.stringify(categories));
    } catch {}
  }, [categories]);

  React.useEffect(() => {
    try {
      localStorage.setItem('portal_audit_logs_store', JSON.stringify(auditLogs));
    } catch {}
  }, [auditLogs]);

  React.useEffect(() => {
    try {
      localStorage.setItem('portal_learning_tracks_store', JSON.stringify(learningTracks));
    } catch {}
  }, [learningTracks]);

  React.useEffect(() => {
    try {
      localStorage.setItem('portal_track_templates_store', JSON.stringify(trackTemplates));
    } catch {}
  }, [trackTemplates]);

  React.useEffect(() => {
    try {
      localStorage.setItem('portal_surveys_store', JSON.stringify(surveys));
    } catch {}
  }, [surveys]);

  React.useEffect(() => {
    try {
      localStorage.setItem('portal_survey_responses_store', JSON.stringify(surveyResponses));
    } catch {}
  }, [surveyResponses]);

  // Sincronização real com banco de dados Supabase (bidirecional + realtime)
  const fetchAllFromSupabase = useCallback(async () => {
    if (!isSupabaseConfigured) return;

    if (isFetchingRef.current) {
      pendingRefetchRef.current = true;
      return;
    }

    isFetchingRef.current = true;
    setIsSyncing(true);

    try {
      const [
        usersRes,
        charsRes,
        exercisesRes,
        checklistsRes,
        collabsRes,
        asgsRes,
        surveysRes,
        surveyRespsRes,
        catsRes,
        auditRes,
        settingsRes,
      ] = await Promise.all([
        supabase.from('portal_users').select('*').order('created_at', { ascending: true }),
        supabase.from('characters').select('*').order('created_at', { ascending: false }),
        supabase
          .from('exercises')
          .select('*, exercise_characters(character_id, order_index)')
          .order('created_at', { ascending: false }),
        supabase
          .from('checklists')
          .select('*, checklist_exercises(exercise_id), checklist_criteria(*)')
          .order('created_at', { ascending: false }),
        supabase.from('collaborators').select('*').order('created_at', { ascending: false }),
        supabase.from('collaborator_checklists').select('*').order('created_at', { ascending: false }),
        supabase.from('surveys').select('*').order('created_at', { ascending: false }),
        supabase.from('survey_responses').select('*').order('completed_at', { ascending: false }),
        supabase.from('categories').select('*'),
        supabase.from('audit_logs').select('*').order('timestamp', { ascending: false }).limit(500),
        supabase
          .from('portal_settings')
          .select('*')
          .in('key', ['roleDefaultPermissions', 'track_templates']),
      ]);

      // 0. Usuários do Portal
      if (!usersRes.error && usersRes.data) {
        if (usersRes.data.length > 0) {
          setUsers(usersRes.data.map(mapDbRowToUserProfile));
        } else {
          // Seed inicial de usuários na nuvem caso a tabela portal_users ainda esteja vazia
          await supabase
            .from('portal_users')
            .upsert(INITIAL_USERS.map(mapUserProfileToDbRow), {
              onConflict: 'id',
              ignoreDuplicates: true,
            });
        }
      }

      // 1. Clientes
      if (!charsRes.error && charsRes.data) {
        setCharacters(
          charsRes.data.map((c: any) => ({
            id: c.id,
            name: c.name || '',
            cell: (c.cell as OfficialCell) || 'OPERADORA',
            age: c.age || '',
            gender: c.gender || 'Outro',
            city: c.city || '',
            cardNumber: c.card_number || '',
            customerTier: c.customer_tier || 'Mediano',
            serviceContext: c.service_context || c.history || '',
            temperament: c.temperament || '',
            objectives: c.objectives || '',
            typicalPhrases: normalizePhrases(c.typical_phrases),
            guideAttachments: Array.isArray(c.guide_attachments) ? c.guide_attachments : undefined,
            guideAttachmentUrl: c.guide_attachment_url || null,
            guideAttachmentName: c.guide_attachment_name || null,
            createdAt: c.created_at || new Date().toISOString(),
          }))
        );
      }

      // 2. Exercícios
      if (!exercisesRes.error && exercisesRes.data) {
        setExercises(
          exercisesRes.data.map((e: any) => ({
            id: e.id,
            title: e.title || '',
            cell: (e.cell as OfficialCell) || 'OPERADORA',
            difficulty: e.difficulty || 'Mediano',
            categoryId: e.category_id || undefined,
            categoryName: e.category_name || '',
            scenarioInstructions: e.scenario_instructions || '',
            characterIds: (e.exercise_characters || [])
              .sort((a: any, b: any) => (a.order_index || 0) - (b.order_index || 0))
              .map((ec: any) => ec.character_id),
            attachments: Array.isArray(e.attachments) ? e.attachments : undefined,
            attachmentUrl: e.attachment_url || null,
            attachmentName: e.attachment_name || null,
            createdAt: e.created_at || new Date().toISOString(),
            updatedAt: e.updated_at || new Date().toISOString(),
          }))
        );
      }

      // 3. Checklists
      if (!checklistsRes.error && checklistsRes.data) {
        setChecklists(
          checklistsRes.data.map((chk: any) => ({
            id: chk.id,
            title: chk.title || '',
            cell: (chk.cell as OfficialCell) || 'OPERADORA',
            description: chk.description || '',
            categoryId: chk.category_id || undefined,
            categoryName: chk.category_name || '',
            visibility: (chk.visibility as VisibilityLevel) || 'padrao',
            hasExercises: Boolean(chk.has_exercises),
            exerciseIds: (chk.checklist_exercises || []).map((ce: any) => ce.exercise_id),
            criteria: (chk.checklist_criteria || []).map((crit: any) => ({
              id: crit.id,
              name: crit.name || '',
              weight: Number(crit.weight) || 1,
            })),
            isActive: chk.is_active ?? true,
            createdAt: chk.created_at || new Date().toISOString(),
            updatedAt: chk.updated_at || new Date().toISOString(),
          }))
        );
      }

      // 4. Colaboradores (incluindo trilha individual, finalização e parecer)
      if (!collabsRes.error && collabsRes.data) {
        setCollaborators(
          collabsRes.data.map((col: any) => ({
            id: col.id,
            fullName: col.full_name || '',
            username: col.username || undefined,
            roleTitle: col.role_title || '',
            cellTeam: getCellName(col.cell_team || ''),
            registrationCode: col.registration_code || undefined,
            learningTrackId: col.learning_track_id || undefined,
            track: Array.isArray(col.track) ? col.track : [],
            isTrackFinalized: Boolean(col.is_track_finalized),
            guardianVerdict: col.guardian_verdict || undefined,
            guardianOpinion: col.guardian_opinion || undefined,
            guardianFinalizedBy: col.guardian_finalized_by || undefined,
            guardianFinalizedAt: col.guardian_finalized_at || undefined,
            status: col.status || 'novo',
            createdAt: col.created_at || new Date().toISOString(),
            updatedAt: col.updated_at || new Date().toISOString(),
          }))
        );
      }

      // 5. Atribuições de Checklists
      if (!asgsRes.error && asgsRes.data) {
        setCollaboratorChecklists(
          asgsRes.data.map((asg: any) => ({
            id: asg.id,
            collaboratorId: asg.collaborator_id,
            checklistId: asg.checklist_id,
            status: asg.status || 'pendente',
            finalScore: asg.final_score !== null ? Number(asg.final_score) : null,
            criteriaAnswers: Array.isArray(asg.criteria_answers) ? asg.criteria_answers : [],
            generalObservations: asg.general_observations || '',
            instructorAuxiliarId: asg.instructor_auxiliar_id || null,
            actorAuxiliarId: asg.actor_auxiliar_id || null,
            completedAt: asg.completed_at || null,
            createdAt: asg.created_at || new Date().toISOString(),
            updatedAt: asg.updated_at || new Date().toISOString(),
          }))
        );
      }

      // 6. Pesquisas de Satisfação
      if (!surveysRes.error && surveysRes.data) {
        setSurveys(
          surveysRes.data.map((sv: any) => ({
            id: sv.id,
            title: sv.title || '',
            description: sv.description || '',
            targetCell: sv.target_cell || 'Todas',
            visibility: (sv.visibility as VisibilityLevel) || 'padrao',
            questions: Array.isArray(sv.questions) ? sv.questions : [],
            isActive: sv.is_active ?? true,
            createdAt: sv.created_at || new Date().toISOString(),
            updatedAt: sv.updated_at || new Date().toISOString(),
          }))
        );
      }

      // 7. Respostas das Pesquisas
      if (!surveyRespsRes.error && surveyRespsRes.data) {
        setSurveyResponses(
          surveyRespsRes.data.map((sr: any) => ({
            id: sr.id,
            surveyId: sr.survey_id,
            collaboratorId: sr.collaborator_id,
            collaboratorName: sr.collaborator_name || '',
            collaboratorUsername: sr.collaborator_username || '',
            cellTeam: sr.cell_team || '',
            answers: sr.answers && typeof sr.answers === 'object' ? sr.answers : {},
            completedAt: sr.completed_at || new Date().toISOString(),
          }))
        );
      }

      // 8. Categorias
      if (!catsRes.error && catsRes.data) {
        setCategories(
          catsRes.data.map((cat: any) => ({
            id: cat.id,
            name: cat.name || '',
            type: (cat.type as CategoryType) || 'geral',
            description: cat.description || undefined,
          }))
        );
      }

      // 9. Logs de Auditoria
      if (!auditRes.error && auditRes.data) {
        setAuditLogs(
          auditRes.data.map((al: any) => ({
            id: al.id,
            timestamp: al.timestamp || new Date().toISOString(),
            actorId: al.actor_id || 'anon',
            actorName: al.actor_name || '',
            actorRole: (al.actor_role as UserRole) || 'auxiliar',
            action: al.action || '',
            module: (al.module as AuditLogEntry['module']) || 'Sistema',
            targetDescription: al.target_description || '',
            status: (al.status as AuditLogEntry['status']) || 'Sucesso',
          }))
        );
      }

      // 10. Configurações Compartilhadas (roleDefaultPermissions e track_templates)
      if (!settingsRes.error && Array.isArray(settingsRes.data)) {
        const roleDefaultsRow = settingsRes.data.find(
          (row: any) => row.key === 'roleDefaultPermissions'
        );
        if (roleDefaultsRow?.value) {
          setRoleDefaultPermissions(normalizeRoleDefaultPermissions(roleDefaultsRow.value));
        }

        const trackTemplatesRow = settingsRes.data.find(
          (row: any) => row.key === 'track_templates'
        );
        if (Array.isArray(trackTemplatesRow?.value)) {
          setTrackTemplates(trackTemplatesRow.value as TrackTemplate[]);
        }
      }

      setLastSyncedAt(new Date().toISOString());
    } catch (err) {
      console.error('Erro ao sincronizar dados com Supabase:', err);
    } finally {
      isFetchingRef.current = false;
      setIsSyncing(false);
      if (pendingRefetchRef.current) {
        pendingRefetchRef.current = false;
        void fetchAllFromSupabase();
      }
    }
  }, []);

  const syncNow = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    await fetchAllFromSupabase();
  }, [fetchAllFromSupabase]);

  React.useEffect(() => {
    if (!isSupabaseConfigured) return;

    fetchAllFromSupabase();

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    const scheduleRealtimeSync = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        void fetchAllFromSupabase();
      }, 300);
    };

    const realtimeTables = [
      'portal_users',
      'characters',
      'exercises',
      'checklists',
      'collaborators',
      'collaborator_checklists',
      'surveys',
      'survey_responses',
      'categories',
      'audit_logs',
      'portal_settings',
    ];

    let channel = supabase.channel('portal-global-sync');
    realtimeTables.forEach((table) => {
      channel = channel.on(
        'postgres_changes',
        { event: '*', schema: 'public', table },
        () => {
          scheduleRealtimeSync();
        }
      );
    });

    channel.subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      supabase.removeChannel(channel);
    };
  }, [fetchAllFromSupabase]);

  const currentUser = useMemo(
    () => users.find((u) => u.id === currentUserId) || null,
    [users, currentUserId]
  );

  const appendAudit = useCallback(
    (
      action: string,
      module: AuditLogEntry['module'],
      targetDescription: string,
      status: AuditLogEntry['status'] = 'Sucesso',
      overrideActor?: UserProfile
    ) => {
      const actor = overrideActor || currentUser;
      const newEntry: AuditLogEntry = {
        id: `aud-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        timestamp: new Date().toISOString(),
        actorId: actor?.id || 'anon',
        actorName: actor?.fullName || 'Usuário Não Autenticado',
        actorRole: actor?.role || 'auxiliar',
        action,
        module,
        targetDescription,
        status,
      };
      setAuditLogs((prev) => [newEntry, ...prev]);

      if (isSupabaseConfigured) {
        void supabase
          .from('audit_logs')
          .insert({
            id: newEntry.id,
            timestamp: newEntry.timestamp,
            actor_id: newEntry.actorId,
            actor_name: newEntry.actorName,
            actor_role: newEntry.actorRole,
            action: newEntry.action,
            module: newEntry.module,
            target_description: newEntry.targetDescription,
            status: newEntry.status,
          })
          .then(({ error }) => {
            if (error) {
              console.warn('Erro ao persistir audit_log no Supabase:', error.message);
            }
          });
      }
    },
    [currentUser]
  );

  const hasPermission = useCallback(
    (perm: PermissionKey) => checkUserPermission(currentUser, perm),
    [currentUser]
  );

  // 1. Novo Sistema de Autenticação Corporativa baseada em Usuário (nome.sobrenome)
  const loginWithUsername = useCallback(
    (usernameInput: string, passwordInput?: string): LoginResult => {
      const cleanUsername = usernameInput.trim().toLowerCase();
      if (!cleanUsername) {
        return { success: false, message: 'Informe seu usuário corporativo (ex: nome.sobrenome).' };
      }

      const target = users.find(
        (u) =>
          u.username.toLowerCase() === cleanUsername ||
          u.email.toLowerCase() === cleanUsername
      );

      if (!target) {
        return {
          success: false,
          message: 'Usuário não encontrado. Verifique a grafia ou solicite o primeiro acesso.',
        };
      }

      // Validação de Status no Login:
      // A. Se estiver pendente de aprovação
      if (target.status === 'pendente_aprovacao') {
        return {
          success: false,
          status: 'pendente_aprovacao',
          user: target,
          message: 'Seu cadastro ainda aguarda aprovação de um Administrador.',
        };
      }

      // A2. Se estiver arquivado
      if (target.status === 'arquivado') {
        return {
          success: false,
          status: 'arquivado',
          user: target,
          message: 'Este usuário está arquivado. Contate um Administrador para reativação.',
        };
      }

      // B. Se estiver bloqueado
      if (target.status === 'bloqueado' || !target.isActive) {
        return {
          success: false,
          status: 'bloqueado',
          user: target,
          message: 'Acesso bloqueado pela administração.',
        };
      }

      // C. Se estiver aprovado sem senha (primeiro acesso)
      if (target.status === 'aprovado_sem_senha') {
        return {
          success: false,
          status: 'aprovado_sem_senha',
          user: target,
          message: 'Acesso liberado! Redirecionando para definir sua senha corporativa...',
        };
      }

      // D. Se estiver ativo: conferir senha se fornecida e usuário possui senha salva
      if (target.password && passwordInput !== undefined) {
        if (passwordInput !== target.password) {
          return {
            success: false,
            status: target.status,
            user: target,
            message: 'Senha incorreta. Verifique suas credenciais.',
          };
        }
      }

      setCurrentUserId(target.id);
      appendAudit(
        'Login Efetuado',
        'Autenticação',
        `Sessão iniciada como ${target.fullName} (@${target.username})`,
        'Sucesso',
        target
      );
      return {
        success: true,
        status: target.status,
        user: target,
        message: `Bem-vindo(a), ${target.fullName}!`,
      };
    },
    [users, appendAudit]
  );

  // Fallback para login por email
  const loginWithEmail = useCallback(
    (email: string, passwordInput?: string): MutationResult => {
      const res = loginWithUsername(email, passwordInput);
      return { success: res.success, message: res.message };
    },
    [loginWithUsername]
  );

  // Solicitar Primeiro Acesso
  const requestAccess = useCallback(
    async (fullName: string, requestedUsername: string): Promise<MutationResult> => {
      if (!fullName.trim()) {
        return { success: false, message: 'Por favor, informe seu Nome Completo.' };
      }
      const cleanUsername = requestedUsername
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '.');

      if (!cleanUsername) {
        return { success: false, message: 'Por favor, informe o usuário desejado (nome.sobrenome).' };
      }

      if (users.some((u) => u.username.toLowerCase() === cleanUsername)) {
        return {
          success: false,
          message: 'Este nome de usuário já está cadastrado ou em análise.',
        };
      }

      const nowIso = new Date().toISOString();
      const newUser: UserProfile = {
        id: `usr-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        username: cleanUsername,
        fullName: fullName.trim(),
        email: `${cleanUsername}@portaldesempenho.corp`,
        role: 'auxiliar',
        status: 'pendente_aprovacao',
        canChangePassword: false,
        isActive: false,
        department: 'Operações e Atendimento',
        individualPermissions: [],
        createdAt: nowIso,
        lastLoginAt: '',
      };

      setUsers((prev) => [...prev, newUser]);

      if (isSupabaseConfigured) {
        const { error } = await supabase
          .from('portal_users')
          .upsert(mapUserProfileToDbRow(newUser));
        if (error) {
          console.error('Erro ao registrar solicitação de acesso no Supabase:', error);
        }
      }

      appendAudit(
        'Solicitação de Primeiro Acesso',
        'Autenticação',
        `Solicitação de ${newUser.fullName} (@${newUser.username}) enviada para aprovação`,
        'Sucesso',
        newUser
      );

      return {
        success: true,
        message:
          'Solicitação enviada com sucesso! Seu acesso está aguardando liberação de um Administrador. Assim que for liberado, você poderá definir sua senha neste portal.',
      };
    },
    [users, appendAudit]
  );

  // Definir ou Alterar Senha (apenas permitido quando status: 'aprovado_sem_senha' ou can_change_password: true)
  const setPassword = useCallback(
    async (usernameInput: string, newPassword: string): Promise<MutationResult> => {
      const cleanUsername = usernameInput.trim().toLowerCase();
      if (!newPassword || newPassword.length < 4) {
        return { success: false, message: 'A senha deve conter pelo menos 4 caracteres.' };
      }

      const target = users.find(
        (u) =>
          u.username.toLowerCase() === cleanUsername ||
          u.email.toLowerCase() === cleanUsername
      );

      if (!target) {
        return { success: false, message: 'Usuário não encontrado.' };
      }

      if (target.status !== 'aprovado_sem_senha' && !target.canChangePassword) {
        return {
          success: false,
          message: 'Você não possui permissão para definir ou alterar sua senha no momento. Contate um Administrador.',
        };
      }

      const nowIso = new Date().toISOString();
      const updatedUser: UserProfile = {
        ...target,
        password: newPassword,
        status: 'ativo',
        isActive: true,
        canChangePassword: false,
        lastLoginAt: nowIso,
      };

      setUsers((prev) => prev.map((u) => (u.id === target.id ? updatedUser : u)));

      if (isSupabaseConfigured) {
        const { error } = await supabase
          .from('portal_users')
          .upsert(mapUserProfileToDbRow(updatedUser));
        if (error) {
          console.error('Erro ao salvar senha no Supabase:', error);
        }
      }

      setCurrentUserId(target.id);
      appendAudit(
        'Senha Cadastrada',
        'Autenticação',
        `Senha definida por ${target.fullName} (@${target.username}). Conta ativada.`,
        'Sucesso',
        updatedUser
      );

      return {
        success: true,
        message: 'Senha cadastrada com sucesso! Bem-vindo(a) ao Portal de Desempenho.',
      };
    },
    [users, appendAudit]
  );

  // Ações de Governança do Administrador
  const approveUser = useCallback(
    async (userId: string, role: UserRole): Promise<MutationResult> => {
      const target = users.find((u) => u.id === userId);
      if (!target) return { success: false, message: 'Usuário não encontrado.' };

      const isColabRole = role === 'colaborador';
      const defaultPerms: PermissionKey[] = isColabRole
        ? []
        : [...(roleDefaultPermissions[role] || [])];
      const hasGuardianDefault =
        !isColabRole &&
        (role === 'admin' || defaultPerms.includes('can_act_as_guardian_host'));

      const updatedUser: UserProfile = {
        ...target,
        role,
        status: 'aprovado_sem_senha',
        canChangePassword: true,
        isActive: true,
        isGuardianHost: hasGuardianDefault,
        individualPermissions: defaultPerms,
      };

      setUsers((prev) => prev.map((u) => (u.id === userId ? updatedUser : u)));

      if (isSupabaseConfigured) {
        const { error } = await supabase
          .from('portal_users')
          .upsert(mapUserProfileToDbRow(updatedUser));
        if (error) {
          console.error('Erro ao aprovar usuário no Supabase:', error);
        }
      }

      appendAudit(
        'Aprovação de Usuário',
        'Administração',
        `Acesso de ${target.fullName} (@${target.username}) aprovado como ${role}`,
        'Sucesso'
      );

      return {
        success: true,
        message: `Usuário ${target.fullName} aprovado como ${role}. Agora ele pode definir a senha no primeiro acesso.`,
      };
    },
    [users, roleDefaultPermissions, appendAudit]
  );

  const rejectOrBlockUser = useCallback(
    async (userId: string): Promise<MutationResult> => {
      const target = users.find((u) => u.id === userId);
      if (!target) return { success: false, message: 'Usuário não encontrado.' };

      const updatedUser: UserProfile = {
        ...target,
        status: 'bloqueado',
        isActive: false,
        canChangePassword: false,
      };

      setUsers((prev) => prev.map((u) => (u.id === userId ? updatedUser : u)));

      if (isSupabaseConfigured) {
        const { error } = await supabase
          .from('portal_users')
          .upsert(mapUserProfileToDbRow(updatedUser));
        if (error) {
          console.error('Erro ao bloquear usuário no Supabase:', error);
        }
      }

      appendAudit(
        'Bloqueio / Recusa de Usuário',
        'Administração',
        `Usuário ${target.fullName} (@${target.username}) bloqueado`,
        'Bloqueado'
      );

      return { success: true, message: `Usuário ${target.fullName} foi bloqueado.` };
    },
    [users, appendAudit]
  );

  const unblockUser = useCallback(
    async (userId: string): Promise<MutationResult> => {
      const target = users.find((u) => u.id === userId);
      if (!target) return { success: false, message: 'Usuário não encontrado.' };

      const updatedUser: UserProfile = {
        ...target,
        status: 'ativo',
        isActive: true,
      };

      setUsers((prev) => prev.map((u) => (u.id === userId ? updatedUser : u)));

      if (isSupabaseConfigured) {
        const { error } = await supabase
          .from('portal_users')
          .upsert(mapUserProfileToDbRow(updatedUser));
        if (error) {
          console.error('Erro ao desbloquear usuário no Supabase:', error);
        }
      }

      appendAudit(
        'Desbloqueio de Usuário',
        'Administração',
        `Usuário ${target.fullName} (@${target.username}) desbloqueado`,
        'Sucesso'
      );

      return { success: true, message: `Usuário ${target.fullName} foi reativado com sucesso.` };
    },
    [users, appendAudit]
  );

  const archiveUser = useCallback(
    async (userId: string): Promise<MutationResult> => {
      const target = users.find((u) => u.id === userId);
      if (!target) return { success: false, message: 'Usuário não encontrado.' };

      if (currentUser?.id === userId) {
        return {
          success: false,
          message: 'Não é possível arquivar o usuário da sessão atual.',
        };
      }

      const updatedUser: UserProfile = {
        ...target,
        status: 'arquivado',
        isActive: false,
        canChangePassword: false,
      };

      setUsers((prev) => prev.map((u) => (u.id === userId ? updatedUser : u)));

      if (isSupabaseConfigured) {
        const { error } = await supabase
          .from('portal_users')
          .upsert(mapUserProfileToDbRow(updatedUser));
        if (error) {
          console.error('Erro ao arquivar usuário no Supabase:', error);
        }
      }

      appendAudit(
        'Arquivamento de Usuário',
        'Administração',
        `Usuário ${target.fullName} (@${target.username}) arquivado`,
        'Sucesso'
      );

      return {
        success: true,
        message: `Usuário ${target.fullName} foi arquivado com sucesso.`,
      };
    },
    [users, currentUser?.id, appendAudit]
  );

  const restoreArchivedUser = useCallback(
    async (userId: string): Promise<MutationResult> => {
      const target = users.find((u) => u.id === userId);
      if (!target) return { success: false, message: 'Usuário não encontrado.' };

      const updatedUser: UserProfile = {
        ...target,
        status: 'ativo',
        isActive: true,
      };

      setUsers((prev) => prev.map((u) => (u.id === userId ? updatedUser : u)));

      if (isSupabaseConfigured) {
        const { error } = await supabase
          .from('portal_users')
          .upsert(mapUserProfileToDbRow(updatedUser));
        if (error) {
          console.error('Erro ao restaurar usuário no Supabase:', error);
        }
      }

      appendAudit(
        'Reativação de Usuário',
        'Administração',
        `Usuário ${target.fullName} (@${target.username}) restaurado para Ativo`,
        'Sucesso'
      );

      return {
        success: true,
        message: `Usuário ${target.fullName} foi reativado com sucesso.`,
      };
    },
    [users, appendAudit]
  );

  const unlockPasswordChange = useCallback(
    async (userId: string): Promise<MutationResult> => {
      const target = users.find((u) => u.id === userId);
      if (!target) return { success: false, message: 'Usuário não encontrado.' };

      const updatedUser: UserProfile = {
        ...target,
        canChangePassword: true,
      };

      setUsers((prev) => prev.map((u) => (u.id === userId ? updatedUser : u)));

      if (isSupabaseConfigured) {
        const { error } = await supabase
          .from('portal_users')
          .upsert(mapUserProfileToDbRow(updatedUser));
        if (error) {
          console.error('Erro ao liberar troca de senha no Supabase:', error);
        }
      }

      appendAudit(
        'Liberação de Troca de Senha',
        'Administração',
        `Permissão de troca de senha concedida para ${target.fullName} (@${target.username})`,
        'Sucesso'
      );

      return {
        success: true,
        message: `Troca de senha liberada para ${target.fullName}. O usuário já pode definir uma nova senha no portal.`,
      };
    },
    [users, appendAudit]
  );

  const switchDemoUser = useCallback(
    (userId: string): MutationResult => {
      const target = users.find((u) => u.id === userId);
      if (!target) {
        return { success: false, message: 'Usuário não encontrado para alternância de perfil.' };
      }

      if (target.status === 'arquivado') {
        return {
          success: false,
          message: 'Este usuário está arquivado. Contate um Administrador para reativação.',
        };
      }

      if (target.status === 'bloqueado' || !target.isActive) {
        return {
          success: false,
          message: `O usuário ${target.fullName} está BLOQUEADO/INATIVO no sistema.`,
        };
      }

      setCurrentUserId(target.id);
      appendAudit(
        'Alternância de Sessão',
        'Autenticação',
        `Perfil ativo alterado para ${target.fullName} (${target.role})`,
        'Sucesso',
        target
      );
      return { success: true, message: `Perfil alterado para ${target.fullName}.` };
    },
    [users, appendAudit]
  );

  const logout = useCallback(() => {
    if (currentUser) {
      appendAudit('Logout Efetuado', 'Autenticação', `Sessão encerrada para ${currentUser.fullName}`, 'Sucesso');
    }
    setCurrentUserId(null);
  }, [currentUser, appendAudit]);

  // ==========================================
  // 1. Categorias Padronizadas
  // ==========================================
  const createCategory = useCallback(
    async (payload: {
      name: string;
      type?: CategoryType;
      description?: string;
    }): Promise<MutationResult & { category?: Category }> => {
      if (!checkUserPermission(currentUser, 'users:manage')) {
        return {
          success: false,
          message: 'Acesso negado: apenas administradores podem cadastrar categorias.',
        };
      }

      const trimmed = payload.name.trim();
      if (!trimmed) {
        return { success: false, message: 'Nome da categoria é obrigatório.' };
      }

      const exists = categories.some((c) => c.name.trim().toLowerCase() === trimmed.toLowerCase());
      if (exists) {
        return { success: false, message: 'Já existe uma categoria cadastrada com este nome.' };
      }

      const newCategory: Category = {
        id: `cat-${Date.now()}`,
        name: trimmed,
        type: payload.type || 'geral',
        description: payload.description?.trim() || undefined,
      };

      if (isSupabaseConfigured) {
        const { error } = await supabase.from('categories').insert({
          id: newCategory.id,
          name: newCategory.name,
          type: newCategory.type,
          description: newCategory.description || null,
        });
        if (error) {
          console.error('Erro ao cadastrar categoria no Supabase:', error);
          return { success: false, message: 'Erro ao salvar categoria no banco: ' + error.message };
        }
      }

      setCategories((prev) => {
        const next = [...prev, newCategory];
        try {
          localStorage.setItem('portal_categories_store', JSON.stringify(next));
        } catch {}
        return next;
      });
      appendAudit(
        'Criação de Categoria',
        'Categorias',
        `${newCategory.name} (${newCategory.type})`,
        'Sucesso'
      );
      return { success: true, message: 'Categoria cadastrada com sucesso!', category: newCategory };
    },
    [currentUser, categories, appendAudit]
  );

  const updateCategory = useCallback(
    async (
      id: string,
      payload: {
        name: string;
        type: CategoryType;
        description?: string;
      }
    ): Promise<MutationResult & { category?: Category }> => {
      if (!checkUserPermission(currentUser, 'users:manage')) {
        return {
          success: false,
          message: 'Acesso negado: apenas administradores podem editar categorias.',
        };
      }

      const target = categories.find((c) => c.id === id);
      if (!target) {
        return { success: false, message: 'Categoria não encontrada.' };
      }

      const trimmed = payload.name.trim();
      if (!trimmed) {
        return { success: false, message: 'Nome da categoria é obrigatório.' };
      }

      const collides = categories.some(
        (c) => c.id !== id && c.name.trim().toLowerCase() === trimmed.toLowerCase()
      );
      if (collides) {
        return { success: false, message: 'Já existe outra categoria cadastrada com este nome.' };
      }

      const updatedCategory: Category = {
        ...target,
        name: trimmed,
        type: payload.type || 'geral',
        description: payload.description?.trim() || undefined,
      };

      if (isSupabaseConfigured) {
        const { error } = await supabase
          .from('categories')
          .update({
            name: updatedCategory.name,
            type: updatedCategory.type,
            description: updatedCategory.description || null,
          })
          .eq('id', id);
        if (error) {
          console.error('Erro ao atualizar categoria no Supabase:', error);
          return { success: false, message: 'Erro ao atualizar categoria no banco: ' + error.message };
        }
      }

      setCategories((prev) => {
        const next = prev.map((c) => (c.id === id ? updatedCategory : c));
        try {
          localStorage.setItem('portal_categories_store', JSON.stringify(next));
        } catch {}
        return next;
      });

      const oldNameLower = target.name.trim().toLowerCase();
      setChecklists((prev) => {
        const next = prev.map((chk) =>
          chk.categoryId === id || chk.categoryName?.trim().toLowerCase() === oldNameLower
            ? { ...chk, categoryId: id, categoryName: updatedCategory.name }
            : chk
        );
        try {
          localStorage.setItem('portal_checklists_store', JSON.stringify(next));
        } catch {}
        return next;
      });

      setExercises((prev) => {
        const next = prev.map((ex) =>
          ex.categoryId === id || ex.categoryName?.trim().toLowerCase() === oldNameLower
            ? { ...ex, categoryId: id, categoryName: updatedCategory.name }
            : ex
        );
        try {
          localStorage.setItem('portal_exercises_store', JSON.stringify(next));
        } catch {}
        return next;
      });

      appendAudit(
        'Edição de Categoria',
        'Categorias',
        `${target.name} → ${updatedCategory.name}`,
        'Sucesso'
      );
      return { success: true, message: 'Categoria atualizada com sucesso!', category: updatedCategory };
    },
    [currentUser, categories, appendAudit]
  );

  const deleteCategory = useCallback(
    async (id: string): Promise<MutationResult> => {
      if (!checkUserPermission(currentUser, 'users:manage')) {
        return {
          success: false,
          message: 'Acesso negado: apenas administradores podem excluir categorias.',
        };
      }

      const target = categories.find((c) => c.id === id);
      if (!target) {
        return { success: false, message: 'Categoria não encontrada.' };
      }

      const targetNameLower = target.name.trim().toLowerCase();
      const linkedChecklists = checklists.filter(
        (chk) => chk.categoryId === id || chk.categoryName?.trim().toLowerCase() === targetNameLower
      ).length;
      const linkedExercises = exercises.filter(
        (ex) => ex.categoryId === id || ex.categoryName?.trim().toLowerCase() === targetNameLower
      ).length;

      if (linkedChecklists > 0 || linkedExercises > 0) {
        return {
          success: false,
          message: `Não é possível excluir a categoria "${target.name}" pois ela está vinculada a ${linkedChecklists} checklist(s) e ${linkedExercises} exercício(s).`,
        };
      }

      if (isSupabaseConfigured) {
        const { error } = await supabase.from('categories').delete().eq('id', id);
        if (error) {
          console.error('Erro ao excluir categoria no Supabase:', error);
          return { success: false, message: 'Erro ao excluir categoria no banco: ' + error.message };
        }
      }

      setCategories((prev) => {
        const next = prev.filter((c) => c.id !== id);
        try {
          localStorage.setItem('portal_categories_store', JSON.stringify(next));
        } catch {}
        return next;
      });

      appendAudit('Exclusão de Categoria', 'Categorias', target.name, 'Sucesso');
      return { success: true, message: `Categoria "${target.name}" excluída com sucesso.` };
    },
    [currentUser, categories, checklists, exercises, appendAudit]
  );

  // ==========================================
  // 2. Banco de Clientes / Personagens (CRUD)
  // ==========================================
  const saveCharacter = useCallback(
    async (payload: {
      id?: string;
      name: string;
      cell: OfficialCell;
      age: string;
      gender: 'Masculino' | 'Feminino' | 'Outro';
      city: string;
      cardNumber: string;
      customerTier: CustomerTier;
      serviceContext: string;
      temperament: string;
      objectives: string;
      typicalPhrases: string[] | string;
      guideAttachments?: AttachedGuideItem[];
      guideAttachmentUrl?: string | null;
      guideAttachmentName?: string | null;
    }): Promise<MutationResult & { characterId?: string }> => {
      if (
        !checkUserPermission(currentUser, 'can_manage_exercises') &&
        !checkUserPermission(currentUser, 'cells:manage')
      ) {
        return {
          success: false,
          message: 'Acesso negado: permissão can_manage_exercises ou cells:manage exigida.',
        };
      }

      if (!payload.name.trim()) {
        return { success: false, message: 'Nome do cliente é obrigatório.' };
      }

      const nowIso = new Date().toISOString();
      const cleanPhrases = normalizePhrases(payload.typicalPhrases);
      const phrasesDbValue = JSON.stringify(cleanPhrases);
      const normalizedGuides: AttachedGuideItem[] = Array.isArray(payload.guideAttachments)
        ? payload.guideAttachments.filter((g) => g && g.url)
        : payload.guideAttachmentUrl
        ? [
            {
              id: `guide-${Date.now()}`,
              name: payload.guideAttachmentName || `Guia_Medica_${payload.name.trim()}.pdf`,
              url: payload.guideAttachmentUrl,
              uploadedAt: nowIso,
            },
          ]
        : [];
      const primaryGuideUrl = normalizedGuides[0]?.url ?? null;
      const primaryGuideName = normalizedGuides[0]?.name ?? null;

      if (payload.id) {
        const updatedChar: Character = {
          id: payload.id,
          name: payload.name.trim(),
          cell: payload.cell || 'OPERADORA',
          age: payload.age.trim() || '45 anos',
          gender: payload.gender || 'Masculino',
          city: payload.city.trim() || 'São Paulo - SP',
          cardNumber: payload.cardNumber.trim() || '0000.0000.00000-00',
          customerTier: payload.customerTier || 'Mediano',
          serviceContext: payload.serviceContext.trim(),
          temperament: payload.temperament.trim(),
          objectives: payload.objectives.trim(),
          typicalPhrases: cleanPhrases,
          guideAttachments: normalizedGuides,
          guideAttachmentUrl: primaryGuideUrl,
          guideAttachmentName: primaryGuideName,
          createdAt: nowIso,
        };

        if (isSupabaseConfigured) {
          const { error } = await supabase.from('characters').upsert({
            id: updatedChar.id,
            name: updatedChar.name,
            cell: updatedChar.cell,
            age: updatedChar.age,
            gender: updatedChar.gender,
            city: updatedChar.city,
            card_number: updatedChar.cardNumber,
            customer_tier: updatedChar.customerTier,
            service_context: updatedChar.serviceContext,
            temperament: updatedChar.temperament,
            objectives: updatedChar.objectives,
            typical_phrases: phrasesDbValue,
            guide_attachments: updatedChar.guideAttachments || [],
            guide_attachment_url: updatedChar.guideAttachmentUrl,
            guide_attachment_name: updatedChar.guideAttachmentName,
          });
          if (error) {
            console.error('Erro ao salvar no Supabase:', error);
            showToast('Erro ao salvar no banco de dados: ' + error.message, 'error');
            return { success: false, message: 'Erro ao salvar no banco: ' + error.message };
          }
        }

        setCharacters((prev) => {
          const next = prev.map((c) => (c.id === payload.id ? { ...c, ...updatedChar } : c));
          try {
            localStorage.setItem('portal_characters_store', JSON.stringify(next));
          } catch {}
          return next;
        });
        appendAudit('Edição de Personagem', 'Personagens', payload.name, 'Sucesso');
        return { success: true, message: 'Cliente atualizado com sucesso!', characterId: payload.id };
      } else {
        const newCharId = `char-${Date.now()}`;
        const newChar: Character = {
          id: newCharId,
          name: payload.name.trim(),
          cell: payload.cell || 'OPERADORA',
          age: payload.age.trim() || '45 anos',
          gender: payload.gender || 'Masculino',
          city: payload.city.trim() || 'São Paulo - SP',
          cardNumber: payload.cardNumber.trim() || '0000.0000.00000-00',
          customerTier: payload.customerTier || 'Mediano',
          serviceContext: payload.serviceContext.trim(),
          temperament: payload.temperament.trim(),
          objectives: payload.objectives.trim(),
          typicalPhrases: cleanPhrases,
          guideAttachments: normalizedGuides,
          guideAttachmentUrl: primaryGuideUrl,
          guideAttachmentName: primaryGuideName,
          createdAt: nowIso,
        };

        if (isSupabaseConfigured) {
          const { error } = await supabase.from('characters').insert({
            id: newChar.id,
            name: newChar.name,
            cell: newChar.cell,
            age: newChar.age,
            gender: newChar.gender,
            city: newChar.city,
            card_number: newChar.cardNumber,
            customer_tier: newChar.customerTier,
            service_context: newChar.serviceContext,
            temperament: newChar.temperament,
            objectives: newChar.objectives,
            typical_phrases: phrasesDbValue,
            guide_attachments: newChar.guideAttachments || [],
            guide_attachment_url: newChar.guideAttachmentUrl,
            guide_attachment_name: newChar.guideAttachmentName,
          });
          if (error) {
            console.error('Erro ao criar no Supabase:', error);
            showToast('Erro ao cadastrar no banco de dados: ' + error.message, 'error');
            return { success: false, message: 'Erro ao cadastrar no banco: ' + error.message };
          }
        }

        setCharacters((prev) => {
          const next = [newChar, ...prev];
          try {
            localStorage.setItem('portal_characters_store', JSON.stringify(next));
          } catch {}
          return next;
        });
        appendAudit('Criação de Personagem', 'Personagens', newChar.name, 'Sucesso');
        return { success: true, message: 'Cliente cadastrado no Banco de Clientes com sucesso!', characterId: newCharId };
      }
    },
    [currentUser, appendAudit, showToast]
  );

  const batchImportCharacters = useCallback(
    async (
      items: Array<{
        name: string;
        cell: OfficialCell;
        age: string;
        gender: 'Masculino' | 'Feminino' | 'Outro';
        city: string;
        cardNumber: string;
        customerTier: CustomerTier;
        serviceContext: string;
        temperament: string;
        objectives: string;
        typicalPhrases: string[];
      }>
    ): Promise<MutationResult & { importedCount?: number }> => {
      if (currentUser?.role !== 'admin') {
        return {
          success: false,
          message: 'Acesso negado: a importação em lote é exclusiva do perfil Administrador.',
        };
      }

      if (!items || items.length === 0) {
        return { success: false, message: 'Nenhum cliente válido para importar.' };
      }

      const baseTs = Date.now();
      const nowIso = new Date().toISOString();

      const newChars: Character[] = items.map((item, idx) => ({
        id: `char-${baseTs}-${idx}-${Math.random().toString(36).slice(2, 6)}`,
        name: item.name.trim(),
        cell: item.cell,
        age: item.age.trim(),
        gender: item.gender,
        city: item.city.trim(),
        cardNumber: item.cardNumber.trim(),
        customerTier: item.customerTier,
        serviceContext: item.serviceContext.trim(),
        temperament: item.temperament.trim(),
        objectives: item.objectives.trim(),
        typicalPhrases: item.typicalPhrases.map((p) => p.trim()).filter((p) => p.length > 0),
        guideAttachmentUrl: null,
        guideAttachmentName: null,
        createdAt: nowIso,
      }));

      if (isSupabaseConfigured) {
        const dbRows = newChars.map((c) => ({
          id: c.id,
          name: c.name,
          cell: c.cell,
          age: c.age,
          gender: c.gender,
          city: c.city,
          card_number: c.cardNumber,
          customer_tier: c.customerTier,
          service_context: c.serviceContext,
          temperament: c.temperament,
          objectives: c.objectives,
          typical_phrases: JSON.stringify(c.typicalPhrases),
          guide_attachments: [],
          guide_attachment_url: null,
          guide_attachment_name: null,
        }));

        const { error } = await supabase.from('characters').insert(dbRows);
        if (error) {
          console.error('Erro ao importar clientes em lote no Supabase:', error);
          showToast('Erro ao importar lote no banco de dados: ' + error.message, 'error');
          return { success: false, message: 'Erro ao importar lote no banco: ' + error.message };
        }
      }

      setCharacters((prev) => {
        const next = [...newChars, ...prev];
        try {
          localStorage.setItem('portal_characters_store', JSON.stringify(next));
        } catch {}
        return next;
      });

      appendAudit(
        'Importação em Lote de Clientes',
        'Personagens',
        `${newChars.length} cliente(s) importado(s)`,
        'Sucesso'
      );

      return {
        success: true,
        message: `${newChars.length} cliente(s) importado(s) com sucesso!`,
        importedCount: newChars.length,
      };
    },
    [currentUser, appendAudit, showToast]
  );

  const deleteCharacter = useCallback(
    async (characterId: string): Promise<MutationResult> => {
      if (
        !checkUserPermission(currentUser, 'can_manage_exercises') &&
        !checkUserPermission(currentUser, 'cells:manage')
      ) {
        return {
          success: false,
          message: 'Acesso negado: permissão can_manage_exercises ou cells:manage exigida.',
        };
      }

      if (isSupabaseConfigured) {
        // Exclusão em cascata: remove vínculos em exercise_characters primeiro
        await supabase.from('exercise_characters').delete().eq('character_id', characterId);
        const { error } = await supabase.from('characters').delete().eq('id', characterId);
        if (error) {
          console.error('Erro ao excluir no Supabase:', error);
          showToast('Erro ao excluir do banco de dados: ' + error.message, 'error');
          return { success: false, message: 'Erro ao excluir do banco de dados: ' + error.message };
        }
      }

      // Remove dos exercícios associados sem quebrar os exercícios
      setExercises((prev) => {
        const next = prev.map((ex) => ({
          ...ex,
          characterIds: ex.characterIds.filter((cid) => cid !== characterId),
        }));
        try {
          localStorage.setItem('portal_exercises_store', JSON.stringify(next));
        } catch {}
        return next;
      });

      setCharacters((prev) => {
        const next = prev.filter((c) => c.id !== characterId);
        try {
          localStorage.setItem('portal_characters_store', JSON.stringify(next));
        } catch {}
        return next;
      });
      appendAudit('Exclusão de Personagem', 'Personagens', `ID: ${characterId}`, 'Sucesso');
      return { success: true, message: 'Cliente removido do Banco de Clientes com sucesso.' };
    },
    [currentUser, appendAudit, showToast]
  );

  const MAX_GUIDE_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

  const sanitizeStorageFileName = (originalName: string): string => {
    const normalized = originalName
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const cleaned = normalized.replace(/[^a-zA-Z0-9._-]+/g, '_').replace(/_+/g, '_');
    return cleaned || `guia_${Date.now()}`;
  };

  const readFileAsDataUrl = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Falha ao converter arquivo para Base64.'));
        }
      };
      reader.onerror = () => reject(reader.error || new Error('Erro de leitura do arquivo.'));
      reader.readAsDataURL(file);
    });

  const uploadClientGuide = useCallback(
    async (file: File): Promise<{ success: boolean; message: string; url?: string; fileName?: string }> => {
      if (
        !checkUserPermission(currentUser, 'can_manage_exercises') &&
        !checkUserPermission(currentUser, 'cells:manage')
      ) {
        const msg = 'Acesso negado para upload de guias de clientes.';
        showToast(msg, 'error');
        return { success: false, message: msg };
      }

      if (file.size > MAX_GUIDE_FILE_SIZE_BYTES) {
        const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
        const msg = `O arquivo "${file.name}" (${sizeMb} MB) excede o limite máximo de 5 MB por guia.`;
        showToast(msg, 'error');
        return { success: false, message: msg };
      }

      if (!isSupabaseConfigured) {
        try {
          const dataUrl = await readFileAsDataUrl(file);
          return {
            success: true,
            message: 'Guia do cliente anexada e persistida localmente.',
            url: dataUrl,
            fileName: file.name,
          };
        } catch {
          const msg = 'Erro ao processar o arquivo selecionado em modo local.';
          showToast(msg, 'error');
          return { success: false, message: msg };
        }
      }

      const uniqueSuffix = Math.random().toString(36).slice(2, 8);
      const storagePath = `clients/cliente_${Date.now()}_${uniqueSuffix}_${sanitizeStorageFileName(file.name)}`;

      try {
        const { error } = await supabase.storage.from('client-guides').upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || undefined,
        });

        if (error) {
          const msg = `Falha ao enviar "${file.name}" para o Supabase Storage: ${error.message}`;
          showToast(msg, 'error');
          return { success: false, message: msg };
        }

        const { data: publicData } = supabase.storage.from('client-guides').getPublicUrl(storagePath);
        if (!publicData?.publicUrl) {
          const msg = `Não foi possível obter a URL pública do arquivo "${file.name}".`;
          showToast(msg, 'error');
          return { success: false, message: msg };
        }

        return {
          success: true,
          message: 'Guia de atendimento do cliente anexada com sucesso!',
          url: publicData.publicUrl,
          fileName: file.name,
        };
      } catch (err) {
        const detail = err instanceof Error ? err.message : 'erro inesperado de conexão';
        const msg = `Erro ao enviar "${file.name}" para o Supabase Storage (${detail}).`;
        showToast(msg, 'error');
        return { success: false, message: msg };
      }
    },
    [currentUser, showToast]
  );

  // ==========================================
  // 3. Exercícios e Cenários (CRUD com até 4 Clientes)
  // ==========================================
  const saveExercise = useCallback(
    async (payload: {
      id?: string;
      title: string;
      cell: OfficialCell;
      difficulty: ExerciseDifficulty;
      categoryId?: string;
      categoryName?: string;
      scenarioInstructions: string;
      characterIds: string[];
      attachments?: AttachedGuideItem[];
      attachmentUrl?: string | null;
      attachmentName?: string | null;
    }): Promise<MutationResult & { exerciseId?: string }> => {
      if (!checkUserPermission(currentUser, 'can_manage_exercises')) {
        return { success: false, message: 'Acesso negado: permissão can_manage_exercises exigida.' };
      }

      if (!payload.title.trim()) {
        return { success: false, message: 'Título do exercício é obrigatório.' };
      }

      // Limita até 4 clientes conforme regra de negócio
      const safeCharacterIds = payload.characterIds.slice(0, 4);
      const nowIso = new Date().toISOString();
      const normalizedAttachments: AttachedGuideItem[] = Array.isArray(payload.attachments)
        ? payload.attachments.filter((a) => a && a.url)
        : payload.attachmentUrl
        ? [
            {
              id: `ex-guide-${Date.now()}`,
              name: payload.attachmentName || `Documento_${payload.title.trim()}.pdf`,
              url: payload.attachmentUrl,
              uploadedAt: nowIso,
            },
          ]
        : [];
      const primaryAttachmentUrl = normalizedAttachments[0]?.url ?? null;
      const primaryAttachmentName = normalizedAttachments[0]?.name ?? null;

      if (payload.id) {
        const updatedEx: Exercise = {
          id: payload.id,
          title: payload.title.trim(),
          cell: payload.cell || 'OPERADORA',
          difficulty: payload.difficulty || 'Mediano',
          categoryId: payload.categoryId,
          categoryName: payload.categoryName || 'Geral',
          scenarioInstructions: payload.scenarioInstructions.trim(),
          characterIds: safeCharacterIds,
          attachments: normalizedAttachments,
          attachmentUrl: primaryAttachmentUrl,
          attachmentName: primaryAttachmentName,
          updatedAt: nowIso,
          createdAt: nowIso,
        };

        if (isSupabaseConfigured) {
          const { error } = await supabase.from('exercises').upsert({
            id: updatedEx.id,
            title: updatedEx.title,
            cell: updatedEx.cell,
            difficulty: updatedEx.difficulty,
            category_id: updatedEx.categoryId || null,
            category_name: updatedEx.categoryName,
            scenario_instructions: updatedEx.scenarioInstructions,
            attachments: updatedEx.attachments || [],
            attachment_url: updatedEx.attachmentUrl,
            attachment_name: updatedEx.attachmentName,
          });
          if (error) {
            console.error('Erro ao salvar no Supabase:', error);
            showToast('Erro ao salvar no banco de dados: ' + error.message, 'error');
            return { success: false, message: 'Erro ao salvar no banco: ' + error.message };
          }

          await supabase.from('exercise_characters').delete().eq('exercise_id', updatedEx.id);
          if (safeCharacterIds.length > 0) {
            const links = safeCharacterIds.map((cid, idx) => ({
              id: `ec-${updatedEx.id}-${cid}`,
              exercise_id: updatedEx.id,
              character_id: cid,
              order_index: idx + 1,
            }));
            await supabase.from('exercise_characters').insert(links);
          }
        }

        setExercises((prev) => {
          const next = prev.map((ex) => (ex.id === payload.id ? { ...ex, ...updatedEx } : ex));
          try {
            localStorage.setItem('portal_exercises_store', JSON.stringify(next));
          } catch {}
          return next;
        });
        appendAudit('Edição de Exercício', 'Exercícios', payload.title, 'Sucesso');
        return { success: true, message: 'Exercício atualizado com sucesso.', exerciseId: payload.id };
      } else {
        const newExId = `ex-${Date.now()}`;
        const newEx: Exercise = {
          id: newExId,
          title: payload.title.trim(),
          cell: payload.cell || 'OPERADORA',
          difficulty: payload.difficulty || 'Mediano',
          categoryId: payload.categoryId,
          categoryName: payload.categoryName || 'Geral',
          scenarioInstructions: payload.scenarioInstructions.trim(),
          characterIds: safeCharacterIds,
          attachments: normalizedAttachments,
          attachmentUrl: primaryAttachmentUrl,
          attachmentName: primaryAttachmentName,
          createdAt: nowIso,
          updatedAt: nowIso,
        };

        if (isSupabaseConfigured) {
          const { error } = await supabase.from('exercises').insert({
            id: newEx.id,
            title: newEx.title,
            cell: newEx.cell,
            difficulty: newEx.difficulty,
            category_id: newEx.categoryId || null,
            category_name: newEx.categoryName,
            scenario_instructions: newEx.scenarioInstructions,
            attachments: newEx.attachments || [],
            attachment_url: newEx.attachmentUrl,
            attachment_name: newEx.attachmentName,
          });
          if (error) {
            console.error('Erro ao criar no Supabase:', error);
            showToast('Erro ao cadastrar exercício no banco de dados: ' + error.message, 'error');
            return { success: false, message: 'Erro ao cadastrar no banco: ' + error.message };
          }

          if (safeCharacterIds.length > 0) {
            const links = safeCharacterIds.map((cid, idx) => ({
              id: `ec-${newEx.id}-${cid}`,
              exercise_id: newEx.id,
              character_id: cid,
              order_index: idx + 1,
            }));
            await supabase.from('exercise_characters').insert(links);
          }
        }

        setExercises((prev) => {
          const next = [newEx, ...prev];
          try {
            localStorage.setItem('portal_exercises_store', JSON.stringify(next));
          } catch {}
          return next;
        });
        appendAudit('Criação de Exercício', 'Exercícios', newEx.title, 'Sucesso');
        return { success: true, message: 'Novo exercício criado com sucesso!', exerciseId: newExId };
      }
    },
    [currentUser, appendAudit, showToast]
  );

  const deleteExercise = useCallback(
    async (exerciseId: string): Promise<MutationResult> => {
      if (!checkUserPermission(currentUser, 'can_manage_exercises')) {
        return { success: false, message: 'Acesso negado: permissão can_manage_exercises exigida.' };
      }

      if (isSupabaseConfigured) {
        // Exclusão em cascata: remove vínculos em checklist_exercises e exercise_characters primeiro
        await supabase.from('checklist_exercises').delete().eq('exercise_id', exerciseId);
        await supabase.from('exercise_characters').delete().eq('exercise_id', exerciseId);
        const { error } = await supabase.from('exercises').delete().eq('id', exerciseId);
        if (error) {
          console.error('Erro ao excluir no Supabase:', error);
          showToast('Erro ao excluir do banco de dados: ' + error.message, 'error');
          return { success: false, message: 'Erro ao excluir do banco de dados: ' + error.message };
        }
      }

      // Desvincula dos checklists existentes sem excluir os checklists
      setChecklists((prev) => {
        const next = prev.map((chk) => ({
          ...chk,
          exerciseIds: chk.exerciseIds.filter((eid) => eid !== exerciseId),
          hasExercises: chk.exerciseIds.filter((eid) => eid !== exerciseId).length > 0,
        }));
        try {
          localStorage.setItem('portal_checklists_store', JSON.stringify(next));
        } catch {}
        return next;
      });

      setExercises((prev) => {
        const next = prev.filter((e) => e.id !== exerciseId);
        try {
          localStorage.setItem('portal_exercises_store', JSON.stringify(next));
        } catch {}
        return next;
      });
      appendAudit('Exclusão de Exercício', 'Exercícios', `ID: ${exerciseId}`, 'Sucesso');
      return { success: true, message: 'Exercício excluído com sucesso.' };
    },
    [currentUser, appendAudit, showToast]
  );

  const uploadExerciseGuide = useCallback(
    async (file: File): Promise<{ success: boolean; message: string; url?: string; fileName?: string }> => {
      if (!checkUserPermission(currentUser, 'can_manage_exercises')) {
        const msg = 'Acesso negado para upload de arquivos.';
        showToast(msg, 'error');
        return { success: false, message: msg };
      }

      if (file.size > MAX_GUIDE_FILE_SIZE_BYTES) {
        const sizeMb = (file.size / (1024 * 1024)).toFixed(1);
        const msg = `O arquivo "${file.name}" (${sizeMb} MB) excede o limite máximo de 5 MB.`;
        showToast(msg, 'error');
        return { success: false, message: msg };
      }

      if (!isSupabaseConfigured) {
        try {
          const dataUrl = await readFileAsDataUrl(file);
          return {
            success: true,
            message: 'Documento preparado e persistido localmente.',
            url: dataUrl,
            fileName: file.name,
          };
        } catch {
          const msg = 'Erro ao processar o arquivo selecionado em modo local.';
          showToast(msg, 'error');
          return { success: false, message: msg };
        }
      }

      const uniqueSuffix = Math.random().toString(36).slice(2, 8);
      const storagePath = `exercises/exercicio_${Date.now()}_${uniqueSuffix}_${sanitizeStorageFileName(file.name)}`;

      try {
        const { error } = await supabase.storage.from('client-guides').upload(storagePath, file, {
          cacheControl: '3600',
          upsert: false,
          contentType: file.type || undefined,
        });

        if (error) {
          const msg = `Falha ao enviar "${file.name}" para o Supabase Storage: ${error.message}`;
          showToast(msg, 'error');
          return { success: false, message: msg };
        }

        const { data: publicData } = supabase.storage.from('client-guides').getPublicUrl(storagePath);
        if (!publicData?.publicUrl) {
          const msg = `Não foi possível obter a URL pública do arquivo "${file.name}".`;
          showToast(msg, 'error');
          return { success: false, message: msg };
        }

        return {
          success: true,
          message: 'Documento enviado com sucesso para o armazenamento seguro.',
          url: publicData.publicUrl,
          fileName: file.name,
        };
      } catch (err) {
        const detail = err instanceof Error ? err.message : 'erro inesperado de conexão';
        const msg = `Erro ao enviar "${file.name}" para o Supabase Storage (${detail}).`;
        showToast(msg, 'error');
        return { success: false, message: msg };
      }
    },
    [currentUser, showToast]
  );

  // ==========================================
  // 4. Checklists Flexíveis (com ou sem exercícios simulados)
  // ==========================================
  const saveChecklist = useCallback(
    async (payload: {
      id?: string;
      title: string;
      cell: OfficialCell;
      description: string;
      categoryId?: string;
      categoryName?: string;
      visibility?: VisibilityLevel;
      hasExercises: boolean;
      exerciseIds: string[];
      criteria: Array<{ id?: string; name: string; weight: number }>;
    }): Promise<MutationResult & { checklistId?: string }> => {
      if (!checkUserPermission(currentUser, 'can_manage_checklists')) {
        return { success: false, message: 'Acesso negado: permissão can_manage_checklists exigida.' };
      }

      if (!payload.title.trim()) {
        return { success: false, message: 'Título do checklist é obrigatório.' };
      }

      if (payload.criteria.length === 0) {
        return { success: false, message: 'Adicione ao menos um critério de avaliação.' };
      }

      const nowIso = new Date().toISOString();
      const formattedCriteria: ChecklistCriterion[] = payload.criteria.map((c, idx) => ({
        id: c.id || `crit-${Date.now()}-${idx}`,
        name: c.name.trim(),
        weight: Number(c.weight) || 1,
      }));

      const hasExercisesReal = payload.hasExercises && payload.exerciseIds.length > 0;

      if (payload.id) {
        const existingChk = checklists.find((c) => c.id === payload.id);
        const updatedChk: Checklist = {
          id: payload.id,
          title: payload.title.trim(),
          cell: payload.cell || 'OPERADORA',
          description: payload.description.trim(),
          categoryId: payload.categoryId,
          categoryName: payload.categoryName || 'Geral',
          visibility: payload.visibility || existingChk?.visibility || 'padrao',
          hasExercises: hasExercisesReal,
          exerciseIds: hasExercisesReal ? payload.exerciseIds : [],
          criteria: formattedCriteria,
          isActive: true,
          updatedAt: nowIso,
          createdAt: existingChk?.createdAt || nowIso,
        };

        if (isSupabaseConfigured) {
          const { error } = await supabase.from('checklists').upsert({
            id: updatedChk.id,
            title: updatedChk.title,
            cell: updatedChk.cell,
            description: updatedChk.description,
            category_id: updatedChk.categoryId || null,
            category_name: updatedChk.categoryName,
            visibility: updatedChk.visibility || 'padrao',
            has_exercises: updatedChk.hasExercises,
            is_active: updatedChk.isActive,
          });
          if (error) {
            console.error('Erro ao salvar no Supabase:', error);
            showToast('Erro ao salvar no banco de dados: ' + error.message, 'error');
            return { success: false, message: 'Erro ao salvar no banco: ' + error.message };
          }

          await supabase.from('checklist_exercises').delete().eq('checklist_id', updatedChk.id);
          if (updatedChk.exerciseIds.length > 0) {
            const exLinks = updatedChk.exerciseIds.map((eid) => ({
              id: `ce-${updatedChk.id}-${eid}`,
              checklist_id: updatedChk.id,
              exercise_id: eid,
            }));
            await supabase.from('checklist_exercises').insert(exLinks);
          }

          await supabase.from('checklist_criteria').delete().eq('checklist_id', updatedChk.id);
          if (updatedChk.criteria.length > 0) {
            const critLinks = updatedChk.criteria.map((crit) => ({
              id: crit.id,
              checklist_id: updatedChk.id,
              name: crit.name,
              weight: crit.weight,
            }));
            await supabase.from('checklist_criteria').insert(critLinks);
          }
        }

        setChecklists((prev) => {
          const next = prev.map((chk) => (chk.id === payload.id ? { ...chk, ...updatedChk } : chk));
          try {
            localStorage.setItem('portal_checklists_store', JSON.stringify(next));
          } catch {}
          return next;
        });
        appendAudit('Edição de Checklist', 'Checklists', payload.title, 'Sucesso');
        return { success: true, message: 'Checklist atualizado com sucesso!', checklistId: payload.id };
      } else {
        const newChkId = `chk-${Date.now()}`;
        const newChk: Checklist = {
          id: newChkId,
          title: payload.title.trim(),
          cell: payload.cell || 'OPERADORA',
          description: payload.description.trim(),
          categoryId: payload.categoryId,
          categoryName: payload.categoryName || 'Geral',
          visibility: payload.visibility || 'padrao',
          hasExercises: hasExercisesReal,
          exerciseIds: hasExercisesReal ? payload.exerciseIds : [],
          criteria: formattedCriteria,
          isActive: true,
          createdAt: nowIso,
          updatedAt: nowIso,
        };

        if (isSupabaseConfigured) {
          const { error } = await supabase.from('checklists').insert({
            id: newChk.id,
            title: newChk.title,
            cell: newChk.cell,
            description: newChk.description,
            category_id: newChk.categoryId || null,
            category_name: newChk.categoryName,
            visibility: newChk.visibility || 'padrao',
            has_exercises: newChk.hasExercises,
            is_active: newChk.isActive,
          });
          if (error) {
            console.error('Erro ao criar no Supabase:', error);
            showToast('Erro ao salvar checklist no banco de dados: ' + error.message, 'error');
            return { success: false, message: 'Erro ao cadastrar no banco: ' + error.message };
          }

          if (newChk.exerciseIds.length > 0) {
            const exLinks = newChk.exerciseIds.map((eid) => ({
              id: `ce-${newChk.id}-${eid}`,
              checklist_id: newChk.id,
              exercise_id: eid,
            }));
            await supabase.from('checklist_exercises').insert(exLinks);
          }

          if (newChk.criteria.length > 0) {
            const critLinks = newChk.criteria.map((crit) => ({
              id: crit.id,
              checklist_id: newChk.id,
              name: crit.name,
              weight: crit.weight,
            }));
            await supabase.from('checklist_criteria').insert(critLinks);
          }
        }

        setChecklists((prev) => {
          const next = [newChk, ...prev];
          try {
            localStorage.setItem('portal_checklists_store', JSON.stringify(next));
          } catch {}
          return next;
        });
        appendAudit('Criação de Checklist', 'Checklists', newChk.title, 'Sucesso');
        return { success: true, message: 'Checklist salvo com sucesso!', checklistId: newChkId };
      }
    },
    [currentUser, checklists, appendAudit, showToast]
  );

  const deleteChecklist = useCallback(
    async (checklistId: string): Promise<MutationResult> => {
      if (!checkUserPermission(currentUser, 'can_manage_checklists')) {
        return { success: false, message: 'Acesso negado: permissão can_manage_checklists exigida.' };
      }

      if (isSupabaseConfigured) {
        // Exclusão em cascata: remove vínculos de avaliações, exercícios e critérios primeiro
        await supabase.from('collaborator_checklists').delete().eq('checklist_id', checklistId);
        await supabase.from('checklist_exercises').delete().eq('checklist_id', checklistId);
        await supabase.from('checklist_criteria').delete().eq('checklist_id', checklistId);
        const { error } = await supabase.from('checklists').delete().eq('id', checklistId);
        if (error) {
          console.error('Erro ao excluir no Supabase:', error);
          showToast('Erro ao excluir do banco de dados: ' + error.message, 'error');
          return { success: false, message: 'Erro ao excluir do banco de dados: ' + error.message };
        }
      }

      // Integridade referencial com ON DELETE CASCADE: remove vínculos de avaliações dos colaboradores
      setCollaboratorChecklists((prev) => {
        const next = prev.filter((c) => c.checklistId !== checklistId);
        try {
          localStorage.setItem('portal_collaborator_checklists_store', JSON.stringify(next));
        } catch {}
        return next;
      });

      setChecklists((prev) => {
        const next = prev.filter((c) => c.id !== checklistId);
        try {
          localStorage.setItem('portal_checklists_store', JSON.stringify(next));
        } catch {}
        return next;
      });
      appendAudit('Exclusão de Checklist', 'Checklists', `ID: ${checklistId}`, 'Sucesso');
      return { success: true, message: 'Checklist e seus vínculos foram excluídos com sucesso.' };
    },
    [currentUser, appendAudit, showToast]
  );

  // ==========================================
  // 5. Colaboradores & Vínculos (CRUD com Edição)
  // ==========================================
  const createCollaborator = useCallback(
    async (payload: {
      firstName?: string;
      lastName?: string;
      fullName?: string;
      username?: string;
      roleTitle: string;
      cellTeam: string;
      registrationCode?: string;
      learningTrackId?: string;
      status?: CollaboratorStatus;
      initialChecklistIds?: string[];
    }): Promise<MutationResult & { collaboratorId?: string; username?: string }> => {
      if (!checkUserPermission(currentUser, 'can_manage_collaborators')) {
        return { success: false, message: 'Acesso negado: permissão can_manage_collaborators exigida.' };
      }

      const calculatedFullName =
        payload.fullName?.trim() ||
        `${payload.firstName?.trim() || ''} ${payload.lastName?.trim() || ''}`.trim();

      if (!calculatedFullName) {
        return { success: false, message: 'Nome e sobrenome são obrigatórios.' };
      }

      // Geração de usuário corporativo único
      let calculatedUsername =
        payload.username?.trim().toLowerCase() ||
        (payload.firstName && payload.lastName
          ? generateCorporateUsername(payload.firstName, payload.lastName)
          : generateCorporateUsername(
              calculatedFullName.split(' ')[0] || '',
              calculatedFullName.split(' ').slice(1).join(' ')
            ));

      if (!calculatedUsername) {
        calculatedUsername = `colab.${Date.now().toString().slice(-4)}`;
      }

      // Se já existir usuário com mesmo username, adiciona sufixo numérico
      const existingUsernames = new Set(users.map((u) => u.username.toLowerCase()));
      let finalUsername = calculatedUsername;
      let counter = 2;
      while (existingUsernames.has(finalUsername)) {
        finalUsername = `${calculatedUsername}${counter}`;
        counter++;
      }

      const nowIso = new Date().toISOString();
      const newCollabId = `col-${Date.now()}`;
      const newCollab: Collaborator = {
        id: newCollabId,
        fullName: calculatedFullName,
        username: finalUsername,
        roleTitle: payload.roleTitle.trim() || 'Atendente de Operações',
        cellTeam: payload.cellTeam.trim() || 'Laboratório',
        registrationCode: payload.registrationCode?.trim(),
        learningTrackId: payload.learningTrackId || undefined,
        track: [],
        status: payload.status || 'novo',
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      setCollaborators((prev) => [newCollab, ...prev]);

      // Criação da conta de usuário corporativo correspondente (Perfil Colaborador)
      const newUserId = `usr-collab-${Date.now()}`;
      const newCollabUser: UserProfile = {
        id: newUserId,
        username: finalUsername,
        fullName: calculatedFullName,
        email: `${finalUsername}@portaldesempenho.corp`,
        role: 'colaborador',
        status: 'ativo',
        canChangePassword: true,
        isActive: true,
        password: '',
        department: payload.cellTeam.trim() || 'Laboratório',
        collaboratorId: newCollabId,
        individualPermissions: [],
        createdAt: nowIso,
        lastLoginAt: nowIso,
      };
      setUsers((prev) => [...prev, newCollabUser]);

      const assignmentsToCreate: CollaboratorChecklist[] = [];

      // Se vinculado a uma trilha de aprendizagem, vincula e cria as etapas de checklist
      if (payload.learningTrackId) {
        setLearningTracks((prev) =>
          prev.map((t) =>
            t.id === payload.learningTrackId
              ? {
                  ...t,
                  collaboratorIds: Array.from(new Set([...t.collaboratorIds, newCollabId])),
                  updatedAt: nowIso,
                }
              : t
          )
        );

        const targetTrack = learningTracks.find((t) => t.id === payload.learningTrackId);
        if (targetTrack && targetTrack.checklistIds.length > 0) {
          targetTrack.checklistIds.forEach((chkId, idx) => {
            assignmentsToCreate.push({
              id: `asg-${Date.now()}-${idx}`,
              collaboratorId: newCollabId,
              checklistId: chkId,
              status: 'pendente',
              finalScore: null,
              criteriaAnswers: [],
              instructorAuxiliarId: null,
              actorAuxiliarId: null,
              completedAt: null,
              createdAt: nowIso,
              updatedAt: nowIso,
            });
          });
          setCollaboratorChecklists((prev) => [...assignmentsToCreate, ...prev]);
        }
      } else if (payload.initialChecklistIds && payload.initialChecklistIds.length > 0) {
        payload.initialChecklistIds.forEach((chkId, idx) => {
          assignmentsToCreate.push({
            id: `asg-${Date.now()}-${idx}`,
            collaboratorId: newCollabId,
            checklistId: chkId,
            status: 'pendente',
            finalScore: null,
            criteriaAnswers: [],
            instructorAuxiliarId: null,
            actorAuxiliarId: null,
            completedAt: null,
            createdAt: nowIso,
            updatedAt: nowIso,
          });
        });
        setCollaboratorChecklists((prev) => [...assignmentsToCreate, ...prev]);
      }

      if (isSupabaseConfigured) {
        const { error: collabErr } = await supabase
          .from('collaborators')
          .upsert(mapCollaboratorToDbRow(newCollab));
        if (collabErr) {
          console.error('Erro ao cadastrar colaborador no Supabase:', collabErr);
          showToast('Erro ao salvar colaborador no banco: ' + collabErr.message, 'error');
        }

        const { error: usrErr } = await supabase
          .from('portal_users')
          .upsert(mapUserProfileToDbRow(newCollabUser));
        if (usrErr) {
          console.error('Erro ao criar usuário do colaborador no Supabase:', usrErr);
        }

        if (assignmentsToCreate.length > 0) {
          await supabase.from('collaborator_checklists').upsert(
            assignmentsToCreate.map((asg) => ({
              id: asg.id,
              collaborator_id: asg.collaboratorId,
              checklist_id: asg.checklistId,
              status: asg.status,
              final_score: asg.finalScore,
              criteria_answers: asg.criteriaAnswers,
              general_observations: '',
              instructor_auxiliar_id: asg.instructorAuxiliarId,
              actor_auxiliar_id: asg.actorAuxiliarId,
              completed_at: asg.completedAt,
              created_at: asg.createdAt,
              updated_at: asg.updatedAt,
            }))
          );
        }
      }

      appendAudit(
        'Cadastro de Colaborador',
        'Colaboradores',
        `${newCollab.fullName} (@${finalUsername})`,
        'Sucesso'
      );

      return {
        success: true,
        message: `Colaborador cadastrado com sucesso! Usuário de acesso: @${finalUsername}`,
        collaboratorId: newCollabId,
        username: finalUsername,
      };
    },
    [currentUser, users, learningTracks, appendAudit, showToast]
  );

  const updateCollaborator = useCallback(
    async (payload: {
      id: string;
      fullName: string;
      roleTitle: string;
      cellTeam: string;
      registrationCode?: string;
      learningTrackId?: string;
      status: CollaboratorStatus;
    }): Promise<MutationResult> => {
      if (!checkUserPermission(currentUser, 'can_manage_collaborators')) {
        return { success: false, message: 'Acesso negado: permissão can_manage_collaborators exigida.' };
      }

      const nowIso = new Date().toISOString();
      const existing = collaborators.find((c) => c.id === payload.id);
      const updatedCollab: Collaborator | null = existing
        ? {
            ...existing,
            fullName: payload.fullName.trim(),
            roleTitle: payload.roleTitle.trim(),
            cellTeam: payload.cellTeam.trim(),
            registrationCode: payload.registrationCode?.trim(),
            learningTrackId: payload.learningTrackId,
            status: payload.status,
            updatedAt: nowIso,
          }
        : null;

      setCollaborators((prev) =>
        prev.map((c) =>
          c.id === payload.id
            ? {
                ...c,
                fullName: payload.fullName.trim(),
                roleTitle: payload.roleTitle.trim(),
                cellTeam: payload.cellTeam.trim(),
                registrationCode: payload.registrationCode?.trim(),
                learningTrackId: payload.learningTrackId,
                status: payload.status,
                updatedAt: nowIso,
              }
            : c
        )
      );

      setUsers((prev) =>
        prev.map((u) =>
          u.collaboratorId === payload.id
            ? { ...u, fullName: payload.fullName.trim(), department: payload.cellTeam.trim() }
            : u
        )
      );

      if (isSupabaseConfigured) {
        if (updatedCollab) {
          const { error } = await supabase
            .from('collaborators')
            .upsert(mapCollaboratorToDbRow(updatedCollab));
          if (error) {
            console.error('Erro ao atualizar colaborador no Supabase:', error);
          }
        }
        await supabase
          .from('portal_users')
          .update({
            full_name: payload.fullName.trim(),
            department: payload.cellTeam.trim(),
          })
          .eq('collaborator_id', payload.id);
      }

      appendAudit('Edição de Colaborador', 'Colaboradores', payload.fullName, 'Sucesso');
      return { success: true, message: 'Colaborador editado com sucesso!' };
    },
    [currentUser, collaborators, appendAudit]
  );

  const deleteCollaborator = useCallback(
    async (collaboratorId: string): Promise<MutationResult> => {
      if (!checkUserPermission(currentUser, 'can_manage_collaborators')) {
        return { success: false, message: 'Acesso negado: permissão can_manage_collaborators exigida.' };
      }

      if (isSupabaseConfigured) {
        await supabase.from('collaborator_checklists').delete().eq('collaborator_id', collaboratorId);
        await supabase.from('survey_responses').delete().eq('collaborator_id', collaboratorId);
        await supabase.from('portal_users').delete().eq('collaborator_id', collaboratorId);
        const { error } = await supabase.from('collaborators').delete().eq('id', collaboratorId);
        if (error) {
          console.error('Erro ao excluir colaborador no Supabase:', error);
          showToast('Erro ao excluir colaborador no banco: ' + error.message, 'error');
          return { success: false, message: 'Erro ao excluir colaborador no banco: ' + error.message };
        }
      }

      setCollaboratorChecklists((prev) => prev.filter((a) => a.collaboratorId !== collaboratorId));
      setCollaborators((prev) => prev.filter((c) => c.id !== collaboratorId));
      setLearningTracks((prev) =>
        prev.map((t) => ({
          ...t,
          collaboratorIds: t.collaboratorIds.filter((id) => id !== collaboratorId),
        }))
      );
      setUsers((prev) => prev.filter((u) => u.collaboratorId !== collaboratorId));
      appendAudit('Exclusão de Colaborador', 'Colaboradores', `ID: ${collaboratorId}`, 'Sucesso');
      return { success: true, message: 'Colaborador excluído com sucesso.' };
    },
    [currentUser, appendAudit, showToast]
  );

  // ==========================================
  // 6. Trilhas de Aprendizagem Dinâmicas (CRUD)
  // ==========================================
  const createLearningTrack = useCallback(
    async (payload: {
      title: string;
      description: string;
      cell: string;
      checklistIds: string[];
      surveyId?: string;
      collaboratorIds?: string[];
    }): Promise<MutationResult & { trackId?: string }> => {
      if (!checkUserPermission(currentUser, 'can_manage_checklists') && currentUser?.role !== 'admin') {
        return { success: false, message: 'Acesso negado: permissão necessária para criar trilhas.' };
      }
      if (!payload.title.trim()) {
        return { success: false, message: 'O título da trilha é obrigatório.' };
      }
      const nowIso = new Date().toISOString();
      const trackId = `track-${Date.now()}`;
      const newTrack: LearningTrack = {
        id: trackId,
        title: payload.title.trim(),
        description: payload.description.trim(),
        cell: payload.cell || 'Laboratório',
        checklistIds: payload.checklistIds || [],
        surveyId: payload.surveyId || undefined,
        collaboratorIds: payload.collaboratorIds || [],
        isActive: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      setLearningTracks((prev) => [newTrack, ...prev]);

      if (payload.collaboratorIds && payload.collaboratorIds.length > 0) {
        setCollaborators((prev) =>
          prev.map((col) =>
            payload.collaboratorIds!.includes(col.id)
              ? { ...col, learningTrackId: trackId, updatedAt: nowIso }
              : col
          )
        );

        if (payload.checklistIds && payload.checklistIds.length > 0) {
          const newAssignments: CollaboratorChecklist[] = [];
          for (const collabId of payload.collaboratorIds) {
            for (let i = 0; i < payload.checklistIds.length; i++) {
              const chkId = payload.checklistIds[i];
              newAssignments.push({
                id: `asg-${Date.now()}-${collabId}-${i}`,
                collaboratorId: collabId,
                checklistId: chkId,
                status: 'pendente',
                finalScore: null,
                criteriaAnswers: [],
                instructorAuxiliarId: null,
                actorAuxiliarId: null,
                completedAt: null,
                createdAt: nowIso,
                updatedAt: nowIso,
              });
            }
          }
          setCollaboratorChecklists((prev) => [...newAssignments, ...prev]);
        }
      }

      appendAudit('Criação de Trilha de Aprendizagem', 'Trilhas', newTrack.title, 'Sucesso');
      return { success: true, message: 'Trilha criada com sucesso!', trackId };
    },
    [currentUser, appendAudit]
  );

  const updateLearningTrack = useCallback(
    async (id: string, payload: Partial<LearningTrack>): Promise<MutationResult> => {
      if (!checkUserPermission(currentUser, 'can_manage_checklists') && currentUser?.role !== 'admin') {
        return { success: false, message: 'Acesso negado: permissão necessária para editar trilhas.' };
      }
      const nowIso = new Date().toISOString();
      setLearningTracks((prev) =>
        prev.map((t) => (t.id === id ? { ...t, ...payload, updatedAt: nowIso } : t))
      );
      appendAudit('Edição de Trilha de Aprendizagem', 'Trilhas', `ID: ${id}`, 'Sucesso');
      return { success: true, message: 'Trilha atualizada com sucesso!' };
    },
    [currentUser, appendAudit]
  );

  const deleteLearningTrack = useCallback(
    async (id: string): Promise<MutationResult> => {
      if (!checkUserPermission(currentUser, 'can_manage_checklists') && currentUser?.role !== 'admin') {
        return { success: false, message: 'Acesso negado: permissão necessária para excluir trilhas.' };
      }
      setLearningTracks((prev) => prev.filter((t) => t.id !== id));
      setCollaborators((prev) =>
        prev.map((col) => (col.learningTrackId === id ? { ...col, learningTrackId: undefined } : col))
      );
      appendAudit('Exclusão de Trilha de Aprendizagem', 'Trilhas', `ID: ${id}`, 'Sucesso');
      return { success: true, message: 'Trilha excluída com sucesso!' };
    },
    [currentUser, appendAudit]
  );

  const enrollCollaboratorInTrack = useCallback(
    async (trackId: string, collaboratorId: string): Promise<MutationResult> => {
      const nowIso = new Date().toISOString();
      setLearningTracks((prev) =>
        prev.map((t) =>
          t.id === trackId
            ? {
                ...t,
                collaboratorIds: Array.from(new Set([...t.collaboratorIds, collaboratorId])),
                updatedAt: nowIso,
              }
            : t
        )
      );
      setCollaborators((prev) =>
        prev.map((col) =>
          col.id === collaboratorId ? { ...col, learningTrackId: trackId, updatedAt: nowIso } : col
        )
      );

      const targetTrack = learningTracks.find((t) => t.id === trackId);
      if (targetTrack && targetTrack.checklistIds.length > 0) {
        setCollaboratorChecklists((prev) => {
          const existingChkIds = new Set(
            prev.filter((c) => c.collaboratorId === collaboratorId).map((c) => c.checklistId)
          );
          const newEntries: CollaboratorChecklist[] = targetTrack.checklistIds
            .filter((chkId) => !existingChkIds.has(chkId))
            .map((chkId, idx) => ({
              id: `asg-${Date.now()}-${idx}`,
              collaboratorId,
              checklistId: chkId,
              status: 'pendente',
              finalScore: null,
              criteriaAnswers: [],
              instructorAuxiliarId: null,
              actorAuxiliarId: null,
              completedAt: null,
              createdAt: nowIso,
              updatedAt: nowIso,
            }));
          return [...prev, ...newEntries];
        });
      }

      return { success: true, message: 'Colaborador matriculado na trilha com sucesso!' };
    },
    [learningTracks]
  );

  const unenrollCollaboratorFromTrack = useCallback(
    async (trackId: string, collaboratorId: string): Promise<MutationResult> => {
      const nowIso = new Date().toISOString();
      setLearningTracks((prev) =>
        prev.map((t) =>
          t.id === trackId
            ? {
                ...t,
                collaboratorIds: t.collaboratorIds.filter((id) => id !== collaboratorId),
                updatedAt: nowIso,
              }
            : t
        )
      );
      setCollaborators((prev) =>
        prev.map((col) =>
          col.id === collaboratorId && col.learningTrackId === trackId
            ? { ...col, learningTrackId: undefined, updatedAt: nowIso }
            : col
        )
      );
      return { success: true, message: 'Colaborador desmatriculado da trilha.' };
    },
    []
  );

  // ==========================================
  // 7. Pesquisas de Satisfação Dinâmicas
  // ==========================================
  const createSurvey = useCallback(
    async (payload: {
      title: string;
      description: string;
      targetCell?: string;
      visibility?: VisibilityLevel;
      questions: SurveyQuestion[];
    }): Promise<MutationResult & { surveyId?: string }> => {
      if (!checkUserPermission(currentUser, 'can_manage_checklists') && currentUser?.role !== 'admin') {
        return { success: false, message: 'Acesso negado: permissão necessária para criar pesquisas.' };
      }
      if (!payload.title.trim()) {
        return { success: false, message: 'O título da pesquisa é obrigatório.' };
      }
      if (!payload.questions || payload.questions.length === 0) {
        return { success: false, message: 'Adicione pelo menos 1 pergunta à pesquisa.' };
      }

      const nowIso = new Date().toISOString();
      const surveyId = `survey-${Date.now()}`;
      const newSurvey: Survey = {
        id: surveyId,
        title: payload.title.trim(),
        description: payload.description.trim(),
        targetCell: payload.targetCell || 'Todas',
        visibility: payload.visibility || 'padrao',
        questions: payload.questions,
        isActive: true,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      setSurveys((prev) => [newSurvey, ...prev]);

      if (isSupabaseConfigured) {
        const { error } = await supabase.from('surveys').insert({
          id: newSurvey.id,
          title: newSurvey.title,
          description: newSurvey.description,
          target_cell: newSurvey.targetCell,
          visibility: newSurvey.visibility || 'padrao',
          questions: newSurvey.questions,
          is_active: newSurvey.isActive,
          created_at: newSurvey.createdAt,
          updated_at: newSurvey.updatedAt,
        });
        if (error) {
          console.error('Erro ao criar pesquisa no Supabase:', error);
        }
      }

      appendAudit('Criação de Pesquisa de Satisfação', 'Pesquisas', newSurvey.title, 'Sucesso');
      return { success: true, message: 'Pesquisa criada com sucesso!', surveyId };
    },
    [currentUser, appendAudit]
  );

  const updateSurvey = useCallback(
    async (id: string, payload: Partial<Survey>): Promise<MutationResult> => {
      if (!checkUserPermission(currentUser, 'can_manage_checklists') && currentUser?.role !== 'admin') {
        return { success: false, message: 'Acesso negado: permissão necessária para editar pesquisas.' };
      }
      const nowIso = new Date().toISOString();
      const existing = surveys.find((s) => s.id === id);
      const updatedSurvey: Survey | null = existing
        ? { ...existing, ...payload, updatedAt: nowIso }
        : null;

      setSurveys((prev) =>
        prev.map((s) => (s.id === id ? { ...s, ...payload, updatedAt: nowIso } : s))
      );

      if (isSupabaseConfigured && updatedSurvey) {
        const { error } = await supabase.from('surveys').upsert({
          id: updatedSurvey.id,
          title: updatedSurvey.title,
          description: updatedSurvey.description,
          target_cell: updatedSurvey.targetCell || 'Todas',
          visibility: updatedSurvey.visibility || 'padrao',
          questions: updatedSurvey.questions,
          is_active: updatedSurvey.isActive ?? true,
          created_at: updatedSurvey.createdAt || nowIso,
          updated_at: nowIso,
        });
        if (error) {
          console.error('Erro ao atualizar pesquisa no Supabase:', error);
        }
      }

      appendAudit('Edição de Pesquisa de Satisfação', 'Pesquisas', `ID: ${id}`, 'Sucesso');
      return { success: true, message: 'Pesquisa atualizada com sucesso!' };
    },
    [currentUser, surveys, appendAudit]
  );

  const deleteSurvey = useCallback(
    async (id: string): Promise<MutationResult> => {
      if (!checkUserPermission(currentUser, 'can_manage_checklists') && currentUser?.role !== 'admin') {
        return { success: false, message: 'Acesso negado: permissão necessária para excluir pesquisas.' };
      }

      if (isSupabaseConfigured) {
        await supabase.from('survey_responses').delete().eq('survey_id', id);
        const { error } = await supabase.from('surveys').delete().eq('id', id);
        if (error) {
          console.error('Erro ao excluir pesquisa no Supabase:', error);
        }
      }

      setSurveys((prev) => prev.filter((s) => s.id !== id));
      setLearningTracks((prev) =>
        prev.map((t) => (t.surveyId === id ? { ...t, surveyId: undefined } : t))
      );
      appendAudit('Exclusão de Pesquisa de Satisfação', 'Pesquisas', `ID: ${id}`, 'Sucesso');
      return { success: true, message: 'Pesquisa excluída com sucesso!' };
    },
    [currentUser, appendAudit]
  );

  const submitSurveyResponse = useCallback(
    async (payload: {
      surveyId: string;
      collaboratorId: string;
      answers: Record<string, SurveyAnswerItem>;
    }): Promise<MutationResult> => {
      const targetSurvey = surveys.find((s) => s.id === payload.surveyId);
      if (!targetSurvey) {
        return { success: false, message: 'Pesquisa não encontrada.' };
      }

      const collab = collaborators.find((c) => c.id === payload.collaboratorId);
      const nowIso = new Date().toISOString();
      const responseId = `resp-${Date.now()}`;
      const newResponse: SurveyResponse = {
        id: responseId,
        surveyId: payload.surveyId,
        collaboratorId: payload.collaboratorId,
        collaboratorName: collab ? collab.fullName : currentUser?.fullName || 'Colaborador',
        collaboratorUsername: collab ? collab.username || '' : currentUser?.username || '',
        cellTeam: collab ? collab.cellTeam : currentUser?.department || 'Laboratório',
        answers: payload.answers,
        completedAt: nowIso,
      };

      setSurveyResponses((prev) => [newResponse, ...prev]);

      let updatedCollabForDb: Collaborator | null = null;
      if (collab) {
        const currentTrack = collab.track || [];
        const stepIndex = currentTrack.findIndex(
          (s) => s.type === 'survey' && s.refId === payload.surveyId
        );
        if (stepIndex !== -1) {
          const updatedTrack = currentTrack.map((step, idx) => {
            if (idx === stepIndex) {
              return {
                ...step,
                status: 'concluido' as const,
                completedAt: nowIso,
                surveyResponseId: responseId,
              };
            }
            if (idx === stepIndex + 1 && step.status === 'bloqueado') {
              return { ...step, status: 'disponivel' as const };
            }
            return step;
          });
          updatedCollabForDb = { ...collab, track: updatedTrack, updatedAt: nowIso };
        }
      }

      // Sincroniza a etapa correspondente de pesquisa na trilha do colaborador (se houver)
      setCollaborators((prev) =>
        prev.map((col) => {
          if (col.id !== payload.collaboratorId) return col;
          const currentTrack = col.track || [];
          const stepIndex = currentTrack.findIndex(
            (s) => s.type === 'survey' && s.refId === payload.surveyId
          );
          if (stepIndex === -1) return col;

          const updatedTrack = currentTrack.map((step, idx) => {
            if (idx === stepIndex) {
              return {
                ...step,
                status: 'concluido' as const,
                completedAt: nowIso,
                surveyResponseId: responseId,
              };
            }
            if (idx === stepIndex + 1 && step.status === 'bloqueado') {
              return { ...step, status: 'disponivel' as const };
            }
            return step;
          });

          return { ...col, track: updatedTrack, updatedAt: nowIso };
        })
      );

      if (isSupabaseConfigured) {
        const { error: respErr } = await supabase.from('survey_responses').insert({
          id: newResponse.id,
          survey_id: newResponse.surveyId,
          collaborator_id: newResponse.collaboratorId,
          collaborator_name: newResponse.collaboratorName,
          collaborator_username: newResponse.collaboratorUsername,
          cell_team: newResponse.cellTeam,
          answers: newResponse.answers,
          completed_at: newResponse.completedAt,
        });
        if (respErr) {
          console.error('Erro ao salvar resposta de pesquisa no Supabase:', respErr);
        }

        if (updatedCollabForDb) {
          await supabase
            .from('collaborators')
            .upsert(mapCollaboratorToDbRow(updatedCollabForDb));
        }
      }

      appendAudit(
        'Resposta de Pesquisa de Satisfação',
        'Pesquisas',
        `${targetSurvey.title} - ${newResponse.collaboratorName}`,
        'Sucesso'
      );
      return { success: true, message: 'Obrigado! Sua resposta foi registrada com sucesso.' };
    },
    [surveys, collaborators, currentUser, appendAudit]
  );

  const updateCollaboratorTrack = useCallback(
    async (collaboratorId: string, steps: CollaboratorTrackStep[]): Promise<MutationResult> => {
      if (!checkUserPermission(currentUser, 'can_manage_collaborators')) {
        return { success: false, message: 'Acesso negado para gerenciar a trilha do colaborador.' };
      }

      const targetCollab = collaborators.find((c) => c.id === collaboratorId);
      if (!targetCollab) {
        return { success: false, message: 'Colaborador não encontrado.' };
      }
      if (targetCollab.isTrackFinalized) {
        return {
          success: false,
          message: 'Esta trilha já foi finalizada pelo Guardião Anfitrião. Alterações estruturais estão bloqueadas.',
        };
      }

      const nowIso = new Date().toISOString();

      // Recalcula ordem e status sequencial:
      // A primeira etapa não-concluída fica 'disponivel', todas as seguintes ficam 'bloqueado'
      let foundFirstPending = false;
      const normalizedSteps: CollaboratorTrackStep[] = steps.map((step, idx) => {
        const order = idx + 1;
        if (step.status === 'concluido') {
          return { ...step, order };
        }
        if (!foundFirstPending) {
          foundFirstPending = true;
          return { ...step, order, status: 'disponivel' as const };
        }
        return { ...step, order, status: 'bloqueado' as const };
      });

      const updatedCollab: Collaborator = {
        ...targetCollab,
        track: normalizedSteps,
        updatedAt: nowIso,
      };

      setCollaborators((prev) =>
        prev.map((c) => (c.id === collaboratorId ? updatedCollab : c))
      );

      // Sincroniza collaboratorChecklists para compatibilidade com avaliações e histórico
      const checklistSteps = normalizedSteps.filter((s) => s.type === 'checklist');
      const currentCollabChecklists = collaboratorChecklists.filter(
        (asg) => asg.collaboratorId === collaboratorId
      );
      const newOrUpdatedAssignments: CollaboratorChecklist[] = checklistSteps.map((step) => {
        const existing = currentCollabChecklists.find(
          (asg) => asg.checklistId === step.refId || asg.id === step.collaboratorChecklistId
        );
        if (existing) {
          return {
            ...existing,
            status: step.status === 'concluido' ? ('concluido' as const) : ('pendente' as const),
            finalScore: typeof step.finalScore === 'number' ? step.finalScore : existing.finalScore,
            completedAt: step.completedAt || existing.completedAt,
            updatedAt: nowIso,
          };
        }
        return {
          id: step.collaboratorChecklistId || `asg-${Date.now()}-${step.order}`,
          collaboratorId,
          checklistId: step.refId,
          status: step.status === 'concluido' ? ('concluido' as const) : ('pendente' as const),
          finalScore: step.finalScore || null,
          criteriaAnswers: [],
          instructorAuxiliarId: null,
          actorAuxiliarId: null,
          completedAt: step.completedAt || null,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
      });

      if (checklistSteps.length > 0) {
        setCollaboratorChecklists((prev) => {
          const others = prev.filter((asg) => asg.collaboratorId !== collaboratorId);
          return [...others, ...newOrUpdatedAssignments];
        });
      }

      if (isSupabaseConfigured) {
        const { error: trackErr } = await supabase
          .from('collaborators')
          .upsert(mapCollaboratorToDbRow(updatedCollab));
        if (trackErr) {
          console.error('Erro ao salvar trilha do colaborador no Supabase:', trackErr);
        }

        if (newOrUpdatedAssignments.length > 0) {
          await supabase.from('collaborator_checklists').upsert(
            newOrUpdatedAssignments.map((asg) => ({
              id: asg.id,
              collaborator_id: asg.collaboratorId,
              checklist_id: asg.checklistId,
              status: asg.status,
              final_score: asg.finalScore,
              criteria_answers: asg.criteriaAnswers,
              general_observations: asg.generalObservations || '',
              instructor_auxiliar_id: asg.instructorAuxiliarId,
              actor_auxiliar_id: asg.actorAuxiliarId,
              completed_at: asg.completedAt,
              created_at: asg.createdAt,
              updated_at: asg.updatedAt,
            }))
          );
        }
      }

      appendAudit('Edição da Trilha do Colaborador', 'Trilhas', `Colaborador: ${collaboratorId}`, 'Sucesso');
      return { success: true, message: 'Trilha do colaborador atualizada com sucesso!' };
    },
    [currentUser, collaborators, collaboratorChecklists, appendAudit]
  );

  const addStepToCollaboratorTrack = useCallback(
    async (
      collaboratorId: string,
      step: Omit<CollaboratorTrackStep, 'id' | 'order' | 'status' | 'filledBy'> & {
        filledBy?: CollaboratorTrackStep['filledBy'];
      }
    ): Promise<MutationResult> => {
      const collab = collaborators.find((c) => c.id === collaboratorId);
      if (!collab) return { success: false, message: 'Colaborador não encontrado.' };
      if (collab.isTrackFinalized) {
        return {
          success: false,
          message: 'Esta trilha já foi finalizada pelo Guardião Anfitrião. Alterações estruturais estão bloqueadas.',
        };
      }

      const currentTrack = collab.track || [];
      const alreadyExists = currentTrack.some(
        (s) => s.type === step.type && s.refId === step.refId
      );
      if (alreadyExists) {
        return {
          success: false,
          message: 'Esta atividade já está vinculada na trilha deste colaborador.',
        };
      }

      const newStepId = `trk-step-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const hasAnyIncomplete = currentTrack.some((s) => s.status !== 'concluido');
      const resolvedFilledBy =
        step.filledBy || (step.type === 'checklist' ? 'evaluator' : 'collaborator');

      const newStep: CollaboratorTrackStep = {
        id: newStepId,
        type: step.type,
        title: step.title,
        refId: step.refId,
        filledBy: resolvedFilledBy,
        order: currentTrack.length + 1,
        status: currentTrack.length === 0 || !hasAnyIncomplete ? 'disponivel' : 'bloqueado',
        completedAt: null,
        finalScore: null,
        collaboratorChecklistId: step.type === 'checklist' ? `asg-${Date.now()}` : undefined,
      };

      const updatedTrack = [...currentTrack, newStep];
      return updateCollaboratorTrack(collaboratorId, updatedTrack);
    },
    [collaborators, updateCollaboratorTrack]
  );

  const removeStepFromCollaboratorTrack = useCallback(
    async (collaboratorId: string, stepId: string): Promise<MutationResult> => {
      const collab = collaborators.find((c) => c.id === collaboratorId);
      if (!collab) return { success: false, message: 'Colaborador não encontrado.' };
      if (collab.isTrackFinalized) {
        return {
          success: false,
          message: 'Esta trilha já foi finalizada pelo Guardião Anfitrião. Alterações estruturais estão bloqueadas.',
        };
      }

      const updatedTrack = (collab.track || []).filter((s) => s.id !== stepId);
      return updateCollaboratorTrack(collaboratorId, updatedTrack);
    },
    [collaborators, updateCollaboratorTrack]
  );

  const saveTrackTemplate = useCallback(
    async (
      name: string,
      cell: string,
      steps: TrackTemplateStep[]
    ): Promise<MutationResult & { template?: TrackTemplate }> => {
      if (!checkUserPermission(currentUser, 'can_manage_collaborators')) {
        return { success: false, message: 'Acesso negado para salvar modelos de trilha.' };
      }

      const trimmedName = name.trim();
      if (!trimmedName) {
        return { success: false, message: 'Informe um nome para o modelo de trilha.' };
      }

      if (!Array.isArray(steps) || steps.length === 0) {
        return {
          success: false,
          message: 'Adicione ao menos uma etapa antes de salvar como modelo.',
        };
      }

      const cleanSteps: TrackTemplateStep[] = steps.map((s) => ({
        type: s.type,
        refId: s.refId,
        filledBy: s.filledBy || (s.type === 'checklist' ? 'evaluator' : 'collaborator'),
      }));

      const newTemplate: TrackTemplate = {
        id: `tpl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        name: trimmedName,
        cell: cell.trim() || 'Geral',
        steps: cleanSteps,
        createdAt: new Date().toISOString(),
      };

      const nextTemplates = [newTemplate, ...trackTemplates];
      setTrackTemplates(nextTemplates);

      if (isSupabaseConfigured) {
        const { error } = await supabase.from('portal_settings').upsert({
          key: 'track_templates',
          value: nextTemplates,
          updated_at: new Date().toISOString(),
        });
        if (error) {
          console.error('Erro ao salvar modelos de trilha no Supabase:', error);
        }
      }

      appendAudit(
        'Criação de Modelo de Trilha',
        'Trilhas',
        `Modelo "${newTemplate.name}" (${cleanSteps.length} etapas)`,
        'Sucesso'
      );

      return {
        success: true,
        message: `Modelo "${newTemplate.name}" salvo com sucesso!`,
        template: newTemplate,
      };
    },
    [currentUser, trackTemplates, appendAudit]
  );

  const deleteTrackTemplate = useCallback(
    async (templateId: string): Promise<MutationResult> => {
      if (!checkUserPermission(currentUser, 'can_manage_collaborators')) {
        return { success: false, message: 'Acesso negado para excluir modelos de trilha.' };
      }

      const target = trackTemplates.find((t) => t.id === templateId);
      const nextTemplates = trackTemplates.filter((t) => t.id !== templateId);
      setTrackTemplates(nextTemplates);

      if (isSupabaseConfigured) {
        const { error } = await supabase.from('portal_settings').upsert({
          key: 'track_templates',
          value: nextTemplates,
          updated_at: new Date().toISOString(),
        });
        if (error) {
          console.error('Erro ao atualizar modelos de trilha no Supabase:', error);
        }
      }

      appendAudit(
        'Exclusão de Modelo de Trilha',
        'Trilhas',
        `Modelo: ${target?.name || templateId}`,
        'Sucesso'
      );

      return { success: true, message: 'Modelo de trilha removido com sucesso.' };
    },
    [currentUser, trackTemplates, appendAudit]
  );

  const completeCollaboratorTrackStep = useCallback(
    async (
      collaboratorId: string,
      stepId: string,
      resultData?: {
        finalScore?: number | null;
        collaboratorChecklistId?: string | null;
        surveyResponseId?: string | null;
      }
    ): Promise<MutationResult> => {
      const nowIso = new Date().toISOString();

      let targetCollab = collaborators.find((c) => c.id === collaboratorId);
      if (!targetCollab) {
        return { success: false, message: 'Colaborador não encontrado.' };
      }

      const currentTrack = targetCollab.track || [];
      const stepIndex = currentTrack.findIndex((s) => s.id === stepId);
      if (stepIndex === -1) {
        return { success: false, message: 'Etapa não encontrada na trilha do colaborador.' };
      }

      const updatedTrack = currentTrack.map((step, idx) => {
        if (idx === stepIndex) {
          return {
            ...step,
            status: 'concluido' as const,
            completedAt: nowIso,
            finalScore: typeof resultData?.finalScore === 'number' ? resultData.finalScore : step.finalScore,
            collaboratorChecklistId: resultData?.collaboratorChecklistId || step.collaboratorChecklistId,
            surveyResponseId: resultData?.surveyResponseId || step.surveyResponseId,
          };
        }
        // Desbloqueia automaticamente a próxima etapa imediata se estiver bloqueada
        if (idx === stepIndex + 1 && step.status === 'bloqueado') {
          return {
            ...step,
            status: 'disponivel' as const,
          };
        }
        return step;
      });

      const updatedCollab: Collaborator = {
        ...targetCollab,
        track: updatedTrack,
        updatedAt: nowIso,
      };

      // Atualiza o colaborador com a nova trilha
      setCollaborators((prev) =>
        prev.map((c) => (c.id === collaboratorId ? updatedCollab : c))
      );

      if (isSupabaseConfigured) {
        await supabase
          .from('collaborators')
          .upsert(mapCollaboratorToDbRow(updatedCollab));
      }

      appendAudit('Conclusão de Etapa da Trilha', 'Trilhas', `Etapa: ${currentTrack[stepIndex].title}`, 'Sucesso');
      return { success: true, message: 'Etapa concluída e próxima etapa desbloqueada com sucesso!' };
    },
    [collaborators, appendAudit]
  );

  const submitCollaboratorChecklistSelfAssessment = useCallback(
    async (payload: {
      collaboratorId: string;
      stepId: string;
      checklistId: string;
      criteriaAnswers: CriteriaAnswerSnapshot[];
      generalObservations?: string;
    }): Promise<MutationResult> => {
      if (!currentUser) {
        return { success: false, message: 'Sessão expirada. Faça login novamente.' };
      }

      const targetCollab = collaborators.find((c) => c.id === payload.collaboratorId);
      if (!targetCollab) {
        return { success: false, message: 'Colaborador não encontrado.' };
      }

      if (targetCollab.isTrackFinalized) {
        return {
          success: false,
          message: 'Esta trilha já foi finalizada e não aceita novos preenchimentos.',
        };
      }

      const targetStep = (targetCollab.track || []).find((s) => s.id === payload.stepId);
      if (
        !targetStep ||
        targetStep.type !== 'checklist' ||
        targetStep.status !== 'disponivel' ||
        targetStep.filledBy !== 'collaborator'
      ) {
        return {
          success: false,
          message: 'Este checklist não está liberado para preenchimento pelo colaborador.',
        };
      }

      const nowIso = new Date().toISOString();
      const computedScore = calculateWeightedScore(payload.criteriaAnswers);
      const trimmedObs = payload.generalObservations?.trim() || null;

      const existingAssignment = collaboratorChecklists.find(
        (a) =>
          (targetStep.collaboratorChecklistId && a.id === targetStep.collaboratorChecklistId) ||
          (a.collaboratorId === payload.collaboratorId && a.checklistId === payload.checklistId)
      );

      const assignmentId =
        existingAssignment?.id ||
        targetStep.collaboratorChecklistId ||
        `asg-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

      if (existingAssignment) {
        setCollaboratorChecklists((prev) =>
          prev.map((a) =>
            a.id === existingAssignment.id
              ? {
                  ...a,
                  status: 'concluido',
                  finalScore: computedScore,
                  criteriaAnswers: payload.criteriaAnswers,
                  generalObservations: trimmedObs ?? a.generalObservations,
                  completedAt: nowIso,
                  updatedAt: nowIso,
                }
              : a
          )
        );
      } else {
        const createdAssignment: CollaboratorChecklist = {
          id: assignmentId,
          collaboratorId: payload.collaboratorId,
          checklistId: payload.checklistId,
          status: 'concluido',
          finalScore: computedScore,
          criteriaAnswers: payload.criteriaAnswers,
          generalObservations: trimmedObs,
          instructorAuxiliarId: null,
          actorAuxiliarId: null,
          completedAt: nowIso,
          createdAt: nowIso,
          updatedAt: nowIso,
        };
        setCollaboratorChecklists((prev) => [createdAssignment, ...prev]);
      }

      if (isSupabaseConfigured) {
        try {
          await supabase.from('collaborator_checklists').upsert({
            id: assignmentId,
            collaborator_id: payload.collaboratorId,
            checklist_id: payload.checklistId,
            status: 'concluido',
            final_score: computedScore,
            criteria_answers: payload.criteriaAnswers,
            general_observations: trimmedObs,
            completed_at: nowIso,
            updated_at: nowIso,
          });
        } catch (err) {
          console.warn('Erro ao sincronizar autoavaliação de checklist no Supabase:', err);
        }
      }

      await completeCollaboratorTrackStep(payload.collaboratorId, payload.stepId, {
        finalScore: computedScore,
        collaboratorChecklistId: assignmentId,
      });

      appendAudit(
        'Preenchimento de Checklist pelo Colaborador',
        'Trilhas',
        `${targetCollab.fullName} — Etapa: ${targetStep.title}`,
        'Sucesso'
      );

      return {
        success: true,
        message: 'Checklist enviado com sucesso! Sua próxima etapa foi liberada.',
      };
    },
    [
      currentUser,
      collaborators,
      collaboratorChecklists,
      completeCollaboratorTrackStep,
      appendAudit,
    ]
  );

  const finalizeCollaboratorTrack = useCallback(
    async (
      collaboratorId: string,
      payload: { verdict: 'aprovado' | 'necessita_reforco'; opinion: string }
    ): Promise<MutationResult> => {
      if (!currentUser || (currentUser.role !== 'admin' && !isGuardianHostUser(currentUser))) {
        return {
          success: false,
          message: 'Acesso negado: apenas Administradores ou Guardiões Anfitriões podem finalizar trilhas e emitir parecer final.',
        };
      }
      const targetCollab = collaborators.find((c) => c.id === collaboratorId);
      if (!targetCollab) {
        return { success: false, message: 'Colaborador não encontrado.' };
      }
      const trimmedOpinion = payload.opinion.trim();
      if (!trimmedOpinion) {
        return { success: false, message: 'O texto do parecer conclusivo é obrigatório.' };
      }

      const nowIso = new Date().toISOString();
      const finalizedByLabel = `${currentUser.fullName} (@${currentUser.username})`;
      const updatedCollab: Collaborator = {
        ...targetCollab,
        isTrackFinalized: true,
        guardianVerdict: payload.verdict,
        guardianOpinion: trimmedOpinion,
        guardianFinalizedBy: finalizedByLabel,
        guardianFinalizedAt: nowIso,
        status: payload.verdict,
        updatedAt: nowIso,
      };

      setCollaborators((prev) =>
        prev.map((col) => (col.id === collaboratorId ? updatedCollab : col))
      );

      if (isSupabaseConfigured) {
        const { error } = await supabase
          .from('collaborators')
          .upsert(mapCollaboratorToDbRow(updatedCollab));
        if (error) {
          console.error('Erro ao finalizar trilha no Supabase:', error);
        }
      }

      appendAudit(
        'Finalização de Trilha',
        'Trilhas',
        `${targetCollab.fullName} — Parecer: ${payload.verdict === 'aprovado' ? 'Aprovado' : 'Validação da liderança'} por ${finalizedByLabel}`,
        'Sucesso'
      );
      return {
        success: true,
        message: 'Trilha finalizada e parecer oficial emitido com sucesso!',
      };
    },
    [currentUser, collaborators, appendAudit]
  );

  const reopenCollaboratorTrack = useCallback(
    async (collaboratorId: string): Promise<MutationResult> => {
      if (currentUser?.role !== 'admin') {
        return {
          success: false,
          message: 'Acesso negado: apenas Administradores podem reabrir uma trilha finalizada.',
        };
      }
      const targetCollab = collaborators.find((c) => c.id === collaboratorId);
      if (!targetCollab) {
        return { success: false, message: 'Colaborador não encontrado.' };
      }
      const nowIso = new Date().toISOString();
      const updatedCollab: Collaborator = {
        ...targetCollab,
        isTrackFinalized: false,
        updatedAt: nowIso,
      };

      setCollaborators((prev) =>
        prev.map((col) => (col.id === collaboratorId ? updatedCollab : col))
      );

      if (isSupabaseConfigured) {
        const { error } = await supabase
          .from('collaborators')
          .upsert(mapCollaboratorToDbRow(updatedCollab));
        if (error) {
          console.error('Erro ao reabrir trilha no Supabase:', error);
        }
      }

      appendAudit(
        'Reabertura de Trilha Finalizada',
        'Trilhas',
        `${targetCollab.fullName} reaberto pelo Administrador`,
        'Sucesso'
      );
      return { success: true, message: 'Trilha reaberta para ajustes administrativos.' };
    },
    [currentUser, collaborators, appendAudit]
  );

  const updateCollaboratorChecklistAssignments = useCallback(
    async (collaboratorId: string, checklistIds: string[]): Promise<MutationResult> => {
      if (!checkUserPermission(currentUser, 'can_manage_collaborators')) {
        return { success: false, message: 'Acesso negado para gerenciar vínculos.' };
      }

      const targetCollab = collaborators.find((c) => c.id === collaboratorId);
      if (targetCollab?.isTrackFinalized) {
        return {
          success: false,
          message: 'Esta trilha já foi finalizada pelo Guardião Anfitrião. Não é possível alterar vínculos.',
        };
      }

      const nowIso = new Date().toISOString();
      const existingChkIds = new Set(
        collaboratorChecklists
          .filter((asg) => asg.collaboratorId === collaboratorId)
          .map((a) => a.checklistId)
      );
      const removedAssignmentIds = collaboratorChecklists
        .filter((asg) => asg.collaboratorId === collaboratorId && !checklistIds.includes(asg.checklistId))
        .map((asg) => asg.id);

      const newEntries: CollaboratorChecklist[] = checklistIds
        .filter((chkId) => !existingChkIds.has(chkId))
        .map((chkId, idx) => ({
          id: `asg-${Date.now()}-${idx}`,
          collaboratorId,
          checklistId: chkId,
          status: 'pendente',
          finalScore: null,
          criteriaAnswers: [],
          instructorAuxiliarId: null,
          actorAuxiliarId: null,
          completedAt: null,
          createdAt: nowIso,
          updatedAt: nowIso,
        }));

      setCollaboratorChecklists((prev) => {
        const preserved = prev.filter(
          (asg) => asg.collaboratorId !== collaboratorId || checklistIds.includes(asg.checklistId)
        );
        return [...preserved, ...newEntries];
      });

      if (isSupabaseConfigured) {
        if (removedAssignmentIds.length > 0) {
          await supabase.from('collaborator_checklists').delete().in('id', removedAssignmentIds);
        }
        if (newEntries.length > 0) {
          await supabase.from('collaborator_checklists').upsert(
            newEntries.map((asg) => ({
              id: asg.id,
              collaborator_id: asg.collaboratorId,
              checklist_id: asg.checklistId,
              status: asg.status,
              final_score: asg.finalScore,
              criteria_answers: asg.criteriaAnswers,
              general_observations: '',
              instructor_auxiliar_id: asg.instructorAuxiliarId,
              actor_auxiliar_id: asg.actorAuxiliarId,
              completed_at: asg.completedAt,
              created_at: asg.createdAt,
              updated_at: asg.updatedAt,
            }))
          );
        }
      }

      appendAudit('Vínculos de Checklists Atualizados', 'Colaboradores', `Colaborador: ${collaboratorId}`, 'Sucesso');
      return { success: true, message: 'Vínculos atualizados com sucesso!' };
    },
    [currentUser, collaborators, collaboratorChecklists, appendAudit]
  );

  const ensureCollaboratorChecklistAssignment = useCallback(
    (collaboratorId: string, checklistId: string, preferredId?: string): string => {
      const existing = collaboratorChecklists.find(
        (c) =>
          (preferredId && c.id === preferredId) ||
          (c.collaboratorId === collaboratorId && c.checklistId === checklistId)
      );
      if (existing) return existing.id;

      const newId = preferredId || `asg-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
      const nowIso = new Date().toISOString();
      const newEntry: CollaboratorChecklist = {
        id: newId,
        collaboratorId,
        checklistId,
        status: 'pendente',
        finalScore: null,
        criteriaAnswers: [],
        instructorAuxiliarId: null,
        actorAuxiliarId: null,
        completedAt: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      setCollaboratorChecklists((prev) => [...prev, newEntry]);

      if (isSupabaseConfigured) {
        void supabase.from('collaborator_checklists').upsert({
          id: newEntry.id,
          collaborator_id: newEntry.collaboratorId,
          checklist_id: newEntry.checklistId,
          status: newEntry.status,
          final_score: null,
          criteria_answers: [],
          general_observations: '',
          instructor_auxiliar_id: null,
          actor_auxiliar_id: null,
          completed_at: null,
          created_at: nowIso,
          updated_at: nowIso,
        });
      }

      return newId;
    },
    [collaboratorChecklists]
  );

  // ==========================================
  // 6. Condução e Execução de Avaliação
  // ==========================================
  const saveEvaluationProgress = useCallback(
    async (payload: {
      collaboratorChecklistId: string;
      instructorAuxiliarId?: string | null;
      criteriaAnswers: CriteriaAnswerSnapshot[];
      finalScore: number;
      generalObservations?: string;
    }): Promise<void> => {
      if (!checkUserPermission(currentUser, 'can_apply_evaluations')) return;

      const nowIso = new Date().toISOString();

      setCollaboratorChecklists((prev) => {
        const next = prev.map((c) =>
          c.id === payload.collaboratorChecklistId
            ? {
                ...c,
                instructorAuxiliarId: payload.instructorAuxiliarId || c.instructorAuxiliarId,
                status: 'em_andamento' as const,
                finalScore: payload.finalScore,
                criteriaAnswers: payload.criteriaAnswers,
                generalObservations:
                  payload.generalObservations !== undefined
                    ? payload.generalObservations
                    : c.generalObservations,
                updatedAt: nowIso,
              }
            : c
        );
        try {
          localStorage.setItem('portal_collaborator_checklists_store', JSON.stringify(next));
        } catch {}
        return next;
      });

      if (isSupabaseConfigured) {
        try {
          await supabase
            .from('collaborator_checklists')
            .update({
              instructor_auxiliar_id: payload.instructorAuxiliarId || null,
              status: 'em_andamento',
              final_score: payload.finalScore,
              criteria_answers: payload.criteriaAnswers,
              general_observations: payload.generalObservations || null,
              updated_at: nowIso,
            })
            .eq('id', payload.collaboratorChecklistId);
        } catch (err) {
          console.warn('Erro ao salvar progresso parcial no Supabase:', err);
        }
      }
    },
    [currentUser]
  );

  const completeEvaluation = useCallback(
    async (payload: {
      collaboratorChecklistId: string;
      instructorAuxiliarId?: string | null;
      actorAuxiliarId?: string | null;
      criteriaAnswers: CriteriaAnswerSnapshot[];
      finalScore: number;
      generalObservations?: string;
      updateCollaboratorStatus?: CollaboratorStatus;
    }): Promise<MutationResult> => {
      if (!checkUserPermission(currentUser, 'can_apply_evaluations')) {
        return { success: false, message: 'Acesso negado: permissão can_apply_evaluations exigida.' };
      }

      const targetAssignment = collaboratorChecklists.find(
        (c) => c.id === payload.collaboratorChecklistId
      );
      if (!targetAssignment) {
        return { success: false, message: 'Atribuição de avaliação não encontrada.' };
      }

      const nowIso = new Date().toISOString();

      setCollaboratorChecklists((prev) =>
        prev.map((c) =>
          c.id === payload.collaboratorChecklistId
            ? {
                ...c,
                instructorAuxiliarId: payload.instructorAuxiliarId || c.instructorAuxiliarId,
                actorAuxiliarId: payload.actorAuxiliarId || c.actorAuxiliarId,
                status: 'concluido',
                finalScore: payload.finalScore,
                criteriaAnswers: payload.criteriaAnswers,
                generalObservations: payload.generalObservations !== undefined ? payload.generalObservations : c.generalObservations,
                completedAt: nowIso,
                updatedAt: nowIso,
              }
            : c
        )
      );

      // Sincroniza a etapa correspondente na trilha individual do colaborador (se existir)
      const targetCollabForDb = collaborators.find((c) => c.id === targetAssignment.collaboratorId);
      let updatedCollabForDb: Collaborator | null = null;
      if (targetCollabForDb) {
        const currentTrack = targetCollabForDb.track || [];
        const stepIndex = currentTrack.findIndex(
          (s) =>
            s.collaboratorChecklistId === targetAssignment.id ||
            s.refId === targetAssignment.checklistId
        );
        if (stepIndex === -1) {
          updatedCollabForDb = payload.updateCollaboratorStatus
            ? { ...targetCollabForDb, status: payload.updateCollaboratorStatus, updatedAt: nowIso }
            : targetCollabForDb;
        } else {
          const updatedTrack = currentTrack.map((step, idx) => {
            if (idx === stepIndex) {
              return {
                ...step,
                status: 'concluido' as const,
                completedAt: nowIso,
                finalScore: payload.finalScore,
                collaboratorChecklistId: targetAssignment.id,
              };
            }
            if (idx === stepIndex + 1 && step.status === 'bloqueado') {
              return { ...step, status: 'disponivel' as const };
            }
            return step;
          });
          updatedCollabForDb = {
            ...targetCollabForDb,
            track: updatedTrack,
            status: payload.updateCollaboratorStatus || targetCollabForDb.status,
            updatedAt: nowIso,
          };
        }
      }

      setCollaborators((prev) =>
        prev.map((col) => {
          if (col.id !== targetAssignment.collaboratorId) return col;
          const currentTrack = col.track || [];
          const stepIndex = currentTrack.findIndex(
            (s) =>
              s.collaboratorChecklistId === targetAssignment.id ||
              s.refId === targetAssignment.checklistId
          );
          if (stepIndex === -1) {
            return payload.updateCollaboratorStatus
              ? { ...col, status: payload.updateCollaboratorStatus, updatedAt: nowIso }
              : col;
          }

          const updatedTrack = currentTrack.map((step, idx) => {
            if (idx === stepIndex) {
              return {
                ...step,
                status: 'concluido' as const,
                completedAt: nowIso,
                finalScore: payload.finalScore,
                collaboratorChecklistId: targetAssignment.id,
              };
            }
            if (idx === stepIndex + 1 && step.status === 'bloqueado') {
              return { ...step, status: 'disponivel' as const };
            }
            return step;
          });

          return {
            ...col,
            track: updatedTrack,
            status: payload.updateCollaboratorStatus || col.status,
            updatedAt: nowIso,
          };
        })
      );

      // Persistência no Supabase (se configurado)
      if (isSupabaseConfigured) {
        try {
          await supabase.from('collaborator_checklists').upsert({
            id: targetAssignment.id,
            collaborator_id: targetAssignment.collaboratorId,
            checklist_id: targetAssignment.checklistId,
            instructor_auxiliar_id: payload.instructorAuxiliarId || targetAssignment.instructorAuxiliarId || null,
            actor_auxiliar_id: payload.actorAuxiliarId || targetAssignment.actorAuxiliarId || null,
            status: 'concluido',
            final_score: payload.finalScore,
            criteria_answers: payload.criteriaAnswers,
            general_observations:
              payload.generalObservations !== undefined
                ? payload.generalObservations
                : targetAssignment.generalObservations || '',
            completed_at: nowIso,
            created_at: targetAssignment.createdAt || nowIso,
            updated_at: nowIso,
          });

          if (updatedCollabForDb) {
            await supabase
              .from('collaborators')
              .upsert(mapCollaboratorToDbRow(updatedCollabForDb));
          }
        } catch (err) {
          console.warn('Erro ao sincronizar avaliação no Supabase:', err);
        }
      }

      appendAudit(
        'Conclusão de Avaliação',
        'Avaliações',
        `Nota ${payload.finalScore.toFixed(1)} registrada para o colaborador ID: ${targetAssignment.collaboratorId}`,
        'Sucesso'
      );
      return { success: true, message: 'Avaliação concluída e registrada com sucesso!' };
    },
    [currentUser, collaboratorChecklists, collaborators, appendAudit]
  );

  // ==========================================
  // 7. Governança e Usuários
  // ==========================================
  const updateRoleDefaultPermissions = useCallback(
    async (role: UserRole, permissions: PermissionKey[]): Promise<MutationResult> => {
      if (!checkUserPermission(currentUser, 'users:manage')) {
        return { success: false, message: 'Acesso negado: permissão users:manage exigida.' };
      }

      const normalizedPerms = role === 'colaborador' ? [] : Array.from(new Set(permissions));
      const nextDefaults = normalizeRoleDefaultPermissions({
        ...roleDefaultPermissions,
        [role]: normalizedPerms,
      });

      setRoleDefaultPermissions(nextDefaults);

      if (isSupabaseConfigured) {
        const { error } = await supabase.from('portal_settings').upsert({
          key: 'roleDefaultPermissions',
          value: nextDefaults,
          updated_at: new Date().toISOString(),
        });
        if (error) {
          console.error('Erro ao salvar padrões de função no Supabase:', error);
        }
      }

      const roleLabel =
        role === 'admin'
          ? 'Administrador'
          : role === 'avaliador'
          ? 'Avaliador'
          : role === 'auxiliar'
          ? 'Auxiliar / Ator'
          : 'Colaborador';

      appendAudit(
        'Atualização de Padrões por Função',
        'Administração',
        `Padrão de ${roleLabel} atualizado (${normalizedPerms.length} permissão(ões))`,
        'Sucesso'
      );

      return {
        success: true,
        message: `Padrões da função ${roleLabel} atualizados com sucesso.`,
      };
    },
    [currentUser, roleDefaultPermissions, appendAudit]
  );

  const updateUserPermissions = useCallback(
    async (payload: {
      targetUserId: string;
      role: UserRole;
      isActive: boolean;
      individualPermissions: PermissionKey[];
      isGuardianHost?: boolean;
    }): Promise<MutationResult> => {
      if (!checkUserPermission(currentUser, 'users:manage')) {
        return { success: false, message: 'Acesso negado: permissão users:manage exigida.' };
      }

      const targetUser = users.find((u) => u.id === payload.targetUserId);
      if (!targetUser) {
        return { success: false, message: 'Usuário não localizado.' };
      }

      const isColabRole = payload.role === 'colaborador';
      const hasGuardianPerm = payload.individualPermissions.includes('can_act_as_guardian_host');
      const resolvedGuardianHost = isColabRole
        ? false
        : payload.isGuardianHost !== undefined
        ? payload.isGuardianHost
        : hasGuardianPerm;
      const syncedPermissions: PermissionKey[] = isColabRole
        ? []
        : resolvedGuardianHost
        ? Array.from(
            new Set([
              ...payload.individualPermissions,
              'can_act_as_guardian_host' as PermissionKey,
            ])
          )
        : payload.individualPermissions.filter((p) => p !== 'can_act_as_guardian_host');

      const updatedUser: UserProfile = {
        ...targetUser,
        role: payload.role,
        isActive: payload.isActive,
        isGuardianHost: resolvedGuardianHost,
        individualPermissions: syncedPermissions,
      };

      setUsers((prev) =>
        prev.map((u) => (u.id === payload.targetUserId ? updatedUser : u))
      );

      if (isSupabaseConfigured) {
        const { error } = await supabase
          .from('portal_users')
          .upsert(mapUserProfileToDbRow(updatedUser));
        if (error) {
          console.error('Erro ao atualizar permissões do usuário no Supabase:', error);
        }
      }

      appendAudit(
        'Atualização de Permissões',
        'Administração',
        `Permissões de ${targetUser.fullName} atualizadas${resolvedGuardianHost ? ' (Guardião Anfitrião ativo)' : ''}`,
        'Sucesso'
      );
      return { success: true, message: 'Permissões do usuário atualizadas com sucesso.' };
    },
    [currentUser, users, appendAudit]
  );

  const createNewUser = useCallback(
    async (payload: {
      fullName: string;
      email: string;
      role: UserRole;
      department: string;
      individualPermissions: PermissionKey[];
      isGuardianHost?: boolean;
    }): Promise<MutationResult> => {
      if (!checkUserPermission(currentUser, 'users:manage')) {
        return { success: false, message: 'Acesso negado: permissão users:manage exigida.' };
      }

      const normalized = payload.email.trim().toLowerCase();
      if (users.some((u) => u.email.toLowerCase() === normalized)) {
        return { success: false, message: 'Já existe um usuário cadastrado com este e-mail.' };
      }

      const isColabRole = payload.role === 'colaborador';
      const hasGuardianPerm = payload.individualPermissions.includes('can_act_as_guardian_host');
      const resolvedGuardianHost = isColabRole
        ? false
        : payload.isGuardianHost !== undefined
        ? payload.isGuardianHost
        : hasGuardianPerm;
      const syncedPermissions: PermissionKey[] = isColabRole
        ? []
        : resolvedGuardianHost
        ? Array.from(
            new Set([
              ...payload.individualPermissions,
              'can_act_as_guardian_host' as PermissionKey,
            ])
          )
        : payload.individualPermissions.filter((p) => p !== 'can_act_as_guardian_host');

      const usernameCandidate = normalized.split('@')[0].toLowerCase().replace(/\s+/g, '.');
      const nowIso = new Date().toISOString();
      const newUser: UserProfile = {
        id: `usr-${Date.now()}`,
        username: usernameCandidate,
        fullName: payload.fullName.trim(),
        email: normalized,
        role: payload.role,
        status: 'ativo',
        canChangePassword: false,
        department: payload.department.trim() || 'Operações',
        isActive: true,
        isGuardianHost: resolvedGuardianHost,
        individualPermissions: syncedPermissions,
        createdAt: nowIso,
        lastLoginAt: nowIso,
      };

      setUsers((prev) => [...prev, newUser]);

      if (isSupabaseConfigured) {
        const { error } = await supabase
          .from('portal_users')
          .upsert(mapUserProfileToDbRow(newUser));
        if (error) {
          console.error('Erro ao criar usuário no Supabase:', error);
        }
      }

      appendAudit(
        'Criação de Usuário',
        'Administração',
        `${newUser.fullName}${resolvedGuardianHost ? ' (Guardião Anfitrião)' : ''}`,
        'Sucesso'
      );
      return { success: true, message: 'Novo usuário criado com sucesso.' };
    },
    [currentUser, users, appendAudit]
  );

  const value = useMemo(
    () => ({
      currentUser,
      users,
      loginWithUsername,
      loginWithEmail,
      requestAccess,
      setPassword,
      approveUser,
      rejectOrBlockUser,
      unblockUser,
      archiveUser,
      restoreArchivedUser,
      unlockPasswordChange,
      switchDemoUser,
      logout,
      hasPermission,
      isSupabaseSynced: isSupabaseConfigured,
      isSyncing,
      lastSyncedAt,
      syncNow,
      categories,
      cells,
      criteria,
      characters,
      exercises,
      checklists,
      collaborators,
      collaboratorChecklists,
      learningTracks,
      trackTemplates,
      surveys,
      surveyResponses,
      auditLogs,
      createCategory,
      updateCategory,
      deleteCategory,
      saveCharacter,
      batchImportCharacters,
      deleteCharacter,
      uploadClientGuide,
      saveExercise,
      deleteExercise,
      uploadExerciseGuide,
      saveChecklist,
      deleteChecklist,
      createCollaborator,
      updateCollaborator,
      deleteCollaborator,
      updateCollaboratorTrack,
      addStepToCollaboratorTrack,
      removeStepFromCollaboratorTrack,
      completeCollaboratorTrackStep,
      submitCollaboratorChecklistSelfAssessment,
      finalizeCollaboratorTrack,
      reopenCollaboratorTrack,
      saveTrackTemplate,
      deleteTrackTemplate,
      updateCollaboratorChecklistAssignments,
      ensureCollaboratorChecklistAssignment,
      createLearningTrack,
      updateLearningTrack,
      deleteLearningTrack,
      enrollCollaboratorInTrack,
      unenrollCollaboratorFromTrack,
      createSurvey,
      updateSurvey,
      deleteSurvey,
      submitSurveyResponse,
      saveEvaluationProgress,
      completeEvaluation,
      roleDefaultPermissions,
      updateRoleDefaultPermissions,
      updateUserPermissions,
      createNewUser,
    }),
    [
      currentUser,
      users,
      loginWithUsername,
      loginWithEmail,
      requestAccess,
      setPassword,
      approveUser,
      rejectOrBlockUser,
      unblockUser,
      archiveUser,
      restoreArchivedUser,
      unlockPasswordChange,
      switchDemoUser,
      logout,
      hasPermission,
      isSyncing,
      lastSyncedAt,
      syncNow,
      categories,
      cells,
      criteria,
      characters,
      exercises,
      checklists,
      collaborators,
      collaboratorChecklists,
      learningTracks,
      trackTemplates,
      surveys,
      surveyResponses,
      auditLogs,
      createCategory,
      updateCategory,
      deleteCategory,
      saveCharacter,
      batchImportCharacters,
      deleteCharacter,
      uploadClientGuide,
      saveExercise,
      deleteExercise,
      uploadExerciseGuide,
      saveChecklist,
      deleteChecklist,
      createCollaborator,
      updateCollaborator,
      deleteCollaborator,
      updateCollaboratorTrack,
      addStepToCollaboratorTrack,
      removeStepFromCollaboratorTrack,
      completeCollaboratorTrackStep,
      submitCollaboratorChecklistSelfAssessment,
      finalizeCollaboratorTrack,
      reopenCollaboratorTrack,
      saveTrackTemplate,
      deleteTrackTemplate,
      updateCollaboratorChecklistAssignments,
      ensureCollaboratorChecklistAssignment,
      createLearningTrack,
      updateLearningTrack,
      deleteLearningTrack,
      enrollCollaboratorInTrack,
      unenrollCollaboratorFromTrack,
      createSurvey,
      updateSurvey,
      deleteSurvey,
      submitSurveyResponse,
      saveEvaluationProgress,
      completeEvaluation,
      roleDefaultPermissions,
      updateRoleDefaultPermissions,
      updateUserPermissions,
      createNewUser,
    ]
  );

  return <PortalStoreContext.Provider value={value}>{children}</PortalStoreContext.Provider>;
};

export function usePortalStore(): PortalStoreContextValue {
  const context = useContext(PortalStoreContext);
  if (!context) {
    throw new Error('usePortalStore deve ser utilizado dentro de um PortalStoreProvider.');
  }
  return context;
}
