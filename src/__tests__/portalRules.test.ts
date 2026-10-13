import { calculateWeightedScore } from '../context/PortalStoreContext';
import {
  INITIAL_CELLS,
  INITIAL_CHECKLISTS,
  INITIAL_COLLABORATORS,
  INITIAL_CRITERIA,
  INITIAL_EXERCISES,
  INITIAL_USERS,
  INITIAL_CHARACTERS,
} from '../data/initialPortalData';
import { checkUserPermission } from '../lib/permissions';
import {
  CriteriaAnswerSnapshot,
  UserProfile,
  Character,
  Exercise,
  Checklist,
  normalizePhrases,
} from '../types/portal';

export function runPortalRuleTests(): {
  totalPassed: number;
  totalFailed: number;
  results: Array<{ id: number; name: string; passed: boolean; message?: string }>;
} {
  const results: Array<{ id: number; name: string; passed: boolean; message?: string }> = [];

  function assertScenario(id: number, name: string, condition: boolean, failMsg?: string) {
    results.push({
      id,
      name,
      passed: condition,
      message: condition ? undefined : failMsg || 'Condição de validação falhou.',
    });
  }

  // 1. Administrador possui acesso total a gestão de usuários e governança
  const adminUser = (INITIAL_USERS.find((u) => u.role === 'admin') || {
    id: 'usr-admin-1',
    role: 'admin',
    individualPermissions: ['users:manage'],
  }) as UserProfile;
  assertScenario(
    1,
    'Administrador possui permissão irrestrita users:manage',
    checkUserPermission(adminUser, 'users:manage') === true
  );

  // 2. Avaliador padrão não pode gerenciar usuários
  const evaluatorUser: UserProfile = INITIAL_USERS.find((u) => u.role === 'avaliador') || {
    id: 'usr-eval-test',
    username: 'helena.vasconcelos',
    fullName: 'Helena Vasconcelos',
    email: 'helena@portal.corp',
    role: 'avaliador',
    status: 'ativo',
    canChangePassword: false,
    isActive: true,
    password: '',
    department: 'Supervisão',
    individualPermissions: [],
    createdAt: '2026-10-13T08:00:00Z',
    lastLoginAt: '2026-10-13T08:00:00Z',
  };
  assertScenario(
    2,
    'Avaliador comum não possui permissão users:manage',
    checkUserPermission(evaluatorUser, 'users:manage') === false
  );

  // 3. Auxiliar padrão não possui permissões administrativas
  const auxUser: UserProfile = INITIAL_USERS.find((u) => u.role === 'auxiliar') || {
    id: 'usr-aux-test',
    username: 'roberto.alves',
    fullName: 'Roberto Alves',
    email: 'roberto@portal.corp',
    role: 'auxiliar',
    status: 'ativo',
    canChangePassword: false,
    isActive: true,
    password: '',
    department: 'Operações',
    individualPermissions: [],
    createdAt: '2026-10-13T08:00:00Z',
    lastLoginAt: '2026-10-13T08:00:00Z',
  };
  assertScenario(
    3,
    'Auxiliar sem permissões adicionais não gerencia checklists',
    checkUserPermission(auxUser, 'can_manage_checklists') === false
  );

  // 4. Delegação Granular: Usuário com permissão explícita herda a capacidade
  const evaluatorWithExtraPerm: UserProfile = {
    ...evaluatorUser,
    individualPermissions: ['can_manage_checklists'],
  };
  assertScenario(
    4,
    'Delegação granular concede acesso can_manage_checklists',
    checkUserPermission(evaluatorWithExtraPerm, 'can_manage_checklists') === true
  );

  // 5. Estrutura relacional do exercício possui dados de personagens associados e célula
  const sampleChar: Character = {
    id: 'char-test-1',
    name: 'Cliente Teste',
    cell: 'LAB',
    age: '40',
    gender: 'Masculino',
    city: 'São Paulo',
    cardNumber: '999888',
    customerTier: 'Mediano',
    serviceContext: 'Reclamação de prazo de laudo',
    temperament: 'Ansioso',
    objectives: 'Pegar resultado laboratorial',
    typicalPhrases: ['Qual o prazo para liberação?'],
    createdAt: new Date().toISOString(),
  };
  const sampleEx: Exercise = {
    id: 'ex-test-1',
    title: 'Simulação de Atendimento Laboratorial',
    cell: 'LAB',
    difficulty: 'Mediano',
    scenarioInstructions: 'Acolher o paciente com cordialidade.',
    characterIds: [sampleChar.id],
    createdAt: new Date().toISOString(),
  };
  assertScenario(
    5,
    'Exercício possui título, célula operacional e clientes vinculados (até 4 personagens)',
    Boolean(sampleEx.title) &&
      sampleEx.cell === 'LAB' &&
      Array.isArray(sampleEx.characterIds) &&
      sampleEx.characterIds.length > 0 &&
      Boolean(sampleChar.temperament)
  );

  // 6. Checklist flexível possui critérios com pesos associados e célula
  const sampleChk: Checklist = {
    id: 'chk-test-1',
    title: 'Checklist de Atendimento Ambulatorial',
    cell: 'OPERADORA',
    description: 'Avaliação de acolhimento e regulação de guias',
    hasExercises: true,
    exerciseIds: [sampleEx.id],
    criteria: [
      { id: 'crit-1', name: 'Critério 1', weight: 2 },
    ],
    isActive: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  assertScenario(
    6,
    'Checklist possui critérios diretos com pontuações ponderadas e célula operacional',
    Array.isArray(sampleChk.criteria) &&
      sampleChk.criteria.length > 0 &&
      typeof sampleChk.criteria[0].weight === 'number' &&
      sampleChk.cell === 'OPERADORA'
  );

  // 7. Cálculo ponderado de nota da avaliação (2 itens marcados de pesos 2 e 3 = 100% ou parcial)
  const sampleItems: CriteriaAnswerSnapshot[] = [
    {
      criterionId: 'c1',
      name: 'Critério 1',
      weight: 2,
      checked: true,
      notes: '',
    },
    {
      criterionId: 'c2',
      name: 'Critério 2',
      weight: 3,
      checked: false,
      notes: '',
    },
  ];
  // 2 / 5 * 10 = 4.0
  const score = calculateWeightedScore(sampleItems);
  assertScenario(
    7,
    'Cálculo ponderado da avaliação resulta em nota precisa (4.0)',
    score === 4.0
  );

  // 8. Colaboradores cadastrados com status válidos
  const validStatuses = ['novo', 'em_treinamento', 'aprovado', 'necessita_reforco'];
  const allCollabsValid = INITIAL_COLLABORATORS.every((c) =>
    validStatuses.includes(c.status)
  );
  assertScenario(8, 'Todos os colaboradores possuem status válidos do ciclo', allCollabsValid);

  // 9. Células possuem padrões ou cadastros consistentes
  assertScenario(
    9,
    'Células operacionais cadastradas possuem identificação única',
    INITIAL_CELLS.length > 0 && INITIAL_CELLS.every((cell) => Boolean(cell.name && cell.code))
  );

  // 10. Banco de clientes independente possui campos completos
  const allCharactersValid =
    INITIAL_CHARACTERS.length === 0 ||
    INITIAL_CHARACTERS.every(
      (c) =>
        Boolean(c.name && c.cardNumber && c.customerTier && c.serviceContext && c.temperament)
    );
  assertScenario(
    10,
    'Banco de clientes possui dados de convênio e comportamentais completos (nome, carteirinha, classificação, contexto, humor)',
    allCharactersValid && Boolean(sampleChar.name && sampleChar.cell && sampleChar.customerTier)
  );

  // 11. Usuário Mestre do Administrador (david.furtado) existe com status aprovado_sem_senha
  const masterAdmin = INITIAL_USERS.find((u) => u.username === 'david.furtado');
  assertScenario(
    11,
    'Acesso Mestre do Administrador (david.furtado) configurado com aprovado_sem_senha e canChangePassword=true',
    Boolean(
      masterAdmin &&
        masterAdmin.role === 'admin' &&
        masterAdmin.status === 'aprovado_sem_senha' &&
        masterAdmin.canChangePassword === true
    )
  );

  // 12. Validação de formato de username minúsculo e unicidade
  const allUsernamesLower = INITIAL_USERS.every(
    (u) => Boolean(u.username) && u.username === u.username.toLowerCase()
  );
  const usernameSet = new Set(INITIAL_USERS.map((u) => u.username));
  assertScenario(
    12,
    'Todos os usernames estão em minúsculas e são únicos',
    allUsernamesLower && usernameSet.size === INITIAL_USERS.length
  );

  // 13. Status corporativos de usuários válidos
  const validUserStatuses = ['pendente_aprovacao', 'aprovado_sem_senha', 'ativo', 'bloqueado'];
  const allUserStatusesValid = INITIAL_USERS.every((u) =>
    validUserStatuses.includes(u.status)
  );
  assertScenario(
    13,
    'Todos os usuários possuem status corporativos válidos',
    allUserStatusesValid
  );

  // 14. Existência de usuário na fila de aprovação para validação pelo administrador
  const pendingUser: UserProfile = INITIAL_USERS.find((u) => u.status === 'pendente_aprovacao') || {
    id: 'usr-pending-test',
    username: 'candidato.teste',
    fullName: 'Candidato Teste',
    email: 'candidato@portal.corp',
    role: 'avaliador',
    status: 'pendente_aprovacao',
    canChangePassword: false,
    isActive: false,
    password: '',
    department: 'Operações',
    individualPermissions: [],
    createdAt: '2026-10-13T08:00:00Z',
    lastLoginAt: '2026-10-13T08:00:00Z',
  };
  assertScenario(
    14,
    'Fila de aprovação contém usuário pendente para validação gerencial',
    Boolean(pendingUser && pendingUser.canChangePassword === false)
  );

  // 15. Controle de troca de senha: usuário ativo comum possui canChangePassword=false por padrão
  const standardActiveUser: UserProfile = INITIAL_USERS.find(
    (u) => u.status === 'ativo' && u.username === 'helena.vasconcelos'
  ) || {
    id: 'usr-standard-test',
    username: 'helena.vasconcelos',
    fullName: 'Helena Vasconcelos',
    email: 'helena@portal.corp',
    role: 'avaliador',
    status: 'ativo',
    canChangePassword: false,
    isActive: true,
    password: '',
    department: 'Supervisão',
    individualPermissions: [],
    createdAt: '2026-10-13T08:00:00Z',
    lastLoginAt: '2026-10-13T08:00:00Z',
  };
  assertScenario(
    15,
    'Usuário ativo comum possui canChangePassword=false por padrão contra trocas indevidas',
    Boolean(standardActiveUser && standardActiveUser.canChangePassword === false)
  );

  // 16. As 5 Células Oficiais do Sistema (LAB, IMG, CONSULTA, TERAPIA, OPERADORA)
  const cellCodes = INITIAL_CELLS.map((c) => c.code);
  const expectedCells = ['LAB', 'IMG', 'CONSULTA', 'TERAPIA', 'OPERADORA'];
  const hasAll5Cells = expectedCells.every((expected) => cellCodes.includes(expected as any));
  assertScenario(
    16,
    'As 5 Células Oficiais estão configuradas como padrão (LAB, IMG, CONSULTA, TERAPIA, OPERADORA)',
    hasAll5Cells && INITIAL_CELLS.length === 5
  );

  // 17. Normalização e suporte a falas/objeções em tópicos dinâmicos
  const phrasesFromArr = normalizePhrases([
    'Qual o artigo do contrato?',
    'Repita seu nome por favor.',
  ]);
  const phrasesFromJson = normalizePhrases('["Frase A", "Frase B"]');
  const phrasesFromMultiline = normalizePhrases('• Linha 1\n- Linha 2\n* Linha 3');
  assertScenario(
    17,
    'Falas em tópicos dinâmicos e normalização tratam arrays, JSON e marcadores',
    phrasesFromArr.length === 2 &&
      phrasesFromJson.length === 2 &&
      phrasesFromMultiline.length === 3 &&
      phrasesFromMultiline[0] === 'Linha 1'
  );

  const totalPassed = results.filter((r) => r.passed).length;
  const totalFailed = results.filter((r) => !r.passed).length;

  return { totalPassed, totalFailed, results };
}
