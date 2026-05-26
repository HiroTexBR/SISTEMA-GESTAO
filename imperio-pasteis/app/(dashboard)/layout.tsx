'use client'

import { useEffect, useState } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import type { Usuario } from '@/lib/types'
import {
  LayoutDashboard, UtensilsCrossed, ChefHat, CreditCard, Package,
  Users, BarChart3, Printer, Settings, LogOut, Menu, X,
  Bell, Sun, Moon, Wifi, WifiOff
} from 'lucide-react'
import { toast } from 'sonner'

const NAV_ITEMS = [
  { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', cargos: ['admin'] },
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
    { href: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', cargos: ['admin'] },
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
  const [dark, setDark] = useState(false)
  const [online, setOnline] = useState(true)

  useEffect(() => {
    // Carregar usuário
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login'); return }
      supabase.from('usuarios').select('*').eq('id', user.id).single()
        .then(({ data }) => setUsuario(data))
    })

    // Online/offline
    const handleOnline = () => { setOnline(true); toast.success('Conexão restaurada') }
    const handleOffline = () => { setOnline(false); toast.error('Sem conexão com a internet') }
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    document.documentElement.classList.toggle('dark', dark)
  }, [dark])

  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const cargo = usuario?.cargo || 'garcom'
  const navItems = NAV_ITEMS.filter(item => item.cargos.includes(cargo))
  const bottomItems = BOTTOM_NAV_ITEMS[cargo] || []

  return (
    <div className="flex h-screen bg-gray-50 dark:bg-gray-950 overflow-hidden">
      {/* Sidebar — desktop/tablet landscape */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white dark:bg-gray-900
        border-r border-gray-200 dark:border-gray-800
        transform transition-transform duration-300 ease-in-out
        flex flex-col
        lg:relative lg:translate-x-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        {/* Logo */}
        <div className="flex items-center gap-3 p-5 border-b border-gray-100 dark:border-gray-800">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center shadow-lg shadow-orange-500/30 flex-shrink-0">
            <UtensilsCrossed className="w-5 h-5 text-white" />
          </div>
          <div className="min-w-0">
            <p className="font-bold text-gray-900 dark:text-white text-sm leading-tight">IMPÉRIO PASTÉIS</p>
            <p className="text-xs text-gray-500 dark:text-gray-400 truncate capitalize">{cargo}</p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto lg:hidden text-gray-400 hover:text-gray-600 p-1"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto p-3 space-y-1">
          {navItems.map(({ href, icon: Icon, label }) => {
            const active = pathname === href || pathname.startsWith(href + '/')
            return (
              <Link
                key={href}
                href={href}
                onClick={() => setSidebarOpen(false)}
                className={`
                  flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all
                  ${active
                    ? 'bg-orange-500 text-white shadow-lg shadow-orange-500/30'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                  }
                `}
              >
                <Icon className="w-5 h-5 flex-shrink-0" />
                {label}
              </Link>
            )
          })}
        </nav>

        {/* Footer da sidebar */}
        <div className="p-3 border-t border-gray-100 dark:border-gray-800 space-y-2">
          {/* Status online */}
          <div className={`flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium ${online ? 'text-emerald-600 bg-emerald-50' : 'text-red-600 bg-red-50'}`}>
            {online ? <Wifi className="w-4 h-4" /> : <WifiOff className="w-4 h-4" />}
            {online ? 'Online' : 'Offline'}
          </div>

          {/* Usuário */}
          {usuario && (
            <div className="flex items-center gap-2 px-3 py-2">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                {usuario.nome[0].toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{usuario.nome}</p>
                <p className="text-[10px] text-gray-500 capitalize">{usuario.cargo}</p>
              </div>
            </div>
          )}

          <button
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/30 transition-all"
          >
            <LogOut className="w-5 h-5" />
            Sair
          </button>
        </div>
      </aside>

      {/* Overlay da sidebar mobile */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Conteúdo principal */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header mobile */}
        <header className="lg:hidden flex items-center gap-3 px-4 py-3 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 flex-shrink-0">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 flex-1">
            <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
              <UtensilsCrossed className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-bold text-gray-900 dark:text-white text-sm">IMPÉRIO PASTÉIS</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Status conexão */}
            <div className={`w-2 h-2 rounded-full ${online ? 'bg-emerald-500' : 'bg-red-500'}`} />

            {/* Dark mode */}
            <button
              onClick={() => setDark(!dark)}
              className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-600 dark:text-gray-400"
            >
              {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
            </button>
          </div>
        </header>

        {/* Área de conteúdo scrollável */}
        <main className="flex-1 overflow-y-auto pb-20 lg:pb-6">
          {children}
        </main>

        {/* Bottom Navigation — mobile */}
        {bottomItems.length > 0 && (
          <nav className="lg:hidden fixed bottom-0 inset-x-0 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 safe-bottom z-30">
            <div className="flex items-center justify-around px-2 py-2">
              {bottomItems.map(({ href, icon: Icon, label }) => {
                const active = pathname === href || pathname.startsWith(href + '/')
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all min-w-[56px] ${
                      active
                        ? 'text-orange-500'
                        : 'text-gray-400 dark:text-gray-600'
                    }`}
                  >
                    <Icon className={`w-6 h-6 ${active ? 'scale-110' : ''} transition-transform`} />
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
