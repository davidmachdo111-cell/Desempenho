-- ============================================================================
-- 20261117_full_shared_realtime_sync.sql
-- MIGRATION IDEMPOTENTE PARA SINCRONIZAÇÃO COMPARTILHADA COMPLETA + REALTIME
-- Portal de Desempenho
-- ============================================================================

-- 1. Usuários do Portal (portal_users)
CREATE TABLE IF NOT EXISTS public.portal_users (
    id TEXT PRIMARY KEY,
    username TEXT UNIQUE NOT NULL,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    role TEXT NOT NULL,
    status TEXT NOT NULL,
    can_change_password BOOLEAN DEFAULT false,
    password TEXT,
    is_active BOOLEAN DEFAULT true,
    department TEXT,
    collaborator_id TEXT,
    individual_permissions JSONB DEFAULT '[]'::jsonb,
    is_guardian_host BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    last_login_at TIMESTAMPTZ
);

ALTER TABLE public.portal_users
    ADD COLUMN IF NOT EXISTS can_change_password BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS password TEXT,
    ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true,
    ADD COLUMN IF NOT EXISTS department TEXT,
    ADD COLUMN IF NOT EXISTS collaborator_id TEXT,
    ADD COLUMN IF NOT EXISTS individual_permissions JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS is_guardian_host BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW(),
    ADD COLUMN IF NOT EXISTS last_login_at TIMESTAMPTZ;

-- 2. Categorias (categories)
CREATE TABLE IF NOT EXISTS public.categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    type TEXT NOT NULL DEFAULT 'geral',
    description TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Banco de Clientes / Personagens (characters)
