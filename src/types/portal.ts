export type UserRole = 'admin' | 'avaliador' | 'auxiliar';

// Permissões Granulares
export type PermissionKey =
  | 'can_manage_collaborators' // pode criar e editar colaboradores
  | 'can_manage_checklists'    // pode criar e editar checklists e critérios
  | 'can_manage_exercises'     // pode criar exercícios, personagens e guias
  | 'can_apply_evaluations'    // pode conduzir e dar check em avaliações
  | 'users:manage'             // administração de contas de usuário
  | 'cells:manage';            // gestão de células e equipes

export type UserStatus =
  | 'pendente_aprovacao'
  | 'aprovado_sem_senha'
  | 'ativo'
  | 'bloqueado';

export interface UserProfile {
  id: string;
  username: string; // sempre em minúsculas, ex: 'david.furtado'
  fullName: string;
  email: string;
  role: UserRole;
  status: UserStatus;
  canChangePassword: boolean;
  password?: string;
  isActive: boolean;
  department: string;
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
    fullName: 'LAB (Laboratório)',
    description: 'Exames laboratoriais e análises clínicas',
    badgeBg: 'bg-blue-50',
    badgeText: 'text-blue-800',
    badgeBorder: 'border-blue-300',
  },
  IMG: {
    code: 'IMG',
    name: 'Imagem',
    fullName: 'IMG (Imagem)',
    description: 'Diagnósticos e exames por imagem',
    badgeBg: 'bg-indigo-50',
    badgeText: 'text-indigo-800',
    badgeBorder: 'border-indigo-300',
  },
  CONSULTA: {
    code: 'CONSULTA',
    name: 'Consultas Ambulatoriais',
    fullName: 'CONSULTA (Consultas Ambulatoriais)',
    description: 'Agendamentos e consultas eletivas/ambulatoriais',
    badgeBg: 'bg-emerald-50',
    badgeText: 'text-emerald-800',
    badgeBorder: 'border-emerald-300',
  },
  TERAPIA: {
    code: 'TERAPIA',
    name: 'Terapias / Tratamentos',
    fullName: 'TERAPIA (Terapias / Tratamentos)',
    description: 'Terapias contínuas, reabilitação e tratamentos',
    badgeBg: 'bg-purple-50',
    badgeText: 'text-purple-800',
    badgeBorder: 'border-purple-300',
  },
  OPERADORA: {
    code: 'OPERADORA',
    name: 'Convênio / Planos de Saúde',
    fullName: 'OPERADORA (Convênio / Planos de Saúde)',
    description: 'Regulação, autorização de guias e SAC operadora',
    badgeBg: 'bg-amber-50',
    badgeText: 'text-amber-800',
    badgeBorder: 'border-amber-300',
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
export type CustomerTier = 'Iniciante' | 'Mediano' | 'Intermediário';
export type ExerciseDifficulty = 'Iniciante' | 'Mediano' | 'Intermediário';

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

export interface Collaborator {
  id: string;
  fullName: string;
  roleTitle: string;
  cellTeam: string; // nome ou código da célula
  registrationCode?: string;
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

export interface AuditLogEntry {
  id: string;
  timestamp: string;
  actorId: string;
  actorName: string;
  actorRole: UserRole;
  action: string;
  module: 'Autenticação' | 'Colaboradores' | 'Checklists' | 'Exercícios' | 'Personagens' | 'Avaliações' | 'Administração' | 'Categorias';
  targetDescription: string;
  status: 'Sucesso' | 'Bloqueado' | 'Erro';
}
