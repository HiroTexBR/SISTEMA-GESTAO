-- =====================================================
-- Migration 004: Adicionar coluna unidade em produtos
-- Para controle de estoque de ingredientes
-- =====================================================

-- Adiciona coluna unidade (ex: kg, un, L, g, pct, cx...)
ALTER TABLE produtos
ADD COLUMN IF NOT EXISTS unidade VARCHAR(20) DEFAULT 'un';

-- Comentário
COMMENT ON COLUMN produtos.unidade IS 'Unidade de medida do produto: un, kg, g, L, ml, cx, pct, sc, lt, fardo';
