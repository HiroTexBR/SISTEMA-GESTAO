'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency } from '@/lib/utils'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip,
  ResponsiveContainer
} from 'recharts'
import { TrendingUp, DollarSign, ArrowRightLeft, FileText, Loader2, Download, RefreshCw } from 'lucide-react'

const S = {
  bg: 'var(--color-surface-bg)', card: 'var(--color-surface-card)',
  cardH: 'var(--color-surface-card-hover)', border: 'var(--color-surface-border)',
  main: 'var(--color-text-main)', sub: 'var(--color-text-sub)', muted: 'var(--color-text-muted)',
  accent: 'var(--color-brand-accent)', green: 'var(--color-status-free)',
}

const PERIODOS = [
  { value: 'hoje',   label: 'Hoje' },
  { value: 'semana', label: '7 dias' },
  { value: 'mes',    label: '30 dias' },
]

export default function RelatoriosPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [periodo, setPeriodo] = useState('mes')
  const [resumo, setResumo] = useState({ total_vendas: 0, qtd_pedidos: 0, ticket_medio: 0, dinheiro: 0, pix: 0, cartao: 0 })
  const [dadosGrafico, setDadosGrafico] = useState<any[]>([])

  const carregarDados = useCallback(async () => {
    setLoading(true)
    const hoje = new Date()
    let dataInicio = new Date()
    if (periodo === 'hoje') dataInicio.setHours(0, 0, 0, 0)
    else if (periodo === 'semana') dataInicio.setDate(hoje.getDate() - 7)
    else dataInicio.setMonth(hoje.getMonth() - 1)

    const isoInicio = dataInicio.toISOString()
    const { data: pagamentos } = await supabase
      .from('pagamentos').select('valor, forma_pagamento, criado_em').gte('criado_em', isoInicio)
    const { data: comandas } = await supabase
      .from('comandas').select('id, valor_final, criado_em').eq('status', 'finalizada').gte('criado_em', isoInicio)

    let total = 0, dinheiro = 0, pix = 0, cartao = 0
    pagamentos?.forEach(p => {
      total += p.valor
      if (p.forma_pagamento === 'dinheiro') dinheiro += p.valor
      if (p.forma_pagamento === 'pix') pix += p.valor
      if (p.forma_pagamento.includes('credito') || p.forma_pagamento.includes('debito')) cartao += p.valor
    })
    const qtd = comandas?.length || 0
    setResumo({ total_vendas: total, qtd_pedidos: qtd, ticket_medio: qtd > 0 ? total / qtd : 0, dinheiro, pix, cartao })

    const agrupadoDia: Record<string, number> = {}
    const dias = periodo === 'mes' ? 30 : periodo === 'semana' ? 7 : 1
    for (let i = dias; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i)
      const dataStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
      if (periodo !== 'hoje') agrupadoDia[dataStr] = 0
    }
    if (periodo === 'hoje') {
      for (let i = 8; i <= 23; i++) agrupadoDia[`${i}h`] = 0
      pagamentos?.forEach(p => {
        const h = new Date(p.criado_em).getHours()
        if (agrupadoDia[`${h}h`] !== undefined) agrupadoDia[`${h}h`] += p.valor
      })
    } else {
      pagamentos?.forEach(p => {
        const dia = new Date(p.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
        if (agrupadoDia[dia] !== undefined) agrupadoDia[dia] += p.valor
      })
    }
    setDadosGrafico(Object.keys(agrupadoDia).map(k => ({ name: k, total: agrupadoDia[k] })))
    setLoading(false)
  }, [periodo])

  useEffect(() => { carregarDados() }, [carregarDados])

  const KPI_CARDS = [
    { label: 'Vendas Brutas', value: formatCurrency(resumo.total_vendas), icon: DollarSign, color: S.accent },
    { label: 'Pedidos',       value: resumo.qtd_pedidos.toString(),        icon: FileText,   color: 'var(--color-status-prep)' },
    { label: 'Ticket Médio',  value: formatCurrency(resumo.ticket_medio),  icon: TrendingUp, color: S.green },
    { label: 'PIX',           value: formatCurrency(resumo.pix),           icon: ArrowRightLeft, color: '#A855F7' },
  ]

  const FORMAS = [
    { label: 'PIX',      valor: resumo.pix,      color: '#14B8A6' },
    { label: 'Cartões',  valor: resumo.cartao,   color: 'var(--color-status-prep)' },
    { label: 'Dinheiro', valor: resumo.dinheiro, color: S.green },
  ]

  return (
    <div className="p-4 lg:p-6 space-y-5 animate-fade-in max-w-7xl mx-auto">

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="font-display font-bold text-2xl tracking-tight" style={{ color: S.main }}>Relatórios</h1>
          <p className="text-xs mt-0.5" style={{ color: S.muted }}>Acompanhamento financeiro</p>
        </div>
        <div className="flex items-center gap-2">
          {/* Seletor de período */}
          <div className="flex rounded-lg overflow-hidden" style={{ border: `1px solid ${S.border}` }}>
            {PERIODOS.map(p => (
              <button
                key={p.value}
                onClick={() => setPeriodo(p.value)}
                className="px-3 py-2 text-xs font-bold transition-all"
                style={{
                  backgroundColor: periodo === p.value ? S.accent : S.card,
                  color: periodo === p.value ? '#fff' : S.muted,
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
          <button
            onClick={carregarDados}
            className="p-2.5 rounded-lg transition-colors"
            style={{ backgroundColor: S.card, color: S.muted }}
          >
            <RefreshCw className="w-4 h-4" />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: S.accent }} />
        </div>
      ) : (
        <>
          {/* ── KPI CARDS ── */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {KPI_CARDS.map(k => {
              const Icon = k.icon
              return (
                <div key={k.label} className="card p-4">
                  <div
                    className="w-9 h-9 rounded-lg flex items-center justify-center mb-4"
                    style={{ backgroundColor: `${k.color}18` }}
                  >
                    <Icon className="w-4 h-4" style={{ color: k.color }} />
                  </div>
                  <p className="font-display font-bold text-xl leading-none" style={{ color: S.main }}>{k.value}</p>
                  <p className="text-[11px] uppercase tracking-wider font-semibold mt-2" style={{ color: S.muted }}>{k.label}</p>
                </div>
              )
            })}
          </div>

          {/* ── GRÁFICO + FORMAS DE PAGAMENTO ── */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            {/* Gráfico de barras */}
            <div className="lg:col-span-2 card p-5">
              <h3 className="font-display font-semibold text-base mb-5" style={{ color: S.main }}>
                Evolução das Vendas
              </h3>
              <div className="h-[260px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dadosGrafico} barCategoryGap="30%">
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.04)" />
                    <XAxis
                      dataKey="name" axisLine={false} tickLine={false}
                      tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }} dy={8}
                    />
                    <YAxis
                      axisLine={false} tickLine={false}
                      tick={{ fontSize: 11, fill: 'var(--color-text-muted)' }}
                      tickFormatter={v => `R$${v}`}
                    />
                    <RechartsTooltip
                      cursor={{ fill: 'rgba(249,115,22,0.05)' }}
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="p-3 rounded-lg shadow-xl"
                              style={{ backgroundColor: 'var(--color-surface-card)', border: `1px solid var(--color-surface-border)` }}>
                              <p className="text-xs mb-1" style={{ color: 'var(--color-text-muted)' }}>{label}</p>
                              <p className="font-bold text-sm" style={{ color: S.accent }}>
                                {formatCurrency(payload[0].value as number)}
                              </p>
                            </div>
                          )
                        }
                        return null
                      }}
                    />
                    <Bar
                      dataKey="total" fill={S.accent}
                      radius={[4, 4, 0, 0]}
                      barSize={periodo === 'mes' ? 10 : 28}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Formas de pagamento */}
            <div className="card p-5">
              <h3 className="font-display font-semibold text-base mb-5" style={{ color: S.main }}>
                Por Forma de Pagamento
              </h3>
              <div className="space-y-5">
                {FORMAS.map(item => {
                  const perc = resumo.total_vendas > 0 ? (item.valor / resumo.total_vendas) * 100 : 0
                  return (
                    <div key={item.label}>
                      <div className="flex justify-between items-end mb-2">
                        <div>
                          <p className="text-sm font-medium" style={{ color: S.sub }}>{item.label}</p>
                          <p className="text-xs" style={{ color: S.muted }}>{perc.toFixed(1)}%</p>
                        </div>
                        <p className="font-bold text-sm" style={{ color: S.main }}>{formatCurrency(item.valor)}</p>
                      </div>
                      <div className="w-full rounded-full h-1.5" style={{ backgroundColor: S.border }}>
                        <div
                          className="h-1.5 rounded-full transition-all duration-500"
                          style={{ width: `${perc}%`, backgroundColor: item.color }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Resumo numérico */}
              <div className="mt-6 pt-4 space-y-2" style={{ borderTop: `1px solid ${S.border}` }}>
                <div className="flex justify-between text-sm">
                  <span style={{ color: S.muted }}>Total Geral</span>
                  <span className="font-bold" style={{ color: S.accent }}>{formatCurrency(resumo.total_vendas)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span style={{ color: S.muted }}>Pedidos</span>
                  <span className="font-bold" style={{ color: S.main }}>{resumo.qtd_pedidos}</span>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
