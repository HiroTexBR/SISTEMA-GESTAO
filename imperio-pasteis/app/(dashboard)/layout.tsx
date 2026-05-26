'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Usuario } from '@/lib/types'
import {
  LayoutDashboard, UtensilsCrossed, ChefHat, CreditCard, Package,
  Users, BarChart3, Printer, Settings, LogOut, Menu, X,
  Sun, Moon, Wifi, WifiOff
} from 'lucide-react'
import { toast } from 'sonner'

const NAV_ITEMS = [
  { href: '/', icon: LayoutDashboard, label: 'Dashboard', cargos: ['admin'] },
  { href: '/mesas', icon: UtensilsCrossed, label: 'Mesas', cargos: ['admin', 'garcom', 'caixa'] },
  { href: '/producao', icon: ChefHat, label: 'Produção', cargos: ['admin', 'producao'] },
  { href: '/caixa', icon: CreditCard, label: 'Caixa', cargos: ['admin', 'caixa'] },
  { href: '/cardapio', icon: Package, label: 'Cardápio', cargos: ['admin'] },
  { href: '/estoque', icon: Package, label: 'Estoque', cargos: ['admin'] },
  { href: '/funcionarios', icon: Users, label: 'Equipe', cargos: ['admin'] },
  { href: '/relatorios', icon: BarChart3, label: 'Relatórios', cargos: ['admin', 'caixa'] },
  { href: '/impressoras', icon: Printer, label: 'Impressoras', cargos: ['admin'] },
  { href: '/teste-impressao', icon: Settings, label: 'Teste Impr.', cargos: ['admin', 'caixa'] },
]

