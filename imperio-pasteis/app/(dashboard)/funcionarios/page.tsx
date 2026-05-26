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
    admin: { label: 'Administrador', cor: 'bg-[#D4A373]/10 text-[#D4A373] border border-[#D4A373]/20' },
    caixa: { label: 'Caixa', cor: 'bg-[#739E82]/10 text-[#739E82] border border-[#739E82]/20' },
    garcom: { label: 'Garçom', cor: 'bg-[#7592B8]/10 text-[#7592B8] border border-[#7592B8]/20' },
    producao: { label: 'Produção', cor: 'bg-brand-accent/10 text-brand-accent border border-brand-accent/20' },
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 animate-fade-in max-w-7xl mx-auto">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-[Fraunces] font-bold text-text-main">Funcionários</h1>
          <p className="text-sm font-bold uppercase tracking-wider text-text-muted mt-1">{usuarios.length} usuários cadastrados</p>
        </div>
        <button
          onClick={abrirNovo}
          className="flex items-center gap-2 bg-brand-accent hover:bg-[#D15C39] text-white font-bold px-4 py-2.5 rounded-xl shadow-glow active:scale-95 transition-all"
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
            <div key={u.id} className={`glass-card rounded-[2rem] p-6 transition-all duration-300 hover:shadow-glow hover:-translate-y-1 ${u.status === 'ativo' ? 'opacity-100' : 'opacity-50 grayscale'}`}>
              <div className="flex justify-between items-start mb-5">
                <div className="w-12 h-12 bg-surface-bg border border-surface-border rounded-xl flex items-center justify-center shadow-inner">
                  <Users className="w-6 h-6 text-text-muted" />
                </div>
                <span className={`text-[10px] uppercase tracking-wider font-bold px-3 py-1.5 rounded-lg ${CARGOS[u.cargo].cor}`}>
                  {CARGOS[u.cargo].label}
                </span>
              </div>
              
              <h3 className="font-bold font-[Fraunces] text-lg text-text-main truncate">{u.nome}</h3>
              <p className="text-xs text-text-muted font-medium truncate mb-5">{u.email}</p>

              <div className="flex items-center justify-between pt-4 border-t border-surface-border mt-4">
                <span className={`text-[10px] uppercase tracking-wider font-bold px-3 py-1.5 rounded-lg ${u.status === 'ativo' ? 'bg-[#739E82]/10 text-[#739E82] border border-[#739E82]/20' : 'bg-[#D96C6C]/10 text-[#D96C6C] border border-[#D96C6C]/20'}`}>
                  {u.status}
                </span>
                
                <button
                  onClick={() => abrirEditar(u)}
                  className="p-2 text-text-muted hover:text-brand-accent hover:bg-brand-accent/10 rounded-xl transition-all"
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
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in">
          <div className="glass-card w-full max-w-md rounded-[2rem] p-8 space-y-5">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-2xl font-[Fraunces] font-bold text-text-main">
                {editando ? 'Editar Funcionário' : 'Novo Funcionário'}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-xl text-text-muted hover:text-text-main hover:bg-surface-border transition-all">
                <X className="w-5 h-5" />
              </button>
            </div>

            {!editando && (
              <div className="p-4 bg-[#7592B8]/10 text-[#7592B8] text-xs font-medium rounded-xl flex gap-3 border border-[#7592B8]/20">
                <Shield className="w-5 h-5 flex-shrink-0" />
                <p><strong>Aviso:</strong> A criação de usuários aqui realiza o login automático (restrição do Supabase no frontend). Para gerenciar com segurança, use o Painel do Supabase.</p>
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-2">Nome completo</label>
                <input
                  value={form.nome}
                  onChange={e => setForm(f => ({...f, nome: e.target.value}))}
                  className="w-full bg-surface-bg border border-surface-border rounded-xl px-4 py-3 text-sm text-text-main focus:outline-none focus:border-brand-accent transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-2">Email</label>
                <input
                  type="email"
                  value={form.email}
                  disabled={!!editando}
                  onChange={e => setForm(f => ({...f, email: e.target.value}))}
                  className="w-full bg-surface-bg border border-surface-border rounded-xl px-4 py-3 text-sm text-text-main focus:outline-none focus:border-brand-accent transition-colors disabled:opacity-50"
                />
              </div>

              {!editando && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-2">Senha</label>
                  <input
                    type="password"
                    value={form.senha}
                    onChange={e => setForm(f => ({...f, senha: e.target.value}))}
                    placeholder="Mínimo 6 caracteres"
                    className="w-full bg-surface-bg border border-surface-border rounded-xl px-4 py-3 text-sm text-text-main placeholder-text-muted/50 focus:outline-none focus:border-brand-accent transition-colors"
                  />
                </div>
              )}

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-2">Cargo</label>
                <select
                  value={form.cargo}
                  onChange={e => setForm(f => ({...f, cargo: e.target.value as any}))}
                  className="w-full bg-surface-bg border border-surface-border rounded-xl px-4 py-3 text-sm text-text-main focus:outline-none focus:border-brand-accent transition-colors"
                >
                  <option value="garcom">Garçom</option>
                  <option value="caixa">Caixa</option>
                  <option value="producao">Produção</option>
                  <option value="admin">Administrador</option>
                </select>
              </div>

              {editando && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-text-muted mb-2">Status</label>
                  <select
                    value={form.status}
                    onChange={e => setForm(f => ({...f, status: e.target.value as any}))}
                    className="w-full bg-surface-bg border border-surface-border rounded-xl px-4 py-3 text-sm text-text-main focus:outline-none focus:border-brand-accent transition-colors"
                  >
                    <option value="ativo">Ativo</option>
                    <option value="inativo">Inativo</option>
                  </select>
                </div>
              )}
            </div>

            <div className="flex gap-3 pt-5 border-t border-surface-border">
              <button onClick={() => setShowForm(false)} className="flex-1 bg-surface-bg border border-surface-border text-text-main font-bold py-3.5 rounded-xl transition-all hover:bg-surface-border">
                Cancelar
              </button>
              <button
                onClick={salvar}
                disabled={salvando}
                className="flex-1 bg-brand-accent hover:bg-[#D15C39] text-white font-bold py-3.5 rounded-xl shadow-glow transition-all disabled:opacity-50 flex items-center justify-center gap-2"
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
