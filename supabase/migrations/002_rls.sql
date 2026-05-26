-- =====================================================
-- ROW LEVEL SECURITY (RLS) — Sistema IMPÉRIO PASTÉIS
-- =====================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE mesas ENABLE ROW LEVEL SECURITY;
ALTER TABLE comandas ENABLE ROW LEVEL SECURITY;
ALTER TABLE comanda_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedidos_producao ENABLE ROW LEVEL SECURITY;
ALTER TABLE pedido_itens ENABLE ROW LEVEL SECURITY;
ALTER TABLE produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE pagamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE impressoras ENABLE ROW LEVEL SECURITY;
ALTER TABLE fila_impressao ENABLE ROW LEVEL SECURITY;
ALTER TABLE testes_impressora ENABLE ROW LEVEL SECURITY;
ALTER TABLE estoque_movimentacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE logs_sistema ENABLE ROW LEVEL SECURITY;
ALTER TABLE caixas ENABLE ROW LEVEL SECURITY;

-- =====================================================
-- FUNÇÃO AUXILIAR: pegar cargo do usuário logado
-- =====================================================

CREATE OR REPLACE FUNCTION get_user_cargo()
RETURNS cargo_usuario AS $$
  SELECT cargo FROM usuarios WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- =====================================================
-- POLÍTICAS: usuarios
-- =====================================================

-- Admin vê todos. Usuário vê a si mesmo.
CREATE POLICY "usuarios_select" ON usuarios
  FOR SELECT USING (
    id = auth.uid() OR get_user_cargo() = 'admin'
  );

CREATE POLICY "usuarios_insert" ON usuarios
  FOR INSERT WITH CHECK (get_user_cargo() = 'admin');

CREATE POLICY "usuarios_update" ON usuarios
  FOR UPDATE USING (
    id = auth.uid() OR get_user_cargo() = 'admin'
  );

CREATE POLICY "usuarios_delete" ON usuarios
  FOR DELETE USING (get_user_cargo() = 'admin');

-- =====================================================
-- POLÍTICAS: categorias
-- =====================================================

CREATE POLICY "categorias_select" ON categorias
  FOR SELECT USING (true); -- Todos autenticados veem

CREATE POLICY "categorias_insert" ON categorias
  FOR INSERT WITH CHECK (get_user_cargo() = 'admin');

CREATE POLICY "categorias_update" ON categorias
  FOR UPDATE USING (get_user_cargo() = 'admin');

-- =====================================================
-- POLÍTICAS: produtos
-- =====================================================

CREATE POLICY "produtos_select" ON produtos
  FOR SELECT USING (true); -- Todos veem

CREATE POLICY "produtos_insert" ON produtos
  FOR INSERT WITH CHECK (get_user_cargo() = 'admin');

CREATE POLICY "produtos_update" ON produtos
  FOR UPDATE USING (get_user_cargo() = 'admin');

-- =====================================================
-- POLÍTICAS: mesas
-- =====================================================

CREATE POLICY "mesas_select" ON mesas
  FOR SELECT USING (true); -- Todos veem mesas

CREATE POLICY "mesas_insert" ON mesas
  FOR INSERT WITH CHECK (get_user_cargo() = 'admin');

CREATE POLICY "mesas_update" ON mesas
  FOR UPDATE USING (
    get_user_cargo() IN ('admin', 'garcom', 'caixa')
  );

-- =====================================================
-- POLÍTICAS: comandas
-- =====================================================

CREATE POLICY "comandas_select" ON comandas
  FOR SELECT USING (
    get_user_cargo() IN ('admin', 'caixa', 'producao') OR
    garcom_id = auth.uid()
  );

CREATE POLICY "comandas_insert" ON comandas
  FOR INSERT WITH CHECK (
    get_user_cargo() IN ('admin', 'garcom', 'caixa')
  );

CREATE POLICY "comandas_update" ON comandas
  FOR UPDATE USING (
    get_user_cargo() IN ('admin', 'caixa') OR
    (get_user_cargo() = 'garcom' AND garcom_id = auth.uid())
  );

-- =====================================================
-- POLÍTICAS: comanda_itens
-- =====================================================

CREATE POLICY "comanda_itens_select" ON comanda_itens
  FOR SELECT USING (
    get_user_cargo() IN ('admin', 'caixa', 'producao') OR
    garcom_id = auth.uid()
  );

CREATE POLICY "comanda_itens_insert" ON comanda_itens
  FOR INSERT WITH CHECK (
    get_user_cargo() IN ('admin', 'garcom', 'caixa')
  );