const BOTTOM_NAV_ITEMS: Record<string, typeof NAV_ITEMS> = {
  admin: [
    { href: '/', icon: LayoutDashboard, label: 'Dashboard', cargos: ['admin'] },
    { href: '/mesas', icon: UtensilsCrossed, label: 'Mesas', cargos: ['admin'] },
    { href: '/producao', icon: ChefHat, label: 'Produção', cargos: ['admin'] },
    { href: '/caixa', icon: CreditCard, label: 'Caixa', cargos: ['admin'] },
    { href: '/relatorios', icon: BarChart3, label: 'Mais', cargos: ['admin'] },
  ],
  garcom: [
    { href: '/mesas', icon: UtensilsCrossed, label: 'Mesas', cargos: ['garcom'] },
  ],
  caixa: [
    { href: '/caixa', icon: CreditCard, label: 'Caixa', cargos: ['caixa'] },
    { href: '/mesas', icon: UtensilsCrossed, label: 'Mesas', cargos: ['caixa'] },
    { href: '/relatorios', icon: BarChart3, label: 'Relatórios', cargos: ['caixa'] },
  ],
  producao: [
    { href: '/producao', icon: ChefHat, label: 'Produção', cargos: ['producao'] },
  ],
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const [usuario, setUsuario] = useState<Usuario | null>(null)
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [online, setOnline] = useState(true)

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login'); return }
      supabase.from('usuarios').select('*').eq('id', user.id).single()
        .then(({ data }) => setUsuario(data))
    })

    const handleOnline = () => { setOnline(true); toast.success('Conexão restaurada') }
    const handleOffline = () => { setOnline(false); toast.error('Sem conexão com a internet') }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const cargo = usuario?.cargo || 'garcom'
  const navItems = NAV_ITEMS.filter(item => item.cargos.includes(cargo))
  const bottomItems = BOTTOM_NAV_ITEMS[cargo] || []

  return (
    <div className="flex h-screen overflow-hidden" style={{ backgroundColor: 'var(--color-surface-bg)' }}>

      {/* ── SIDEBAR — desktop ── */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-60 flex flex-col
        transition-transform duration-300 ease-in-out
        lg:relative lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `} style={{ backgroundColor: 'var(--color-surface-card)', borderRight: '1px solid var(--color-surface-border)' }}>

        {/* Logo */}
        <div className="flex items-center gap-3 px-5 h-16 flex-shrink-0" style={{ borderBottom: '1px solid var(--color-surface-border)' }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: 'var(--color-brand-accent)' }}>
            <UtensilsCrossed className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="font-display font-bold text-sm tracking-tight" style={{ color: 'var(--color-text-main)' }}>IMPÉRIO PASTÉIS</p>
            <p className="text-xs capitalize font-medium" style={{ color: 'var(--color-brand-accent)' }}>{cargo}</p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="lg:hidden p-1 rounded-md"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto px-3 py-3 space-y-0.5">
          {navItems.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || (href !== '/' && pathname.startsWith(href + '/'))
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
                style={{
                  backgroundColor: active ? 'rgba(249,115,22,0.1)' : 'transparent',
                  color: active ? 'var(--color-brand-accent)' : 'var(--color-text-muted)',
                }}
              >
                <Icon className="w-4 h-4 flex-shrink-0" />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Footer */}
        <div className="px-3 pb-4 space-y-1" style={{ borderTop: '1px solid var(--color-surface-border)', paddingTop: '12px' }}>
          {/* Status online */}
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold"
            style={{ color: online ? 'var(--color-status-free)' : 'var(--color-status-busy)' }}>
            {online ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
            {online ? 'Online' : 'Offline'}
          </div>

          {/* Usuário */}
          {usuario && (
            <div className="flex items-center gap-2.5 px-3 py-2">
              <div className="w-7 h-7 rounded-md flex items-center justify-center text-white text-xs font-bold flex-shrink-0"
                style={{ background: 'var(--color-brand-accent)' }}>
                {usuario.nome[0].toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold truncate" style={{ color: 'var(--color-text-main)' }}>{usuario.nome}</p>
                <p className="text-[10px] capitalize" style={{ color: 'var(--color-text-muted)' }}>{usuario.cargo}</p>
              </div>
            </div>
          )}

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all"
            style={{ color: 'var(--color-status-busy)' }}
          >
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </aside>

      {/* Overlay mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/60 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ── CONTEÚDO PRINCIPAL ── */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header mobile */}
        <header className="lg:hidden flex items-center gap-3 px-4 h-14 flex-shrink-0 z-30 sticky top-0"
          style={{ backgroundColor: 'var(--color-surface-card)', borderBottom: '1px solid var(--color-surface-border)' }}>
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg"
            style={{ color: 'var(--color-text-muted)' }}
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 flex-1">
            <div className="w-6 h-6 rounded-md flex items-center justify-center" style={{ background: 'var(--color-brand-accent)' }}>
              <UtensilsCrossed className="w-3 h-3 text-white" />
            </div>
            <span className="font-display font-bold text-sm tracking-tight" style={{ color: 'var(--color-text-main)' }}>IMPÉRIO PASTÉIS</span>
          </div>

          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: online ? 'var(--color-status-free)' : 'var(--color-status-busy)' }} />
          </div>
        </header>

        {/* Conteúdo scrollável */}
        <main className="flex-1 overflow-y-auto pb-16 lg:pb-0">
          {children}
        </main>

        {/* ── BOTTOM NAV — mobile ── */}
        {bottomItems.length > 0 && (
          <nav className="lg:hidden fixed bottom-0 inset-x-0 safe-bottom z-30"
            style={{ backgroundColor: 'var(--color-surface-card)', borderTop: '1px solid var(--color-surface-border)' }}>
            <div className="flex items-center justify-around px-2 py-1">
              {bottomItems.map(({ href, icon: Icon, label }) => {
                const active = pathname === href || (href !== '/' && pathname.startsWith(href + '/'))
                return (
                  <Link
                    key={href}
                    href={href}
                    className="flex flex-col items-center gap-0.5 px-3 py-2 rounded-lg transition-all min-w-[52px]"
                    style={{ color: active ? 'var(--color-brand-accent)' : 'var(--color-text-muted)' }}
                  >
                    <Icon className={`w-5 h-5 transition-transform ${active ? 'scale-110' : ''}`} />
                    <span className="text-[10px] font-medium leading-tight">{label}</span>
                  </Link>
                )
              })}
            </div>
          </nav>
        )}
      </div>
    </div>
  )
}
