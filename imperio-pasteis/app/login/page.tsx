'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { UtensilsCrossed, Eye, EyeOff, Loader2, ChefHat, ShoppingBag, CreditCard, User } from 'lucide-react'

const CARGOS = [
  { id: 'garcom', label: 'Garçom', icon: User, cor: 'from-blue-500 to-blue-600', desc: 'Atendimento às mesas' },
  { id: 'producao', label: 'Produção', icon: ChefHat, cor: 'from-amber-500 to-orange-500', desc: 'Cozinha e preparo' },
  { id: 'caixa', label: 'Caixa', icon: CreditCard, cor: 'from-emerald-500 to-green-600', desc: 'Pagamentos' },
  { id: 'admin', label: 'Admin', icon: ShoppingBag, cor: 'from-purple-500 to-violet-600', desc: 'Administração total' },
]

export default function LoginPage() {
  const router = useRouter()
  const supabase = createClient()

  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [showSenha, setShowSenha] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    if (!email || !senha) {
      toast.error('Preencha e-mail e senha')
      return
    }

    setLoading(true)
    try {
      const { error } = await supabase.auth.signInWithPassword({ email, password: senha })

      if (error) {
        toast.error('E-mail ou senha incorretos')
        return
      }

      // Buscar cargo do usuário
      const { data: usuario } = await supabase
        .from('usuarios')
        .select('cargo, nome')
        .eq('email', email)
        .single()

      toast.success(`Bem-vindo(a), ${usuario?.nome || 'usuário'}!`)

      const redirectMap: Record<string, string> = {
        admin: '/dashboard',
        caixa: '/caixa',
        garcom: '/mesas',
        producao: '/producao',
      }

      router.push(redirectMap[usuario?.cargo || 'garcom'])
    } catch {
      toast.error('Erro ao fazer login. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-950 via-orange-900 to-orange-800 flex flex-col items-center justify-center p-4">
      {/* Partículas decorativas */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/4 left-1/4 w-64 h-64 bg-orange-500/10 rounded-full blur-3xl" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-orange-400/10 rounded-full blur-3xl" />
      </div>

      <div className="relative w-full max-w-md">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-gradient-to-br from-orange-400 to-orange-600 shadow-2xl shadow-orange-500/40 mb-4">
            <UtensilsCrossed className="w-10 h-10 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">IMPÉRIO</h1>
          <p className="text-orange-200 text-lg font-medium tracking-widest uppercase">Pastéis</p>
          <p className="text-orange-300/60 text-sm mt-1">Sistema de Comandas Digital</p>
        </div>

        {/* Card de login */}
        <div className="bg-white/10 backdrop-blur-xl rounded-3xl border border-white/20 p-8 shadow-2xl">
          <h2 className="text-white font-semibold text-xl mb-6 text-center">Acesse sua conta</h2>

          {/* Cards de cargo (informativo) */}
          <div className="grid grid-cols-4 gap-2 mb-6">
            {CARGOS.map(({ id, label, icon: Icon, cor }) => (
              <div
                key={id}
                className="flex flex-col items-center gap-1 p-2 rounded-xl bg-white/5 border border-white/10"
              >
                <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${cor} flex items-center justify-center`}>
                  <Icon className="w-4 h-4 text-white" />
                </div>
                <span className="text-white/70 text-[10px] font-medium text-center leading-tight">{label}</span>
              </div>
            ))}
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            {/* E-mail */}
            <div>
              <label className="block text-orange-100 text-sm font-medium mb-2">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                autoComplete="email"
                className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all text-base"
              />
            </div>

            {/* Senha */}
            <div>
              <label className="block text-orange-100 text-sm font-medium mb-2">Senha</label>
              <div className="relative">
                <input
                  type={showSenha ? 'text' : 'password'}
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full bg-white/10 border border-white/20 rounded-xl px-4 py-3 pr-12 text-white placeholder-white/40 focus:outline-none focus:ring-2 focus:ring-orange-400 focus:border-transparent transition-all text-base"
                />
                <button
                  type="button"
                  onClick={() => setShowSenha(!showSenha)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-white/50 hover:text-white transition-colors p-1"
                >
                  {showSenha ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Botão entrar */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 active:scale-[0.98] text-white font-bold py-4 rounded-xl transition-all duration-200 shadow-lg shadow-orange-500/30 flex items-center justify-center gap-3 text-lg mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Entrando...
                </>
              ) : (
                'Entrar no Sistema'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-orange-400/50 text-sm mt-6">
          v1.0.0 · IMPÉRIO PASTÉIS © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
