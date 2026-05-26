require('dotenv').config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('URL ou Chave do Supabase não encontradas no .env')
  process.exit(1)
}

const usersToCreate = [
  { email: 'garcom@imperiopasteis.com.br', nome: 'Garçom Teste', cargo: 'garcom' },
  { email: 'producao@imperiopasteis.com.br', nome: 'Produção Teste', cargo: 'producao' },
  { email: 'caixa@imperiopasteis.com.br', nome: 'Caixa Teste', cargo: 'caixa' }
];

async function createUsers() {
  for (const u of usersToCreate) {
    console.log(`Criando conta para ${u.cargo}...`)
    
    const authResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
      method: 'POST',
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        email: u.email,
        password: 'senha123',
        email_confirm: true,
        user_metadata: {
          nome: u.nome,
          cargo: u.cargo
        }
      })
    })

    const authData = await authResponse.json()
    let authId = null;

    if (!authResponse.ok) {
      if (authData.error_code === 'email_exists' || authData.msg?.includes('already registered')) {
        console.log(`✅ A conta ${u.email} já existe! Buscando ID...`);
        const listResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
          headers: {
            'apikey': supabaseServiceKey,
            'Authorization': `Bearer ${supabaseServiceKey}`
          }
        });
        const listData = await listResponse.json();
        const existingUser = listData.users.find(x => x.email === u.email);
        if (existingUser) authId = existingUser.id;
      } else {
        console.error(`❌ Erro ao criar conta ${u.email}:`, authData)
        continue;
      }
    } else {
      authId = authData.id;
      console.log(`✅ Conta criada com sucesso: ${u.email}`)
    }
    
    // Inserir na tabela usuarios
    const dbResponse = await fetch(`${supabaseUrl}/rest/v1/usuarios`, {
      method: 'POST',
      headers: {
        'apikey': supabaseServiceKey,
        'Authorization': `Bearer ${supabaseServiceKey}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=minimal'
      },
      body: JSON.stringify({
        id: authId,
        nome: u.nome,
        cargo: u.cargo,
        ativo: true,
        email: u.email
      })
    })

    if (!dbResponse.ok) {
      const errorBody = await dbResponse.text()
      if (!errorBody.includes('duplicate key')) {
        console.error(`❌ Erro ao adicionar na tabela usuarios (${u.cargo}):`, errorBody)
      } else {
        console.log(`✅ Usuário ${u.cargo} já salvo na tabela de usuarios.`)
      }
    } else {
      console.log(`✅ Usuário ${u.cargo} salvo na tabela de usuarios.`)
    }
  }
}

createUsers()
