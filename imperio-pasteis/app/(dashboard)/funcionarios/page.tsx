'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Users, UserPlus, Edit2, Trash2, Shield, X, Loader2, CheckCircle2, AlertTriangle, Key
} from 'lucide-react'
import { toast } from 'sonner'

type Usuario = {
  id: string
  nome: string
  email: string
  cargo: 'admin' | 'caixa' | 'garcom' | 'producao'
  status: 'ativo' | 'inativo'
  criado_em: string
}

const FORM_INICIAL = {
  nome: '',
  email: '',
  senha: '',
  cargo: 'garcom' as Usuario['cargo'],
  status: 'ativo' as Usuario['status']
}

export default function FuncionariosPage() {
  const supabase = createClient()
  const [usuarios, setUsuarios] = useState<Usuario[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState<Usuario | null>(null)
  const [form, setForm] = useState(FORM_INICIAL)
  const [salvando, setSalvando] = useState(false)
  const [currentUser, setCurrentUser] = useState<any>(null)

  const carregar = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUser(user)

    const { data } = await supabase
      .from('usuarios')
      .select('*')
      .order('nome')

    if (data) setUsuarios(data as Usuario[])
    setLoading(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  function abrirNovo() {
    setEditando(null)
    setForm(FORM_INICIAL)
    setShowForm(true)
  }

  function abrirEditar(u: Usuario) {
    setEditando(u)
    setForm({
      nome: u.nome,
      email: u.email,
      senha: '', // Não carrega senha
      cargo: u.cargo,
      status: u.status
    })
    setShowForm(true)
  }

  async function salvar() {
    if (!form.nome.trim() || !form.email.trim()) {
      toast.error('Nome e email são obrigatórios')
      return
    }

    setSalvando(true)
    try {
      if (editando) {
        // Atualizar usuário
        const { error } = await supabase
          .from('usuarios')
          .update({
            nome: form.nome,
            cargo: form.cargo,
            status: form.status
          })
          .eq('id', editando.id)

        if (error) throw error

        // Nota: A atualização de email/senha via auth.admin requer Service Role Key no servidor.
        // Aqui estamos apenas atualizando os metadados públicos.
        if (form.senha) {
          toast.warning('Para alterar a senha de outro usuário é necessário redefini-la pelo painel administrativo.')
        } else {
          toast.success('✅ Usuário atualizado!')
        }
      } else {
        if (!form.senha || form.senha.length < 6) {
          toast.error('Senha deve ter pelo menos 6 caracteres')
          setSalvando(false)
          return
        }
        
        // Criar usuário via Supabase Auth (como estamos no client, fará login automático, 
        // em um cenário real usaria uma edge function com supabase.auth.admin.createUser)
        // Por simplicidade do MVP, vamos instruir a usar o painel do supabase
        toast.info('Para criar novos usuários, utilize o Painel do Supabase -> Authentication.')
        // await supabase.auth.signUp({ ... }) // <- loga o usuário recém criado
      }

      setShowForm(false)
      carregar()
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`)
    } finally {
      setSalvando(false)
    }
  }

  const CARGOS = {
    admin: { label: 'Administrador', cor: 'bg-purple-100 text-purple-700 dark:bg-purple-500/20 dark:text-purple-400' },
    caixa: { label: 'Caixa', cor: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400' },
    garcom: { label: 'Garçom', cor: 'bg-blue-100 text-blue-700 dark:bg-blue-500/20 dark:text-blue-400' },
    producao: { label: 'Produção', cor: 'bg-orange-100 text-orange-700 dark:bg-orange-500/20 dark:text-orange-400' },
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 animate-fade-in max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Funcionários</h1>
          <p className="text-sm text-gray-500">{usuarios.length} usuários cadastrados</p>
        </div>
        <button
          onClick={abrirNovo}
          className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold px-4 py-2.5 rounded-xl shadow-lg shadow-orange-500/20 active:scale-95 transition-all"
        >
          <UserPlus className="w-5 h-5" />
          <span className="hidden sm:inline">Novo</span>
        </button>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map(i => <div key={i} className="h-32 skeleton rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
          {usuarios.map(u => (
            <div key={u.id} className={`glass-card rounded-2xl p-5 transition-all duration-300 hover:shadow-glow hover:-translate-y-1 ${u.status === 'ativo' ? 'opacity-100' : 'opacity-50 grayscale'}`}>
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 bg-gray-100 dark:bg-white/10 rounded-full flex items-center justify-center shadow-inner">
                  <Users className="w-6 h-6 text-gray-500 dark:text-gray-300" />
                </div>
                <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${CARGOS[u.cargo].cor}`}>
                  {CARGOS[u.cargo].label}
                </span>
              </div>
              
              <h3 className="font-bold text-gray-900 dark:text-white truncate">{u.nome}</h3>
              <p className="text-sm text-gray-500 truncate mb-4">{u.email}</p>

              <div className="flex items-center justify-between pt-4 border-t border-gray-100 dark:border-white/10 mt-4">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-lg ${u.status === 'ativo' ? 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400'}`}>
                  {u.status}
                </span>
                
                <button
                  onClick={() => abrirEditar(u)}
                  className="p-1.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition-all"
                >
                  <Edit2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-900 w-full max-w-md rounded-3xl p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                {editando ? 'Editar Funcionário' : 'Novo Funcionário'}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            {!editando && (
              <div className="p-3 bg-blue-50 text-blue-700 text-sm rounded-xl flex gap-2">
                <Shield className="w-5 h-5 flex-shrink-0" />
                <p><strong>Aviso:</strong> A criação completa de usuários deve ser feita pelo Painel do Supabase (Authentication) para segurança do sistema.</p>
              </div>
            )}

            <div className="space-y-3">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Nome completo</label>
                <input
                  value={form.nome}
                  onChange={e => setForm(f => ({...f, nome: e.target.value}))}
                  className="w-full bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Email</label>
                <input
                  type="email"
                  value={form.email}
                  disabled={!!editando}
                  onChange={e => setForm(f => ({...f, email: e.target.value}))}
                  className="w-full bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 disabled:opacity-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Cargo</label>
                <select
                  value={form.cargo}
                  onChange={e => setForm(f => ({...f, cargo: e.target.value as any}))}
                  className="w-full bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                >
                  <option value="garcom">Garçom</option>
                  <option value="caixa">Caixa</option>
                  <option value="producao">Produção</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>

              {editando && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Status</label>
                  <select
                    value={form.status}
                    onChange={e => setForm(f => ({...f, status: e.target.value as any}))}
                    className="w-full bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  >
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                  </select>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-4">
              <button onClick={() => setShowForm(false)} className="flex-1 border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold py-3.5 rounded-2xl transition-all">
                Cancelar
              </button>
              <button
                onClick={salvar}
                disabled={salvando}
                className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-orange-500/20 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {salvando ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
