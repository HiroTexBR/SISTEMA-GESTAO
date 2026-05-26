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
          <h1 className="text-3xl font-bold font-[Fraunces] text-text-main">Dashboard</h1>
          <p className="text-sm text-text-muted mt-1">
            Atualizado às {formatTime(lastUpdate)}
          </p>
        </div>
        <button
          onClick={carregarDados}
          className="p-3 rounded-xl bg-surface-bg border border-surface-border text-text-muted hover:text-brand-accent transition-colors"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          titulo="Vendas Hoje"
          valor={formatCurrency(resumo?.vendas_hoje || 0)}
          icon={TrendingUp}
          cor="text-[#739E82] bg-[#739E82]/10"
        />
        <KPICard
          titulo="Vendas do Mês"
          valor={formatCurrency(resumo?.vendas_mes || 0)}
          icon={BarChart3}
          cor="text-[#739E82] bg-[#739E82]/10"
        />
        <KPICard
          titulo="Comandas Abertas"
          valor={String(resumo?.comandas_abertas || 0)}
          icon={Receipt}
          cor="text-[#D4A373] bg-[#D4A373]/10"
        />
        <KPICard
          titulo="Ticket Médio"
          valor={formatCurrency(resumo?.ticket_medio_hoje || 0)}
          icon={ShoppingBag}
          cor="text-brand-accent bg-brand-accent/10"
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Gráfico de vendas por hora */}
        <div className="lg:col-span-2 glass-card p-6">
          <div className="flex items-center justify-between mb-6 border-b border-surface-border pb-4">
            <h2 className="text-xl font-[Fraunces] font-bold text-text-main">Vendas por Hora — Hoje</h2>
            <TrendingUp className="w-5 h-5 text-brand-accent" />
          </div>
          {vendasHora.length > 0 ? (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={vendasHora}>
                <defs>
                  <linearGradient id="gradOrange" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#C44B29" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#C44B29" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="hora" tick={{ fill: 'var(--color-text-muted)' }} />
                <YAxis tick={{ fill: 'var(--color-text-muted)' }} tickFormatter={v => `R$${v}`} />
                <Tooltip formatter={(v: any) => formatCurrency(v as number)} contentStyle={{ backgroundColor: 'var(--color-surface-bg)', borderColor: 'var(--color-surface-border)', color: 'var(--color-text-main)' }} />
                <Area type="monotone" dataKey="total" stroke="#C44B29" fill="url(#gradOrange)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-[200px] flex items-center justify-center text-text-muted text-sm">
              Nenhuma venda registrada hoje ainda
            </div>
          )}
        </div>

        {/* Produtos mais vendidos */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-6 border-b border-surface-border pb-4">
            <h2 className="text-xl font-[Fraunces] font-bold text-text-main">Mais Vendidos</h2>
            <Flame className="w-5 h-5 text-brand-accent" />
          </div>
          <div className="space-y-3">
            {produtosMaisVendidos.length > 0 ? produtosMaisVendidos.map((p, i) => (
              <div key={p.nome} className="flex items-center gap-4 bg-surface-bg border border-surface-border p-3 rounded-2xl">
                <span className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold flex-shrink-0 ${
                  i === 0 ? 'bg-brand-accent/20 text-brand-accent' : 
                  i === 1 ? 'bg-surface-border text-text-muted' : 
                  'bg-surface-border text-text-muted'
                }`}>{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-text-main truncate">{p.nome}</p>
                  <p className="text-xs text-text-muted">{p.qtd}x · {formatCurrency(p.total)}</p>
                </div>
              </div>
            )) : (
              <p className="text-sm text-text-muted text-center py-4">Sem dados hoje</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Pedidos ativos */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-6 border-b border-surface-border pb-4">
            <h2 className="text-xl font-[Fraunces] font-bold text-text-main">Produção Agora</h2>
            <span className="text-[10px] bg-brand-accent/10 text-brand-accent px-3 py-1.5 rounded-lg font-bold uppercase tracking-wider">
              {pedidosAtivos.length} pedidos
            </span>
          </div>
          <div className="space-y-3 max-h-64 overflow-y-auto pr-2">
            {pedidosAtivos.length > 0 ? pedidosAtivos.map(p => (
              <div key={p.id} className="flex items-center gap-4 p-4 rounded-2xl bg-surface-bg border border-surface-border transition-all">
                <div className={`w-3 h-3 rounded-full flex-shrink-0 shadow-glow ${
                  p.status === 'novo' ? 'bg-[#739E82]' : 'bg-[#D4A373] animate-pulse'
                }`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-text-main">
                    Mesa {p.mesa_numero} <span className="opacity-50 font-normal">· #{p.numero}</span>
                  </p>
                  <p className="text-xs text-text-muted">{p.garcom_nome}</p>
                </div>
                <div className="flex items-center gap-1.5 text-xs text-text-muted font-bold">
                  <Clock className="w-3.5 h-3.5" />
                  {Math.floor(p.minutos_espera || 0)}min
                </div>
              </div>
            )) : (
              <div className="text-center py-8 text-text-muted">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-3 text-[#739E82]" />
                <p className="text-sm font-bold uppercase tracking-wider">Produção em dia!</p>
              </div>
            )}
          </div>
        </div>

        {/* Status das impressoras */}
        <div className="glass-card p-6">
          <div className="flex items-center justify-between mb-6 border-b border-surface-border pb-4">
            <h2 className="text-xl font-[Fraunces] font-bold text-text-main">Impressoras</h2>
            <Printer className="w-5 h-5 text-text-muted" />
          </div>
          <div className="space-y-3">
            {impressorasStatus.length > 0 ? impressorasStatus.map(imp => (
              <div key={imp.nome} className="flex items-center gap-4 p-4 rounded-2xl bg-surface-bg border border-surface-border transition-all">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  imp.status === 'online' ? 'bg-[#739E82]/10' :
                  imp.status === 'offline' ? 'bg-[#D96C6C]/10' :
                  'bg-surface-border'
                }`}>
                  <Printer className={`w-5 h-5 ${
                    imp.status === 'online' ? 'text-[#739E82]' :
                    imp.status === 'offline' ? 'text-[#D96C6C]' :
                    'text-text-muted'
                  }`} />
                </div>
                <div className="flex-1">
                  <p className="text-sm font-bold text-text-main">{imp.nome}</p>
                  <p className="text-xs text-text-muted uppercase tracking-wider mt-0.5">{imp.setor}</p>
                </div>
                <StatusImpressoraBadge status={imp.status} />
              </div>
            )) : (
              <div className="text-center py-6 text-text-muted">
                <AlertCircle className="w-10 h-10 mx-auto mb-3" />
                <p className="text-sm uppercase tracking-wider font-bold">Nenhuma configurada</p>
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
    <div className="glass-card rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1">
      <div className={`w-12 h-12 rounded-2xl ${cor} flex items-center justify-center mb-6`}>
        <Icon className="w-6 h-6" />
      </div>
      <p className="text-3xl font-[Fraunces] font-bold text-text-main leading-none">{valor}</p>
      <p className="text-[10px] uppercase tracking-widest font-bold text-text-muted mt-3">{titulo}</p>
    </div>
  )
}

function StatusImpressoraBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; cls: string }> = {
    online: { label: 'Online', cls: 'bg-[#739E82]/10 text-[#739E82] border border-[#739E82]/20' },
    offline: { label: 'Offline', cls: 'bg-[#D96C6C]/10 text-[#D96C6C] border border-[#D96C6C]/20' },
    erro: { label: 'Erro', cls: 'bg-[#D4A373]/10 text-[#D4A373] border border-[#D4A373]/20' },
    nao_configurada: { label: 'N/A', cls: 'bg-surface-bg text-text-muted border border-surface-border' },
  }
  const c = config[status] || config['nao_configurada']
  return (
    <span className={`text-[10px] font-bold px-3 py-1 rounded-lg uppercase tracking-wider ${c.cls}`}>{c.label}</span>
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
