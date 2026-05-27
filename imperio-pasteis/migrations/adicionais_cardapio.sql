-- ============================================================
--  IMPÉRIO DOS PASTÉIS — Migração de Adicionais e Cardápio
--  Execute no SQL Editor do Supabase
-- ============================================================

-- ─── 1. TABELA DE ADICIONAIS ────────────────────────────────
CREATE TABLE IF NOT EXISTS adicionais (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  nome          text NOT NULL,
  tipo          text NOT NULL CHECK (tipo IN ('salgado', 'doce', 'recheio_extra')),
  preco_extra   numeric(10,2) NOT NULL DEFAULT 1.00,
  ativo         boolean DEFAULT true,
  ordem         int DEFAULT 0,
  criado_em     timestamptz DEFAULT now()
);

-- ─── 2. CONFIG DE ADICIONAIS POR PRODUTO ────────────────────
CREATE TABLE IF NOT EXISTS produto_adicionais_config (
  id                  uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  produto_id          uuid NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  aceita_adicionais   boolean DEFAULT true,
  max_gratis          int DEFAULT 2,
  preco_por_extra     numeric(10,2) DEFAULT 1.00,
  tipo_adicional      text DEFAULT 'salgado' CHECK (tipo_adicional IN ('salgado', 'doce', 'ambos')),
  UNIQUE (produto_id)
);

-- ─── 3. ADICIONAIS POR ITEM DA COMANDA ──────────────────────
CREATE TABLE IF NOT EXISTS comanda_item_adicionais (
  id               uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  comanda_item_id  uuid NOT NULL REFERENCES comanda_itens(id) ON DELETE CASCADE,
  adicional_id     uuid REFERENCES adicionais(id),
  nome_adicional   text NOT NULL,
  preco_cobrado    numeric(10,2) NOT NULL DEFAULT 0.00,
  criado_em        timestamptz DEFAULT now()
);

-- ─── 4. COLUNAS EXTRAS EM comanda_itens ─────────────────────
ALTER TABLE comanda_itens
  ADD COLUMN IF NOT EXISTS total_adicionais numeric(10,2) DEFAULT 0.00,
  ADD COLUMN IF NOT EXISTS adicionais_texto text;  -- snapshot p/ impressão: "Bacon, Catupiry, Queijo"

-- ─── 5. POPULANDO ADICIONAIS ────────────────────────────────
INSERT INTO adicionais (nome, tipo, preco_extra, ordem) VALUES
  -- Salgados
  ('Bacon',     'salgado', 1.00, 1),
  ('Calabresa', 'salgado', 1.00, 2),
  ('Catupiry',  'salgado', 1.00, 3),
  ('Gueroba',   'salgado', 1.00, 4),
  ('Pequi',     'salgado', 1.00, 5),
  ('Azeitona',  'salgado', 1.00, 6),
  ('Cheddar',   'salgado', 1.00, 7),
  ('Queijo',    'salgado', 1.00, 8),
  ('Presunto',  'salgado', 1.00, 9),
  ('Milho',     'salgado', 1.00, 10),
  -- Doces
  ('Morango',   'doce',    1.00, 11),
  ('Canela',    'doce',    1.00, 12),
  ('Banana',    'doce',    1.00, 13),
  -- Recheio extra (R$3,00)
  ('Carne',          'recheio_extra', 3.00, 14),
  ('Frango',         'recheio_extra', 3.00, 15),
  ('Costela Bovina', 'recheio_extra', 3.00, 16),
  ('Carne Seca',     'recheio_extra', 3.00, 17)
ON CONFLICT DO NOTHING;

-- ─── 6. CATEGORIAS ──────────────────────────────────────────
INSERT INTO categorias (nome, icone, cor, ordem, ativo) VALUES
  ('Pastéis Tradicionais', '🥟', '#F97316', 1, true),
  ('Pastéis Doces',        '🍫', '#A855F7', 2, true),
  ('Pastéis Especiais',    '⭐', '#EAB308', 3, true),
  ('Bebidas',              '🥤', '#3B82F6', 4, true)
ON CONFLICT DO NOTHING;

