-- =====================================================
-- Migration 005: Tabelas de Insumos (Estoque Interno)
-- SEPARADO do cardápio/produtos
-- Insumos = Queijo, Batata Palha, Óleo, Sal, Farinha...
-- =====================================================

-- Tabela de insumos (ingredientes e materiais internos)
CREATE TABLE IF NOT EXISTS insumos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  nome VARCHAR(200) NOT NULL,
  descricao TEXT,
  unidade VARCHAR(20) NOT NULL DEFAULT 'un',    -- kg, g, L, ml, un, cx, pct...
  quantidade_atual DECIMAL(10,3) NOT NULL DEFAULT 0,
  quantidade_minima DECIMAL(10,3) NOT NULL DEFAULT 0, -- alerta de reposição
  preco_custo DECIMAL(10,2) DEFAULT 0,          -- custo unitário (opcional)
  fornecedor VARCHAR(200),                       -- nome do fornecedor (opcional)
  codigo_interno VARCHAR(50),
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Histórico de movimentações de insumos
CREATE TABLE IF NOT EXISTS insumo_movimentacoes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  insumo_id UUID REFERENCES insumos(id) ON DELETE CASCADE,
  tipo tipo_movimentacao NOT NULL,              -- entrada | saida | ajuste | cancelamento
  quantidade DECIMAL(10,3) NOT NULL,
  quantidade_anterior DECIMAL(10,3),
  quantidade_posterior DECIMAL(10,3),
  usuario_id UUID REFERENCES usuarios(id),
  observacao TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_insumos_ativo ON insumos(ativo);
CREATE INDEX IF NOT EXISTS idx_insumos_nome ON insumos(nome);
CREATE INDEX IF NOT EXISTS idx_insumo_mov_insumo_id ON insumo_movimentacoes(insumo_id);
CREATE INDEX IF NOT EXISTS idx_insumo_mov_criado_em ON insumo_movimentacoes(criado_em DESC);

-- Trigger para atualizar atualizado_em
CREATE TRIGGER set_updated_at_insumos
  BEFORE UPDATE ON insumos
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- RLS: mesmas regras dos produtos (admin e caixa gerenciam estoque)
ALTER TABLE insumos ENABLE ROW LEVEL SECURITY;
ALTER TABLE insumo_movimentacoes ENABLE ROW LEVEL SECURITY;

-- Política: usuarios autenticados podem ler
CREATE POLICY "Usuarios autenticados podem ver insumos"
  ON insumos FOR SELECT
  TO authenticated
  USING (true);

-- Política: admin e caixa podem criar/editar/deletar
CREATE POLICY "Admin e caixa podem gerenciar insumos"
  ON insumos FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
      AND cargo IN ('admin', 'caixa')
    )
  );

CREATE POLICY "Usuarios autenticados podem ver movimentacoes"
  ON insumo_movimentacoes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admin e caixa podem registrar movimentacoes"
  ON insumo_movimentacoes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM usuarios
      WHERE id = auth.uid()
      AND cargo IN ('admin', 'caixa', 'producao')
    )
  );

-- =====================================================
-- Dados iniciais (exemplos de insumos comuns)
-- Você pode deletar esses dados depois
-- =====================================================
INSERT INTO insumos (nome, unidade, quantidade_atual, quantidade_minima) VALUES
  ('Queijo Mussarela', 'kg', 0, 2),
  ('Batata Palha', 'kg', 0, 1),
  ('Óleo de Soja', 'L', 0, 5),
  ('Sal', 'kg', 0, 1),
  ('Farinha de Trigo', 'kg', 0, 5),
  ('Frango Desfiado', 'kg', 0, 2),
  ('Carne Moída', 'kg', 0, 3),
  ('Presunto', 'kg', 0, 1),
  ('Palmito', 'kg', 0, 1),
  ('Calabresa', 'kg', 0, 1)
ON CONFLICT DO NOTHING;
