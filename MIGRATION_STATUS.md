# MIGRATION_STATUS.md — PORTAL DE DESEMPENHO

**Última Atualização:** Novembro de 2026  
**Status da Arquitetura:** Refatorado, Limpo e Verificado (React 19 + TypeScript + Vite + Tailwind CSS v4)

---

## 1. Tecnologias e Estrutura Atual

- **Runtime e Bundler:** React 19 + TypeScript + Vite + Tailwind CSS (`@tailwindcss/vite`), servindo na porta `3000` (`0.0.0.0`).
- **Camada de Estado e Persistência:**
  - `src/context/PortalStoreContext.tsx`: Estado centralizado com persistência local (`localStorage`) preservando integralmente cadastros criados pelo usuário, suporte opcional ao Supabase, auto-save de avaliações em andamento (`saveEvaluationProgress`) e trilha de auditoria.
  - `src/context/ToastContext.tsx`: Sistema global de notificações flutuantes (`success`, `error`, `info`) com fechamento automático em 4 segundos e botão manual de fechamento.
  - `src/lib/downloadHelpers.ts` & `src/components/GuideMirrorModal.tsx`: Geração de PDFs institucionais (Ficha/DPF de Cliente individual e consolidado em PDF único, Dossiê do Colaborador e Relatórios de Avaliação).
- **Roteamento Sincronizado com URL (History API):**
  - Implementado em `src/App.tsx` via `window.location.pathname`, `history.pushState`, `history.replaceState` e listener `popstate`:
    - `/colaboradores` e `/colaboradores/:id`
    - `/pesquisas`
    - `/checklists`
    - `/exercicios`
    - `/clientes`
    - `/admin`
    - `/minha-trilha`
    - `/avaliacoes/executar/:id`
- **Módulos Ativos em `src/modules/`:**
  - `src/components/layout/PlatformShell.tsx`: Shell corporativo verde institucional (`#0f3e2e`), busca global com navegação direta para fichas e alternador de sessão RBAC.
  - `src/components/AuthLoginView.tsx` & `src/components/SetPasswordView.tsx`: Autenticação corporativa, primeiro acesso e recuperação de senha.
  - `src/modules/collaborators/views/CollaboratorsView.tsx`: Gestão de colaboradores, filtros rápidos por status e nota, modo leitura rápida para Ator (`auxiliar`) e visualização de laudos/dossiês para perfis autorizados.
  - `src/modules/tracks/views/CollaboratorTrackBuilder.tsx`: Construtor sequencial de trilha individual (drag-and-drop e reordenação) integrado à ficha do colaborador.
  - `src/modules/surveys/views/SurveysManagementView.tsx`: Construtor e painel consolidado de pesquisas de satisfação.
  - `src/modules/checklists/views/ChecklistsManagementView.tsx`: Gestão de checklists ponderados com opção de duplicação rápida.
  - `src/modules/exercises/views/ExercisesSimulationView.tsx`: Gestão de exercícios e roteiros de simulação com até 4 clientes e opção de duplicação rápida.
  - `src/modules/characters/views/CharactersManagementView.tsx`: Banco de Clientes / Personagens com falas típicas, DPF e opção de duplicação rápida.
  - `src/modules/evaluations/views/EvaluationExecutionView.tsx`: Execução de avaliação em Split View (cenário/guias fixos à esquerda e critérios com marcação em lote e auto-save à direita).
  - `src/modules/admin/views/AdminGovernanceView.tsx`: Fila de aprovação, gestão de usuários, permissões individuais e logs de auditoria.
  - `src/modules/collaborator-portal/views/CollaboratorPortalView.tsx`: Visão restrita do colaborador (`/minha-trilha`).

---

## 2. Modelo de Permissões (RBAC)

Fonte única de verdade em `src/lib/permissions.ts` (`checkUserPermission`):

1. **Administrador (`admin`):** Acesso completo aos módulos `/colaboradores`, `/pesquisas`, `/checklists`, `/exercicios`, `/clientes`, `/admin` e `/avaliacoes/executar/:id`.
2. **Avaliador (`avaliador`):** Acesso a `/colaboradores`, `/checklists`, `/exercicios` e `/avaliacoes/executar/:id` para conduzir e registrar avaliações.
3. **Auxiliar / Ator (`auxiliar`):** Acesso estrito a `/colaboradores` e `/colaboradores/:id` no modo de roteiros cênicos vinculados, sem exposição de notas, laudos, dossiês ou controles administrativos.
4. **Colaborador (`colaborador`):** Acesso estrito a `/minha-trilha` para acompanhar sua trilha e responder pesquisas de satisfação.

---

## 3. Verificação e Testes

Os cenários de regras de negócio e RBAC estão implementados em `src/__tests__/portalRules.test.ts` e a verificação estática de tipos é executada via `npm run lint` (`tsc --noEmit`).
