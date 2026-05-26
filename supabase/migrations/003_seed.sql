-- =====================================================
-- SEED — Dados iniciais do Sistema IMPÉRIO PASTÉIS
-- =====================================================

-- Categorias
INSERT INTO categorias (nome, icone, cor, ordem) VALUES
  ('Pastéis', '🥟', '#f97316', 1),
  ('Bebidas', '🥤', '#3b82f6', 2),
  ('Porções', '🍟', '#eab308', 3),
  ('Lanches', '🍔', '#ef4444', 4),
  ('Sobremesas', '🍦', '#ec4899', 5),
  ('Sorvetes', '🍨', '#8b5cf6', 6),
  ('Açaí', '🫐', '#7c3aed', 7),
  ('Adicionais', '➕', '#6b7280', 8),
  ('Combos', '🎁', '#10b981', 9),
  ('Promoções', '🔥', '#dc2626', 10);

-- Mesas
INSERT INTO mesas (numero, descricao, capacidade) VALUES
  (1, 'Mesa 1 - Salão', 4),
  (2, 'Mesa 2 - Salão', 4),
  (3, 'Mesa 3 - Salão', 4),
  (4, 'Mesa 4 - Salão', 6),
  (5, 'Mesa 5 - Varanda', 4),
  (6, 'Mesa 6 - Varanda', 4),
  (7, 'Mesa 7 - Varanda', 6),
  (8, 'Mesa 8 - Fundo', 4),
  (9, 'Mesa 9 - Fundo', 2),
  (10, 'Mesa 10 - Fundo', 2),
  (11, 'Balcão 1', 2),
  (12, 'Balcão 2', 2);

-- Produtos de exemplo
INSERT INTO produtos (nome, descricao, preco_venda, preco_custo, enviar_para_producao, tempo_preparo_min) 
SELECT 
  nome, descricao, preco_venda, preco_custo, enviar_para_producao, tempo_preparo_min
FROM (VALUES
  ('Pastel de Carne', 'Pastel crocante com carne moída temperada', 10.00, 3.50, true, 8),
  ('Pastel de Queijo', 'Pastel crocante com queijo derretido', 9.00, 3.00, true, 8),
  ('Pastel de Frango', 'Pastel crocante com frango desfiado', 10.00, 3.50, true, 8),
  ('Pastel de Pizza', 'Pastel com molho, queijo e calabresa', 11.00, 4.00, true, 8),
  ('Pastel de Camarão', 'Pastel especial com camarão', 16.00, 7.00, true, 10),
  ('Pastel de Palmito', 'Pastel vegano com palmito', 10.00, 3.50, true, 8),
  ('Coca-Cola Lata', 'Coca-Cola 350ml gelada', 6.00, 2.50, false, 0),
  ('Coca-Cola 600ml', 'Coca-Cola garrafa 600ml', 7.00, 3.00, false, 0),
  ('Coca-Cola 2L', 'Coca-Cola 2 litros', 14.00, 6.00, false, 0),
  ('Água Mineral', 'Água mineral 500ml', 4.00, 1.00, false, 0),
  ('Suco Natural', 'Suco de laranja, limão ou maracujá 300ml', 9.00, 3.00, true, 5),
  ('Caldo de Cana', 'Caldo de cana fresquinho 300ml', 8.00, 2.50, true, 3),
  ('Porção de Batata Frita', 'Batata frita crocante porção individual', 18.00, 5.00, true, 12),
  ('Porção de Mandioca', 'Mandioca frita crocante', 16.00, 4.00, true, 12),
  ('Sobremesa do Dia', 'Pergunte ao garçom', 12.00, 4.00, true, 5)
) AS t(nome, descricao, preco_venda, preco_custo, enviar_para_producao, tempo_preparo_min);

-- Atualizar categoria dos produtos
UPDATE produtos SET categoria_id = (SELECT id FROM categorias WHERE nome = 'Pastéis')
WHERE nome LIKE 'Pastel%';

UPDATE produtos SET categoria_id = (SELECT id FROM categorias WHERE nome = 'Bebidas')
WHERE nome IN ('Coca-Cola Lata', 'Coca-Cola 600ml', 'Coca-Cola 2L', 'Água Mineral', 'Suco Natural', 'Caldo de Cana');

UPDATE produtos SET categoria_id = (SELECT id FROM categorias WHERE nome = 'Porções')
WHERE nome LIKE 'Porção%';

UPDATE produtos SET categoria_id = (SELECT id FROM categorias WHERE nome = 'Sobremesas')
WHERE nome = 'Sobremesa do Dia';

-- Impressora padrão da produção (modo teste/simulação)
INSERT INTO impressoras (nome, setor, tipo_conexao, endereco_ip, porta, largura_papel, corte_automatico, impressao_automatica, modo_teste, status) VALUES
  ('Impressora Produção', 'producao', 'ethernet', '192.168.0.100', 9100, '80mm', true, true, true, 'nao_configurada'),
  ('Impressora Caixa', 'caixa', 'ethernet', '192.168.0.101', 9100, '80mm', true, false, true, 'nao_configurada');
