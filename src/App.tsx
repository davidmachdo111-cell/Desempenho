/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useState } from 'react';
import { ShieldAlert } from 'lucide-react';
import { AuthLoginView } from './components/AuthLoginView';
import { PlatformShell, PortalRoute } from './components/layout/PlatformShell';
import { PortalStoreProvider, usePortalStore } from './context/PortalStoreContext';
import { ToastProvider } from './context/ToastContext';
import { canAccessPortalRoute, getFirstAuthorizedRoute } from './lib/permissions';
import { CollaboratorsView } from './modules/collaborators/views/CollaboratorsView';
import { SurveysManagementView } from './modules/surveys/views/SurveysManagementView';
import { ChecklistsManagementView } from './modules/checklists/views/ChecklistsManagementView';
import { ExercisesSimulationView } from './modules/exercises/views/ExercisesSimulationView';
import { CharactersManagementView } from './modules/characters/views/CharactersManagementView';
import { EvaluationExecutionView } from './modules/evaluations/views/EvaluationExecutionView';
import { AdminGovernanceView } from './modules/admin/views/AdminGovernanceView';
import { CollaboratorPortalView } from './modules/collaborator-portal/views/CollaboratorPortalView';
import { TrackTemplatesView } from './modules/tracks/views/TrackTemplatesView';
import { canSeeFinalVerdict, UserProfile } from './types/portal';

interface ParsedLocation {
  route: PortalRoute | null;
  collaboratorId: string | null;
  assignmentId: string | null;
}

function parsePortalLocation(pathname: string): ParsedLocation {
  const clean = pathname.replace(/\/+$/, '') || '/';
  const segments = clean.split('/').filter(Boolean).map((s) => decodeURIComponent(s));

  if (segments.length === 0) {
    return { route: null, collaboratorId: null, assignmentId: null };
  }

  const [first, second, third] = segments;

  if (first === 'colaboradores') {
    return {
      route: 'collaborators',
      collaboratorId: second || null,
      assignmentId: null,
    };
  }
  if (first === 'modelos-de-trilha') {
    return { route: 'track-templates', collaboratorId: null, assignmentId: null };
  }
  if (first === 'pesquisas') {
    return { route: 'surveys', collaboratorId: null, assignmentId: null };
  }
  if (first === 'checklists') {
    return { route: 'checklists', collaboratorId: null, assignmentId: null };
  }
  if (first === 'exercicios') {
    return { route: 'exercises', collaboratorId: null, assignmentId: null };
  }
  if (first === 'clientes') {
    return { route: 'characters', collaboratorId: null, assignmentId: null };
  }
  if (first === 'admin') {
    return { route: 'admin', collaboratorId: null, assignmentId: null };
  }
  if (first === 'minha-trilha') {
    return { route: 'my-development', collaboratorId: null, assignmentId: null };
  }
  if (first === 'avaliacoes' && second === 'executar' && third) {
    return { route: 'evaluation-run', collaboratorId: null, assignmentId: third };
  }

  return { route: null, collaboratorId: null, assignmentId: null };
}

function buildPortalPath(
  route: PortalRoute,
  collaboratorId?: string | null,
  assignmentId?: string | null
): string {
  switch (route) {
    case 'collaborators':
      return collaboratorId
        ? `/colaboradores/${encodeURIComponent(collaboratorId)}`
        : '/colaboradores';
    case 'track-templates':
      return '/modelos-de-trilha';
    case 'surveys':
      return '/pesquisas';
    case 'checklists':
      return '/checklists';
    case 'exercises':
      return '/exercicios';
    case 'characters':
      return '/clientes';
    case 'admin':
      return '/admin';
    case 'my-development':
      return '/minha-trilha';
    case 'evaluation-run':
      return assignmentId
        ? `/avaliacoes/executar/${encodeURIComponent(assignmentId)}`
        : '/colaboradores';
    default:
      return '/colaboradores';
  }
}

function getAuthorizedLocation(
  user: UserProfile | null | undefined,
  parsed: ParsedLocation
): { route: PortalRoute; collaboratorId: string | null; assignmentId: string | null } {
  if (user?.role === 'colaborador') {
    return { route: 'my-development', collaboratorId: null, assignmentId: null };
  }

  if (parsed.route && canAccessPortalRoute(user, parsed.route)) {
    return {
      route: parsed.route,
      collaboratorId: parsed.route === 'collaborators' ? parsed.collaboratorId : null,
      assignmentId: parsed.route === 'evaluation-run' ? parsed.assignmentId : null,
    };
  }

  const fallbackRoute = getFirstAuthorizedRoute(user) || 'collaborators';
  return { route: fallbackRoute, collaboratorId: null, assignmentId: null };
}

