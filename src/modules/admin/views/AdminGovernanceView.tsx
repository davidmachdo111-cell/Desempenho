import React, { useMemo, useState } from 'react';
import {
  UserPlus,
  CheckCircle2,
  X,
  KeyRound,
  UserCheck,
  UserX,
  Search,
  Clock,
  Unlock,
  ShieldAlert,
  Tags,
  Plus,
  Edit3,
  Trash2,
  Shield,
  Archive,
  Sliders,
  RotateCcw,
} from 'lucide-react';
import { usePortalStore } from '../../../context/PortalStoreContext';
import { useToast } from '../../../context/ToastContext';
import {
  ALL_PERMISSIONS_METADATA,
  ROLE_DEFAULT_PERMISSIONS,
} from '../../../lib/permissions';
import {
  Category,
  CategoryType,
  isGuardianHostUser,
  PermissionKey,
  UserRole,
  UserStatus,
} from '../../../types/portal';

export const AdminGovernanceView: React.FC = () => {
  const {
    users,
    categories,
    checklists,
    exercises,
    auditLogs,
    roleDefaultPermissions,
    updateRoleDefaultPermissions,
    updateUserPermissions,
    createNewUser,
    approveUser,
    rejectOrBlockUser,
    unblockUser,
    archiveUser,
    restoreArchivedUser,
    unlockPasswordChange,
    createCategory,
    updateCategory,
    deleteCategory,
  } = usePortalStore();
  const { showToast } = useToast();

  const pendingUsers = useMemo(
    () => users.filter((u) => u.status === 'pendente_aprovacao'),
    [users]
  );

  const [activeSubTab, setActiveSubTab] = useState<'pending' | 'users' | 'categories' | 'audit'>(
    pendingUsers.length > 0 ? 'pending' : 'users'
  );

  const [selectedUserId, setSelectedUserId] = useState<string>(
    () => users.find((u) => u.status === 'ativo')?.id || users[0]?.id || ''
  );
  const [showCreateUserModal, setShowCreateUserModal] = useState(false);
  const [userSearchQuery, setUserSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | UserStatus>('ativo');

  // Papel temporário selecionado para cada usuário na fila de aprovação
  const [pendingApprovalRoles, setPendingApprovalRoles] = useState<Record<string, UserRole>>({});

  const selectedUser = useMemo(
    () => users.find((u) => u.id === selectedUserId) || users[0] || null,
    [users, selectedUserId]
  );

  // Estados do formulário de permissões do usuário selecionado
  const [targetRole, setTargetRole] = useState<UserRole>(selectedUser?.role || 'auxiliar');
  const [targetIsActive, setTargetIsActive] = useState<boolean>(selectedUser?.isActive ?? true);
  const [targetIsGuardianHost, setTargetIsGuardianHost] = useState<boolean>(
    Boolean(selectedUser && isGuardianHostUser(selectedUser))
  );
  const [targetPermissions, setTargetPermissions] = useState<PermissionKey[]>(
    selectedUser?.individualPermissions || []
  );

  // Sincroniza estado quando muda o usuário selecionado
  React.useEffect(() => {
    if (selectedUser) {
      setTargetRole(selectedUser.role);
      setTargetIsActive(selectedUser.isActive);
      setTargetIsGuardianHost(isGuardianHostUser(selectedUser));
      setTargetPermissions(selectedUser.individualPermissions);
    }
  }, [selectedUser]);

  // Estados para criação de novo usuário
  const [newFullName, setNewFullName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newDepartment, setNewDepartment] = useState('Operações');
  const [newRole, setNewRole] = useState<UserRole>('auxiliar');
  const [newIsGuardianHost, setNewIsGuardianHost] = useState<boolean>(false);
  const [newPermissions, setNewPermissions] = useState<PermissionKey[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Estados de gestão de Categorias
  const [categorySearchQuery, setCategorySearchQuery] = useState('');
  const [categoryTypeFilter, setCategoryTypeFilter] = useState<'all' | CategoryType>('all');
  const [categoryModal, setCategoryModal] = useState<{ open: boolean; category?: Category }>({
    open: false,
  });
  const [catFormName, setCatFormName] = useState('');
  const [catFormType, setCatFormType] = useState<CategoryType>('checklist');
  const [catFormDescription, setCatFormDescription] = useState('');
  const [isSavingCategory, setIsSavingCategory] = useState(false);
  const [deleteConfirmCategory, setDeleteConfirmCategory] = useState<Category | null>(null);

  // Modal de Configuração de Padrões por Função
  const [showRoleDefaultsModal, setShowRoleDefaultsModal] = useState(false);
  const [editingDefaultsRole, setEditingDefaultsRole] = useState<'admin' | 'avaliador' | 'auxiliar'>('avaliador');
  const [draftRoleDefaults, setDraftRoleDefaults] = useState<Record<UserRole, PermissionKey[]>>(
    roleDefaultPermissions
  );
  const [isSavingDefaults, setIsSavingDefaults] = useState(false);

  // Permissões 100% sincronizadas com ALL_PERMISSIONS_METADATA (src/lib/permissions.ts)
  const SIMPLIFIED_PERMISSIONS = ALL_PERMISSIONS_METADATA;

  // Reflete automaticamente as permissões padrão configuradas ao alternar o papel corporativo
  const handleSelectRole = (newRoleValue: UserRole) => {
    setTargetRole(newRoleValue);
    if (newRoleValue === 'colaborador') {
      setTargetIsGuardianHost(false);
      setTargetPermissions([]);
      return;
    }

    const defaults = [...(roleDefaultPermissions[newRoleValue] || [])];
    setTargetIsGuardianHost(defaults.includes('can_act_as_guardian_host'));
    setTargetPermissions(defaults);
  };

  const handleSelectNewRole = (roleValue: UserRole) => {
    setNewRole(roleValue);
    if (roleValue === 'colaborador') {
      setNewIsGuardianHost(false);
      setNewPermissions([]);
      return;
    }
    const defaults = [...(roleDefaultPermissions[roleValue] || [])];
    setNewIsGuardianHost(defaults.includes('can_act_as_guardian_host'));
    setNewPermissions(defaults);
  };

  const handleToggleTargetGuardianHost = (checked: boolean) => {
    if (targetRole === 'colaborador') {
      setTargetIsGuardianHost(false);
      setTargetPermissions([]);
      return;
    }
    setTargetIsGuardianHost(checked);
    setTargetPermissions((prev) =>
      checked
        ? Array.from(new Set([...prev, 'can_act_as_guardian_host' as PermissionKey]))
        : prev.filter((p) => p !== 'can_act_as_guardian_host')
    );
  };

  const handleToggleNewGuardianHost = (checked: boolean) => {
    if (newRole === 'colaborador') {
      setNewIsGuardianHost(false);
      setNewPermissions([]);
      return;
    }
    setNewIsGuardianHost(checked);
    setNewPermissions((prev) =>
      checked
        ? Array.from(new Set([...prev, 'can_act_as_guardian_host' as PermissionKey]))
        : prev.filter((p) => p !== 'can_act_as_guardian_host')
    );
  };

  const toggleTargetPermission = (key: PermissionKey) => {
    if (targetRole === 'colaborador') return;
    const willBeChecked = !targetPermissions.includes(key);
    if (key === 'can_act_as_guardian_host') {
      setTargetIsGuardianHost(willBeChecked);
    }
    setTargetPermissions((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  };

  const toggleNewUserPermission = (key: PermissionKey) => {
    if (newRole === 'colaborador') return;
    const willBeChecked = !newPermissions.includes(key);
    if (key === 'can_act_as_guardian_host') {
      setNewIsGuardianHost(willBeChecked);
    }
    setNewPermissions((prev) =>
      prev.includes(key) ? prev.filter((p) => p !== key) : [...prev, key]
    );
  };

  const handleSaveUserPermissions = async () => {
    if (!selectedUser) return;

    const effectivePerms = targetRole === 'colaborador' ? [] : targetPermissions;
    const effectiveGuardian = targetRole === 'colaborador' ? false : targetIsGuardianHost;

    setIsSubmitting(true);
    const res = await updateUserPermissions({
      targetUserId: selectedUser.id,
      role: targetRole,
      isActive: targetIsActive,
      isGuardianHost: effectiveGuardian,
      individualPermissions: effectivePerms,
    });
    setIsSubmitting(false);

    showToast(res.message, res.success ? 'success' : 'error');
  };

  const handleApprove = async (userId: string) => {
    const role = pendingApprovalRoles[userId] || 'auxiliar';
    const res = await approveUser(userId, role);
    showToast(res.message, res.success ? 'success' : 'error');
  };

  const handleRejectOrBlock = async (userId: string) => {
    const res = await rejectOrBlockUser(userId);
    showToast(res.message, res.success ? 'success' : 'error');
  };

  const handleUnblock = async (userId: string) => {
    const res = await unblockUser(userId);
    showToast(res.message, res.success ? 'success' : 'error');
  };

  const handleArchiveUser = async (userId: string) => {
    const res = await archiveUser(userId);
    showToast(res.message, res.success ? 'success' : 'error');
  };

  const handleRestoreArchivedUser = async (userId: string) => {
    const res = await restoreArchivedUser(userId);
    showToast(res.message, res.success ? 'success' : 'error');
  };

  const handleUnlockPasswordChange = async (userId: string) => {
    const res = await unlockPasswordChange(userId);
    showToast(res.message, res.success ? 'success' : 'error');
  };

  const handleOpenCreateUserModal = () => {
    const auxDefaults = [...(roleDefaultPermissions['auxiliar'] || [])];
    setNewFullName('');
    setNewUsername('');
    setNewEmail('');
    setNewDepartment('Operações');
    setNewRole('auxiliar');
    setNewIsGuardianHost(auxDefaults.includes('can_act_as_guardian_host'));
    setNewPermissions(auxDefaults);
    setShowCreateUserModal(true);
  };

  const handleOpenRoleDefaultsModal = () => {
    setDraftRoleDefaults({
      admin: [...(roleDefaultPermissions.admin || [])],
      avaliador: [...(roleDefaultPermissions.avaliador || [])],
      auxiliar: [...(roleDefaultPermissions.auxiliar || [])],
      colaborador: [],
    });
    setEditingDefaultsRole('avaliador');
    setShowRoleDefaultsModal(true);
  };

  const handleToggleDraftRolePermission = (key: PermissionKey) => {
    setDraftRoleDefaults((prev) => {
      const current = prev[editingDefaultsRole] || [];
      const next = current.includes(key)
        ? current.filter((p) => p !== key)
        : [...current, key];
      return {
        ...prev,
        [editingDefaultsRole]: next,
      };
    });
  };

  const handleSaveRoleDefaults = async () => {
    setIsSavingDefaults(true);
    const rolesToSave: Array<'admin' | 'avaliador' | 'auxiliar'> = ['admin', 'avaliador', 'auxiliar'];
    for (const r of rolesToSave) {
      const res = await updateRoleDefaultPermissions(r, draftRoleDefaults[r] || []);
      if (!res.success) {
        setIsSavingDefaults(false);
        showToast(res.message, 'error');
        return;
      }
    }
    setIsSavingDefaults(false);
    setShowRoleDefaultsModal(false);
    showToast('Padrões de permissões por função atualizados com sucesso!', 'success');
  };

  const handleCreateNewUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFullName.trim()) {
      showToast('Preencha o nome do usuário.', 'error');
      return;
    }

    const emailToUse =
      newEmail.trim() ||
      `${(newUsername.trim() || newFullName.trim().toLowerCase().replace(/\s+/g, '.'))}@portaldesempenho.corp`;

    const effectivePerms = newRole === 'colaborador' ? [] : newPermissions;
    const effectiveGuardian = newRole === 'colaborador' ? false : newIsGuardianHost;

    setIsSubmitting(true);
    const res = await createNewUser({
      fullName: newFullName,
      email: emailToUse,
      department: newDepartment,
      role: newRole,
      isGuardianHost: effectiveGuardian,
      individualPermissions: effectivePerms,
    });
    setIsSubmitting(false);

    if (res.success) {
      showToast('Novo usuário criado com sucesso!', 'success');
      setShowCreateUserModal(false);
      setNewFullName('');
      setNewUsername('');
      setNewEmail('');
      setNewIsGuardianHost(false);
      setNewPermissions([]);
    } else {
      showToast(res.message, 'error');
    }
  };

  const statusCounts = useMemo(() => {
    const counts: Record<UserStatus, number> = {
      ativo: 0,
      aprovado_sem_senha: 0,
      pendente_aprovacao: 0,
      arquivado: 0,
      bloqueado: 0,
    };
    users.forEach((u) => {
      if (u.status in counts) {
        counts[u.status] += 1;
      }
    });
    return counts;
  }, [users]);

  const filteredUsers = useMemo(() => {
    const q = userSearchQuery.trim().toLowerCase();
    return users.filter((u) => {
      if (statusFilter !== 'all' && u.status !== statusFilter) return false;
      if (!q) return true;
      return (
        u.fullName.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.role.toLowerCase().includes(q)
      );
    });
  }, [users, userSearchQuery, statusFilter]);

  const categoryUsageMap = useMemo(() => {
    const map: Record<string, { checklists: number; exercises: number; total: number }> = {};
    categories.forEach((cat) => {
      const nameLower = cat.name.trim().toLowerCase();
      const linkedChecklists = checklists.filter(
        (chk) => chk.categoryId === cat.id || chk.categoryName?.trim().toLowerCase() === nameLower
      ).length;
      const linkedExercises = exercises.filter(
        (ex) => ex.categoryId === cat.id || ex.categoryName?.trim().toLowerCase() === nameLower
      ).length;
      map[cat.id] = {
        checklists: linkedChecklists,
        exercises: linkedExercises,
        total: linkedChecklists + linkedExercises,
      };
    });
    return map;
  }, [categories, checklists, exercises]);

  const filteredCategories = useMemo(() => {
    const q = categorySearchQuery.trim().toLowerCase();
    return categories.filter((cat) => {
      if (categoryTypeFilter !== 'all' && cat.type !== categoryTypeFilter) return false;
      if (!q) return true;
      return (
        cat.name.toLowerCase().includes(q) ||
        (cat.description || '').toLowerCase().includes(q)
      );
    });
  }, [categories, categorySearchQuery, categoryTypeFilter]);

  const openCategoryModal = (cat?: Category) => {
    if (cat) {
      setCatFormName(cat.name);
      setCatFormType(cat.type);
      setCatFormDescription(cat.description || '');
      setCategoryModal({ open: true, category: cat });
    } else {
      setCatFormName('');
      setCatFormType('checklist');
      setCatFormDescription('');
      setCategoryModal({ open: true });
    }
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!catFormName.trim()) {
      showToast('Informe o nome da categoria.', 'error');
      return;
    }

    setIsSavingCategory(true);
    const res = categoryModal.category
      ? await updateCategory(categoryModal.category.id, {
          name: catFormName.trim(),
          type: catFormType,
          description: catFormDescription.trim() || undefined,
        })
      : await createCategory({
          name: catFormName.trim(),
          type: catFormType,
          description: catFormDescription.trim() || undefined,
        });
    setIsSavingCategory(false);

    if (res.success) {
      showToast(res.message, 'success');
      setCategoryModal({ open: false });
    } else {
      showToast(res.message, 'error');
    }
  };

  const handleAttemptDeleteCategory = async (cat: Category) => {
    const usage = categoryUsageMap[cat.id];
    if (usage && usage.total > 0) {
      const res = await deleteCategory(cat.id);
      showToast(res.message, 'error');
      return;
    }
    setDeleteConfirmCategory(cat);
  };

  const handleConfirmDeleteCategory = async () => {
    if (!deleteConfirmCategory) return;
    const res = await deleteCategory(deleteConfirmCategory.id);
    setDeleteConfirmCategory(null);
    showToast(res.message, res.success ? 'success' : 'error');
  };

  return (
    <div className="space-y-6">

      {/* Cabeçalho */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-emerald-800">
            Controle de Acessos & Governança Corporativa
          </div>
          <h1 className="text-2xl font-black text-slate-900 mt-1">
            Administração de Usuários & Senhas
          </h1>
          <p className="text-sm text-slate-600 mt-1">
            Fila de aprovação de acessos, liberação de troca de senhas e delegação de competências operacionais.
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center p-1 bg-slate-200/70 rounded-xl">
            {/* Aba Fila de Aprovação */}
            <button
              type="button"
              onClick={() => setActiveSubTab('pending')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeSubTab === 'pending'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <span>Fila de Aprovação</span>
              {pendingUsers.length > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[10px] font-black bg-amber-500 text-white animate-pulse">
                  {pendingUsers.length}
                </span>
              )}
            </button>

            {/* Aba Usuários & Permissões */}
            <button
              type="button"
              onClick={() => setActiveSubTab('users')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeSubTab === 'users'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Usuários & Acessos ({users.length})
            </button>

            {/* Aba Categorias */}
            <button
              type="button"
              onClick={() => setActiveSubTab('categories')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeSubTab === 'categories'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Categorias ({categories.length})
            </button>

            {/* Aba Auditoria */}
            <button
              type="button"
              onClick={() => setActiveSubTab('audit')}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                activeSubTab === 'audit'
                  ? 'bg-white text-slate-900 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Logs ({auditLogs.length})
            </button>
          </div>

          {activeSubTab === 'categories' ? (
            <button
              type="button"
              onClick={() => openCategoryModal()}
              className="px-4 py-2 text-xs font-bold text-white bg-[#0f3e2e] hover:bg-emerald-900 rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>+ Nova Categoria</span>
            </button>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              {activeSubTab === 'users' && (
                <button
                  type="button"
                  onClick={handleOpenRoleDefaultsModal}
                  className="px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-300 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0 shadow-xs"
                  title="Configurar as permissões preenchidas automaticamente ao selecionar cada função"
                >
                  <Sliders className="w-3.5 h-3.5 text-emerald-800" />
                  <span>Padrões por Função</span>
                </button>
              )}
              <button
                type="button"
                onClick={handleOpenCreateUserModal}
                className="px-4 py-2 text-xs font-bold text-white bg-[#0f3e2e] hover:bg-emerald-900 rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              >
                <UserPlus className="w-4 h-4" />
                <span>+ Novo Usuário</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ======================================================== */}
      {/* 1. ABA: FILA DE APROVAÇÃO (PENDENTES) */}
      {/* ======================================================== */}
      {activeSubTab === 'pending' && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <Clock className="w-5 h-5 text-amber-700 shrink-0" />
              <div>
                <h2 className="text-xs font-bold uppercase tracking-wider text-amber-900">
                  Fila de Solicitações de Acesso Pendentes
                </h2>
                <p className="text-xs text-amber-800 mt-0.5">
                  Novos colaboradores que solicitaram acesso através da tela de login. Ao aprovar, o usuário recebe status &quot;Aprovado sem Senha&quot; e poderá definir sua senha pessoal no primeiro login.
                </p>
              </div>
            </div>
            <div className="font-bold text-sm text-amber-950 font-mono">
              {pendingUsers.length} aguardando
            </div>
          </div>

          {pendingUsers.length === 0 ? (
            <div className="p-12 bg-white border border-slate-200 rounded-2xl text-center space-y-2">
              <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
              <h3 className="text-sm font-bold text-slate-800">
                Fila de Aprovação Vazia
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Não há nenhuma solicitação de acesso aguardando moderação no momento. Todos os cadastros estão revisados.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {pendingUsers.map((pending) => {
                const assignedRole = pendingApprovalRoles[pending.id] || 'auxiliar';

                return (
                  <div
                    key={pending.id}
                    className="bg-white border border-amber-200 rounded-2xl p-5 shadow-xs space-y-4 relative overflow-hidden"
                  >
                    <div className="absolute top-0 left-0 right-0 h-1 bg-amber-400" />

                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-sm font-black text-slate-900">
                          {pending.fullName}
                        </h3>
                        <div className="text-xs font-mono text-emerald-800 font-bold mt-0.5">
                          @{pending.username}
                        </div>
                        <div className="text-[11px] text-slate-500 mt-1">
                          Departamento: {pending.department || 'Operações'} · Solicitado em: {new Date(pending.createdAt).toLocaleDateString('pt-BR')}
                        </div>
                      </div>

                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 border border-amber-300 uppercase">
                        Pendente
                      </span>
                    </div>

                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                      <label className="block text-[11px] font-bold text-slate-700">
                        Atribuir Função ao Aprovar:
                      </label>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                        {(['colaborador', 'auxiliar', 'avaliador', 'admin'] as UserRole[]).map((r) => (
                          <button
                            key={r}
                            type="button"
                            onClick={() =>
                              setPendingApprovalRoles((prev) => ({
                                ...prev,
                                [pending.id]: r,
                              }))
                            }
                            className={`py-1.5 px-2 rounded-lg font-bold text-[11px] border transition-all cursor-pointer ${
                              assignedRole === r
                                ? 'bg-emerald-700 text-white border-emerald-800 shadow-xs'
                                : 'bg-white text-slate-700 border-slate-200 hover:border-slate-300'
                            }`}
                          >
                            {r === 'colaborador'
                              ? 'Colaborador'
                              : r === 'auxiliar'
                              ? 'Auxiliar'
                              : r === 'avaliador'
                              ? 'Avaliador'
                              : 'Admin'}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Botões de Ação */}
                    <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-slate-100">
                      <button
                        type="button"
                        onClick={() => handleRejectOrBlock(pending.id)}
                        className="px-3.5 py-2 text-xs font-bold text-red-700 hover:text-red-800 hover:bg-red-50 border border-red-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                      >
                        <UserX className="w-3.5 h-3.5" />
                        <span>Recusar / Bloquear</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleApprove(pending.id)}
                        className="px-4 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Aprovar Acesso</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ======================================================== */}
      {/* 2. ABA: USUÁRIOS & GESTÃO DE ACESSOS */}
      {/* ======================================================== */}
      {activeSubTab === 'users' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Coluna Esquerda: Lista de Usuários */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            {/* Barra de Filtro e Busca */}
            <div className="p-3.5 bg-slate-50 border-b border-slate-200 space-y-2.5">
              <div className="relative">
                <input
                  type="text"
                  value={userSearchQuery}
                  onChange={(e) => setUserSearchQuery(e.target.value)}
                  placeholder="Buscar por nome ou @usuario..."
                  className="w-full pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                />
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-2" />
              </div>

              <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                <button
                  type="button"
                  onClick={() => setStatusFilter('ativo')}
                  className={`px-2 py-0.5 rounded-md font-semibold cursor-pointer ${
                    statusFilter === 'ativo'
                      ? 'bg-emerald-700 text-white'
                      : 'bg-white text-slate-600 border border-slate-200'
                  }`}
                >
                  Ativos ({statusCounts.ativo})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('aprovado_sem_senha')}
                  className={`px-2 py-0.5 rounded-md font-semibold cursor-pointer ${
                    statusFilter === 'aprovado_sem_senha'
                      ? 'bg-blue-700 text-white'
                      : 'bg-white text-slate-600 border border-slate-200'
                  }`}
                >
                  1º Acesso ({statusCounts.aprovado_sem_senha})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('pendente_aprovacao')}
                  className={`px-2 py-0.5 rounded-md font-semibold cursor-pointer ${
                    statusFilter === 'pendente_aprovacao'
                      ? 'bg-amber-600 text-white'
                      : 'bg-white text-slate-600 border border-slate-200'
                  }`}
                >
                  Pendentes ({statusCounts.pendente_aprovacao})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('arquivado')}
                  className={`px-2 py-0.5 rounded-md font-semibold cursor-pointer ${
                    statusFilter === 'arquivado'
                      ? 'bg-slate-600 text-white'
                      : 'bg-white text-slate-600 border border-slate-200'
                  }`}
                >
                  Arquivados ({statusCounts.arquivado})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('bloqueado')}
                  className={`px-2 py-0.5 rounded-md font-semibold cursor-pointer ${
                    statusFilter === 'bloqueado'
                      ? 'bg-red-700 text-white'
                      : 'bg-white text-slate-600 border border-slate-200'
                  }`}
                >
                  Bloqueados ({statusCounts.bloqueado})
                </button>
                <button
                  type="button"
                  onClick={() => setStatusFilter('all')}
                  className={`px-2 py-0.5 rounded-md font-semibold cursor-pointer ${
                    statusFilter === 'all'
                      ? 'bg-slate-800 text-white'
                      : 'bg-white text-slate-600 border border-slate-200'
                  }`}
                >
                  Todos ({users.length})
                </button>
              </div>
            </div>

            <div className="divide-y divide-slate-100 max-h-[600px] overflow-y-auto">
              {filteredUsers.map((u) => {
                const isSelected = u.id === selectedUser?.id;
                const isMaster = u.username === 'david.furtado';

                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => setSelectedUserId(u.id)}
                    className={`w-full text-left p-3.5 transition-all flex items-center justify-between gap-3 cursor-pointer ${
                      isSelected
                        ? 'bg-emerald-50/80 border-l-4 border-emerald-700'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-slate-900 text-xs truncate">
                          {u.fullName}
                        </span>
                        <span className="font-mono text-[10px] text-emerald-800 font-semibold">
                          @{u.username}
                        </span>
                        {isMaster && (
                          <span className="text-[9px] font-black px-1.5 py-0.2 rounded bg-amber-200 text-amber-900 uppercase">
                            Mestre
                          </span>
                        )}
                        {isGuardianHostUser(u) && (
                          <span className="inline-flex items-center gap-1 text-[9px] font-black px-1.5 py-0.5 rounded-md bg-gradient-to-r from-amber-100 to-emerald-100 border border-amber-300 text-amber-900 uppercase">
                            <Shield className="w-2.5 h-2.5 text-amber-700" />
                            Guardião Anfitrião
                          </span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500 truncate">
                        {u.role.toUpperCase()} · {u.department}
                      </div>
                    </div>

                    <div className="text-right shrink-0 space-y-0.5">
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full block text-center ${
                          u.status === 'ativo'
                            ? 'bg-emerald-100 text-emerald-800'
                            : u.status === 'aprovado_sem_senha'
                            ? 'bg-blue-100 text-blue-800'
                            : u.status === 'pendente_aprovacao'
                            ? 'bg-amber-100 text-amber-800'
                            : u.status === 'arquivado'
                            ? 'bg-slate-200 text-slate-700'
                            : 'bg-red-100 text-red-800'
                        }`}
                      >
                        {u.status === 'ativo'
                          ? 'Ativo'
                          : u.status === 'aprovado_sem_senha'
                          ? '1º Acesso'
                          : u.status === 'pendente_aprovacao'
                          ? 'Pendente'
                          : u.status === 'arquivado'
                          ? 'Arquivado'
                          : 'Bloqueado'}
                      </span>
                      {u.canChangePassword && (
                        <span className="text-[8px] font-bold text-emerald-700 block">
                          Troca liberada
                        </span>
                      )}
                    </div>
                  </button>
                );
              })}
              {filteredUsers.length === 0 && (
                <div className="p-8 text-center text-xs text-slate-400">
                  Nenhum usuário encontrado neste filtro.
                </div>
              )}
            </div>
          </div>

          {/* Coluna Direita: Editor de Usuário e Controles de Senha */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-6 shadow-xs space-y-6">
            {selectedUser ? (
              <>
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 border-b border-slate-100 pb-4">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold uppercase tracking-wider text-emerald-800">
                        Perfil do Usuário
                      </span>
                      {selectedUser.username === 'david.furtado' && (
                        <span className="text-[10px] font-black px-2 py-0.5 rounded bg-amber-200 text-amber-900 uppercase">
                          Administrador Mestre
                        </span>
                      )}
                      {isGuardianHostUser(selectedUser) && (
                        <span className="inline-flex items-center gap-1 text-[10px] font-black px-2 py-0.5 rounded-md bg-gradient-to-r from-amber-100 to-emerald-100 border border-amber-300 text-amber-900 uppercase">
                          <Shield className="w-3 h-3 text-amber-700" />
                          Guardião Anfitrião
                        </span>
                      )}
                    </div>
                    <h2 className="text-lg font-black text-slate-900 mt-0.5">
                      {selectedUser.fullName}
                    </h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Usuário: <span className="font-mono text-emerald-800 font-bold">@{selectedUser.username}</span> · {selectedUser.email}
                    </p>
                  </div>

                  {/* Badges de Status */}
                  <div className="flex flex-col items-end gap-1">
                    <span
                      className={`text-xs font-bold px-3 py-1 rounded-full ${
                        selectedUser.status === 'ativo'
                          ? 'bg-emerald-100 text-emerald-800'
                          : selectedUser.status === 'aprovado_sem_senha'
                          ? 'bg-blue-100 text-blue-800'
                          : selectedUser.status === 'pendente_aprovacao'
                          ? 'bg-amber-100 text-amber-800'
                          : selectedUser.status === 'arquivado'
                          ? 'bg-slate-200 text-slate-700'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      Status:{' '}
                      {selectedUser.status === 'ativo'
                        ? 'Ativo'
                        : selectedUser.status === 'aprovado_sem_senha'
                        ? '1º Acesso'
                        : selectedUser.status === 'pendente_aprovacao'
                        ? 'Pendente'
                        : selectedUser.status === 'arquivado'
                        ? 'Arquivado'
                        : 'Bloqueado'}
                    </span>
                    {selectedUser.canChangePassword && (
                      <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                        ✓ Troca de senha liberada
                      </span>
                    )}
                  </div>
                </div>

                {/* Painel de Controle de Credencial e Acesso (Requisito 5) */}
                <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                  <div className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                    <KeyRound className="w-3.5 h-3.5 text-emerald-800" />
                    <span>Ações de Segurança e Senha</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2.5">
                    {/* Botão: Liberar Troca de Senha */}
                    <button
                      type="button"
                      disabled={selectedUser.status === 'arquivado'}
                      onClick={() => handleUnlockPasswordChange(selectedUser.id)}
                      className="px-3.5 py-2 text-xs font-bold text-emerald-900 bg-white hover:bg-emerald-50 border border-emerald-300 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      <Unlock className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Liberar Troca de Senha</span>
                    </button>

                    {/* Botão: Reativar Usuário (quando arquivado, bloqueado ou inativo) */}
                    {(selectedUser.status === 'arquivado' ||
                      selectedUser.status === 'bloqueado' ||
                      !selectedUser.isActive) && (
                      <button
                        type="button"
                        onClick={() =>
                          selectedUser.status === 'arquivado'
                            ? handleRestoreArchivedUser(selectedUser.id)
                            : handleUnblock(selectedUser.id)
                        }
                        className="px-3.5 py-2 text-xs font-bold text-white bg-emerald-700 hover:bg-emerald-800 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Reativar Usuário</span>
                      </button>
                    )}

                    {/* Botão: Arquivar Usuário */}
                    {selectedUser.status !== 'arquivado' && (
                      <button
                        type="button"
                        onClick={() => handleArchiveUser(selectedUser.id)}
                        className="px-3.5 py-2 text-xs font-bold text-slate-700 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-300 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
                      >
                        <Archive className="w-3.5 h-3.5 text-slate-600" />
                        <span>Arquivar Usuário</span>
                      </button>
                    )}

                    {/* Botão: Bloquear Acesso */}
                    {selectedUser.status !== 'bloqueado' &&
                      selectedUser.status !== 'arquivado' &&
                      selectedUser.isActive && (
                        <button
                          type="button"
                          onClick={() => handleRejectOrBlock(selectedUser.id)}
                          className="px-3.5 py-2 text-xs font-bold text-red-700 hover:text-red-900 bg-white hover:bg-red-50 border border-red-200 rounded-xl transition-colors flex items-center gap-1.5 cursor-pointer"
                        >
                          <ShieldAlert className="w-3.5 h-3.5 text-red-600" />
                          <span>Bloquear Acesso</span>
                        </button>
                      )}
                  </div>
                  <p className="text-[11px] text-slate-500">
                    O botão &quot;Liberar Troca de Senha&quot; concede permissão temporária (<span className="font-mono">can_change_password = true</span>) para o colaborador redefinir sua credencial. Usuários arquivados têm o login suspenso até reativação.
                  </p>
                </div>

                {/* Perfil Base */}
                <div className="space-y-2">
                  <label className="block text-xs font-bold text-slate-800 uppercase tracking-wide">
                    Função Corporativa:
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <label
                      className={`p-3 rounded-xl border flex flex-col cursor-pointer transition-all ${
                        targetRole === 'admin'
                          ? 'bg-emerald-50 border-emerald-500 shadow-xs ring-1 ring-emerald-500/30'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="role"
                        value="admin"
                        checked={targetRole === 'admin'}
                        onChange={() => handleSelectRole('admin')}
                        className="hidden"
                      />
                      <span className="font-bold text-xs text-slate-900">Administrador</span>
                      <span className="text-[10px] text-slate-500 mt-1">Acesso irrestrito</span>
                    </label>

                    <label
                      className={`p-3 rounded-xl border flex flex-col cursor-pointer transition-all ${
                        targetRole === 'avaliador'
                          ? 'bg-blue-50 border-blue-500 shadow-xs ring-1 ring-blue-500/30'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="role"
                        value="avaliador"
                        checked={targetRole === 'avaliador'}
                        onChange={() => handleSelectRole('avaliador')}
                        className="hidden"
                      />
                      <span className="font-bold text-xs text-slate-900">Avaliador</span>
                      <span className="text-[10px] text-slate-500 mt-1">Aplica e pontua checklists</span>
                    </label>

                    <label
                      className={`p-3 rounded-xl border flex flex-col cursor-pointer transition-all ${
                        targetRole === 'auxiliar'
                          ? 'bg-purple-50 border-purple-500 shadow-xs ring-1 ring-purple-500/30'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="role"
                        value="auxiliar"
                        checked={targetRole === 'auxiliar'}
                        onChange={() => handleSelectRole('auxiliar')}
                        className="hidden"
                      />
                      <span className="font-bold text-xs text-slate-900">Auxiliar / Ator</span>
                      <span className="text-[10px] text-slate-500 mt-1">Apoio e visualização dos exercícios atrelados</span>
                    </label>

                    <label
                      className={`p-3 rounded-xl border flex flex-col cursor-pointer transition-all ${
                        targetRole === 'colaborador'
                          ? 'bg-emerald-50 border-emerald-600 shadow-xs ring-1 ring-emerald-500/30'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="radio"
                        name="role"
                        value="colaborador"
                        checked={targetRole === 'colaborador'}
                        onChange={() => handleSelectRole('colaborador')}
                        className="hidden"
                      />
                      <span className="font-bold text-xs text-slate-900">Colaborador</span>
                      <span className="text-[10px] text-slate-500 mt-1">Acesso restrito apenas à própria trilha</span>
                    </label>
                  </div>
                </div>

                {/* Tag em Destaque: Guardião Anfitrião */}
                <label
                  className={`p-4 rounded-xl border-2 flex items-start justify-between gap-4 transition-all ${
                    targetRole === 'colaborador'
                      ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
                      : targetIsGuardianHost
                      ? 'bg-gradient-to-r from-amber-50/90 via-emerald-50/70 to-white border-amber-400 shadow-xs cursor-pointer'
                      : 'bg-slate-50 border-slate-200 hover:border-amber-300 cursor-pointer'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                        targetIsGuardianHost
                          ? 'bg-amber-500 text-white shadow-xs'
                          : 'bg-slate-200 text-slate-500'
                      }`}
                    >
                      <Shield className="w-4 h-4" />
                    </div>
                    <div className="space-y-0.5">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-black text-slate-900">
                          Tag: Guardião Anfitrião
                        </span>
                        {targetIsGuardianHost && (
                          <span className="text-[9px] font-black px-2 py-0.5 rounded-full bg-amber-200 text-amber-950 uppercase tracking-wider">
                            Ativa
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">
                        Concede visão global de todos os colaboradores, acesso a checklists e pesquisas restritas, e poder para emitir parecer final e finalizar trilhas.
                      </p>
                    </div>
                  </div>
                  <input
                    type="checkbox"
                    disabled={targetRole === 'colaborador'}
                    checked={targetIsGuardianHost}
                    onChange={(e) => handleToggleTargetGuardianHost(e.target.checked)}
                    className="rounded text-amber-600 focus:ring-amber-500 h-5 w-5 mt-1 cursor-pointer shrink-0 disabled:cursor-not-allowed"
                  />
                </label>

                {/* Delegar Poderes e Permissões Individuais */}
                <div className="space-y-3 bg-slate-50 border border-slate-200 rounded-xl p-4.5">
                  <div className="flex items-start justify-between gap-2 flex-wrap">
                    <div>
                      <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wide">
                        Delegar Poderes e Permissões Individuais:
                      </h3>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {targetRole === 'colaborador'
                          ? 'Contas com função Colaborador operam em visão restrita à própria trilha, sem permissões administrativas.'
                          : 'Permissões padrão ajustadas automaticamente pela função. Você pode personalizar livremente ou desmarcar todas.'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {targetRole !== 'colaborador' && targetPermissions.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setTargetIsGuardianHost(false);
                            setTargetPermissions([]);
                          }}
                          className="text-[10px] font-bold text-slate-600 hover:text-red-700 underline cursor-pointer"
                        >
                          Limpar todas
                        </button>
                      )}
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                        {targetPermissions.length} ativa(s)
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2.5 pt-1">
                    {SIMPLIFIED_PERMISSIONS.map((perm) => {
                      const isChecked = targetPermissions.includes(perm.key);
                      const isDisabled = targetRole === 'colaborador';

                      return (
                        <label
                          key={perm.key}
                          className={`p-3 rounded-lg border flex items-start gap-3 transition-colors ${
                            isDisabled
                              ? 'bg-slate-100 border-slate-200 opacity-60 cursor-not-allowed'
                              : isChecked
                              ? 'bg-emerald-50/80 border-emerald-400 cursor-pointer'
                              : 'bg-white border-slate-200 hover:border-slate-300 cursor-pointer'
                          }`}
                        >
                          <input
                            type="checkbox"
                            disabled={isDisabled}
                            checked={isChecked}
                            onChange={() => toggleTargetPermission(perm.key)}
                            className="rounded text-emerald-700 focus:ring-emerald-500 h-4 w-4 mt-0.5 cursor-pointer disabled:cursor-not-allowed"
                          />
                          <div className="space-y-0.5">
                            <span className="text-xs font-semibold text-slate-800 block">
                              {perm.label}
                            </span>
                            <span className="text-[11px] text-slate-500 block">
                              {perm.description}
                            </span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>

                {/* Botão de Salvar Alterações */}
                <div className="flex justify-end pt-2">
                  <button
                    type="button"
                    disabled={isSubmitting}
                    onClick={handleSaveUserPermissions}
                    className="px-6 py-2.5 text-xs font-bold text-white bg-[#0f3e2e] hover:bg-emerald-900 rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>{isSubmitting ? 'Salvando...' : 'Salvar Alterações'}</span>
                  </button>
                </div>
              </>
            ) : (
              <div className="text-center py-8 text-xs text-slate-400">
                Selecione um usuário para gerenciar permissões.
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 3. ABA: GESTÃO CENTRALIZADA DE CATEGORIAS */}
      {/* ======================================================== */}
      {activeSubTab === 'categories' && (
        <div className="space-y-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                value={categorySearchQuery}
                onChange={(e) => setCategorySearchQuery(e.target.value)}
                placeholder="Buscar categoria por nome ou descrição..."
                className="w-full pl-9 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              />
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              {[
                { key: 'all', label: `Todas (${categories.length})` },
                { key: 'checklist', label: 'Checklist' },
                { key: 'exercise', label: 'Exercício' },
                { key: 'geral', label: 'Geral' },
              ].map((item) => {
                const isSelected = categoryTypeFilter === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => setCategoryTypeFilter(item.key as 'all' | CategoryType)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer border whitespace-nowrap ${
                      isSelected
                        ? 'bg-[#0f3e2e] text-white border-[#0f3e2e] shadow-xs'
                        : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                    }`}
                  >
                    {item.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <Tags className="w-4 h-4 text-emerald-800" />
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
                  Categorias Padronizadas ({filteredCategories.length})
                </span>
              </div>
              <span className="text-xs text-slate-500">
                Categorias em uso por checklists ou exercícios são protegidas contra exclusão
              </span>
            </div>

            {filteredCategories.length === 0 ? (
              <div className="p-12 text-center space-y-2">
                <Tags className="w-10 h-10 text-slate-300 mx-auto" />
                <h3 className="text-sm font-bold text-slate-800">
                  Nenhuma categoria encontrada
                </h3>
                <p className="text-xs text-slate-500 max-w-md mx-auto">
                  Cadastre uma nova categoria para padronizar checklists e exercícios de simulação no portal.
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => openCategoryModal()}
                    className="px-4 py-2 text-xs font-bold text-white bg-[#0f3e2e] hover:bg-emerald-900 rounded-xl transition-colors cursor-pointer"
                  >
                    + Nova Categoria
                  </button>
                </div>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50/70 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                    <tr>
                      <th className="p-3.5">Nome</th>
                      <th className="p-3.5">Escopo</th>
                      <th className="p-3.5">Descrição</th>
                      <th className="p-3.5 text-center">Checklists Vinculados</th>
                      <th className="p-3.5 text-center">Exercícios Vinculados</th>
                      <th className="p-3.5 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredCategories.map((cat) => {
                      const usage = categoryUsageMap[cat.id] || {
                        checklists: 0,
                        exercises: 0,
                        total: 0,
                      };
                      const scopeMeta =
                        cat.type === 'checklist'
                          ? {
                              label: 'Checklist',
                              cls: 'bg-emerald-50 text-emerald-800 border-emerald-200',
                            }
                          : cat.type === 'exercise'
                          ? {
                              label: 'Exercício',
                              cls: 'bg-blue-50 text-blue-800 border-blue-200',
                            }
                          : {
                              label: 'Geral',
                              cls: 'bg-slate-100 text-slate-700 border-slate-200',
                            };

                      return (
                        <tr key={cat.id} className="hover:bg-slate-50/60 transition-colors">
                          <td className="p-3.5 font-bold text-slate-900 whitespace-nowrap">
                            {cat.name}
                          </td>
                          <td className="p-3.5 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${scopeMeta.cls}`}
                            >
                              {scopeMeta.label}
                            </span>
                          </td>
                          <td className="p-3.5 text-slate-600 max-w-md">
                            {cat.description ? (
                              <span>{cat.description}</span>
                            ) : (
                              <span className="text-slate-400 italic">Sem descrição</span>
                            )}
                          </td>
                          <td className="p-3.5 text-center font-mono font-bold text-slate-800">
                            {usage.checklists}
                          </td>
                          <td className="p-3.5 text-center font-mono font-bold text-slate-800">
                            {usage.exercises}
                          </td>
                          <td className="p-3.5 text-right whitespace-nowrap">
                            <div className="inline-flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() => openCategoryModal(cat)}
                                className="px-2.5 py-1.5 text-xs font-bold text-[#0f3e2e] bg-emerald-50 hover:bg-emerald-100 rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer"
                              >
                                <Edit3 className="w-3.5 h-3.5" />
                                <span>Editar</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAttemptDeleteCategory(cat)}
                                className="px-2.5 py-1.5 text-xs font-bold text-red-700 bg-red-50 hover:bg-red-100 rounded-lg transition-colors inline-flex items-center gap-1 cursor-pointer"
                                title={
                                  usage.total > 0
                                    ? 'Categoria em uso — clique para ver detalhes'
                                    : 'Excluir categoria'
                                }
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                                <span>Excluir</span>
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* 4. ABA: LOGS DE AUDITORIA */}
      {/* ======================================================== */}
      {activeSubTab === 'audit' && (
        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-xs">
          <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-700">
              Trilha de Auditoria Imutável ({auditLogs.length} eventos)
            </span>
            <span className="text-xs text-slate-500">
              Rastreamento de acessos, logins e avaliações
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/70 border-b border-slate-200 text-slate-600 font-bold uppercase text-[10px]">
                <tr>
                  <th className="p-3">Data / Hora</th>
                  <th className="p-3">Usuário</th>
                  <th className="p-3">Módulo</th>
                  <th className="p-3">Ação</th>
                  <th className="p-3">Detalhes</th>
                  <th className="p-3 text-center">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {auditLogs.map((log) => (
                  <tr key={log.id} className="hover:bg-slate-50/50">
                    <td className="p-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString('pt-BR')}
                    </td>
                    <td className="p-3 font-bold text-slate-900">
                      {log.actorName}
                      <span className="text-[10px] text-slate-500 block font-normal">
                        {log.actorRole}
                      </span>
                    </td>
                    <td className="p-3 text-slate-600">{log.module}</td>
                    <td className="p-3 font-semibold text-slate-800">{log.action}</td>
                    <td className="p-3 text-slate-600 max-w-xs truncate" title={log.targetDescription}>
                      {log.targetDescription}
                    </td>
                    <td className="p-3 text-center">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          log.status === 'Sucesso'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-amber-100 text-amber-800'
                        }`}
                      >
                        {log.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL DE CRIAÇÃO (+ NOVO USUÁRIO) */}
      {/* ======================================================== */}
      {showCreateUserModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[92vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-[#0f3e2e] text-white flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white">+ Novo Usuário</h2>
                <p className="text-xs text-emerald-200">
                  Cadastre um novo colaborador e defina sua função.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowCreateUserModal(false)}
                className="text-emerald-200 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateNewUser} className="p-6 overflow-y-auto space-y-4 text-xs">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  required
                  value={newFullName}
                  onChange={(e) => setNewFullName(e.target.value)}
                  placeholder="Ex: Beatriz Lima"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Usuário Corporativo (nome.sobrenome)
                </label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value.toLowerCase().trim())}
                  placeholder="beatriz.lima"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono lowercase"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  E-mail Corporativo
                </label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="beatriz.lima@portaldesempenho.corp"
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Departamento
                  </label>
                  <input
                    type="text"
                    value={newDepartment}
                    onChange={(e) => setNewDepartment(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Papel Inicial
                  </label>
                  <select
                    value={newRole}
                    onChange={(e) => handleSelectNewRole(e.target.value as UserRole)}
                    className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
                  >
                    <option value="colaborador">Colaborador</option>
                    <option value="auxiliar">Auxiliar / Ator</option>
                    <option value="avaliador">Avaliador</option>
                    <option value="admin">Administrador</option>
                  </select>
                </div>
              </div>

              {/* Tag em Destaque: Guardião Anfitrião */}
              <label
                className={`p-3.5 rounded-xl border-2 flex items-start justify-between gap-3 transition-all ${
                  newRole === 'colaborador'
                    ? 'bg-slate-50 border-slate-200 opacity-60 cursor-not-allowed'
                    : newIsGuardianHost
                    ? 'bg-gradient-to-r from-amber-50 via-emerald-50/70 to-white border-amber-400 cursor-pointer'
                    : 'bg-slate-50 border-slate-200 hover:border-amber-300 cursor-pointer'
                }`}
              >
                <div className="flex items-start gap-2.5">
                  <div
                    className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                      newIsGuardianHost
                        ? 'bg-amber-500 text-white'
                        : 'bg-slate-200 text-slate-500'
                    }`}
                  >
                    <Shield className="w-3.5 h-3.5" />
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-xs font-black text-slate-900 block">
                      Tag: Guardião Anfitrião
                    </span>
                    <span className="text-[11px] text-slate-600 leading-snug block">
                      Concede visão global de todos os colaboradores, acesso a checklists e pesquisas restritas, e poder para emitir parecer final e finalizar trilhas.
                    </span>
                  </div>
                </div>
                <input
                  type="checkbox"
                  disabled={newRole === 'colaborador'}
                  checked={newIsGuardianHost}
                  onChange={(e) => handleToggleNewGuardianHost(e.target.checked)}
                  className="rounded text-amber-600 focus:ring-amber-500 h-4 w-4 mt-1 cursor-pointer shrink-0 disabled:cursor-not-allowed"
                />
              </label>

              {/* Poderes Iniciais */}
              <div className="space-y-2 pt-2 border-t border-slate-200">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-bold text-slate-800 text-xs">
                    Poderes Delegados ({newPermissions.length}):
                  </span>
                  {newRole !== 'colaborador' && newPermissions.length > 0 && (
                    <button
                      type="button"
                      onClick={() => {
                        setNewIsGuardianHost(false);
                        setNewPermissions([]);
                      }}
                      className="text-[10px] font-bold text-slate-600 hover:text-red-700 underline cursor-pointer"
                    >
                      Limpar todas
                    </button>
                  )}
                </div>
                {newRole === 'colaborador' ? (
                  <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-200 text-[11px] text-slate-500">
                    A função Colaborador possui acesso exclusivo à própria trilha, sem permissões administrativas.
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {SIMPLIFIED_PERMISSIONS.map((perm) => (
                      <label
                        key={perm.key}
                        className="flex items-center gap-2 p-2 rounded-lg bg-slate-50 border border-slate-200 cursor-pointer"
                      >
                        <input
                          type="checkbox"
                          checked={newPermissions.includes(perm.key)}
                          onChange={() => toggleNewUserPermission(perm.key)}
                          className="rounded text-emerald-700 focus:ring-emerald-500 h-4 w-4"
                        />
                        <span className="text-[11px] font-medium text-slate-800">
                          {perm.label}
                        </span>
                      </label>
                    ))}
                  </div>
                )}
              </div>

              <div className="pt-2 flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setShowCreateUserModal(false)}
                  className="px-4 py-2.5 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-2.5 font-bold text-white bg-[#0f3e2e] hover:bg-emerald-900 rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <UserPlus className="w-4 h-4" />
                  <span>{isSubmitting ? 'Criando...' : 'Criar Usuário'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL DE CRIAÇÃO / EDIÇÃO DE CATEGORIA */}
      {/* ======================================================== */}
      {categoryModal.open && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-[#0f3e2e] text-white flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-white">
                  {categoryModal.category ? 'Editar Categoria' : '+ Nova Categoria'}
                </h2>
                <p className="text-xs text-emerald-200">
                  Padronize a categorização de checklists e exercícios no portal.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCategoryModal({ open: false })}
                className="text-emerald-200 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveCategory} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Nome da Categoria *
                </label>
                <input
                  type="text"
                  required
                  value={catFormName}
                  onChange={(e) => setCatFormName(e.target.value)}
                  placeholder="Ex: Atendimento SAC, Autorização TISS..."
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium text-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Tipo / Escopo *
                </label>
                <select
                  value={catFormType}
                  onChange={(e) => setCatFormType(e.target.value as CategoryType)}
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-slate-900"
                >
                  <option value="checklist">Checklist (disponível nos checklists)</option>
                  <option value="exercise">Exercício (disponível nos exercícios)</option>
                  <option value="geral">Geral (disponível em checklists e exercícios)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-800 mb-1">
                  Descrição (Opcional)
                </label>
                <textarea
                  rows={3}
                  value={catFormDescription}
                  onChange={(e) => setCatFormDescription(e.target.value)}
                  placeholder="Explique quando os avaliadores devem selecionar esta categoria..."
                  className="w-full px-3.5 py-2 bg-white border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 text-slate-900 resize-none"
                />
              </div>

              <div className="pt-2 flex items-center justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setCategoryModal({ open: false })}
                  className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSavingCategory}
                  className="px-6 py-2 font-bold text-white bg-[#0f3e2e] hover:bg-emerald-900 rounded-xl transition-all shadow-md flex items-center gap-2 cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>
                    {isSavingCategory
                      ? 'Salvando...'
                      : categoryModal.category
                      ? 'Salvar Alterações'
                      : 'Cadastrar Categoria'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================================================== */}
      {/* MODAL DE CONFIRMAÇÃO DE EXCLUSÃO DE CATEGORIA */}
      {/* ======================================================== */}
      {deleteConfirmCategory && (
        <div className="fixed inset-0 z-60 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="w-12 h-12 rounded-full bg-red-100 text-red-600 flex items-center justify-center mx-auto">
              <Trash2 className="w-6 h-6" />
            </div>
            <div className="text-center space-y-1">
              <h3 className="text-base font-bold text-slate-900">
                Excluir categoria &ldquo;{deleteConfirmCategory.name}&rdquo;?
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Esta categoria não possui checklists ou exercícios vinculados e será removida permanentemente do portal.
              </p>
            </div>
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setDeleteConfirmCategory(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmDeleteCategory}
                className="px-5 py-2 text-xs font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors cursor-pointer shadow-xs"
              >
                Confirmar Exclusão
              </button>
            </div>
          </div>
        </div>
      )}
      {/* ======================================================== */}
      {/* MODAL DE CONFIGURAÇÃO: PADRÕES POR FUNÇÃO */}
      {/* ======================================================== */}
      {showRoleDefaultsModal && (
        <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="px-6 py-4 bg-[#0f3e2e] text-white flex items-center justify-between shrink-0">
              <div>
                <h2 className="text-base font-bold text-white flex items-center gap-2">
                  <Sliders className="w-4 h-4 text-emerald-300" />
                  <span>Padrões por Função Corporativa</span>
                </h2>
                <p className="text-xs text-emerald-200 mt-0.5">
                  Configure as permissões preenchidas automaticamente ao atribuir uma função no cadastro ou edição de usuários.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowRoleDefaultsModal(false)}
                className="text-emerald-200 hover:text-white p-1 rounded-lg hover:bg-white/10 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-4 text-xs flex-1">
              {/* Seletor da Função sendo configurada */}
              <div className="grid grid-cols-3 gap-2.5">
                {(
                  [
                    {
                      role: 'avaliador' as const,
                      label: 'Avaliador',
                      desc: 'Condução e avaliação',
                    },
                    {
                      role: 'auxiliar' as const,
                      label: 'Auxiliar / Ator',
                      desc: 'Apoio e simulação',
                    },
                    {
                      role: 'admin' as const,
                      label: 'Administrador',
                      desc: 'Governança total',
                    },
                  ] as const
                ).map((item) => {
                  const isActiveTab = editingDefaultsRole === item.role;
                  const count = (draftRoleDefaults[item.role] || []).length;
                  return (
                    <button
                      key={item.role}
                      type="button"
                      onClick={() => setEditingDefaultsRole(item.role)}
                      className={`p-3 rounded-xl border text-left transition-all cursor-pointer ${
                        isActiveTab
                          ? 'bg-emerald-50 border-emerald-600 ring-1 ring-emerald-500/30 shadow-xs'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-bold text-slate-900">{item.label}</span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${
                            isActiveTab
                              ? 'bg-emerald-700 text-white'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {count}
                        </span>
                      </div>
                      <span className="text-[10px] text-slate-500 block mt-0.5">{item.desc}</span>
                    </button>
                  );
                })}
              </div>

              {editingDefaultsRole === 'admin' && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-[11px] text-amber-900">
                  A função <strong>Administrador</strong> possui acesso irrestrito no sistema. Ajuste abaixo as permissões que vêm selecionadas no formulário ao atribuir este papel.
                </div>
              )}

              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="font-bold text-slate-800 uppercase tracking-wide text-[11px]">
                  Permissões padrão para{' '}
                  {editingDefaultsRole === 'admin'
                    ? 'Administrador'
                    : editingDefaultsRole === 'avaliador'
                    ? 'Avaliador'
                    : 'Auxiliar / Ator'}
                  :
                </span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    onClick={() =>
                      setDraftRoleDefaults((prev) => ({
                        ...prev,
                        [editingDefaultsRole]: [...(ROLE_DEFAULT_PERMISSIONS[editingDefaultsRole] || [])],
                      }))
                    }
                    className="text-[11px] font-semibold text-emerald-800 hover:text-emerald-950 inline-flex items-center gap-1 cursor-pointer"
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>Restaurar padrão inicial</span>
                  </button>
                  {(draftRoleDefaults[editingDefaultsRole] || []).length > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        setDraftRoleDefaults((prev) => ({
                          ...prev,
                          [editingDefaultsRole]: [],
                        }))
                      }
                      className="text-[11px] font-semibold text-slate-500 hover:text-red-700 underline cursor-pointer"
                    >
                      Desmarcar todas
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                {SIMPLIFIED_PERMISSIONS.map((perm) => {
                  const isChecked = (draftRoleDefaults[editingDefaultsRole] || []).includes(
                    perm.key
                  );
                  return (
                    <label
                      key={perm.key}
                      className={`p-3 rounded-xl border flex items-start gap-3 transition-colors cursor-pointer ${
                        isChecked
                          ? 'bg-emerald-50/80 border-emerald-400'
                          : 'bg-white border-slate-200 hover:border-slate-300'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => handleToggleDraftRolePermission(perm.key)}
                        className="rounded text-emerald-700 focus:ring-emerald-500 h-4 w-4 mt-0.5 cursor-pointer"
                      />
                      <div className="space-y-0.5">
                        <span className="text-xs font-semibold text-slate-800 block">
                          {perm.label}
                        </span>
                        <span className="text-[11px] text-slate-500 block">
                          {perm.description}
                        </span>
                      </div>
                    </label>
                  );
                })}
              </div>

              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600">
                A função <strong>Colaborador</strong> mantém sempre zero permissões administrativas (acesso exclusivo à própria trilha). Alterar padrões não sobrescreve permissões já personalizadas em usuários existentes até que você reatribua a função.
              </div>
            </div>

            <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end gap-3 shrink-0">
              <button
                type="button"
                onClick={() => setShowRoleDefaultsModal(false)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-200/60 rounded-xl transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={isSavingDefaults}
                onClick={handleSaveRoleDefaults}
                className="px-5 py-2 text-xs font-bold text-white bg-[#0f3e2e] hover:bg-emerald-900 rounded-xl transition-all shadow-md flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>{isSavingDefaults ? 'Salvando...' : 'Salvar Padrões'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
