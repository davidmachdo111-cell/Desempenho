-- ============================================================================
-- 20261118_frozen_snapshot_history.sql
-- Adiciona suporte à coluna frozen_snapshot em collaborator_checklists
-- para imutabilidade histórica de avaliações concluídas.
-- ============================================================================

ALTER TABLE public.collaborator_checklists
    ADD COLUMN IF NOT EXISTS frozen_snapshot JSONB;
