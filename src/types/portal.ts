export type UserRole = 'admin' | 'avaliador' | 'auxiliar' | 'colaborador';

// Permissões Granulares
export type PermissionKey =
  | 'can_manage_collaborators' // pode criar e editar colaboradores
  | 'can_manage_checklists'    // pode criar e editar checklists e critérios
  | 'can_manage_exercises'     // pode criar exercícios, personagens e guias
  | 'can_apply_evaluations'    // pode conduzir e dar check em avaliações
  | 'can_view_scenarios'       // visualização de cenários de simulação e casos atrelados
  | 'users:manage'             // administração de contas de usuário
  | 'cells:manage';            // gestão de células e equipes

export type UserStatus =
  | 'pendente_aprovacao'
  | 'aprovado_sem_senha'
  | 'ativo'
  | 'bloqueado';

export interface UserProfile {
  id: string;
  username: string; // sempre em minúsculas, ex: 'david.furtado' ou 'lucas.silveira'
  fullName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  canChangePassword: boolean;
  password?: string;
  isActive: boolean;
  department: string;
  collaboratorId?: string; // vínculo direto com colaborador
  individualPermissions: PermissionKey[];
  createdAt: string;
  lastLoginAt: string;
}

export interface Cell {
  id: string;
  code: string;
  name: string;
  coordinatorName: string;
  hasServiceStandard: boolean;
  standardDocumentTitle: string;
  standardUpdatedAt: string;
}

export interface Criterion {
  id: string;
  code: string;
  sectionName: string;
  name: string;
  description: string;
  weight: number;
  isActive: boolean;
}

// 1. Categorias Padronizadas
export type CategoryType = 'checklist' | 'exercise' | 'geral';

export interface Category {
  id: string;
  name: string;
  type: CategoryType;
  description?: string;
}

export type OfficialCell = 'LAB' | 'IMG' | 'CONSULTA' | 'TERAPIA' | 'OPERADORA';

export const OFFICIAL_CELL_NAMES: Record<OfficialCell, string> = {
  LAB: 'Laboratório',
  IMG: 'Imagem',
  CONSULTA: 'Consultas',
  TERAPIA: 'Terapias',
  OPERADORA: 'Operadora',
};

export const CLEAN_CELL_NAMES: string[] = [
  'Laboratório',
  'Imagem',
  'Consultas',
  'Terapias',
  'Operadora',
];

export function getCellName(cell?: string | null): string {
  if (!cell) return 'Operadora';
  if (cell in OFFICIAL_CELL_NAMES) {
    return OFFICIAL_CELL_NAMES[cell as OfficialCell];
  }
  if (cell === 'Consultas Ambulatoriais') return 'Consultas';
  if (cell === 'Terapias / Tratamentos') return 'Terapias';
  if (
    cell === 'Convênio / Planos de Saúde' ||
    cell === 'Convênio' ||
    cell === 'OPERADORA' ||
    cell === 'Operadora'
  ) {
    return 'Operadora';
  }
  return cell;
}

/**
 * Remove prefixos redundantes de títulos de atividades para exibição compacta e limpa
 */
export function cleanActivityTitle(title: string): string {
  return title
    .replace(/^Checklist\s+de\s+Avalia[çc][ãa]o:\s*/i, '')
    .replace(/^Checklist\s+de\s+/i, '')
    .replace(/^Pesquisa\s+de\s+Satisfa[çc][ãa]o:\s*/i, '')
    .trim();
}

/**
 * Calcula dinamicamente o status do colaborador com base no progresso de sua trilha:
 * - 'novo': 0% de progresso ou nenhuma etapa iniciada/concluída
 * - 'em_treinamento': progresso > 0% e < 100%
 * - 'concluido': 100% das etapas configuradas concluídas
 */