const PortalAppInner: React.FC = () => {
  const { currentUser, collaboratorChecklists, collaborators } = usePortalStore();

  const isCollaborator = currentUser?.role === 'colaborador';
  const canOpenFinalizedFicha = canSeeFinalVerdict(currentUser);
  const firstAuthorizedRoute = getFirstAuthorizedRoute(currentUser);
  const hasAnyModuleAccess = isCollaborator || firstAuthorizedRoute !== null;

  const sanitizeAuthorizedLocation = useCallback(
    (loc: { route: PortalRoute; collaboratorId: string | null; assignmentId: string | null }) => {
      if (loc.route === 'collaborators' && loc.collaboratorId && !canOpenFinalizedFicha) {
        const targetCollab = collaborators.find((c) => c.id === loc.collaboratorId);
        if (targetCollab?.isTrackFinalized) {
          return { ...loc, collaboratorId: null };
        }
      }
      return loc;
    },
    [collaborators, canOpenFinalizedFicha]
  );

  const initialLocation = sanitizeAuthorizedLocation(
    getAuthorizedLocation(
      currentUser,
      parsePortalLocation(typeof window !== 'undefined' ? window.location.pathname : '/')
    )
  );

  const [activeRoute, setActiveRoute] = useState<PortalRoute>(initialLocation.route);
  const [activeAssignmentId, setActiveAssignmentId] = useState<string | null>(
    initialLocation.assignmentId
  );
  const [selectedCollaboratorId, setSelectedCollaboratorId] = useState<string | null>(
    initialLocation.collaboratorId
  );

  const navigateTo = useCallback(
    (
      targetRoute: PortalRoute,
      options?: {
        collaboratorId?: string | null;
        assignmentId?: string | null;
        replace?: boolean;
      }
    ) => {
      const authorized = sanitizeAuthorizedLocation(
        getAuthorizedLocation(currentUser, {
          route: targetRoute,
          collaboratorId: options?.collaboratorId ?? null,
          assignmentId: options?.assignmentId ?? null,
        })
      );

      setActiveRoute(authorized.route);
      setSelectedCollaboratorId(authorized.collaboratorId);
      setActiveAssignmentId(authorized.assignmentId);

      if (typeof window !== 'undefined') {
        const nextPath = buildPortalPath(
          authorized.route,
          authorized.collaboratorId,
          authorized.assignmentId
        );
        if (window.location.pathname !== nextPath) {
          if (options?.replace) {
            window.history.replaceState(null, '', nextPath);
          } else {
            window.history.pushState(null, '', nextPath);
          }
        }
      }
    },
    [currentUser, sanitizeAuthorizedLocation]
  );

  // Sincroniza URL e RBAC quando o papel do usuário muda, na carga inicial ou quando uma trilha é finalizada
  useEffect(() => {
    if (!currentUser) return;

    const currentParsed = parsePortalLocation(window.location.pathname);
    const authorized = sanitizeAuthorizedLocation(
      getAuthorizedLocation(currentUser, currentParsed)
    );

    if (authorized.route !== activeRoute) {
      setActiveRoute(authorized.route);
    }
    if (authorized.collaboratorId !== selectedCollaboratorId) {
      setSelectedCollaboratorId(authorized.collaboratorId);
    }
    if (authorized.assignmentId !== activeAssignmentId) {
      setActiveAssignmentId(authorized.assignmentId);
    }

    const expectedPath = buildPortalPath(
      authorized.route,
      authorized.collaboratorId,
      authorized.assignmentId
    );
    if (window.location.pathname !== expectedPath) {
      window.history.replaceState(null, '', expectedPath);
    }
  }, [
    currentUser,
    activeRoute,
    selectedCollaboratorId,
    activeAssignmentId,
    sanitizeAuthorizedLocation,
  ]);

  // Escuta os botões Voltar / Avançar do navegador (popstate)
  useEffect(() => {
    const handlePopState = () => {
      const parsed = parsePortalLocation(window.location.pathname);
      const authorized = sanitizeAuthorizedLocation(getAuthorizedLocation(currentUser, parsed));

      setActiveRoute(authorized.route);
      setSelectedCollaboratorId(authorized.collaboratorId);
      setActiveAssignmentId(authorized.assignmentId);

      const expectedPath = buildPortalPath(
        authorized.route,
        authorized.collaboratorId,
        authorized.assignmentId
      );
      if (window.location.pathname !== expectedPath) {
        window.history.replaceState(null, '', expectedPath);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, [currentUser, sanitizeAuthorizedLocation]);

  if (!currentUser) {
    return <AuthLoginView />;
  }

  // Ação fluida de iniciar avaliação
  const handleStartEvaluation = (assignmentId: string) => {
    navigateTo('evaluation-run', { assignmentId });
  };

  const handleBackFromEvaluation = (collaboratorId?: string) => {
    navigateTo('collaborators', { collaboratorId: collaboratorId || null });
  };

  const currentAssignmentId =
    activeAssignmentId ||
    collaboratorChecklists.find((c) => c.status === 'em_andamento')?.id ||
    collaboratorChecklists.find((c) => c.status === 'pendente')?.id ||
    collaboratorChecklists[0]?.id ||
    '';

  return (
    <PlatformShell
      activeRoute={activeRoute}
      onNavigate={(route, collaboratorId) => {
        navigateTo(route, { collaboratorId: collaboratorId || null });
      }}
    >
      {/* 1. VISÃO RESTRITA DO COLABORADOR (/minha-trilha) */}
      {isCollaborator && <CollaboratorPortalView />}

      {/* Estado de Permissão Zero (nenhum módulo habilitado) */}
      {!isCollaborator && !hasAnyModuleAccess && (
        <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center max-w-lg mx-auto shadow-xs space-y-3 mt-8">
          <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
            <ShieldAlert className="w-6 h-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Nenhum módulo liberado</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Este perfil não possui permissões operacionais ativas no momento. Solicite a liberação de acessos a um Administrador.
          </p>
        </div>
      )}

      {/* 2. MÓDULOS GOVERNADOS POR PERMISSÕES INDIVIDUAIS */}
      {/* Colaboradores (/colaboradores e /colaboradores/:id) */}
      {!isCollaborator &&
        canAccessPortalRoute(currentUser, 'collaborators') &&
        activeRoute === 'collaborators' && (
          <CollaboratorsView
            initialCollaboratorId={selectedCollaboratorId}
            onSelectCollaborator={(collabId) => {
              navigateTo('collaborators', { collaboratorId: collabId });
            }}
            onStartEvaluation={handleStartEvaluation}
          />
        )}

      {/* Modelos de Trilha (/modelos-de-trilha) */}
      {!isCollaborator &&
        canAccessPortalRoute(currentUser, 'track-templates') &&
        activeRoute === 'track-templates' && <TrackTemplatesView />}

      {/* Checklists (/checklists) */}
      {!isCollaborator &&
        canAccessPortalRoute(currentUser, 'checklists') &&
        activeRoute === 'checklists' && <ChecklistsManagementView />}

      {/* Exercícios (/exercicios) */}
      {!isCollaborator &&
        canAccessPortalRoute(currentUser, 'exercises') &&
        activeRoute === 'exercises' && <ExercisesSimulationView />}

      {/* Tela de Avaliação em Tempo Real (/avaliacoes/executar/:id) */}
      {!isCollaborator &&
        canAccessPortalRoute(currentUser, 'evaluation-run') &&
        activeRoute === 'evaluation-run' && (
          <EvaluationExecutionView
            assignmentId={currentAssignmentId}
            onBack={handleBackFromEvaluation}
          />
        )}

      {/* Banco de Clientes (/clientes) */}
      {!isCollaborator &&
        canAccessPortalRoute(currentUser, 'characters') &&
        activeRoute === 'characters' && <CharactersManagementView />}

      {/* Pesquisas de Satisfação (/pesquisas) */}
      {!isCollaborator &&
        canAccessPortalRoute(currentUser, 'surveys') &&
        activeRoute === 'surveys' && <SurveysManagementView />}

      {/* Administração (/admin) */}
      {!isCollaborator &&
        canAccessPortalRoute(currentUser, 'admin') &&
        activeRoute === 'admin' && <AdminGovernanceView />}
    </PlatformShell>
  );
};

export default function App() {
  return (
    <ToastProvider>
      <PortalStoreProvider>
        <PortalAppInner />
      </PortalStoreProvider>
    </ToastProvider>
  );
}
