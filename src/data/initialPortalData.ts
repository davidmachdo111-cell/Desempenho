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
  LearningTrack,
  Survey,
  SurveyResponse,
  UserProfile,
} from '../types/portal';

import { LAB_CHARACTERS, LAB_EXERCISES, LAB_CHECKLISTS } from './labSeedData';

// Base oficial populada com a célula Laboratório completa
export const INITIAL_CATEGORIES: Category[] = [
  { id: 'cat-1', name: 'Atendimento Humanizado', type: 'checklist' },
  { id: 'cat-2', name: 'Técnico / Procedimental', type: 'checklist' },
  { id: 'cat-3', name: 'Regulatório / ANS', type: 'checklist' },
  { id: 'cat-4', name: 'Multitarefa / Agilidade', type: 'checklist' },
  { id: 'cat-5', name: 'Gestão de Conflito / CNV', type: 'checklist' },
  { id: 'cat-6', name: 'Priorização Ética / Crítico', type: 'checklist' },
  { id: 'cat-7', name: 'Geral', type: 'checklist' },
];

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

// 1. Pesquisa de Satisfação Dinâmica Inicial
export const INITIAL_SURVEYS: Survey[] = [
  {
    id: 'survey-satisfacao-geral',
    title: 'Pesquisa de Satisfação com o Programa de Simulação',
    description:
      'Avalie a qualidade das guias médicas, o nível de detalhamento dos checklists e a dinâmica de aprendizagem do treinamento.',
    targetCell: 'Todas',
    isActive: true,
    createdAt: '2026-10-13T10:00:00Z',
    updatedAt: '2026-10-13T10:00:00Z',
    questions: [
      {
        id: 'q-1',
        text: 'Como você avalia a clareza e fidelidade das guias médicas nas simulações?',
        type: 'multipla_com_observacao',
        options: [
          'Excelente — Guias completas e muito próximas da rotina',
          'Boa — Claras e fáceis de interpretar',
          'Regular — Alguns campos poderiam ter mais detalhes',
          'Insatisfatória — Confusas ou insuficientes',
        ],
        required: true,
      },
      {
        id: 'q-2',
        text: 'O checklist de atendimento e seus critérios refletem com precisão as exigências do seu setor?',
        type: 'multipla_simples',
        options: [
          'Sim, 100% alinhado com nossos padrões',
          'Parcialmente alinhado, alguns itens diferem',
          'Pouco alinhado com a realidade do dia a dia',
        ],
        required: true,
      },
      {
        id: 'q-3',
        text: 'Quais sugestões você gostaria de deixar para aprimorar as próximas trilhas de treinamento?',
        type: 'apenas_observacao',
        options: [],
        required: false,
      },
    ],
  },
];

// Respostas de Exemplo para a Pesquisa
export const INITIAL_SURVEY_RESPONSES: SurveyResponse[] = [
  {
    id: 'resp-demo-01',
    surveyId: 'survey-satisfacao-geral',
    collaboratorId: 'col-lucas-silveira',
    collaboratorName: 'Lucas Silveira',
    collaboratorUsername: 'lucas.silveira',
    cellTeam: 'Laboratório',
    answers: {
      'q-1': {
        selectedOption: 'Excelente — Guias completas e muito próximas da rotina',
        observation: 'A inclusão dos códigos TUSS e das regras de jejum ajudou muito na conferência do atendimento!',
      },
      'q-2': {
        selectedOption: 'Sim, 100% alinhado com nossos padrões',
      },
      'q-3': {
        observation: 'Gostaria de ver mais casos de pacientes que esquecem o preparo de 12 horas de jejum para podermos treinar a remarcação humanizada.',
      },
    },
    completedAt: '2026-10-13T14:30:00Z',
  },
];

// 2. Trilhas de Aprendizagem Dinâmicas Iniciais
export const INITIAL_LEARNING_TRACKS: LearningTrack[] = [
  {
    id: 'track-lab-101',
    title: 'Trilha de Excelência e Procedimentos em Laboratório',
    description:
      'Programa intensivo de integração focado em identificação de guias médicas, preparo de coletas especiais e comunicação assertiva.',
    cell: 'Laboratório',
    checklistIds: ['chk-lab-01', 'chk-lab-02', 'chk-lab-03'],
    surveyId: 'survey-satisfacao-geral',
    collaboratorIds: ['col-lucas-silveira'],
    isActive: true,
    createdAt: '2026-10-13T09:00:00Z',
    updatedAt: '2026-10-13T09:00:00Z',
  },
];

// 3. Colaboradores em Treinamento Iniciais
export const INITIAL_COLLABORATORS: Collaborator[] = [
  {
    id: 'col-lucas-silveira',
    fullName: 'Lucas Silveira',
    username: 'lucas.silveira',
    roleTitle: 'Atendente de Recepção e Triagem',
    cellTeam: 'Laboratório',
    registrationCode: 'COL-842',
    learningTrackId: 'track-lab-101',
    track: [
      {
        id: 'track-step-1',
        type: 'checklist',
        title: 'Checklist de Atendimento ao Cliente e Recepção',
        refId: 'chk-lab-01',
        filledBy: 'collaborator',
        order: 1,
        status: 'concluido',
        completedAt: '2026-10-13T11:45:00Z',
        finalScore: 9.3,
        collaboratorChecklistId: 'asg-lucas-01',
      },
      {
        id: 'track-step-2',
        type: 'survey',
        title: 'Pesquisa de Percepção & Satisfação do Treinamento',
        refId: 'survey-satisfacao-geral',
        filledBy: 'collaborator',
        order: 2,
        status: 'concluido',
        completedAt: '2026-10-13T14:30:00Z',
        surveyResponseId: 'resp-demo-01',
      },
      {
        id: 'track-step-3',
        type: 'checklist',
        title: 'Conferência de Guia Médica e Exames Especiais',
        refId: 'chk-lab-02',
        filledBy: 'evaluator',
        order: 3,
        status: 'disponivel',
        collaboratorChecklistId: 'asg-lucas-02',
      },
      {
        id: 'track-step-4',
        type: 'checklist',
        title: 'Orientações de Coleta e Preparo de Exames',
        refId: 'chk-lab-03',
        filledBy: 'collaborator',
        order: 4,
        status: 'bloqueado',
        collaboratorChecklistId: 'asg-lucas-03',
      },
    ],
    status: 'em_treinamento',
    createdAt: '2026-10-13T09:30:00Z',
    updatedAt: '2026-10-13T09:30:00Z',
  },
];

