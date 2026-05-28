const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  'https://qumepzsylaxuuwabhrem.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InF1bWVwenN5bGF4dXV3YWJocmVtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3OTc1NzA4NSwiZXhwIjoyMDk1MzMzMDg1fQ.t2CVs9GMeDsgy1UOX24v2AsNBsb6C0n733pJQrDIjnU'
)

async function run() {
  // Testa se a coluna unidade existe inserindo produto de teste
  const { error } = await supabase
    .from('produtos')
    .insert({
      nome: '__TEST_UNIDADE__',
      preco_venda: 0,
      controlar_estoque: true,
      unidade: 'un',
      ativo: false
    })

  if (error) {
    console.log('Coluna unidade NAO existe:', error.message)
    console.log('')
    console.log('Para adicionar a coluna, acesse o SQL Editor do Supabase e execute:')
    console.log('ALTER TABLE produtos ADD COLUMN IF NOT EXISTS unidade VARCHAR(20) DEFAULT \'un\';')
  } else {
    console.log('Coluna unidade JA EXISTE! Tudo certo.')
    // Limpar
    await supabase.from('produtos').delete().eq('nome', '__TEST_UNIDADE__')
    console.log('Produto de teste removido.')
  }
}

run().catch(console.error)
