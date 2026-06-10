-- =====================================================
-- Migration 007 — Otimizações de Performance e Limpeza
-- =====================================================

-- =====================================================
-- 1. OTIMIZAÇÃO DO DASHBOARD (SARGable Queries)
-- =====================================================
-- Criamos um índice parcial apenas para comandas fechadas.
-- Isso vai acelerar as contas de "vendas de hoje" e "vendas do mês".
CREATE INDEX IF NOT EXISTS idx_comandas_fechada_em 
  ON comandas (fechada_em) 
  WHERE status = 'fechada';

-- Recriamos a view do dashboard para usar buscas por período (Ranges)
-- em vez de funções em cima da coluna, permitindo que o banco USE o índice que criamos acima.
CREATE OR REPLACE VIEW dashboard_resumo AS
SELECT
  -- Vendas do dia (fechadas hoje)
  COALESCE(SUM(CASE 
    WHEN c.fechada_em >= CURRENT_DATE 
     AND c.fechada_em < (CURRENT_DATE + INTERVAL '1 day') 
     AND c.status = 'fechada' 
    THEN c.total ELSE 0 END), 0) AS vendas_hoje,
    
  -- Vendas do mês
  COALESCE(SUM(CASE 
    WHEN c.fechada_em >= DATE_TRUNC('month', CURRENT_DATE) 
     AND c.fechada_em < (DATE_TRUNC('month', CURRENT_DATE) + INTERVAL '1 month') 
     AND c.status = 'fechada' 
    THEN c.total ELSE 0 END), 0) AS vendas_mes,
    
  -- Comandas abertas no momento
  COUNT(CASE WHEN c.status = 'aberta' THEN 1 END) AS comandas_abertas,
  
  -- Quantidade de comandas fechadas hoje
  COUNT(CASE 
    WHEN c.fechada_em >= CURRENT_DATE 
     AND c.fechada_em < (CURRENT_DATE + INTERVAL '1 day') 
     AND c.status = 'fechada' 
    THEN 1 END) AS comandas_fechadas_hoje,
    
  -- Ticket médio hoje
  CASE 
    WHEN COUNT(CASE WHEN c.fechada_em >= CURRENT_DATE AND c.fechada_em < (CURRENT_DATE + INTERVAL '1 day') AND c.status = 'fechada' THEN 1 END) > 0
    THEN SUM(CASE WHEN c.fechada_em >= CURRENT_DATE AND c.fechada_em < (CURRENT_DATE + INTERVAL '1 day') AND c.status = 'fechada' THEN c.total ELSE 0 END) /
         COUNT(CASE WHEN c.fechada_em >= CURRENT_DATE AND c.fechada_em < (CURRENT_DATE + INTERVAL '1 day') AND c.status = 'fechada' THEN 1 END)
    ELSE 0
  END AS ticket_medio_hoje
FROM comandas c;


-- =====================================================
-- 2. ROTINA DE LIMPEZA AUTOMÁTICA (pg_cron)
-- =====================================================
-- Ativamos a extensão do pg_cron (padrão no Supabase)
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- Criamos uma função que apaga dados velhos do sistema para não estourar o banco
CREATE OR REPLACE FUNCTION limpar_dados_antigos()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- 1. Deletar logs do sistema com mais de 30 dias
  DELETE FROM logs_sistema WHERE criado_em < NOW() - INTERVAL '30 days';
  
  -- 2. Deletar da fila de impressão papeis que já foram impressos ou que falharam 
  --    (mantemos os últimos 7 dias para consulta se der problema)
  DELETE FROM fila_impressao 
  WHERE (status = 'impresso' OR status = 'falhou') 
    AND criado_em < NOW() - INTERVAL '7 days';

  -- 3. Deletar logs de testes de impressora velhos
  DELETE FROM testes_impressora
  WHERE criado_em < NOW() - INTERVAL '7 days';
END;
$$;

-- Removemos o agendamento caso ele já exista para recriar (evita erros ao rodar a migration mais de uma vez)
DO $$
BEGIN
  PERFORM cron.unschedule('limpeza_diaria_sistema');
EXCEPTION WHEN OTHERS THEN
  -- Ignora se der erro porque não existia
END $$;

-- Agendamos a limpeza para rodar todo dia às 03:00 da madrugada
SELECT cron.schedule(
  'limpeza_diaria_sistema', -- Nome da tarefa
  '0 3 * * *',             -- Todo dia as 03:00 (Expressão Cron)
  $$SELECT limpar_dados_antigos();$$ -- Comando a ser executado
);
