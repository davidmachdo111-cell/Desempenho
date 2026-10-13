import {
  AuditLogEntry,
  Category,
  Cell,
  Character,
  Checklist,
  Collaborator,
  CollaboratorChecklist,
  Criterion,
  Exercise,
  UserProfile,
} from '../types/portal';

import { LAB_CHARACTERS, LAB_EXERCISES, LAB_CHECKLISTS } from './labSeedData';

// Base oficial populada com a célula Laboratório completa
export const INITIAL_CATEGORIES: Category[] = [];
export const INITIAL_CHARACTERS: Character[] = LAB_CHARACTERS;
export const INITIAL_CELLS: Cell[] = [
  {
    id: 'cell-lab',
    code: 'LAB',
    name: 'Laboratório',
    coordinatorName: 'Coordenação Laboratório',
    hasServiceStandard: true,
    standardDocumentTitle: 'Manual Operacional de Atendimento Laboratorial',
    standardUpdatedAt: '2026-10-13T08:00:00Z',
  },
  {
    id: 'cell-img',
    code: 'IMG',
    name: 'Imagem',
    coordinatorName: 'Coordenação Imagem',
    hasServiceStandard: true,
    standardDocumentTitle: 'Diretrizes de Atendimento e Diagnóstico por Imagem',
    standardUpdatedAt: '2026-10-13T08:00:00Z',
  },
  {
    id: 'cell-consulta',
    code: 'CONSULTA',
    name: 'Consultas',
    coordinatorName: 'Coordenação Consultas',
    hasServiceStandard: true,
    standardDocumentTitle: 'Procedimento Padrão para Agendamento e Recepção Ambulatorial',
    standardUpdatedAt: '2026-10-13T08:00:00Z',
  },
  {
    id: 'cell-terapia',
    code: 'TERAPIA',
    name: 'Terapias',
    coordinatorName: 'Coordenação Terapias',
    hasServiceStandard: true,
    standardDocumentTitle: 'Protocolo de Acolhimento e Terapias Contínuas',
    standardUpdatedAt: '2026-10-13T08:00:00Z',
  },
  {
    id: 'cell-operadora',
    code: 'OPERADORA',
    name: 'Operadora',
    coordinatorName: 'Coordenação Operadora',
    hasServiceStandard: true,
    standardDocumentTitle: 'Normas de Regulação, Autorização de Guias e SAC Operadora',
    standardUpdatedAt: '2026-10-13T08:00:00Z',
  },
];
export const INITIAL_CRITERIA: Criterion[] = [];
export const INITIAL_EXERCISES: Exercise[] = LAB_EXERCISES;
export const INITIAL_CHECKLISTS: Checklist[] = LAB_CHECKLISTS;
export const INITIAL_COLLABORATORS: Collaborator[] = [];
export const INITIAL_COLLABORATOR_CHECKLISTS: CollaboratorChecklist[] = [];
export const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [];

// Acesso Mestre Inicial do Administrador Corporativo
export const INITIAL_USERS: UserProfile[] = [
  {
    id: 'usr-admin-master',
    username: 'david.furtado',
    fullName: 'David Furtado',
    email: 'david.furtado@portaldesempenho.corp',
    role: 'admin',
    status: 'aprovado_sem_senha',
    canChangePassword: true,
    isActive: true,
    password: '',
    department: 'Diretoria de Treinamento e Operações',
    individualPermissions: [
      'can_manage_collaborators',
      'can_manage_checklists',
      'can_manage_exercises',
      'can_apply_evaluations',
      'users:manage',
      'cells:manage',
    ],
    createdAt: '2026-10-13T08:00:00Z',
    lastLoginAt: '2026-10-13T08:00:00Z',
  },
];
