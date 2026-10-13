-- ====================================================================
-- 20261013_cells_and_bullet_points_standardization.sql
-- PADRONIZAÇÃO DAS 5 CÉLULAS (LAB, IMG, CONSULTA, TERAPIA, OPERADORA)
-- E FALAS/OBJEÇÕES EM TÓPICOS DINÂMICOS
-- ====================================================================

-- 1. Adicionar coluna cell nas tabelas characters, exercises e checklists
ALTER TABLE public.characters
    ADD COLUMN IF NOT EXISTS cell TEXT NOT NULL DEFAULT 'OPERADORA';

ALTER TABLE public.exercises
    ADD COLUMN IF NOT EXISTS cell TEXT NOT NULL DEFAULT 'OPERADORA';

ALTER TABLE public.checklists
    ADD COLUMN IF NOT EXISTS cell TEXT NOT NULL DEFAULT 'OPERADORA';

-- 2. Garantir que as células oficiais padrão existam na tabela cells
INSERT INTO public.cells (id, code, name, coordinator_name, has_service_standard, standard_document_title)
VALUES
    (gen_random_uuid(), 'LAB', 'Laboratório', 'Coordenação LAB', true, 'Manual Operacional de Atendimento Laboratorial'),
    (gen_random_uuid(), 'IMG', 'Imagem', 'Coordenação IMG', true, 'Diretrizes de Atendimento e Diagnóstico por Imagem'),
    (gen_random_uuid(), 'CONSULTA', 'Consultas Ambulatoriais', 'Coordenação Ambulatório', true, 'Procedimento Padrão para Agendamento e Recepção Ambulatorial'),
    (gen_random_uuid(), 'TERAPIA', 'Terapias / Tratamentos', 'Coordenação Terapias', true, 'Protocolo de Acolhimento e Terapias Contínuas'),
    (gen_random_uuid(), 'OPERADORA', 'Convênio / Planos de Saúde', 'Coordenação Convênios', true, 'Normas de Regulação, Autorização de Guias e SAC Operadora')
ON CONFLICT DO NOTHING;