-- ─── 7. PRODUTOS (com referência às categorias) ─────────────
-- Usar subselect para pegar o id das categorias inseridas

-- TRADICIONAIS
INSERT INTO produtos (nome, descricao, categoria_id, preco_venda, preco_custo, ativo, enviar_para_producao, controlar_estoque, tempo_preparo_min)
SELECT
  p.nome, p.descricao, c.id, p.preco, 0, true, true, false, 8
FROM (VALUES
  ('Pastel de Queijo',        'Recheio de queijo', 'Pastéis Tradicionais', 12.00),
  ('Pastel de Frango',        'Recheio de frango', 'Pastéis Tradicionais', 12.00),
  ('Pastel de Carne',         'Recheio de carne moída', 'Pastéis Tradicionais', 12.00),
  ('Pastel de Costela Bovina','Recheio de costela bovina', 'Pastéis Tradicionais', 12.00),
  ('Pastel de Carne Seca',    'Recheio de carne seca', 'Pastéis Tradicionais', 12.00),
  ('Pastel Pizza',            'Queijo, Presunto, Calabresa e Orégano - sem adicionais', 'Pastéis Tradicionais', 12.00)
) AS p(nome, descricao, cat_nome, preco)
JOIN categorias c ON c.nome = p.cat_nome
ON CONFLICT DO NOTHING;

-- DOCES
INSERT INTO produtos (nome, descricao, categoria_id, preco_venda, preco_custo, ativo, enviar_para_producao, controlar_estoque, tempo_preparo_min)
SELECT
  p.nome, p.descricao, c.id, p.preco, 0, true, true, false, 8
FROM (VALUES
  ('Pastel de Nutella',  'Recheio de Nutella', 'Pastéis Doces', 12.00),
  ('Pastel de Queijo Doce', 'Recheio de queijo doce', 'Pastéis Doces', 12.00),
  ('Pastel de Morango',  'Recheio de morango', 'Pastéis Doces', 12.00),
  ('Pastel de Canela',   'Recheio de canela', 'Pastéis Doces', 12.00),
  ('Pastel de Banana',   'Recheio de banana', 'Pastéis Doces', 12.00)
) AS p(nome, descricao, cat_nome, preco)
JOIN categorias c ON c.nome = p.cat_nome
ON CONFLICT DO NOTHING;

-- ESPECIAIS
INSERT INTO produtos (nome, descricao, categoria_id, preco_venda, preco_custo, ativo, enviar_para_producao, controlar_estoque, tempo_preparo_min)
SELECT
  p.nome, p.descricao, c.id, p.preco, 0, true, true, false, 12
FROM (VALUES
  ('Pastel Império',    'Todos os recheios + 2 massas', 'Pastéis Especiais', 20.00),
  ('Pastel Imperatriz', 'Todos os recheios + 1 massa',  'Pastéis Especiais', 16.00),
  ('Pastel Vegetariano','Queijo, Gueiroba, Azeitona, Catupiry, Pequi, Milho, Cheddar', 'Pastéis Especiais', 13.00)
) AS p(nome, descricao, cat_nome, preco)
JOIN categorias c ON c.nome = p.cat_nome
ON CONFLICT DO NOTHING;

-- BEBIDAS (não vai para produção)
INSERT INTO produtos (nome, descricao, categoria_id, preco_venda, preco_custo, ativo, enviar_para_producao, controlar_estoque, tempo_preparo_min)
SELECT
  p.nome, p.descricao, c.id, p.preco, 0, true, false, false, 0
