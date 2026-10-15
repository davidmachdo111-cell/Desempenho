/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AuthLoginView } from './components/AuthLoginView';
import { PlatformShell, PortalRoute } from './components/layout/PlatformShell';
import { PortalStoreProvider, usePortalStore } from './context/PortalStoreContext';
import { CollaboratorsView } from './modules/collaborators/views/CollaboratorsView';
import { TracksManagementView } from './modules/tracks/views/TracksManagementView';
import { SurveysManagementView } from './modules/surveys/views/SurveysManagementView';
import { ChecklistsManagementView } from './modules/checklists/views/ChecklistsManagementView';
import { ExercisesSimulationView } from './modules/exercises/views/ExercisesSimulationView';
import { CharactersManagementView } from './modules/characters/views/CharactersManagementView';
import { EvaluationExecutionView } from './modules/evaluations/views/EvaluationExecutionView';
import { AdminGovernanceView } from './modules/admin/views/AdminGovernanceView';
import { CollaboratorPortalView } from './modules/collaborator-portal/views/CollaboratorPortalView';
import { ActorScenariosView } from './modules/actor-scenarios/views/ActorScenariosView';

const PortalAppInner: React.FC = () => {
  const { currentUser, collaboratorChecklists } = usePortalStore();

  const isCollaborator = currentUser?.role === 'colaborador';
  const isAuxiliar = currentUser?.role === 'auxiliar';
  const isEvaluator = currentUser?.role === 'avaliador';
  const isAdmin = currentUser?.role === 'admin';

  const [activeRoute, setActiveRoute] = useState<PortalRoute>(() => {
    if (currentUser?.role === 'colaborador') return 'my-development';
    if (currentUser?.role === 'auxiliar') return 'actor-scenarios';
    return 'collaborators';
  });
  const [activeAssignmentId, setActiveAssignmentId] = useState<string | null>(null);
  const [selectedCollaboratorId, setSelectedCollaboratorId] = useState<string | null>(null);

  // Redirecionamento automático respeitando os 4 Papéis Corporativos (RBAC)
  useEffect(() => {
    if (!currentUser) return;

    if (currentUser.role === 'colaborador') {
      // 1. Colaborador: estritamente restrito a sua trilha individual
      if (activeRoute !== 'my-development') {
        setActiveRoute('my-development');
      }
    } else if (currentUser.role === 'auxiliar') {
      // 2. Auxiliar / Ator: estritamente restrito aos cenários de simulação e casos atrelados
      if (activeRoute !== 'actor-scenarios') {
        setActiveRoute('actor-scenarios');
      }
    } else if (currentUser.role === 'avaliador') {
      // 3. Avaliador: Colaboradores, Exercícios e Checklists (modo consulta/avaliação)
      const allowedForEvaluator: PortalRoute[] = [
        'collaborators',
        'exercises',
        'checklists',
        'evaluation-run',
      ];
      if (!allowedForEvaluator.includes(activeRoute)) {
        setActiveRoute('collaborators');
      }
    } else if (currentUser.role === 'admin') {
      // 4. Administrador: acesso total; redireciona apenas se estava em tela exclusiva de colaborador
      if (activeRoute === 'my-development') {
        setActiveRoute('collaborators');
      }
    }
  }, [currentUser?.role, currentUser?.id, activeRoute]);

  if (!currentUser) {
    return <AuthLoginView />;
  }

  // Ação fluida de iniciar avaliação
  const handleStartEvaluation = (assignmentId: string, collaboratorId?: string) => {
    setActiveAssignmentId(assignmentId);
    if (collaboratorId) {
      setSelectedCollaboratorId(collaboratorId);
    }
    setActiveRoute('evaluation-run');
  };

  const handleBackFromEvaluation = (collaboratorId?: string) => {
    setActiveAssignmentId(null);
    if (collaboratorId) {
      setSelectedCollaboratorId(collaboratorId);
    }
    setActiveRoute('collaborators');
  };

  // Se entrar diretamente pelo link ou atalho de avaliação
  const currentAssignmentId =
    activeAssignmentId ||
    collaboratorChecklists.find((c) => c.status === 'em_andamento')?.id ||
    collaboratorChecklists.find((c) => c.status === 'pendente')?.id ||
    collaboratorChecklists[0]?.id ||
    '';

  return (
    <PlatformShell
      activeRoute={activeRoute}
      onNavigate={(route) => {
        setActiveRoute(route);
        if (route !== 'evaluation-run') {
          setActiveAssignmentId(null);
        }
      }}
    >
      {/* ========================================================= */}
      {/* 1. VISÃO RESTRITA DO COLABORADOR (MINHA TRILHA) */}
      {/* ========================================================= */}
      {(activeRoute === 'my-development' || (isCollaborator && activeRoute === 'surveys')) && (
        <CollaboratorPortalView />
      )}

      {/* ========================================================= */}
      {/* 2. CENÁRIOS DE SIMULAÇÃO & CASOS ATRELADOS (PAINEL DO ATOR) */}
      {/* ========================================================= */}
      {activeRoute === 'actor-scenarios' && <ActorScenariosView />}

      {/* ========================================================= */}
      {/* 3. MÓDULOS DE GESTÃO E AVALIAÇÃO (ADMIN & AVALIADOR) */}
      {/* ========================================================= */}

      {/* Colaboradores (/colaboradores) — Admin e Avaliador */}
      {!isCollaborator && !isAuxiliar && activeRoute === 'collaborators' && (
        <CollaboratorsView
          initialCollaboratorId={selectedCollaboratorId}
          onStartEvaluation={handleStartEvaluation}
        />
      )}

      {/* Checklists (/checklists) — Admin e Avaliador (modo consulta) */}
      {!isCollaborator && !isAuxiliar && activeRoute === 'checklists' && <ChecklistsManagementView />}

      {/* Exercícios (/exercicios) — Admin e Avaliador (modo consulta) */}
      {!isCollaborator && !isAuxiliar && activeRoute === 'exercises' && <ExercisesSimulationView />}

      {/* Tela de Avaliação em Tempo Real (/avaliacoes/executar/:id) */}
      {!isCollaborator && !isAuxiliar && activeRoute === 'evaluation-run' && (
        <EvaluationExecutionView
          assignmentId={currentAssignmentId}
          onBack={handleBackFromEvaluation}
        />
      )}

      {/* ========================================================= */}
      {/* 4. MÓDULOS EXCLUSIVOS DO ADMINISTRADOR */}
      {/* ========================================================= */}

      {/* Banco de Clientes (/clientes) — Acesso irrestrito Admin */}
      {isAdmin && activeRoute === 'characters' && <CharactersManagementView />}

      {/* Pesquisas de Satisfação (/pesquisas) — Construtor e Resultados Admin */}
      {isAdmin && activeRoute === 'surveys' && <SurveysManagementView />}

      {/* Administração (/admin) — Gestão e delegação de poderes Admin */}
      {isAdmin && activeRoute === 'admin' && <AdminGovernanceView />}
    </PlatformShell>
  );
};

export default function App() {
  return (
    <PortalStoreProvider>
      <PortalAppInner />
    </PortalStoreProvider>
  );
}