CREATE TABLE IF NOT EXISTS public.characters (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    cell TEXT NOT NULL DEFAULT 'OPERADORA',
    age TEXT NOT NULL DEFAULT '',
    gender TEXT DEFAULT 'Outro',
    city TEXT DEFAULT '',
    card_number TEXT DEFAULT '',
    customer_tier TEXT DEFAULT 'Mediano',
    service_context TEXT DEFAULT '',
    temperament TEXT NOT NULL DEFAULT '',
    history TEXT,
    objectives TEXT,
    typical_phrases TEXT,
    guide_attachment_url TEXT,
    guide_attachment_name TEXT,
    guide_attachments JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.characters
    ADD COLUMN IF NOT EXISTS cell TEXT NOT NULL DEFAULT 'OPERADORA',
    ADD COLUMN IF NOT EXISTS gender TEXT DEFAULT 'Outro',
    ADD COLUMN IF NOT EXISTS city TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS card_number TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS customer_tier TEXT DEFAULT 'Mediano',
    ADD COLUMN IF NOT EXISTS service_context TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS guide_attachment_url TEXT,
    ADD COLUMN IF NOT EXISTS guide_attachment_name TEXT,
    ADD COLUMN IF NOT EXISTS guide_attachments JSONB DEFAULT '[]'::jsonb;

-- 4. Exercícios e Cenários (exercises)
CREATE TABLE IF NOT EXISTS public.exercises (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    cell TEXT NOT NULL DEFAULT 'OPERADORA',
    difficulty TEXT DEFAULT 'Mediano',
    category_id TEXT REFERENCES public.categories(id) ON DELETE SET NULL,
    category_name TEXT DEFAULT '',
    scenario_instructions TEXT NOT NULL DEFAULT '',
    attachment_url TEXT,
    attachment_name TEXT,
    attachments JSONB DEFAULT '[]'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.exercises
    ADD COLUMN IF NOT EXISTS cell TEXT NOT NULL DEFAULT 'OPERADORA',
    ADD COLUMN IF NOT EXISTS difficulty TEXT DEFAULT 'Mediano',
    ADD COLUMN IF NOT EXISTS category_name TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS attachment_url TEXT,
    ADD COLUMN IF NOT EXISTS attachment_name TEXT,
    ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;

-- 5. Vínculo Exercícios <-> Personagens
CREATE TABLE IF NOT EXISTS public.exercise_characters (
    id TEXT PRIMARY KEY,
    exercise_id TEXT NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
    character_id TEXT NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
    order_index INT NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 6. Checklists (checklists + vínculos)
CREATE TABLE IF NOT EXISTS public.checklists (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    cell TEXT NOT NULL DEFAULT 'OPERADORA',
    description TEXT,
    category_id TEXT REFERENCES public.categories(id) ON DELETE SET NULL,
    category_name TEXT DEFAULT '',
    visibility TEXT DEFAULT 'padrao',
    has_exercises BOOLEAN NOT NULL DEFAULT FALSE,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.checklists
    ADD COLUMN IF NOT EXISTS cell TEXT NOT NULL DEFAULT 'OPERADORA',
    ADD COLUMN IF NOT EXISTS category_name TEXT DEFAULT '',
    ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'padrao',
    ADD COLUMN IF NOT EXISTS has_exercises BOOLEAN NOT NULL DEFAULT FALSE;

CREATE TABLE IF NOT EXISTS public.checklist_exercises (
    id TEXT PRIMARY KEY,
    checklist_id TEXT NOT NULL REFERENCES public.checklists(id) ON DELETE CASCADE,
    exercise_id TEXT NOT NULL REFERENCES public.exercises(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.checklist_criteria (
    id TEXT PRIMARY KEY,
    checklist_id TEXT NOT NULL REFERENCES public.checklists(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    weight NUMERIC NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 7. Colaboradores e Trilha Individual + Veredito (collaborators)
CREATE TABLE IF NOT EXISTS public.collaborators (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    username TEXT,
    role_title TEXT NOT NULL,
    cell_team TEXT NOT NULL,
    registration_code TEXT,
    learning_track_id TEXT,
    track JSONB DEFAULT '[]'::jsonb,
    is_track_finalized BOOLEAN DEFAULT false,
    guardian_verdict TEXT,
    guardian_opinion TEXT,
    guardian_finalized_by TEXT,
    guardian_finalized_at TIMESTAMPTZ,
    status TEXT NOT NULL DEFAULT 'novo',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.collaborators
    ADD COLUMN IF NOT EXISTS username TEXT,
    ADD COLUMN IF NOT EXISTS learning_track_id TEXT,
    ADD COLUMN IF NOT EXISTS track JSONB DEFAULT '[]'::jsonb,
    ADD COLUMN IF NOT EXISTS is_track_finalized BOOLEAN DEFAULT false,
    ADD COLUMN IF NOT EXISTS guardian_verdict TEXT,
    ADD COLUMN IF NOT EXISTS guardian_opinion TEXT,
    ADD COLUMN IF NOT EXISTS guardian_finalized_by TEXT,
    ADD COLUMN IF NOT EXISTS guardian_finalized_at TIMESTAMPTZ;

-- 8. Avaliações / Atribuições de Checklists (collaborator_checklists)
CREATE TABLE IF NOT EXISTS public.collaborator_checklists (
    id TEXT PRIMARY KEY,
    collaborator_id TEXT NOT NULL REFERENCES public.collaborators(id) ON DELETE CASCADE,
    checklist_id TEXT NOT NULL REFERENCES public.checklists(id) ON DELETE CASCADE,
    status TEXT NOT NULL DEFAULT 'pendente',
    final_score NUMERIC,
    criteria_answers JSONB NOT NULL DEFAULT '[]'::jsonb,
    general_observations TEXT DEFAULT '',
    instructor_auxiliar_id TEXT,
    actor_auxiliar_id TEXT,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.collaborator_checklists
    ADD COLUMN IF NOT EXISTS general_observations TEXT DEFAULT '';

-- 9. Pesquisas de Satisfação (surveys)
CREATE TABLE IF NOT EXISTS public.surveys (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    target_cell TEXT,
    visibility TEXT DEFAULT 'padrao',
    questions JSONB DEFAULT '[]'::jsonb,
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. Respostas das Pesquisas (survey_responses)
CREATE TABLE IF NOT EXISTS public.survey_responses (
    id TEXT PRIMARY KEY,
    survey_id TEXT NOT NULL,
    collaborator_id TEXT NOT NULL,
    collaborator_name TEXT,
    collaborator_username TEXT,
    cell_team TEXT,
    answers JSONB DEFAULT '{}'::jsonb,
    completed_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. Logs de Auditoria (audit_logs)
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id TEXT PRIMARY KEY,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    actor_id TEXT,
    actor_name TEXT,
    actor_role TEXT,
    action TEXT,
    module TEXT,
    target_description TEXT,
    status TEXT
);

-- 12. Configurações Compartilhadas do Portal (portal_settings)
CREATE TABLE IF NOT EXISTS public.portal_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================================
-- RLS E POLÍTICAS DE ACESSO COMPARTILHADO PARA O CLIENTE DO PORTAL
-- ============================================================================
ALTER TABLE public.portal_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exercise_characters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_exercises ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checklist_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collaborators ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.collaborator_checklists ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.portal_settings ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
    tbl TEXT;
    all_tables TEXT[] := ARRAY[
        'portal_users',
        'categories',
        'characters',
        'exercises',
        'exercise_characters',
        'checklists',
        'checklist_exercises',
        'checklist_criteria',
        'collaborators',
        'collaborator_checklists',
        'surveys',
        'survey_responses',
        'audit_logs',
        'portal_settings'
    ];
BEGIN
    FOREACH tbl IN ARRAY all_tables LOOP
        EXECUTE format('DROP POLICY IF EXISTS "%s_full_access" ON public.%I', tbl, tbl);
        EXECUTE format('CREATE POLICY "%s_full_access" ON public.%I FOR ALL USING (true) WITH CHECK (true)', tbl, tbl);
    END LOOP;
END $$;

-- ============================================================================
-- ATIVAR SUPABASE REALTIME PARA TODAS AS TABELAS DO PORTAL
-- ============================================================================
DO $$
DECLARE
    tbl TEXT;
    realtime_tables TEXT[] := ARRAY[
        'portal_users',
        'characters',
        'exercises',
        'checklists',
        'collaborators',
        'collaborator_checklists',
        'surveys',
        'survey_responses',
        'categories',
        'audit_logs',
        'portal_settings'
    ];
BEGIN
    FOREACH tbl IN ARRAY realtime_tables LOOP
        BEGIN
            EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', tbl);
        EXCEPTION
            WHEN duplicate_object THEN NULL;
            WHEN undefined_object THEN NULL;
        END;
    END LOOP;
END $$;