CREATE POLICY "comanda_itens_update" ON comanda_itens
  FOR UPDATE USING (
    get_user_cargo() IN ('admin', 'caixa', 'producao') OR
    garcom_id = auth.uid()
  );

-- =====================================================
-- POLÍTICAS: pedidos_producao
-- =====================================================

CREATE POLICY "pedidos_producao_select" ON pedidos_producao
  FOR SELECT USING (true); -- Todos autenticados veem

CREATE POLICY "pedidos_producao_insert" ON pedidos_producao
  FOR INSERT WITH CHECK (
    get_user_cargo() IN ('admin', 'garcom', 'caixa')
  );

CREATE POLICY "pedidos_producao_update" ON pedidos_producao
  FOR UPDATE USING (
    get_user_cargo() IN ('admin', 'producao', 'caixa')
  );

-- =====================================================
-- POLÍTICAS: pedido_itens
-- =====================================================

CREATE POLICY "pedido_itens_select" ON pedido_itens
  FOR SELECT USING (true);

CREATE POLICY "pedido_itens_insert" ON pedido_itens
  FOR INSERT WITH CHECK (
    get_user_cargo() IN ('admin', 'garcom', 'caixa')
  );

-- =====================================================
-- POLÍTICAS: pagamentos
-- =====================================================

CREATE POLICY "pagamentos_select" ON pagamentos
  FOR SELECT USING (
    get_user_cargo() IN ('admin', 'caixa')
  );

CREATE POLICY "pagamentos_insert" ON pagamentos
  FOR INSERT WITH CHECK (
    get_user_cargo() IN ('admin', 'caixa')
  );

-- =====================================================
-- POLÍTICAS: impressoras
-- =====================================================

CREATE POLICY "impressoras_select" ON impressoras
  FOR SELECT USING (true); -- Todos precisam ver status

CREATE POLICY "impressoras_insert" ON impressoras
  FOR INSERT WITH CHECK (get_user_cargo() = 'admin');

CREATE POLICY "impressoras_update" ON impressoras
  FOR UPDATE USING (get_user_cargo() = 'admin');

CREATE POLICY "impressoras_delete" ON impressoras
  FOR DELETE USING (get_user_cargo() = 'admin');

-- =====================================================
-- POLÍTICAS: fila_impressao
-- =====================================================

CREATE POLICY "fila_impressao_select" ON fila_impressao
  FOR SELECT USING (true);

CREATE POLICY "fila_impressao_insert" ON fila_impressao
  FOR INSERT WITH CHECK (true); -- Sistema insere automaticamente

CREATE POLICY "fila_impressao_update" ON fila_impressao
  FOR UPDATE USING (true); -- Gateway atualiza

-- =====================================================
-- POLÍTICAS: testes_impressora
-- =====================================================

CREATE POLICY "testes_impressora_select" ON testes_impressora
  FOR SELECT USING (
    get_user_cargo() IN ('admin', 'caixa')
  );

CREATE POLICY "testes_impressora_insert" ON testes_impressora
  FOR INSERT WITH CHECK (
    get_user_cargo() IN ('admin', 'caixa')
  );

-- =====================================================
-- POLÍTICAS: caixas
-- =====================================================

CREATE POLICY "caixas_select" ON caixas
  FOR SELECT USING (
    get_user_cargo() IN ('admin', 'caixa')
  );

CREATE POLICY "caixas_insert" ON caixas
  FOR INSERT WITH CHECK (
    get_user_cargo() IN ('admin', 'caixa')
  );

CREATE POLICY "caixas_update" ON caixas
  FOR UPDATE USING (
    get_user_cargo() IN ('admin', 'caixa')
  );

-- =====================================================
-- POLÍTICAS: estoque_movimentacoes
-- =====================================================

CREATE POLICY "estoque_select" ON estoque_movimentacoes
  FOR SELECT USING (
    get_user_cargo() IN ('admin', 'caixa')
  );

CREATE POLICY "estoque_insert" ON estoque_movimentacoes
  FOR INSERT WITH CHECK (
    get_user_cargo() IN ('admin', 'caixa')
  );

-- =====================================================
-- POLÍTICAS: logs_sistema
-- =====================================================

CREATE POLICY "logs_select" ON logs_sistema
  FOR SELECT USING (get_user_cargo() = 'admin');

CREATE POLICY "logs_insert" ON logs_sistema
  FOR INSERT WITH CHECK (true); -- Sistema insere logs
