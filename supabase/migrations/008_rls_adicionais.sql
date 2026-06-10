-- =====================================================
-- RLS: Tabelas de adicionais e configurações
-- Sistema IMPÉRIO PASTÉIS — Migration 008
-- =====================================================

-- Habilitar RLS nas tabelas que faltavam
DO $$ 
BEGIN
  -- adicionais
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'adicionais') THEN
    ALTER TABLE adicionais ENABLE ROW LEVEL SECURITY;
    
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'adicionais_select') THEN
      CREATE POLICY "adicionais_select" ON adicionais FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'adicionais_insert') THEN
      CREATE POLICY "adicionais_insert" ON adicionais FOR INSERT WITH CHECK (get_user_cargo() = 'admin');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'adicionais_update') THEN
      CREATE POLICY "adicionais_update" ON adicionais FOR UPDATE USING (get_user_cargo() = 'admin');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'adicionais_delete') THEN
      CREATE POLICY "adicionais_delete" ON adicionais FOR DELETE USING (get_user_cargo() = 'admin');
    END IF;
  END IF;

  -- produto_adicionais_config
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'produto_adicionais_config') THEN
    ALTER TABLE produto_adicionais_config ENABLE ROW LEVEL SECURITY;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'pac_select') THEN
      CREATE POLICY "pac_select" ON produto_adicionais_config FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'pac_insert') THEN
      CREATE POLICY "pac_insert" ON produto_adicionais_config FOR INSERT WITH CHECK (get_user_cargo() = 'admin');
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'pac_update') THEN
      CREATE POLICY "pac_update" ON produto_adicionais_config FOR UPDATE USING (get_user_cargo() = 'admin');
    END IF;
  END IF;

  -- comanda_item_adicionais
  IF EXISTS (SELECT 1 FROM pg_tables WHERE tablename = 'comanda_item_adicionais') THEN
    ALTER TABLE comanda_item_adicionais ENABLE ROW LEVEL SECURITY;

    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'cia_select') THEN
      CREATE POLICY "cia_select" ON comanda_item_adicionais FOR SELECT USING (true);
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'cia_insert') THEN
      CREATE POLICY "cia_insert" ON comanda_item_adicionais FOR INSERT WITH CHECK (
        get_user_cargo() IN ('admin', 'garcom', 'caixa')
      );
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE policyname = 'cia_update') THEN
      CREATE POLICY "cia_update" ON comanda_item_adicionais FOR UPDATE USING (
        get_user_cargo() IN ('admin', 'garcom', 'caixa')
      );
    END IF;
  END IF;
END $$;
