-- ============================================================================
-- 20261117_storage_client_guides.sql
-- MIGRATION IDEMPOTENTE PARA STORAGE BUCKET PÚBLICO DE GUIAS MÉDICAS
-- Portal de Desempenho
-- ============================================================================

-- 1. Criação idempotente do bucket público 'client-guides'
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-guides', 'client-guides', true)
ON CONFLICT (id) DO NOTHING;

-- Garante que o bucket permaneça público caso já existisse anteriormente
UPDATE storage.buckets
SET public = true
WHERE id = 'client-guides';

-- 2. Políticas RLS em storage.objects para o bucket 'client-guides'
DROP POLICY IF EXISTS "client_guides_public_select" ON storage.objects;
CREATE POLICY "client_guides_public_select"
    ON storage.objects
    FOR SELECT
    USING (bucket_id = 'client-guides');

DROP POLICY IF EXISTS "client_guides_public_insert" ON storage.objects;
CREATE POLICY "client_guides_public_insert"
    ON storage.objects
    FOR INSERT
    WITH CHECK (bucket_id = 'client-guides');

DROP POLICY IF EXISTS "client_guides_public_update" ON storage.objects;
CREATE POLICY "client_guides_public_update"
    ON storage.objects
    FOR UPDATE
    USING (bucket_id = 'client-guides')
    WITH CHECK (bucket_id = 'client-guides');

DROP POLICY IF EXISTS "client_guides_public_delete" ON storage.objects;
CREATE POLICY "client_guides_public_delete"
    ON storage.objects
    FOR DELETE
    USING (bucket_id = 'client-guides');
