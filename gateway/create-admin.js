require('dotenv').config()

const supabaseUrl = process.env.SUPABASE_URL
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('URL ou Chave do Supabase não encontradas no .env')
  process.exit(1)
}

async function createAdmin() {
  console.log('Criando conta do administrador...')
  
  // 1. Criar usuário no auth.users
  const authResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: 'POST',
    headers: {
      'apikey': supabaseServiceKey,
      'Authorization': `Bearer ${supabaseServiceKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      email: 'admin@imperiopasteis.com.br',
      password: 'admin123',
      email_confirm: true,
      user_metadata: {
        nome: 'Administrador Sistema',
        cargo: 'admin'
      }
    })
  })

  const authData = await authResponse.json()

  let authId = null;

  if (!authResponse.ok) {
    if (authData.error_code === 'email_exists' || authData.msg?.includes('already registered')) {
      console.log('✅ A conta admin@imperiopasteis.com.br já existe! Buscando ID...');
      
      const listResponse = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
        headers: {
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`
        }
      });
      const listData = await listResponse.json();
      const admin = listData.users.find(u => u.email === 'admin@imperiopasteis.com.br');
      if (admin) {
        authId = admin.id;
      } else {
        console.error('❌ Erro: conta existe mas não foi encontrada na lista');
        process.exit(1);
      }
    } else {
      console.error('❌ Erro ao criar conta:', authData)
      process.exit(1)
    }
  } else {
    authId = authData.id;
    console.log('✅ Conta criada com sucesso!')
    console.log('--------------------------------')
    console.log('Email: admin@imperiopasteis.com.br')
    console.log('Senha: admin123')
    console.log('--------------------------------')
  }

  
  // 2. Inserir na tabela usuarios
  console.log('Registrando na tabela de usuarios...')
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
      nome: 'Administrador Sistema',
      cargo: 'admin',
      ativo: true,
      email: 'admin@imperiopasteis.com.br'
    })
  })

  if (!dbResponse.ok) {
    const errorBody = await dbResponse.text()
    if (!errorBody.includes('duplicate key')) {
      console.error('❌ Erro ao adicionar na tabela usuarios:', errorBody)
    } else {
      console.log('✅ Usuário já salvo na tabela de usuarios.')
    }
  } else {
    console.log('✅ Usuário salvo na tabela de usuarios.')
  }
}

createAdmin()
