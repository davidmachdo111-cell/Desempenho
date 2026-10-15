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

const PortalAppInner: React.FC = () => {
  const { currentUser, collaboratorChecklists } = usePortalStore();

  const isCollaborator = currentUser?.role === 'colaborador';

  const [activeRoute, setActiveRoute] = useState<PortalRoute>(() =>
    currentUser?.role === 'colaborador' ? 'my-development' : 'collaborators'
  );
  const [activeAssignmentId, setActiveAssignmentId] = useState<string | null>(null);
  const [selectedCollaboratorId, setSelectedCollaboratorId] = useState<string | null>(null);

  // Redirecionamento automático respeitando os 3 Perfis Fundamentais de Acesso
  useEffect(() => {
    if (currentUser?.role === 'colaborador') {
      if (activeRoute !== 'my-development') {
        setActiveRoute('my-development');
      }
    } else if (currentUser?.role === 'avaliador' || currentUser?.role === 'auxiliar') {
      // Avaliador tem foco em colaboradores e não acessa governança nem pesquisas
      if (
        activeRoute === 'my-development' ||
        activeRoute === 'admin' ||
        activeRoute === 'surveys' ||
        (activeRoute as string) === 'tracks'
      ) {
        setActiveRoute('collaborators');
      }
    } else if (currentUser) {
      if (activeRoute === 'my-development' || (activeRoute as string) === 'tracks') {
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
      {/* VISÃO RESTRITA DO COLABORADOR (MEU DESENVOLVIMENTO) */}
      {/* ========================================================= */}
      {(activeRoute === 'my-development' || (isCollaborator && activeRoute === 'surveys')) && (
        <CollaboratorPortalView />
      )}

      {/* ========================================================= */}
      {/* MÓDULOS ADMINISTRATIVOS */}
      {/* ========================================================= */}

      {/* 1. Colaboradores (/colaboradores) */}
      {!isCollaborator && activeRoute === 'collaborators' && (
        <CollaboratorsView
          initialCollaboratorId={selectedCollaboratorId}
          onStartEvaluation={handleStartEvaluation}
        />
      )}

      {/* 2. Pesquisas de Satisfação (/pesquisas) — Construtor e Resultados */}
      {!isCollaborator && activeRoute === 'surveys' && <SurveysManagementView />}

      {/* 4. Checklists (/checklists) — Modelos flexíveis */}
      {!isCollaborator && activeRoute === 'checklists' && <ChecklistsManagementView />}

      {/* 5. Exercícios (/exercicios) — Roleplay e anexos */}
      {!isCollaborator && activeRoute === 'exercises' && <ExercisesSimulationView />}

      {/* 6. Banco de Clientes / Personagens (/clientes) — CRUD independente */}
      {!isCollaborator && activeRoute === 'characters' && <CharactersManagementView />}

      {/* 7. Administração (/admin) — Gestão e delegação de poderes */}
      {!isCollaborator && activeRoute === 'admin' && <AdminGovernanceView />}

      {/* 8. Tela de Avaliação em Tempo Real (/avaliacoes/executar/:id) */}
      {!isCollaborator && activeRoute === 'evaluation-run' && (
        <EvaluationExecutionView
          assignmentId={currentAssignmentId}
          onBack={handleBackFromEvaluation}
        />
      )}
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