export const INITIAL_COLLABORATOR_CHECKLISTS: CollaboratorChecklist[] = [
  {
    id: 'asg-lucas-01',
    collaboratorId: 'col-lucas-silveira',
    checklistId: 'chk-lab-01',
    status: 'concluido',
    finalScore: 9.3,
    criteriaAnswers: [
      {
        criterionId: 'crit-lab-01-1',
        name: 'Acolhimento empático e conferência da carteirinha e documento com foto',
        weight: 1,
        checked: true,
        notes: 'Excelente postura e clareza no diálogo',
      },
      {
        criterionId: 'crit-lab-01-2',
        name: 'Conferência de todos os exames solicitados na guia médica',
        weight: 1.5,
        checked: true,
      },
      {
        criterionId: 'crit-lab-01-3',
        name: 'Verificação do tempo de jejum obrigatório e preparo específico',
        weight: 1.5,
        checked: true,
      },
      {
        criterionId: 'crit-lab-01-4',
        name: 'Explicação detalhada dos prazos de liberação dos laudos',
        weight: 1,
        checked: false,
        notes: 'Poderia ter reforçado a consulta no portal online',
      },
    ],
    generalObservations:
      'Colaborador demonstrou ótima atenção aos detalhes da guia e empatia durante a simulação do caso crítico.',
    instructorAuxiliarId: 'usr-admin-master',
    completedAt: '2026-10-13T11:45:00Z',
    createdAt: '2026-10-13T09:30:00Z',
    updatedAt: '2026-10-13T11:45:00Z',
  },
  {
    id: 'asg-lucas-02',
    collaboratorId: 'col-lucas-silveira',
    checklistId: 'chk-lab-02',
    status: 'em_andamento',
    finalScore: null,
    criteriaAnswers: [],
    generalObservations: null,
    completedAt: null,
    createdAt: '2026-10-13T09:30:00Z',
    updatedAt: '2026-10-13T09:30:00Z',
  },
  {
    id: 'asg-lucas-03',
    collaboratorId: 'col-lucas-silveira',
    checklistId: 'chk-lab-03',
    status: 'pendente',
    finalScore: null,
    criteriaAnswers: [],
    generalObservations: null,
    completedAt: null,
    createdAt: '2026-10-13T09:30:00Z',
    updatedAt: '2026-10-13T09:30:00Z',
  },
];

export const INITIAL_AUDIT_LOGS: AuditLogEntry[] = [
  {
    id: 'log-seed-1',
    timestamp: '2026-10-13T08:00:00Z',
    actorId: 'usr-admin-master',
    actorName: 'David Furtado',
    actorRole: 'admin',
    action: 'Criação da Trilha de Excelência em Laboratório',
    module: 'Trilhas',
    targetDescription: 'Trilha track-lab-101 criada com 3 checklists vinculados',
    status: 'Sucesso',
  },
];

// Usuários do Sistema: 4 Perfis Fundamentais Representativos para Validação Imediata
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
      'can_view_scenarios',
      'users:manage',
      'cells:manage',
    ],
    createdAt: '2026-10-13T08:00:00Z',
    lastLoginAt: '2026-10-13T08:00:00Z',
  },
  {
    id: 'usr-eval-mariana',
    username: 'mariana.avaliador',
    fullName: 'Mariana Evaluator',
    email: 'mariana.avaliador@portaldesempenho.corp',
    role: 'avaliador',
    status: 'ativo',
    canChangePassword: true,
    isActive: true,
    password: '',
    department: 'Supervisão & Avaliação Clínica',
    individualPermissions: [
      'can_apply_evaluations',
    ],
    createdAt: '2026-10-13T08:00:00Z',
    lastLoginAt: '2026-10-13T08:00:00Z',
  },
  {
    id: 'usr-aux-carlos',
    username: 'carlos.ator',
    fullName: 'Carlos Ator',
    email: 'carlos.ator@portaldesempenho.corp',
    role: 'auxiliar',
    status: 'ativo',
    canChangePassword: true,
    isActive: true,
    password: '',
    department: 'Simulação & Apoio Cênico',
    individualPermissions: [
      'can_view_scenarios',
    ],
    createdAt: '2026-10-13T08:00:00Z',
    lastLoginAt: '2026-10-13T08:00:00Z',
  },
  {
    id: 'usr-collab-lucas',
    username: 'lucas.silveira',
    fullName: 'Lucas Silveira',
    email: 'lucas.silveira@portaldesempenho.corp',
    role: 'colaborador',
    status: 'ativo',
    canChangePassword: true,
    isActive: true,
    password: '',
    department: 'Laboratório',
    collaboratorId: 'col-lucas-silveira',
    individualPermissions: [],
    createdAt: '2026-10-13T09:30:00Z',
    lastLoginAt: '2026-10-13T09:30:00Z',
  },
];
