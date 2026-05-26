'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatTime } from '@/lib/utils'
import type { DashboardResumo, PedidoProducao } from '@/lib/types'
import {
  TrendingUp, ShoppingBag, Receipt, Users, Printer,
  AlertCircle, Clock, CheckCircle2, XCircle, RefreshCw,
  BarChart3, Flame
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid
} from 'recharts'

export default function DashboardPage() {
  const supabase = createClient()
  const [resumo, setResumo] = useState<DashboardResumo | null>(null)
  const [pedidosAtivos, setPedidosAtivos] = useState<PedidoProducao[]>([])
  const [vendasHora, setVendasHora] = useState<{ hora: string; total: number }[]>([])
  const [produtosMaisVendidos, setProdutosMaisVendidos] = useState<{ nome: string; qtd: number; total: number }[]>([])
  const [impressorasStatus, setImpressorasStatus] = useState<{ nome: string; status: string; setor: string }[]>([])
  const [loading, setLoading] = useState(true)
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date())

  const carregarDados = useCallback(async () => {
    try {
      // Resumo principal
      const { data: resumoData } = await supabase
        .from('dashboard_resumo')
        .select('*')
        .single()

      if (resumoData) setResumo(resumoData)

      // Pedidos ativos na produção
      const { data: pedidos } = await supabase
        .from('view_pedidos_producao_completo')
        .select('*')
        .in('status', ['novo', 'em_preparo'])
        .order('criado_em', { ascending: false })
        .limit(10)

      if (pedidos) setPedidosAtivos(pedidos)

      // Impressoras
      const { data: impressoras } = await supabase
        .from('impressoras')
        .select('nome, status, setor')
        .eq('ativa', true)

      if (impressoras) setImpressorasStatus(impressoras)

      // Produtos mais vendidos hoje
      const hoje = new Date().toISOString().split('T')[0]
      const { data: produtos } = await supabase
        .from('comanda_itens')
        .select(`
          nome_produto,
          quantidade,
          total,
          comanda:comandas!inner(aberta_em)
        `)
        .gte('comanda.aberta_em', hoje)
        .neq('status', 'cancelado')
        .limit(5)

      if (produtos) {
        const agrupado = produtos.reduce((acc: Record<string, { qtd: number; total: number }>, item: any) => {
          if (!acc[item.nome_produto]) acc[item.nome_produto] = { qtd: 0, total: 0 }
          acc[item.nome_produto].qtd += item.quantidade
          acc[item.nome_produto].total += item.total
          return acc
        }, {})

        setProdutosMaisVendidos(
          Object.entries(agrupado)
            .map(([nome, v]) => ({ nome, qtd: v.qtd, total: v.total }))
            .sort((a, b) => b.qtd - a.qtd)
            .slice(0, 5)
        )
      }

      setLastUpdate(new Date())
    } catch (err) {
      console.error('Erro ao carregar dashboard:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    carregarDados()
    const interval = setInterval(carregarDados, 30000) // Atualiza a cada 30s
    return () => clearInterval(interval)
  }, [carregarDados])

  if (loading) return <DashboardSkeleton />

  return (
    <div className="p-4 lg:p-6 space-y-6 animate-fade-in max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Atualizado às {formatTime(lastUpdate)}
          </p>
        </div>
        <button
          onClick={carregarDados}
          className="p-2.5 rounded-full glass-card text-gray-500 dark:text-gray-400 hover:text-amber-500 hover:border-amber-500/50 transition-all shadow-sm"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-4">
        <KPICard
          titulo="Vendas Hoje"
          valor={formatCurrency(resumo?.vendas_hoje || 0)}
          icon={TrendingUp}
          cor="text-amber-500 bg-amber-500/10"
        />
        <KPICard
          titulo="Vendas do Mês"
          valor={formatCurrency(resumo?.vendas_mes || 0)}
          icon={BarChart3}
          cor="text-emerald-500 bg-emerald-500/10"
        />
        <KPICard
          titulo="Comandas Abertas"
          valor={String(resumo?.comandas_abertas || 0)}
          icon={Receipt}
          cor="text-blue-500 bg-blue-500/10"
        />
        <KPICard
          titulo="Ticket Médio"
          valor={formatCurrency(resumo?.ticket_medio_hoje || 0)}
          icon={ShoppingBag}
          cor="text-purple-500 bg-purple-500/10"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Gráfico de vendas por hora */}
        <div className="lg:col-span-2 glass-card rounded-2xl border border-gray-200 dark:border-white/5 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 dark:text-white">Vendas por Hora — Hoje</h2>
            <TrendingUp className="w-5 h-5 text-orange-500" />
          </div>
          {vendasHora.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={vendasHora}>
                <defs>
                  <linearGradient id="gradOrange" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f97316" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#f97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="hora" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} tickFormatter={v => `R$${v}`} />
                <Tooltip formatter={(v: any) => formatCurrency(v as number)} />
                <Area type="monotone" dataKey="total" stroke="#f97316" fill="url(#gradOrange)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-gray-400 text-sm">
              Nenhuma venda registrada hoje ainda
            </div>
          )}
        </div>

        {/* Produtos mais vendidos */}
        <div className="glass-card rounded-2xl border border-gray-200 dark:border-white/5 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 dark:text-white">Mais Vendidos</h2>
            <Flame className="w-5 h-5 text-orange-500" />
          </div>
          <div className="space-y-3">
            {produtosMaisVendidos.length > 0 ? produtosMaisVendidos.map((p, i) => (
              <div key={p.nome} className="flex items-center gap-4">
                <span className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                  i === 0 ? 'bg-amber-500/20 text-amber-500' : 
                  i === 1 ? 'bg-gray-400/20 text-gray-400' : 
                  'bg-orange-900/20 text-orange-400'
                }`}>{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{p.nome}</p>
                  <p className="text-xs text-gray-500">{p.qtd}x · {formatCurrency(p.total)}</p>
                </div>
              </div>
            )) : (
              <p className="text-sm text-gray-400 text-center py-4">Sem dados hoje</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pedidos ativos */}
        <div className="glass-card rounded-2xl border border-gray-200 dark:border-white/5 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 dark:text-white">Produção Agora</h2>
            <span className="text-xs bg-orange-100 text-orange-600 px-2 py-1 rounded-full font-medium">
              {pedidosAtivos.length} pedidos
            </span>
          </div>
          <div className="space-y-2 max-h-64 overflow-y-auto pr-2">
            {pedidosAtivos.length > 0 ? pedidosAtivos.map(p => (
              <div key={p.id} className="flex items-center gap-3 p-3 rounded-2xl glass-card transition-all hover:border-amber-500/30">
                <div className={`w-2 h-2 rounded-full flex-shrink-0 shadow-glow ${
                  p.status === 'novo' ? 'bg-blue-400' : 'bg-amber-400 animate-pulse'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">
                    Mesa {p.mesa_numero} · #{p.numero}
                  </p>
                  <p className="text-xs text-gray-500">{p.garcom_nome}</p>
                </div>
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <Clock className="w-3 h-3" />
                  {Math.floor(p.minutos_espera || 0)}min
                </div>
              </div>
            )) : (
              <div className="text-center py-8 text-gray-400">
                <CheckCircle2 className="w-10 h-10 mx-auto mb-2 text-emerald-400" />
                <p className="text-sm">Produção em dia!</p>
              </div>
            )}
          </div>
        </div>

        {/* Status das impressoras */}
        <div className="glass-card rounded-2xl border border-gray-200 dark:border-white/5 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900 dark:text-white">Impressoras</h2>
            <Printer className="w-5 h-5 text-gray-400" />
          </div>
          <div className="space-y-3">
            {impressorasStatus.length > 0 ? impressorasStatus.map(imp => (
              <div key={imp.nome} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50/50 dark:bg-white/5 transition-all hover:bg-gray-100 dark:hover:bg-white/10 border border-transparent dark:border-white/5">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  imp.status === 'online' ? 'bg-emerald-100 dark:bg-emerald-900/30' :
                  imp.status === 'offline' ? 'bg-red-100 dark:bg-red-900/30' :
                  'bg-gray-100 dark:bg-gray-700'
                }`}>
                  <Printer className={`w-5 h-5 ${
                    imp.status === 'online' ? 'text-emerald-600' :
                    imp.status === 'offline' ? 'text-red-600' :
                    'text-gray-400'
                  }`} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-900 dark:text-white">{imp.nome}</p>
                  <p className="text-xs text-gray-500 capitalize">{imp.setor}</p>
                </div>
                <StatusImpressoraBadge status={imp.status} />
              </div>
            )) : (
              <div className="text-center py-6 text-gray-400">
                <AlertCircle className="w-8 h-8 mx-auto mb-2" />
                <p className="text-sm">Nenhuma impressora configurada</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function KPICard({
  titulo, valor, icon: Icon, cor
}: {
  titulo: string; valor: string; icon: any; cor: string;
}) {
  return (
    <div className="glass-card rounded-3xl p-5 lg:p-6 transition-all duration-300 hover:-translate-y-1">
      <div className={`w-12 h-12 rounded-full ${cor} flex items-center justify-center mb-5`}>
        <Icon className="w-6 h-6" />
      </div>
      <p className="text-2xl font-bold text-gray-900 dark:text-white leading-tight">{valor}</p>
      <p className="text-[11px] uppercase tracking-wider font-semibold text-gray-500 dark:text-gray-400 mt-2">{titulo}</p>
    </div>
  )
}

function StatusImpressoraBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; cls: string }> = {
    online: { label: 'Online', cls: 'bg-emerald-100 text-emerald-700' },
    offline: { label: 'Offline', cls: 'bg-red-100 text-red-700' },
    erro: { label: 'Erro', cls: 'bg-amber-100 text-amber-700' },
    nao_configurada: { label: 'N/A', cls: 'bg-gray-100 text-gray-500' },
  }
  const c = config[status] || config['nao_configurada']
  return (
    <span className={`text-[10px] font-semibold px-2 py-1 rounded-full ${c.cls}`}>{c.label}</span>
  )
}

function DashboardSkeleton() {
  return (
    <div className="p-4 lg:p-6 space-y-6">
      <div className="h-8 w-48 skeleton rounded-xl" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1,2,3,4].map(i => <div key={i} className="h-32 skeleton rounded-2xl" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 h-72 skeleton rounded-2xl" />
        <div className="h-72 skeleton rounded-2xl" />
      </div>
    </div>
  )
}
