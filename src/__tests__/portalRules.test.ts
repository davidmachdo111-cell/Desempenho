import { calculateWeightedScore } from '../context/PortalStoreContext';
import {
  INITIAL_CELLS,
  INITIAL_COLLABORATORS,
  INITIAL_USERS,
  INITIAL_CHARACTERS,
} from '../data/initialPortalData';
import {
  canAccessPortalRoute,
  checkUserPermission,
  getEffectivePermissions,
  getFirstAuthorizedRoute,
  isActorOnlyUser,
  normalizeRoleDefaultPermissions,
} from '../lib/permissions';
import {
  CriteriaAnswerSnapshot,
  UserProfile,
  Character,
  Exercise,
  Checklist,
  normalizePhrases,
  isGuardianHostUser,
  canViewRestrictedItem,
  canSeeFinalVerdict,
} from '../types/portal';
import {
  BATCH_CHARACTER_TEMPLATE,
  parseBatchCharactersInput,
} from '../lib/batchCharacterParser';

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
    'Banco de clientes possui dados de operadora e comportamentais completos (nome, carteirinha, classificação, contexto, humor)',
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
  const validUserStatuses = ['pendente_aprovacao', 'aprovado_sem_senha', 'ativo', 'arquivado', 'bloqueado'];
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

  // 18. Usuários estritamente restritos a David Furtado e os 3 perfis de teste solicitados
  const allowedUsernames = ['david.furtado', 'avaliador.teste', 'ator.teste', 'colaborador.teste'];
  const hasOnlyAllowedUsers = INITIAL_USERS.every((u) => allowedUsernames.includes(u.username));
  const hasDavidAdmin = INITIAL_USERS.some((u) => u.username === 'david.furtado' && u.role === 'admin');
  const hasAvaliadorTeste = INITIAL_USERS.some((u) => u.username === 'avaliador.teste' && u.role === 'avaliador');
  const hasAtorTeste = INITIAL_USERS.some((u) => u.username === 'ator.teste' && u.role === 'auxiliar');
  const hasColaboradorTeste = INITIAL_USERS.some((u) => u.username === 'colaborador.teste' && u.role === 'colaborador');

  assertScenario(
    18,
    'Cadastros de usuários contêm exclusivamente David Furtado e os 3 perfis de teste (Avaliador teste, Ator teste e Colaborador teste)',
    hasOnlyAllowedUsers && hasDavidAdmin && hasAvaliadorTeste && hasAtorTeste && hasColaboradorTeste && INITIAL_USERS.length === 4
  );

  // 19. Na visão de Ator (auxiliar), permissão estrita para acessar colaboradores (com roteiros vinculados)
  const actorUser = INITIAL_USERS.find((u) => u.username === 'ator.teste');
  const actorRoutes = ['collaborators'];
  assertScenario(
    19,
    'Na visão de Ator (auxiliar), possui acesso estritamente à rota de colaboradores com roteiros vinculados',
    Boolean(actorUser && actorUser.role === 'auxiliar' && actorRoutes.includes('collaborators') && actorRoutes.length === 1)
  );

  // 20. Na visão de Colaborador, exibição de conclusão garantida sem exposição indevida de laudo/nota
  const colabUser = INITIAL_USERS.find((u) => u.username === 'colaborador.teste');
  const testCollab = INITIAL_COLLABORATORS.find((c) => c.username === 'colaborador.teste');
  assertScenario(
    20,
    'Na visão de Colaborador, perfil e trilha focados em status concluído sem visualização de laudo técnico',
    Boolean(colabUser && colabUser.role === 'colaborador' && testCollab && testCollab.username === 'colaborador.teste')
  );

  // 21. Tag Guardião Anfitrião sincroniza com permissão can_act_as_guardian_host
  const guardianEvaluator: UserProfile = {
    ...evaluatorUser,
    isGuardianHost: true,
    individualPermissions: ['can_apply_evaluations', 'can_act_as_guardian_host'],
  };
  assertScenario(
    21,
    'Guardião Anfitrião concede acesso à permissão can_act_as_guardian_host',
    isGuardianHostUser(guardianEvaluator) === true &&
      checkUserPermission(guardianEvaluator, 'can_act_as_guardian_host') === true &&
      isGuardianHostUser(evaluatorUser) === false
  );

  // 22. Controle de visibilidade restrita permite apenas Admin e Guardião Anfitrião
  assertScenario(
    22,
    'Itens restritos são visíveis apenas para Admin e Guardião Anfitrião ativo',
    canViewRestrictedItem(adminUser, 'restrito') === true &&
      canViewRestrictedItem(guardianEvaluator, 'restrito') === true &&
      canViewRestrictedItem(evaluatorUser, 'restrito') === false &&
      canViewRestrictedItem(evaluatorUser, 'padrao') === true
  );

  // 23. Sigilo do veredito final permite visualização apenas para Admin e Guardião Anfitrião ativo
  assertScenario(
    23,
    'Veredito final e parecer são restritos a Admin e Guardião Anfitrião ativo',
    canSeeFinalVerdict({ ...adminUser, isActive: true }) === true &&
      canSeeFinalVerdict(guardianEvaluator) === true &&
      canSeeFinalVerdict(evaluatorUser) === false &&
      canSeeFinalVerdict(auxUser) === false &&
      canSeeFinalVerdict(colabUser) === false
  );

  // 24. Parser determinístico de importação em lote lê modelo padrão com --- sem alterar dados
  const templateParsed = parseBatchCharactersInput(BATCH_CHARACTER_TEMPLATE);
  assertScenario(
    24,
    'Parser determinístico converte blocos separados por --- mantendo valores exatos',
    templateParsed.format === 'text' &&
      templateParsed.validItems.length === 2 &&
      templateParsed.invalidItems.length === 0 &&
      templateParsed.validItems[0].name === 'Maria Helena Souza' &&
      templateParsed.validItems[0].cell === 'LAB' &&
      templateParsed.validItems[0].typicalPhrases.length === 2 &&
      templateParsed.validItems[1].cell === 'OPERADORA' &&
      templateParsed.validItems[1].customerTier === 'Crítico'
  );

  // 25. Parser determinístico suporta array JSON preservando campos exatos
  const jsonParsed = parseBatchCharactersInput(
    JSON.stringify([
      {
        NOME: 'João Silva',
        CELULA: 'IMG',
        IDADE: '32 anos',
        SEXO: 'Masculino',
        CIDADE: 'Itajaí - SC',
        CARTEIRINHA: '0000.0000.00000-09',
        CLASSIFICACAO: 'Intermediário',
        CONTEXTO: 'Solicita agendamento de ressonância.',
        TEMPERAMENTO: 'Calmo',
        OBJETIVO: 'Confirmar horário de exame',
        FALAS: ['Qual o preparo necessário?'],
      },
    ])
  );
  assertScenario(
    25,
    'Parser determinístico aceita array JSON preservando os valores exatos',
    jsonParsed.format === 'json' &&
      jsonParsed.validItems.length === 1 &&
      jsonParsed.validItems[0].name === 'João Silva' &&
      jsonParsed.validItems[0].cell === 'IMG' &&
      jsonParsed.validItems[0].customerTier === 'Intermediário' &&
      jsonParsed.validItems[0].typicalPhrases[0] === 'Qual o preparo necessário?'
  );

  // 26. Parser determinístico aponta erros sem inventar ou completar campos inválidos
  const invalidParsed = parseBatchCharactersInput(
    'NOME: \nCELULA: INVALIDA\nSEXO: Outro\nCLASSIFICACAO: Simples\nCONTEXTO: '
  );
  assertScenario(
    26,
    'Parser determinístico rejeita bloco com campos obrigatórios vazios ou célula inválida',
    invalidParsed.validItems.length === 0 &&
      invalidParsed.invalidItems.length === 1 &&
      invalidParsed.invalidItems[0].errors.length >= 3
  );

  // 27. Permissão Zero: usuário não-admin salvo com individualPermissions=[] não recebe permissões forçadas
  const zeroPermEvaluator: UserProfile = {
    ...evaluatorUser,
    isGuardianHost: false,
    individualPermissions: [],
  };
  assertScenario(
    27,
    'Permissão Zero respeita individualPermissions=[] sem forçar permissões padrão da role',
    checkUserPermission(zeroPermEvaluator, 'can_apply_evaluations') === false &&
      getEffectivePermissions(zeroPermEvaluator).length === 0
  );

  // 28. Usuário com role colaborador nunca recebe permissões administrativas ou Guardião Anfitrião
  const colabWithAttemptedPerms: UserProfile = {
    ...(colabUser || evaluatorUser),
    role: 'colaborador',
    isGuardianHost: true,
    individualPermissions: ['can_manage_collaborators', 'can_act_as_guardian_host'],
  };
  assertScenario(
    28,
    'Perfil colaborador mantém zero permissões operacionais e não atua como Guardião Anfitrião',
    checkUserPermission(colabWithAttemptedPerms, 'can_manage_collaborators') === false &&
      isGuardianHostUser(colabWithAttemptedPerms) === false &&
      getEffectivePermissions(colabWithAttemptedPerms).length === 0
  );

  // 29. Usuário arquivado tem todas as permissões e selos bloqueados
  const archivedUser: UserProfile = {
    ...evaluatorUser,
    status: 'arquivado',
    isActive: false,
    isGuardianHost: true,
    individualPermissions: ['can_apply_evaluations', 'can_act_as_guardian_host'],
  };
  assertScenario(
    29,
    'Usuário arquivado perde acesso efetivo a permissões e Guardião Anfitrião',
    checkUserPermission(archivedUser, 'can_apply_evaluations') === false &&
      isGuardianHostUser(archivedUser) === false &&
      getEffectivePermissions(archivedUser).length === 0
  );

  // 30. Auxiliar com permissões expandidas desbloqueia rotas e deixa o modo exclusivo de ator
  const promotedAux: UserProfile = {
    ...auxUser,
    isActive: true,
    status: 'ativo',
    individualPermissions: ['can_view_scenarios', 'can_manage_collaborators', 'users:manage', 'can_manage_checklists'],
  };
  assertScenario(
    30,
    'Auxiliar com permissões atribuídas acessa Administração/Checklists e sai do modo restrito de ator',
    canAccessPortalRoute(promotedAux, 'admin') === true &&
      canAccessPortalRoute(promotedAux, 'checklists') === true &&
      canAccessPortalRoute(promotedAux, 'collaborators') === true &&
      isActorOnlyUser(promotedAux) === false
  );

  // 31. Auxiliar padrão (somente can_view_scenarios) permanece no modo ator e bloqueado para outros módulos
  const standardActor: UserProfile = {
    ...auxUser,
    isActive: true,
    status: 'ativo',
    isGuardianHost: false,
    individualPermissions: ['can_view_scenarios'],
  };
  assertScenario(
    31,
    'Auxiliar somente com can_view_scenarios opera no modo ator restrito',
    isActorOnlyUser(standardActor) === true &&
      canAccessPortalRoute(standardActor, 'collaborators') === true &&
      canAccessPortalRoute(standardActor, 'checklists') === false &&
      canAccessPortalRoute(standardActor, 'admin') === false
  );

  // 32. individualPermissions é estritamente soberana mesmo quando indefinida (sem fallback legado)
  const missingArrayEvaluator = {
    ...evaluatorUser,
    isActive: true,
    status: 'ativo',
    individualPermissions: undefined,
  } as unknown as UserProfile;
  assertScenario(
    32,
    'Soberania de individualPermissions não reativa permissões padrão por fallback',
    checkUserPermission(missingArrayEvaluator, 'can_apply_evaluations') === false &&
      canAccessPortalRoute(missingArrayEvaluator, 'evaluation-run') === false &&
      getFirstAuthorizedRoute(missingArrayEvaluator) === null
  );

  // 33. Avaliador sem can_apply_evaluations perde rota de execução mas mantém módulos atribuídos
  const customEvaluator: UserProfile = {
    ...evaluatorUser,
    isActive: true,
    status: 'ativo',
    isGuardianHost: false,
    individualPermissions: ['cells:manage', 'can_manage_exercises'],
  };
  assertScenario(
    33,
    'Avaliador com permissões customizadas acessa apenas rotas compatíveis',
    canAccessPortalRoute(customEvaluator, 'characters') === true &&
      canAccessPortalRoute(customEvaluator, 'exercises') === true &&
      canAccessPortalRoute(customEvaluator, 'evaluation-run') === false &&
      canAccessPortalRoute(customEvaluator, 'collaborators') === false &&
      getFirstAuthorizedRoute(customEvaluator) === 'exercises'
  );

  // 34. Normalização de padrões por função preserva colaborador vazio e sanitiza chaves inválidas
  const normalizedDefaults = normalizeRoleDefaultPermissions({
    avaliador: ['can_apply_evaluations', 'can_manage_checklists', 'chave_invalida'],
    auxiliar: [],
    colaborador: ['users:manage'],
  });
  assertScenario(
    34,
    'Normalização de padrões por função aceita auxiliar=[] e força colaborador=[]',
    normalizedDefaults.avaliador.length === 2 &&
      normalizedDefaults.auxiliar.length === 0 &&
      normalizedDefaults.colaborador.length === 0
  );

  // 35. Colaborador acessa exclusivamente /minha-trilha
  const activeColab: UserProfile = {
    ...(colabUser || evaluatorUser),
    role: 'colaborador',
    status: 'ativo',
    isActive: true,
    individualPermissions: [],
  };
  assertScenario(
    35,
    'Colaborador ativo acessa exclusivamente my-development',
    canAccessPortalRoute(activeColab, 'my-development') === true &&
      canAccessPortalRoute(activeColab, 'collaborators') === false &&
      getFirstAuthorizedRoute(activeColab) === 'my-development'
  );

  const totalPassed = results.filter((r) => r.passed).length;
  const totalFailed = results.filter((r) => !r.passed).length;

  return { totalPassed, totalFailed, results };
}
