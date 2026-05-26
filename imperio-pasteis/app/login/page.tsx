'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { toast } from 'sonner'
import { UtensilsCrossed, Eye, EyeOff, Loader2 } from 'lucide-react'

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
        admin: '/',
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
    <div className="min-h-screen bg-surface-bg flex flex-col items-center justify-center p-4">
      {/* Background Decor */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-accent-glow rounded-full blur-[100px]" />
        <div className="absolute bottom-0 left-0 w-64 h-64 bg-brand-accent-glow rounded-full blur-[100px] opacity-50" />
      </div>

      <div className="relative w-full max-w-sm">
        {/* Logo and Typography */}
        <div className="text-center mb-10">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-surface-card shadow-glow mb-6">
            <UtensilsCrossed className="w-8 h-8 text-brand-accent" />
          </div>
          <h1 className="text-4xl font-bold text-text-main font-display tracking-tight mb-1">IMPÉRIO</h1>
          <p className="text-brand-accent text-sm font-bold tracking-[0.2em] uppercase">Alta Gastronomia</p>
        </div>

        {/* Login Form */}
        <div className="glass-card p-8 rounded-[2rem]">
          <h2 className="text-text-main font-display font-bold text-2xl mb-6 text-center">Acesso ao Sistema</h2>

          <form onSubmit={handleLogin} className="space-y-5">
            <div>
              <label className="block text-text-muted text-xs font-bold uppercase tracking-wider mb-2">Credencial</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                autoComplete="email"
                className="w-full bg-surface-bg border border-surface-border rounded-xl px-4 py-3 text-text-main placeholder-text-muted/50 focus:outline-none focus:border-brand-accent transition-colors text-sm"
              />
            </div>

            <div>
              <label className="block text-text-muted text-xs font-bold uppercase tracking-wider mb-2">Chave de Acesso</label>
              <div className="relative">
                <input
                  type={showSenha ? 'text' : 'password'}
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full bg-surface-bg border border-surface-border rounded-xl px-4 py-3 pr-12 text-text-main placeholder-text-muted/50 focus:outline-none focus:border-brand-accent transition-colors text-sm"
                />
                <button
                  type="button"
                  onClick={() => setShowSenha(!showSenha)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted hover:text-brand-accent transition-colors p-1"
                >
                  {showSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-accent hover:bg-[#D15C39] text-white font-bold py-3.5 rounded-xl transition-all shadow-glow flex items-center justify-center gap-2 mt-4 text-sm"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                'Entrar'
              )}
            </button>
          </form>
        </div>

        <p className="text-center text-text-muted/40 text-xs mt-8">
          IMPÉRIO PASTÉIS © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
