import {
  isGuardianHostUser,
  PermissionKey,
  PortalRoute,
  UserProfile,
  UserRole,
} from '../types/portal';

export const ROLE_DEFAULT_PERMISSIONS_STORAGE_KEY = 'portal_role_defaults_store';

// Padrões iniciais de fábrica por função corporativa:
// - admin tem controle total (e acesso irrestrito no checkUserPermission)
// - avaliador pode conduzir e aplicar avaliações
// - auxiliar/ator pode visualizar cenários de simulação e casos atrelados
// - colaborador acessa exclusivamente sua própria trilha
export const ROLE_DEFAULT_PERMISSIONS: Record<UserRole, PermissionKey[]> = {
  admin: [
    'can_manage_collaborators',
    'can_manage_checklists',
    'can_manage_exercises',
    'can_apply_evaluations',
    'can_view_scenarios',
    'users:manage',
    'cells:manage',
    'can_act_as_guardian_host',
  ],
  avaliador: ['can_apply_evaluations'],
  auxiliar: ['can_view_scenarios'],
  colaborador: [],
};

export const ALL_PERMISSIONS_METADATA: Array<{
  key: PermissionKey;
  label: string;
  description: string;
}> = [
  {
    key: 'can_manage_collaborators',
    label: 'Gerenciar Colaboradores (can_manage_collaborators)',
    description:
      'Cadastrar novos colaboradores, editar perfis, alterar status e atribuir checklists de treinamento.',
  },
  {
    key: 'can_manage_checklists',
    label: 'Gerenciar Checklists e Critérios (can_manage_checklists)',
    description:
      'Criar e editar modelos de checklists, vincular exercícios e ponderar critérios de avaliação.',
  },
  {
    key: 'can_manage_exercises',
    label: 'Gerenciar Exercícios e Roteiros (can_manage_exercises)',
    description:
      'Criar cenários de simulação com cliente, instruções para atores e realizar upload de guias.',
  },
  {
    key: 'can_apply_evaluations',
    label: 'Conduzir e Avaliar Simulações (can_apply_evaluations)',
    description:
      'Iniciar treinamentos em tempo real, dar checks nos critérios e registrar a nota final.',
  },
  {
    key: 'can_view_scenarios',
    label: 'Visualizar Cenários de Simulação Vinculados (can_view_scenarios)',
    description:
      'Consultar roteiros de casos clínicos, falas/objeções do paciente e guias médicas de apoio.',
  },
  {
    key: 'users:manage',
    label: 'Administrar Usuários e Permissões (users:manage)',
    description: 'Ativar/arquivar contas, alterar papéis e conceder permissões granulares.',
  },
  {
    key: 'cells:manage',
    label: 'Gerenciar Células e Padrões (cells:manage)',
    description: 'Cadastrar células de atendimento e aprovar padrões de serviço.',
  },
  {
    key: 'can_act_as_guardian_host',
    label: 'Guardião Anfitrião (can_act_as_guardian_host)',
    description:
      'Concede visão global de todos os colaboradores, acesso a checklists e pesquisas restritas, e poder para emitir parecer final e finalizar trilhas.',
  },
];

const VALID_PERMISSION_KEYS = new Set<PermissionKey>(
  ALL_PERMISSIONS_METADATA.map((p) => p.key)
);

function sanitizePermissionList(value: unknown, fallback: PermissionKey[]): PermissionKey[] {
  if (!Array.isArray(value)) {
    return [...fallback];
  }
  const unique = new Set<PermissionKey>();
  for (const item of value) {
    if (typeof item === 'string' && VALID_PERMISSION_KEYS.has(item as PermissionKey)) {
      unique.add(item as PermissionKey);
    }
  }
  return Array.from(unique);
}

export function normalizeRoleDefaultPermissions(
  raw?: Partial<Record<UserRole, unknown>> | null
): Record<UserRole, PermissionKey[]> {
  return {
    admin: sanitizePermissionList(raw?.admin, ROLE_DEFAULT_PERMISSIONS.admin),
    avaliador: sanitizePermissionList(raw?.avaliador, ROLE_DEFAULT_PERMISSIONS.avaliador),
    auxiliar: sanitizePermissionList(raw?.auxiliar, ROLE_DEFAULT_PERMISSIONS.auxiliar),
    colaborador: [],
  };
}

export function loadRoleDefaultPermissions(): Record<UserRole, PermissionKey[]> {
  try {
    if (typeof localStorage === 'undefined') {
      return normalizeRoleDefaultPermissions();
    }
    const stored = localStorage.getItem(ROLE_DEFAULT_PERMISSIONS_STORAGE_KEY);
    if (stored) {
      const parsed = JSON.parse(stored);
      if (parsed && typeof parsed === 'object') {
        return normalizeRoleDefaultPermissions(parsed as Partial<Record<UserRole, unknown>>);
      }
    }
  } catch {
    // fallback para os padrões iniciais
  }
  return normalizeRoleDefaultPermissions();
}

