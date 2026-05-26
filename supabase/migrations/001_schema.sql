-- =====================================================
-- SISTEMA IMPÉRIO PASTÉIS — Schema Completo
-- PostgreSQL / Supabase
-- =====================================================

-- Extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- =====================================================
-- ENUMS
-- =====================================================

CREATE TYPE cargo_usuario AS ENUM ('admin', 'caixa', 'garcom', 'producao');
CREATE TYPE status_mesa AS ENUM ('livre', 'ocupada', 'aguardando_pagamento', 'em_preparo', 'inativa');
CREATE TYPE status_comanda AS ENUM ('aberta', 'aguardando_pagamento', 'fechada', 'cancelada');
CREATE TYPE status_item AS ENUM ('pendente', 'enviado', 'em_preparo', 'pronto', 'entregue', 'cancelado');
CREATE TYPE status_pedido AS ENUM ('novo', 'em_preparo', 'pronto', 'entregue', 'cancelado');
CREATE TYPE status_impressao AS ENUM ('pendente', 'imprimindo', 'impresso', 'falhou', 'reimpressao_solicitada', 'simulado', 'teste_enviado');
CREATE TYPE tipo_conexao AS ENUM ('ethernet', 'wifi', 'bluetooth', 'usb');
CREATE TYPE largura_papel AS ENUM ('58mm', '80mm');
CREATE TYPE status_impressora AS ENUM ('online', 'offline', 'erro', 'nao_configurada');
CREATE TYPE setor_impressora AS ENUM ('producao', 'caixa');
CREATE TYPE tipo_documento AS ENUM ('pedido_producao', 'comanda_completa', 'novos_itens', 'recibo_final', 'fechamento_caixa', 'relatorio_diario', 'teste_simples', 'teste_completo', 'teste_corte', 'teste_acentuacao', 'teste_largura');
CREATE TYPE modo_teste AS ENUM ('simulacao', 'real');
CREATE TYPE resultado_teste AS ENUM ('sucesso', 'falhou', 'pendente');
CREATE TYPE tipo_movimentacao AS ENUM ('entrada', 'saida', 'ajuste', 'cancelamento');
CREATE TYPE forma_pagamento AS ENUM ('dinheiro', 'pix', 'credito', 'debito', 'misto');
CREATE TYPE status_caixa AS ENUM ('aberto', 'fechado');

