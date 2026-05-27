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
      if (error) { toast.error('E-mail ou senha incorretos'); return }

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
    <div
      className="min-h-screen flex flex-col items-center justify-center p-5"
      style={{ backgroundColor: 'var(--color-surface-bg)' }}
    >
      {/* Glow de fundo sutil */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute top-[-10%] right-[-5%] w-[400px] h-[400px] rounded-full"
          style={{ background: 'radial-gradient(circle, rgba(249,115,22,0.06) 0%, transparent 70%)' }}
        />
      </div>

      <div className="relative w-full max-w-[380px]">

        {/* Logo */}
        <div className="text-center mb-10">
          <img 
            src="/logo.png" 
            alt="Império dos Pastéis" 
            className="w-48 mx-auto mb-6 drop-shadow-xl" 
          />
          <h1 className="sr-only">Império dos Pastéis</h1>
        </div>

        {/* Card de login */}
        <div
          className="p-7 rounded-xl"
          style={{ backgroundColor: 'var(--color-surface-card)', boxShadow: 'var(--shadow-card)' }}
        >
          <h2
            className="font-display font-bold text-lg mb-6"
            style={{ color: 'var(--color-text-main)' }}
          >
            Entrar na conta
          </h2>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label
                className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
                style={{ color: 'var(--color-text-muted)' }}
              >
                E-mail
              </label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="seu@email.com"
                autoComplete="email"
                className="input"
              />
            </div>

            <div>
              <label
                className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
                style={{ color: 'var(--color-text-muted)' }}
              >
                Senha
              </label>
              <div className="relative">
                <input
                  type={showSenha ? 'text' : 'password'}
                  value={senha}
                  onChange={e => setSenha(e.target.value)}
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="input pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowSenha(!showSenha)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 p-1 rounded transition-colors"
                  style={{ color: 'var(--color-text-muted)', minHeight: 'unset', minWidth: 'unset' }}
                >
                  {showSenha ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full mt-2"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Entrar'}
            </button>
          </form>
        </div>

        <p
          className="text-center text-xs mt-8"
          style={{ color: 'var(--color-text-muted)' }}
        >
          IMPÉRIO PASTÉIS © {new Date().getFullYear()}
        </p>
      </div>
    </div>
  )
}