export function getCollaboratorDynamicStatus(collaborator: {
  track?: CollaboratorTrackStep[];
  status?: CollaboratorStatus;
}): {
  status: 'novo' | 'em_treinamento' | 'concluido';
  label: string;
  badgeStyle: string;
  progressPct: number;
  completedSteps: number;
  totalSteps: number;
} {
  const steps = collaborator.track || [];
  const totalSteps = steps.length;
  const completedSteps = steps.filter((s) => s.status === 'concluido').length;
  const progressPct = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

  if (totalSteps > 0 && completedSteps === totalSteps) {
    return {
      status: 'concluido',
      label: 'Concluído',
      badgeStyle: 'bg-emerald-50 text-emerald-800 border-emerald-200',
      progressPct: 100,
      completedSteps,
      totalSteps,
    };
  }

  if (completedSteps > 0 && completedSteps < totalSteps) {
    return {
      status: 'em_treinamento',
      label: 'Em Treinamento',
      badgeStyle: 'bg-amber-50 text-amber-800 border-amber-200',
      progressPct,
      completedSteps,
      totalSteps,
    };
  }

  return {
    status: 'novo',
    label: 'Novo',
    badgeStyle: 'bg-slate-100 text-slate-700 border-slate-200',
    progressPct: 0,
    completedSteps,
    totalSteps,
  };
}

export interface OfficialCellMetadata {
  code: OfficialCell;
  name: string;
  fullName: string;
  description: string;
  badgeBg: string;
  badgeText: string;
  badgeBorder: string;
}

export const OFFICIAL_CELLS: Record<OfficialCell, OfficialCellMetadata> = {
  LAB: {
    code: 'LAB',
    name: 'Laboratório',
    fullName: 'Laboratório',
    description: 'Exames laboratoriais e análises clínicas',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-700',
    badgeBorder: 'border-slate-200',
  },
  IMG: {
    code: 'IMG',
    name: 'Imagem',
    fullName: 'Imagem',
    description: 'Diagnósticos e exames por imagem',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-700',
    badgeBorder: 'border-slate-200',
  },
  CONSULTA: {
    code: 'CONSULTA',
    name: 'Consultas',
    fullName: 'Consultas',
    description: 'Agendamentos e consultas eletivas/ambulatoriais',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-700',
    badgeBorder: 'border-slate-200',
  },
  TERAPIA: {
    code: 'TERAPIA',
    name: 'Terapias',
    fullName: 'Terapias',
    description: 'Terapias contínuas, reabilitação e tratamentos',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-700',
    badgeBorder: 'border-slate-200',
  },
  OPERADORA: {
    code: 'OPERADORA',
    name: 'Operadora',
    fullName: 'Operadora',
    description: 'Regulação, autorização de guias e SAC operadora',
    badgeBg: 'bg-slate-100',
    badgeText: 'text-slate-700',
    badgeBorder: 'border-slate-200',
  },
};

export const OFFICIAL_CELL_LIST: OfficialCell[] = [
  'LAB',
  'IMG',
  'CONSULTA',
  'TERAPIA',
  'OPERADORA',
];

/**
 * Converte falas/objeções armazenadas (string, array ou JSON) em uma lista de strings limpas
 */