-- =====================================================
-- TABELA: categorias
-- =====================================================
CREATE TABLE categorias (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  icone VARCHAR(50),
  cor VARCHAR(20),
  ordem INT DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABELA: produtos
-- =====================================================
CREATE TABLE produtos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  nome VARCHAR(200) NOT NULL,
  descricao TEXT,
  categoria_id UUID REFERENCES categorias(id),
  preco_venda DECIMAL(10,2) NOT NULL DEFAULT 0,
  preco_custo DECIMAL(10,2) DEFAULT 0,
  foto_url TEXT,
  estoque_atual DECIMAL(10,3) DEFAULT 0,
  estoque_minimo DECIMAL(10,3) DEFAULT 0,
  controlar_estoque BOOLEAN DEFAULT false,
  enviar_para_producao BOOLEAN DEFAULT true,
  tempo_preparo_min INT DEFAULT 0,
  codigo_interno VARCHAR(50),
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABELA: mesas
-- =====================================================
CREATE TABLE mesas (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  numero INT NOT NULL UNIQUE,
  descricao VARCHAR(100),
  capacidade INT DEFAULT 4,
  status status_mesa DEFAULT 'livre',
  ativa BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABELA: usuarios (espelho do auth.users do Supabase)
-- =====================================================
CREATE TABLE usuarios (
  id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
  nome VARCHAR(200) NOT NULL,
  email VARCHAR(300) UNIQUE NOT NULL,
  cargo cargo_usuario NOT NULL DEFAULT 'garcom',
  ativo BOOLEAN DEFAULT true,
  avatar_url TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABELA: caixas
-- =====================================================
CREATE TABLE caixas (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  usuario_id UUID REFERENCES usuarios(id),
  status status_caixa DEFAULT 'aberto',
  valor_inicial DECIMAL(10,2) DEFAULT 0,
  valor_final DECIMAL(10,2),
  total_dinheiro DECIMAL(10,2) DEFAULT 0,
  total_pix DECIMAL(10,2) DEFAULT 0,
  total_credito DECIMAL(10,2) DEFAULT 0,
  total_debito DECIMAL(10,2) DEFAULT 0,
  total_geral DECIMAL(10,2) DEFAULT 0,
  observacoes TEXT,
  aberto_em TIMESTAMPTZ DEFAULT NOW(),
  fechado_em TIMESTAMPTZ
);

-- =====================================================
-- TABELA: comandas
-- =====================================================
CREATE TABLE comandas (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  numero SERIAL,
  mesa_id UUID REFERENCES mesas(id),
  cliente_nome VARCHAR(200),
  garcom_id UUID REFERENCES usuarios(id),
  caixa_id UUID REFERENCES caixas(id),
  status status_comanda DEFAULT 'aberta',
  subtotal DECIMAL(10,2) DEFAULT 0,
  desconto_reais DECIMAL(10,2) DEFAULT 0,
  desconto_percentual DECIMAL(5,2) DEFAULT 0,
  taxa_servico DECIMAL(10,2) DEFAULT 0,
  acrescimo DECIMAL(10,2) DEFAULT 0,
  total DECIMAL(10,2) DEFAULT 0,
  observacoes TEXT,
  motivo_cancelamento TEXT,
  aberta_em TIMESTAMPTZ DEFAULT NOW(),
  fechada_em TIMESTAMPTZ,
  cancelada_em TIMESTAMPTZ
);

-- =====================================================
-- TABELA: comanda_itens
-- =====================================================
CREATE TABLE comanda_itens (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  comanda_id UUID REFERENCES comandas(id) ON DELETE CASCADE,
  produto_id UUID REFERENCES produtos(id),
  nome_produto VARCHAR(200) NOT NULL,
  quantidade DECIMAL(10,3) NOT NULL DEFAULT 1,
  preco_unitario DECIMAL(10,2) NOT NULL,
  total DECIMAL(10,2) NOT NULL,
  observacao TEXT,
  status status_item DEFAULT 'pendente',
  enviado_para_producao BOOLEAN DEFAULT false,
  enviado_em TIMESTAMPTZ,
  garcom_id UUID REFERENCES usuarios(id),
  motivo_cancelamento TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABELA: pedidos_producao
-- =====================================================
CREATE TABLE pedidos_producao (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  numero SERIAL,
  comanda_id UUID REFERENCES comandas(id),
  mesa_id UUID REFERENCES mesas(id),
  mesa_numero INT,
  garcom_id UUID REFERENCES usuarios(id),
  garcom_nome VARCHAR(200),
  status status_pedido DEFAULT 'novo',
  status_impressao status_impressao DEFAULT 'pendente',
  observacoes TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  aceito_em TIMESTAMPTZ,
  preparo_em TIMESTAMPTZ,
  pronto_em TIMESTAMPTZ,
  entregue_em TIMESTAMPTZ,
  cancelado_em TIMESTAMPTZ,
  motivo_cancelamento TEXT
);

-- =====================================================
-- TABELA: pedido_itens (itens do pedido enviado à produção)
-- =====================================================
CREATE TABLE pedido_itens (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  pedido_producao_id UUID REFERENCES pedidos_producao(id) ON DELETE CASCADE,
  comanda_item_id UUID REFERENCES comanda_itens(id),
  produto_id UUID REFERENCES produtos(id),
  nome_produto VARCHAR(200) NOT NULL,
  quantidade DECIMAL(10,3) NOT NULL,
  observacao TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABELA: pagamentos
-- =====================================================
CREATE TABLE pagamentos (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  comanda_id UUID REFERENCES comandas(id),
  caixa_id UUID REFERENCES caixas(id),
  usuario_id UUID REFERENCES usuarios(id),
  forma_pagamento forma_pagamento NOT NULL,
  valor DECIMAL(10,2) NOT NULL,
  valor_recebido DECIMAL(10,2),
  troco DECIMAL(10,2) DEFAULT 0,
  observacao TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABELA: impressoras
-- =====================================================
CREATE TABLE impressoras (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  setor setor_impressora NOT NULL DEFAULT 'producao',
  tipo_conexao tipo_conexao DEFAULT 'ethernet',
  endereco_ip VARCHAR(50),
  porta INT DEFAULT 9100,
  dispositivo_bluetooth VARCHAR(100),
  largura_papel largura_papel DEFAULT '80mm',
  corte_automatico BOOLEAN DEFAULT true,
  impressao_automatica BOOLEAN DEFAULT true,
  modo_teste BOOLEAN DEFAULT false,
  ativa BOOLEAN DEFAULT true,
  status status_impressora DEFAULT 'nao_configurada',
  ultimo_teste_em TIMESTAMPTZ,
  ultimo_erro TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  atualizado_em TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABELA: fila_impressao
-- =====================================================
CREATE TABLE fila_impressao (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  tipo_documento tipo_documento NOT NULL,
  comanda_id UUID REFERENCES comandas(id),
  pedido_producao_id UUID REFERENCES pedidos_producao(id),
  impressora_id UUID REFERENCES impressoras(id),
  conteudo TEXT NOT NULL,
  conteudo_escpos BYTEA,
  status status_impressao DEFAULT 'pendente',
  tentativas INT DEFAULT 0,
  max_tentativas INT DEFAULT 3,
  erro TEXT,
  modo_simulacao BOOLEAN DEFAULT false,
  gateway_url TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  processando_em TIMESTAMPTZ,
  impresso_em TIMESTAMPTZ,
  proximo_retry_em TIMESTAMPTZ
);

-- =====================================================
-- TABELA: testes_impressora
-- =====================================================
CREATE TABLE testes_impressora (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  impressora_id UUID REFERENCES impressoras(id),
  usuario_id UUID REFERENCES usuarios(id),
  tipo_teste VARCHAR(100) NOT NULL,
  modo modo_teste DEFAULT 'simulacao',
  resultado resultado_teste DEFAULT 'pendente',
  conteudo_teste TEXT,
  fila_impressao_id UUID REFERENCES fila_impressao(id),
  erro TEXT,
  duracao_ms INT,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABELA: estoque_movimentacoes
-- =====================================================
CREATE TABLE estoque_movimentacoes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  produto_id UUID REFERENCES produtos(id),
  tipo tipo_movimentacao NOT NULL,
  quantidade DECIMAL(10,3) NOT NULL,
  quantidade_anterior DECIMAL(10,3),
  quantidade_posterior DECIMAL(10,3),
  usuario_id UUID REFERENCES usuarios(id),
  comanda_id UUID REFERENCES comandas(id),
  observacao TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- TABELA: logs_sistema
-- =====================================================
CREATE TABLE logs_sistema (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  usuario_id UUID REFERENCES usuarios(id),
  acao VARCHAR(100) NOT NULL,
  descricao TEXT,
  detalhes JSONB,
  ip_origem VARCHAR(50),
  user_agent TEXT,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

-- =====================================================
-- ÍNDICES PARA PERFORMANCE
-- =====================================================

-- Comandas
CREATE INDEX idx_comandas_mesa_id ON comandas(mesa_id);
CREATE INDEX idx_comandas_status ON comandas(status);
CREATE INDEX idx_comandas_garcom_id ON comandas(garcom_id);
CREATE INDEX idx_comandas_criado_em ON comandas(aberta_em DESC);

-- Comanda itens
CREATE INDEX idx_comanda_itens_comanda_id ON comanda_itens(comanda_id);
CREATE INDEX idx_comanda_itens_status ON comanda_itens(status);

-- Pedidos produção
CREATE INDEX idx_pedidos_producao_status ON pedidos_producao(status);
CREATE INDEX idx_pedidos_producao_criado_em ON pedidos_producao(criado_em DESC);
CREATE INDEX idx_pedidos_producao_comanda_id ON pedidos_producao(comanda_id);

-- Fila de impressão
CREATE INDEX idx_fila_impressao_status ON fila_impressao(status);
CREATE INDEX idx_fila_impressao_impressora_id ON fila_impressao(impressora_id);
CREATE INDEX idx_fila_impressao_criado_em ON fila_impressao(criado_em DESC);

-- Logs
CREATE INDEX idx_logs_sistema_criado_em ON logs_sistema(criado_em DESC);
CREATE INDEX idx_logs_sistema_usuario_id ON logs_sistema(usuario_id);

-- Estoque
CREATE INDEX idx_estoque_mov_produto_id ON estoque_movimentacoes(produto_id);

-- =====================================================
-- TRIGGERS: atualizar updated_at automaticamente
-- =====================================================

CREATE OR REPLACE FUNCTION trigger_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.atualizado_em = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_updated_at_mesas
  BEFORE UPDATE ON mesas
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_produtos
  BEFORE UPDATE ON produtos
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_impressoras
  BEFORE UPDATE ON impressoras
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

CREATE TRIGGER set_updated_at_comanda_itens
  BEFORE UPDATE ON comanda_itens
  FOR EACH ROW EXECUTE FUNCTION trigger_set_updated_at();

-- =====================================================
-- TRIGGER: Atualizar total da comanda ao adicionar/remover itens
-- =====================================================

CREATE OR REPLACE FUNCTION recalcular_total_comanda()
RETURNS TRIGGER AS $$
DECLARE
  v_subtotal DECIMAL(10,2);
  v_desconto_reais DECIMAL(10,2);
  v_desconto_pct DECIMAL(5,2);
  v_taxa_servico DECIMAL(10,2);
  v_acrescimo DECIMAL(10,2);
  v_total DECIMAL(10,2);
BEGIN
  -- Calcular subtotal dos itens ativos
  SELECT COALESCE(SUM(total), 0)
  INTO v_subtotal
  FROM comanda_itens
  WHERE comanda_id = COALESCE(NEW.comanda_id, OLD.comanda_id)
    AND status != 'cancelado';

  -- Buscar descontos e taxas da comanda
  SELECT desconto_reais, desconto_percentual, taxa_servico, acrescimo
  INTO v_desconto_reais, v_desconto_pct, v_taxa_servico, v_acrescimo
  FROM comandas
  WHERE id = COALESCE(NEW.comanda_id, OLD.comanda_id);

  -- Calcular total
  v_desconto_reais := COALESCE(v_desconto_reais, 0);
  v_desconto_pct := COALESCE(v_desconto_pct, 0);
  v_taxa_servico := COALESCE(v_taxa_servico, 0);
  v_acrescimo := COALESCE(v_acrescimo, 0);

  v_total := v_subtotal
    - v_desconto_reais
    - (v_subtotal * v_desconto_pct / 100)
    + v_taxa_servico
    + v_acrescimo;

  -- Atualizar comanda
  UPDATE comandas
  SET subtotal = v_subtotal, total = GREATEST(v_total, 0)
  WHERE id = COALESCE(NEW.comanda_id, OLD.comanda_id);

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER atualizar_total_comanda_insert
  AFTER INSERT OR UPDATE ON comanda_itens
  FOR EACH ROW EXECUTE FUNCTION recalcular_total_comanda();

CREATE TRIGGER atualizar_total_comanda_delete
  AFTER DELETE ON comanda_itens
  FOR EACH ROW EXECUTE FUNCTION recalcular_total_comanda();

-- =====================================================
-- TRIGGER: Atualizar status da mesa ao abrir/fechar comanda
-- =====================================================

CREATE OR REPLACE FUNCTION atualizar_status_mesa()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'aberta' AND NEW.mesa_id IS NOT NULL THEN
    UPDATE mesas SET status = 'ocupada' WHERE id = NEW.mesa_id;
  ELSIF NEW.status IN ('fechada', 'cancelada') AND NEW.mesa_id IS NOT NULL THEN
    -- Verificar se há outras comandas abertas para essa mesa
    IF NOT EXISTS (
      SELECT 1 FROM comandas
      WHERE mesa_id = NEW.mesa_id
        AND status = 'aberta'
        AND id != NEW.id
    ) THEN
      UPDATE mesas SET status = 'livre' WHERE id = NEW.mesa_id;
    END IF;
  ELSIF NEW.status = 'aguardando_pagamento' AND NEW.mesa_id IS NOT NULL THEN
    UPDATE mesas SET status = 'aguardando_pagamento' WHERE id = NEW.mesa_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_atualizar_status_mesa
  AFTER INSERT OR UPDATE OF status ON comandas
  FOR EACH ROW EXECUTE FUNCTION atualizar_status_mesa();

-- =====================================================
-- VIEW: dashboard_resumo (para o dashboard admin)
-- =====================================================

CREATE OR REPLACE VIEW dashboard_resumo AS
SELECT
  -- Vendas do dia
  COALESCE(SUM(CASE WHEN DATE(c.fechada_em) = CURRENT_DATE AND c.status = 'fechada' THEN c.total ELSE 0 END), 0) AS vendas_hoje,
  -- Vendas do mês
  COALESCE(SUM(CASE WHEN DATE_TRUNC('month', c.fechada_em) = DATE_TRUNC('month', CURRENT_DATE) AND c.status = 'fechada' THEN c.total ELSE 0 END), 0) AS vendas_mes,
  -- Comandas abertas
  COUNT(CASE WHEN c.status = 'aberta' THEN 1 END) AS comandas_abertas,
  -- Comandas fechadas hoje
  COUNT(CASE WHEN DATE(c.fechada_em) = CURRENT_DATE AND c.status = 'fechada' THEN 1 END) AS comandas_fechadas_hoje,
  -- Ticket médio hoje
  CASE 
    WHEN COUNT(CASE WHEN DATE(c.fechada_em) = CURRENT_DATE AND c.status = 'fechada' THEN 1 END) > 0
    THEN SUM(CASE WHEN DATE(c.fechada_em) = CURRENT_DATE AND c.status = 'fechada' THEN c.total ELSE 0 END) /
         COUNT(CASE WHEN DATE(c.fechada_em) = CURRENT_DATE AND c.status = 'fechada' THEN 1 END)
    ELSE 0
  END AS ticket_medio_hoje
FROM comandas c;

-- =====================================================
-- VIEW: view_pedidos_producao_completo
-- =====================================================

CREATE OR REPLACE VIEW view_pedidos_producao_completo AS
SELECT
  pp.id,
  pp.numero,
  pp.status,
  pp.status_impressao,
  pp.criado_em,
  pp.aceito_em,
  pp.preparo_em,
  pp.pronto_em,
  pp.entregue_em,
  pp.observacoes,
  -- Mesa
  m.numero AS mesa_numero,
  -- Garçom
  u.nome AS garcom_nome,
  -- Comanda
  pp.comanda_id,
  -- Itens (JSON aggregation)
  COALESCE(
    json_agg(
      json_build_object(
        'id', pi.id,
        'produto_id', pi.produto_id,
        'nome_produto', pi.nome_produto,
        'quantidade', pi.quantidade,
        'observacao', pi.observacao
      )
    ) FILTER (WHERE pi.id IS NOT NULL),
    '[]'
  ) AS itens,
  -- Tempo de espera em minutos
  EXTRACT(EPOCH FROM (NOW() - pp.criado_em)) / 60 AS minutos_espera
FROM pedidos_producao pp
LEFT JOIN mesas m ON pp.mesa_id = m.id
LEFT JOIN usuarios u ON pp.garcom_id = u.id
LEFT JOIN pedido_itens pi ON pp.id = pi.pedido_producao_id
GROUP BY pp.id, pp.numero, pp.status, pp.status_impressao, pp.criado_em,
         pp.aceito_em, pp.preparo_em, pp.pronto_em, pp.entregue_em,
         pp.observacoes, m.numero, u.nome, pp.comanda_id;