export function saveRoleDefaultPermissions(defaults: Record<UserRole, PermissionKey[]>): void {
  try {
    if (typeof localStorage === 'undefined') return;
    const normalized = normalizeRoleDefaultPermissions(defaults);
    localStorage.setItem(ROLE_DEFAULT_PERMISSIONS_STORAGE_KEY, JSON.stringify(normalized));
  } catch {
    // ignore storage errors
  }
}

export function checkUserPermission(
  user: UserProfile | null | undefined,
  requiredPermission: PermissionKey
): boolean {
  if (
    !user ||
    !user.isActive ||
    user.status === 'bloqueado' ||
    user.status === 'arquivado'
  ) {
    return false;
  }

  // Colaborador acessa exclusivamente sua própria trilha (sem permissões administrativas)
  if (user.role === 'colaborador') {
    return false;
  }

  // Admin possui controle irrestrito
  if (user.role === 'admin') {
    return true;
  }

  // Para avaliador e auxiliar: individualPermissions é estritamente soberana (sem fallback de role)
  if (
    requiredPermission === 'can_act_as_guardian_host' &&
    user.isGuardianHost === true
  ) {
    return true;
  }

  return Array.isArray(user.individualPermissions)
    ? user.individualPermissions.includes(requiredPermission)
    : false;
}

export function getEffectivePermissions(user: UserProfile | null | undefined): PermissionKey[] {
  if (
    !user ||
    !user.isActive ||
    user.status === 'bloqueado' ||
    user.status === 'arquivado' ||
    user.role === 'colaborador'
  ) {
    return [];
  }
  if (user.role === 'admin') {
    return ALL_PERMISSIONS_METADATA.map((p) => p.key);
  }
  const resolved = new Set<PermissionKey>(
    Array.isArray(user.individualPermissions) ? user.individualPermissions : []
  );
  if (user.isGuardianHost === true) {
    resolved.add('can_act_as_guardian_host');
  }
  return Array.from(resolved);
}

export const MANAGER_ROUTE_PRIORITY: PortalRoute[] = [
  'collaborators',
  'track-templates',
  'surveys',
  'checklists',
  'exercises',
  'characters',
  'admin',
];

export function canAccessPortalRoute(
  user: UserProfile | null | undefined,
  route: PortalRoute
): boolean {
  if (
    !user ||
    !user.isActive ||
    user.status === 'bloqueado' ||
    user.status === 'arquivado'
  ) {
    return false;
  }

  if (user.role === 'colaborador') {
    return route === 'my-development';
  }

  if (route === 'my-development') {
    return false;
  }

  if (user.role === 'admin') {
    return true;
  }

  switch (route) {
    case 'collaborators':
      return (
        checkUserPermission(user, 'can_manage_collaborators') ||
        checkUserPermission(user, 'can_apply_evaluations') ||
        checkUserPermission(user, 'can_view_scenarios') ||
        isGuardianHostUser(user)
      );
    case 'track-templates':
      return checkUserPermission(user, 'can_manage_collaborators');
    case 'checklists':
      return checkUserPermission(user, 'can_manage_checklists');
    case 'exercises':
      return checkUserPermission(user, 'can_manage_exercises');
    case 'characters':
      return (
        checkUserPermission(user, 'can_manage_exercises') ||
        checkUserPermission(user, 'cells:manage')
      );
    case 'surveys':
      return (
        checkUserPermission(user, 'can_manage_checklists') ||
        isGuardianHostUser(user)
      );
    case 'admin':
      return checkUserPermission(user, 'users:manage');
    case 'evaluation-run':
      return checkUserPermission(user, 'can_apply_evaluations');
    default:
      return false;
  }
}

export function getFirstAuthorizedRoute(
  user: UserProfile | null | undefined
): PortalRoute | null {
  if (
    !user ||
    !user.isActive ||
    user.status === 'bloqueado' ||
    user.status === 'arquivado'
  ) {
    return null;
  }

  if (user.role === 'colaborador') {
    return 'my-development';
  }

  for (const route of MANAGER_ROUTE_PRIORITY) {
    if (canAccessPortalRoute(user, route)) {
      return route;
    }
  }

  return null;
}

export function isActorOnlyUser(user: UserProfile | null | undefined): boolean {
  if (
    !user ||
    !user.isActive ||
    user.status === 'bloqueado' ||
    user.status === 'arquivado' ||
    user.role === 'admin' ||
    user.role === 'colaborador'
  ) {
    return false;
  }

  return (
    checkUserPermission(user, 'can_view_scenarios') &&
    !checkUserPermission(user, 'can_manage_collaborators') &&
    !checkUserPermission(user, 'can_apply_evaluations') &&
    !isGuardianHostUser(user)
  );
}