export function normalizePhrases(phrases: string[] | string | undefined | null): string[] {
  if (!phrases) return [];
  if (Array.isArray(phrases)) {
    return phrases
      .map((p) => (typeof p === 'string' ? p.trim() : ''))
      .filter((p) => p.length > 0);
  }
  if (typeof phrases === 'string') {
    const trimmed = phrases.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('[') && trimmed.endsWith(']')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          return parsed
            .map((p) => (typeof p === 'string' ? p.trim() : ''))
            .filter((p) => p.length > 0);
        }
      } catch {}
    }
    return trimmed
      .split('\n')
      .map((l) => l.trim().replace(/^["'“”«»•\-\*]+|["'“”«»,]+$/g, '').trim())
      .filter((l) => l.length > 0);
  }
  return [];
}

export type Gender = 'Masculino' | 'Feminino' | 'Outro';
export type CustomerTier = 'Iniciante' | 'Simples' | 'Mediano' | 'Intermediário' | 'Crítico';
export type ExerciseDifficulty = 'Iniciante' | 'Simples' | 'Mediano' | 'Intermediário' | 'Crítico';

// 2. characters: Banco de Clientes / Personagens Independentes
export interface Character {
  id: string;
  name: string;
  cell: OfficialCell; // Célula de Atendimento (LAB, IMG, CONSULTA, TERAPIA, OPERADORA)
  age: string; // ex: '45 anos'
  gender: Gender; // Sexo
  city: string; // ex: 'São Paulo - SP'
  cardNumber: string; // Número da Carteirinha
  customerTier: CustomerTier; // Classificação: Iniciante, Mediano, Intermediário
  serviceContext: string; // Contexto do Atendimento
  temperament: string; // humor/comportamento
  objectives: string; // o que quer no atendimento
  typicalPhrases: string[] | string; // falas e objeções em tópicos dinâmicos
  guideAttachmentUrl?: string | null; // Guia de Atendimento do Cliente (PDF/imagem)
  guideAttachmentName?: string | null;
  createdAt: string;
  // Compatibilidade legada opcional
  history?: string;
}

// 3. exercises: Cenários de treinamento vinculando até 4 clientes
export interface Exercise {
  id: string;
  title: string;
  cell: OfficialCell; // Célula do Exercício (LAB, IMG, CONSULTA, TERAPIA, OPERADORA)
  difficulty: ExerciseDifficulty; // Classificação de Dificuldade
  categoryId?: string; // FK categories (opcional/legado)
  categoryName?: string; // Denormalizado para exibição
  scenarioInstructions: string; // orientações do caso
  characterIds: string[]; // Vínculo N:M - até 4 clientes por exercício
  createdAt: string;
  updatedAt?: string;
  // Compatibilidade transitória
  attachmentUrl?: string | null;
  attachmentName?: string | null;
}

// 4. checklists: Modelos flexíveis (com ou sem exercícios simulados)
export interface ChecklistCriterion {
  id: string;
  name: string; // título do critério
  weight: number; // peso/pontuação (default 1)
}

export interface Checklist {
  id: string;
  title: string;
  cell: OfficialCell; // Célula do Checklist (LAB, IMG, CONSULTA, TERAPIA, OPERADORA)
  description: string;
  categoryId?: string;
  categoryName?: string;
  hasExercises: boolean; // default false
  exerciseIds: string[]; // Vínculo N:M opcional
  criteria: ChecklistCriterion[]; // Critérios diretos do checklist
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

// 5. collaborators: Colaboradores em Treinamento
export type CollaboratorStatus = 'novo' | 'em_treinamento' | 'aprovado' | 'necessita_reforco';

export type CollaboratorTrackStepType = 'checklist' | 'survey';
export type CollaboratorTrackFilledBy = 'collaborator' | 'evaluator';
export type CollaboratorTrackStepStatus = 'disponivel' | 'bloqueado' | 'concluido';

export interface CollaboratorTrackStep {
  id: string; // id único da etapa na trilha
  type: CollaboratorTrackStepType; // 'checklist' | 'survey'
  title: string;
  refId: string; // id do Checklist ou da Survey de referência
  filledBy: CollaboratorTrackFilledBy; // 'collaborator' | 'evaluator' (default 'collaborator' para checklist, sempre 'collaborator' para survey)
  order: number; // 1, 2, 3...
  status: CollaboratorTrackStepStatus; // 'disponivel' | 'bloqueado' | 'concluido'
  completedAt?: string | null;
  finalScore?: number | null; // se checklist avaliado
  collaboratorChecklistId?: string | null; // vínculo se criado em collaborator_checklists
  surveyResponseId?: string | null; // vínculo se resposta enviada
}

export interface Collaborator {
  id: string;
  fullName: string;
  username?: string; // identificador único corporativo: nome.sobrenome
  roleTitle: string;
  cellTeam: string; // nome ou código da célula
  registrationCode?: string;
  learningTrackId?: string; // vínculo opcional/legado com trilha de aprendizagem
  track?: CollaboratorTrackStep[]; // Trilha de aprendizagem individual e sequencial do colaborador
  status: CollaboratorStatus;
  createdAt: string;
  updatedAt: string;
}

// 6. collaborator_checklists: Atribuição e Resultados das Avaliações
export type CollaboratorChecklistStatus = 'pendente' | 'em_andamento' | 'concluido';

export interface CriteriaAnswerSnapshot {
  criterionId: string;
  name: string;
  weight: number;
  checked: boolean;
  notes?: string;
}

export interface EvaluationSnapshotItem {
  criterionId: string;
  criterionCode?: string;
  criterionName: string;
  sectionName?: string;
  weight: number;
  score: number;
  isApplicable: boolean;
  notes?: string;
}

export interface CollaboratorChecklist {
  id: string;
  collaboratorId: string;
  checklistId: string;
  status: CollaboratorChecklistStatus;
  finalScore?: number | null;
  criteriaAnswers: CriteriaAnswerSnapshot[];
  generalObservations?: string | null;
  instructorAuxiliarId?: string | null;
  actorAuxiliarId?: string | null;
  completedAt?: string | null;
  createdAt: string;
  updatedAt: string;
}

// 7. Pesquisas de Satisfação Dinâmicas
export type SurveyQuestionType =
  | 'multipla_simples'
  | 'multipla_com_observacao'
  | 'apenas_observacao';

export interface SurveyQuestion {
  id: string;
  text: string;
  type: SurveyQuestionType;
  options: string[]; // alternativas quando aplicável
  required: boolean;
}

export interface Survey {
  id: string;
  title: string;
  description: string;
  targetCell?: string; // Célula específica ou "Todas"
  questions: SurveyQuestion[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface SurveyAnswerItem {
  selectedOption?: string;
  observation?: string;
}

export interface SurveyResponse {
  id: string;
  surveyId: string;
  collaboratorId: string;
  collaboratorName: string;
  collaboratorUsername: string;
  cellTeam: string;
  answers: Record<string, SurveyAnswerItem>; // questionId -> resposta
  completedAt: string;
}

// 8. Trilhas de Aprendizagem Dinâmicas
export interface LearningTrack {
  id: string;
  title: string;
  description: string;
  cell: string; // Laboratório, Imagem, Consultas, Terapias, Operadora, ou Geral
  checklistIds: string[]; // Ordem cronológica das etapas de checklists
  surveyId?: string; // Pesquisa de satisfação vinculada à conclusão da trilha
  collaboratorIds: string[]; // Colaboradores matriculados nesta trilha
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  module:
    | 'Autenticação'
    | 'Colaboradores'
    | 'Checklists'
    | 'Exercícios'
    | 'Personagens'
    | 'Avaliações'
    | 'Administração'
    | 'Categorias'
    | 'Trilhas'
    | 'Pesquisas';
  targetDescription: string;
  status: 'Sucesso' | 'Bloqueado' | 'Erro';
}

/**
 * Gera o identificador de usuário corporativo no padrão "nome.sobrenome"
 * sem acentos e em minúsculas (ex: "Lucas Silveira" -> "lucas.silveira")
 */
export function generateCorporateUsername(firstName: string, lastName: string): string {
  const sanitize = (text: string) =>
    text
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // remove diacríticos/acentos
      .replace(/[^a-z0-9]/g, ''); // mantém apenas alfanuméricos

  const cleanFirst = sanitize(firstName.split(' ')[0] || '');
  const cleanLast = sanitize(lastName.split(' ').filter(Boolean).pop() || '');

  if (!cleanFirst && !cleanLast) return '';
  if (!cleanFirst) return cleanLast;
  if (!cleanLast) return cleanFirst;
  return `${cleanFirst}.${cleanLast}`;
}
