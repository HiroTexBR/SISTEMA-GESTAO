'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatTime } from '@/lib/utils'
import type { DashboardResumo, PedidoProducao } from '@/lib/types'
import {
  TrendingUp, ShoppingBag, Receipt, Users, Printer,
  AlertCircle, Clock, CheckCircle2, RefreshCw,
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
      const { data: resumoData } = await supabase.from('dashboard_resumo').select('*').single()
      if (resumoData) setResumo(resumoData)

      const { data: pedidos } = await supabase
        .from('view_pedidos_producao_completo')
        .select('*')
        .in('status', ['novo', 'em_preparo'])
        .order('criado_em', { ascending: false })
        .limit(10)
      if (pedidos) setPedidosAtivos(pedidos)

      const { data: impressoras } = await supabase
        .from('impressoras').select('nome, status, setor').eq('ativa', true)
      if (impressoras) setImpressorasStatus(impressoras)

      const hoje = new Date().toISOString().split('T')[0]
      const { data: produtos } = await supabase
        .from('comanda_itens')
        .select('nome_produto, quantidade, total, comanda:comandas!inner(aberta_em)')
        .gte('comanda.aberta_em', hoje)
        .neq('status', 'cancelado')
        .limit(50)

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
    const interval = setInterval(carregarDados, 30000)
    return () => clearInterval(interval)
  }, [carregarDados])

  if (loading) return <DashboardSkeleton />

  return (
    <div className="p-4 lg:p-6 space-y-5 max-w-7xl mx-auto animate-fade-in">

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl tracking-tight" style={{ color: 'var(--color-text-main)' }}>
            Dashboard
          </h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            Atualizado às {formatTime(lastUpdate)}
          </p>
        </div>
        <button
          onClick={carregarDados}
          className="p-2.5 rounded-lg transition-colors"
          style={{ backgroundColor: 'var(--color-surface-card)', color: 'var(--color-text-muted)' }}
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* ── KPI CARDS ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KPICard titulo="Vendas Hoje"       valor={formatCurrency(resumo?.vendas_hoje || 0)}        icon={TrendingUp} accent="#22C55E" />
        <KPICard titulo="Vendas do Mês"     valor={formatCurrency(resumo?.vendas_mes || 0)}         icon={BarChart3}  accent="#22C55E" />
        <KPICard titulo="Comandas Abertas"  valor={String(resumo?.comandas_abertas || 0)}           icon={Receipt}    accent="#FBBF24" />
        <KPICard titulo="Ticket Médio"      valor={formatCurrency(resumo?.ticket_medio_hoje || 0)}  icon={ShoppingBag} accent="#F97316" />
      </div>

      {/* ── GRÁFICO + TOP PRODUTOS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Gráfico de área */}
        <div className="lg:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display font-semibold text-base" style={{ color: 'var(--color-text-main)' }}>
              Vendas por Hora
            </h2>
            <TrendingUp className="w-4 h-4" style={{ color: 'var(--color-brand-accent)' }} />
          </div>
          {vendasHora.length > 0 ? (
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={vendasHora}>
                <defs>
                  <linearGradient id="gradOrange" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="#F97316" stopOpacity={0.25} />
                    <stop offset="95%" stopColor="#F97316" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                <XAxis dataKey="hora" tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--color-text-muted)', fontSize: 11 }} tickFormatter={v => `R$${v}`} axisLine={false} tickLine={false} />
                <Tooltip
                  formatter={(v: any) => formatCurrency(v as number)}
                  contentStyle={{ backgroundColor: 'var(--color-surface-card)', border: '1px solid var(--color-surface-border)', borderRadius: '8px', color: 'var(--color-text-main)', fontSize: 12 }}
                />
                <Area type="monotone" dataKey="total" stroke="#F97316" fill="url(#gradOrange)" strokeWidth={2} dot={false} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[180px] flex items-center justify-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Nenhuma venda registrada hoje
            </div>
          )}
        </div>

        {/* Mais vendidos */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-display font-semibold text-base" style={{ color: 'var(--color-text-main)' }}>
              Mais Vendidos
            </h2>
            <Flame className="w-4 h-4" style={{ color: 'var(--color-brand-accent)' }} />
          </div>
          <div className="space-y-2">
            {produtosMaisVendidos.length > 0 ? produtosMaisVendidos.map((p, i) => (
              <div key={p.nome} className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: 'var(--color-surface-bg)' }}>
                <span
                  className="w-7 h-7 rounded-md flex items-center justify-center text-xs font-bold flex-shrink-0"
                  style={{
                    backgroundColor: i === 0 ? 'rgba(249,115,22,0.15)' : 'var(--color-surface-border)',
                    color: i === 0 ? 'var(--color-brand-accent)' : 'var(--color-text-muted)',
                  }}
                >
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold truncate" style={{ color: 'var(--color-text-main)' }}>{p.nome}</p>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{p.qtd}x · {formatCurrency(p.total)}</p>
                </div>
              </div>
            )) : (
              <p className="text-sm text-center py-6" style={{ color: 'var(--color-text-muted)' }}>Sem dados hoje</p>
            )}
          </div>
        </div>
      </div>

      {/* ── PRODUÇÃO + IMPRESSORAS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Produção agora */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-base" style={{ color: 'var(--color-text-main)' }}>
              Produção Agora
            </h2>
            <span className="badge" style={{ backgroundColor: 'rgba(249,115,22,0.1)', color: 'var(--color-brand-accent)' }}>
              {pedidosAtivos.length} pedidos
            </span>
          </div>
          <div className="space-y-2 max-h-56 overflow-y-auto">
            {pedidosAtivos.length > 0 ? pedidosAtivos.map(p => (
              <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: 'var(--color-surface-bg)' }}>
                <div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: p.status === 'novo' ? 'var(--color-status-free)' : 'var(--color-status-wait)' }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold" style={{ color: 'var(--color-text-main)' }}>
                    Mesa {p.mesa_numero} <span style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>· #{p.numero}</span>
                  </p>
                  <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{p.garcom_nome}</p>
                </div>
                <div className="flex items-center gap-1 text-xs font-bold" style={{ color: 'var(--color-text-muted)' }}>
                  <Clock className="w-3 h-3" />
                  {Math.floor(p.minutos_espera || 0)}min
                </div>
              </div>
            )) : (
              <div className="text-center py-8">
                <CheckCircle2 className="w-10 h-10 mx-auto mb-2" style={{ color: 'var(--color-status-free)' }} />
                <p className="text-xs font-bold uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Produção em dia!</p>
              </div>
            )}
          </div>
        </div>

        {/* Impressoras */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-base" style={{ color: 'var(--color-text-main)' }}>
              Impressoras
            </h2>
            <Printer className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
          </div>
          <div className="space-y-2">
            {impressorasStatus.length > 0 ? impressorasStatus.map(imp => (
              <div key={imp.nome} className="flex items-center gap-3 p-3 rounded-lg" style={{ backgroundColor: 'var(--color-surface-bg)' }}>
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0"
                  style={{
                    backgroundColor: imp.status === 'online' ? 'rgba(34,197,94,0.1)' : imp.status === 'offline' ? 'rgba(248,113,113,0.1)' : 'var(--color-surface-border)',
                  }}
                >
                  <Printer
                    className="w-4 h-4"
                    style={{ color: imp.status === 'online' ? 'var(--color-status-free)' : imp.status === 'offline' ? 'var(--color-status-busy)' : 'var(--color-text-muted)' }}
                  />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-semibold" style={{ color: 'var(--color-text-main)' }}>{imp.nome}</p>
                  <p className="text-xs uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>{imp.setor}</p>
                </div>
                <StatusImpressoraBadge status={imp.status} />
              </div>
            )) : (
              <div className="text-center py-6">
                <AlertCircle className="w-8 h-8 mx-auto mb-2" style={{ color: 'var(--color-text-muted)' }} />
                <p className="text-xs uppercase tracking-wider font-bold" style={{ color: 'var(--color-text-muted)' }}>Nenhuma configurada</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function KPICard({ titulo, valor, icon: Icon, accent }: {
  titulo: string; valor: string; icon: any; accent: string
}) {
  return (
    <div className="card p-4 transition-all duration-200 hover:-translate-y-0.5">
      <div
        className="w-9 h-9 rounded-lg flex items-center justify-center mb-4"
        style={{ backgroundColor: `${accent}15` }}
      >
        <Icon className="w-4 h-4" style={{ color: accent }} />
      </div>
      <p className="font-display font-bold text-2xl leading-none" style={{ color: 'var(--color-text-main)' }}>{valor}</p>
      <p className="text-[11px] uppercase tracking-wider font-semibold mt-2" style={{ color: 'var(--color-text-muted)' }}>{titulo}</p>
    </div>
  )
}

function StatusImpressoraBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; color: string; bg: string }> = {
    online:          { label: 'Online',  color: 'var(--color-status-free)',     bg: 'rgba(34,197,94,0.1)' },
    offline:         { label: 'Offline', color: 'var(--color-status-busy)',     bg: 'rgba(248,113,113,0.1)' },
    erro:            { label: 'Erro',    color: 'var(--color-status-wait)',     bg: 'rgba(251,191,36,0.1)' },
    nao_configurada: { label: 'N/A',     color: 'var(--color-text-muted)',      bg: 'var(--color-surface-border)' },
  }
  const c = config[status] || config['nao_configurada']
  return (
    <span className="badge" style={{ backgroundColor: c.bg, color: c.color }}>
      {c.label}
    </span>
  )
}

function DashboardSkeleton() {
  return (
    <div className="p-4 lg:p-6 space-y-5">
      <div className="h-7 w-36 skeleton" />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1,2,3,4].map(i => <div key={i} className="h-28 skeleton" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 h-60 skeleton" />
        <div className="h-60 skeleton" />
      </div>
    </div>
  )
}
