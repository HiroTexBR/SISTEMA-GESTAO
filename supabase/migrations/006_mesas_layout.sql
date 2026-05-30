-- =====================================================
-- Migration 006 — Reorganização das Mesas
-- F1-F8 (Fora/Varanda), M1-M8 (Dentro/Salão), D1-D4 (Delivery/Viagem)
-- =====================================================

-- Remove mesas antigas (seed inicial)
DELETE FROM mesas;

-- Reseta a sequência de número se necessário
-- (numero é INT com UNIQUE, não serial, então só inserimos os novos)

-- Mesas de Fora / Varanda  (F1–F8) → numeros 101–108
INSERT INTO mesas (numero, descricao, capacidade, status) VALUES
  (101, 'F1 — Fora',  4, 'livre'),
  (102, 'F2 — Fora',  4, 'livre'),
  (103, 'F3 — Fora',  4, 'livre'),
  (104, 'F4 — Fora',  4, 'livre'),
  (105, 'F5 — Fora',  6, 'livre'),
  (106, 'F6 — Fora',  6, 'livre'),
  (107, 'F7 — Fora',  4, 'livre'),
  (108, 'F8 — Fora',  4, 'livre');

-- Mesas de Dentro / Salão  (M1–M8) → numeros 201–208
INSERT INTO mesas (numero, descricao, capacidade, status) VALUES
  (201, 'M1 — Dentro', 4, 'livre'),
  (202, 'M2 — Dentro', 4, 'livre'),
  (203, 'M3 — Dentro', 4, 'livre'),
  (204, 'M4 — Dentro', 4, 'livre'),
  (205, 'M5 — Dentro', 6, 'livre'),
  (206, 'M6 — Dentro', 6, 'livre'),
  (207, 'M7 — Dentro', 4, 'livre'),
  (208, 'M8 — Dentro', 4, 'livre');

-- Delivery / Viagem  (D1–D4) → numeros 301–304
INSERT INTO mesas (numero, descricao, capacidade, status) VALUES
  (301, 'D1 — Delivery', 1, 'livre'),
  (302, 'D2 — Delivery', 1, 'livre'),
  (303, 'D3 — Delivery', 1, 'livre'),
  (304, 'D4 — Delivery', 1, 'livre');