FROM (VALUES
  ('Coca Cola 1LT',         'Coca Cola 1 litro',        'Bebidas', 9.00),
  ('Coca Cola 2LT',         'Coca Cola 2 litros',       'Bebidas', 14.00),
  ('Coca Cola KS',          'Coca Cola lata KS',        'Bebidas', 6.00),
  ('Refrigerante 1LT',      'Refrigerante 1 litro',     'Bebidas', 8.00),
  ('Refrigerante 2LT',      'Refrigerante 2 litros',    'Bebidas', 10.00),
  ('Refrigerante Lata',     'Refrigerante em lata',     'Bebidas', 6.00),
  ('Água com Gás',          'Água mineral com gás',     'Bebidas', 5.00),
  ('Água sem Gás',          'Água mineral sem gás',     'Bebidas', 4.00),
  ('Suco de Laranja Jarra', 'Suco natural jarra',       'Bebidas', 18.00),
  ('Suco de Laranja 400ml', 'Suco natural 400ml',       'Bebidas', 8.00),
  ('Suco de Caixa 1LT',     'Suco de caixa 1 litro',   'Bebidas', 8.00),
  ('Cerveja Lata',          'Cerveja em lata',          'Bebidas', 6.00),
  ('Cerveja Long Neck',     'Cerveja long neck',        'Bebidas', 8.00),
  ('Heineken',              'Heineken long neck',       'Bebidas', 10.00)
) AS p(nome, descricao, cat_nome, preco)
JOIN categorias c ON c.nome = p.cat_nome
ON CONFLICT DO NOTHING;

-- ─── 8. CONFIG DE ADICIONAIS POR PRODUTO ────────────────────
-- Pastéis tradicionais (exceto Pizza) = salgados
INSERT INTO produto_adicionais_config (produto_id, aceita_adicionais, max_gratis, preco_por_extra, tipo_adicional)
SELECT p.id, true, 2, 1.00, 'salgado'
FROM produtos p
JOIN categorias c ON c.id = p.categoria_id
WHERE c.nome = 'Pastéis Tradicionais'
  AND p.nome != 'Pastel Pizza'
ON CONFLICT (produto_id) DO NOTHING;

-- Pizza = sem adicionais
INSERT INTO produto_adicionais_config (produto_id, aceita_adicionais, max_gratis, preco_por_extra, tipo_adicional)
SELECT p.id, false, 0, 0, 'salgado'
FROM produtos p WHERE p.nome = 'Pastel Pizza'
ON CONFLICT (produto_id) DO NOTHING;

-- Pastéis doces = adicionais doces
INSERT INTO produto_adicionais_config (produto_id, aceita_adicionais, max_gratis, preco_por_extra, tipo_adicional)
SELECT p.id, true, 2, 1.00, 'doce'
FROM produtos p
JOIN categorias c ON c.id = p.categoria_id
WHERE c.nome = 'Pastéis Doces'
ON CONFLICT (produto_id) DO NOTHING;

-- Pastéis especiais = ambos
INSERT INTO produto_adicionais_config (produto_id, aceita_adicionais, max_gratis, preco_por_extra, tipo_adicional)
SELECT p.id, true, 2, 1.00, 'ambos'
FROM produtos p
JOIN categorias c ON c.id = p.categoria_id
WHERE c.nome = 'Pastéis Especiais'
  AND p.nome != 'Pastel Vegetariano'
ON CONFLICT (produto_id) DO NOTHING;

-- Vegetariano e Bebidas = sem adicionais
INSERT INTO produto_adicionais_config (produto_id, aceita_adicionais, max_gratis, preco_por_extra, tipo_adicional)
SELECT p.id, false, 0, 0, 'salgado'
FROM produtos p
JOIN categorias c ON c.id = p.categoria_id
WHERE c.nome IN ('Bebidas') OR p.nome = 'Pastel Vegetariano'
ON CONFLICT (produto_id) DO NOTHING;

-- ─── 9. RLS ──────────────────────────────────────────────────
ALTER TABLE adicionais ENABLE ROW LEVEL SECURITY;
ALTER TABLE produto_adicionais_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE comanda_item_adicionais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "adicionais_leitura" ON adicionais FOR SELECT USING (true);
CREATE POLICY "adicionais_config_leitura" ON produto_adicionais_config FOR SELECT USING (true);
CREATE POLICY "comanda_item_adicionais_all" ON comanda_item_adicionais FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "adicionais_write" ON adicionais FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "config_write" ON produto_adicionais_config FOR ALL USING (auth.role() = 'authenticated') WITH CHECK (auth.role() = 'authenticated');

-- ─── PRONTO! ─────────────────────────────────────────────────
-- Tabelas criadas, cardápio populado, regra de adicionais configurada.
