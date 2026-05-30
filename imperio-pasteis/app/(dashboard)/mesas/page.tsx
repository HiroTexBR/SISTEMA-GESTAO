'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Mesa, Comanda } from '@/lib/types'
import { getStatusMesaColor, getStatusMesaLabel, formatCurrency, formatTime } from '@/lib/utils'
import { Plus, Search, RefreshCw, Users, Clock, Receipt } from 'lucide-react'
import { toast } from 'sonner'

const STATUS_FILTERS = ['todos', 'livre', 'ocupada', 'aguardando_pagamento', 'em_preparo', 'inativa']

const STATUS_STYLE: Record<string, { dot: string; badge: string; label: string }> = {
  livre:               { dot: 'var(--color-status-free)',     badge: 'rgba(34,197,94,0.12)',   label: 'Livre'        },
  ocupada:             { dot: 'var(--color-status-busy)',     badge: 'rgba(248,113,113,0.12)', label: 'Ocupada'      },
  aguardando_pagamento:{ dot: 'var(--color-status-wait)',     badge: 'rgba(251,191,36,0.12)',  label: 'Aguardando'   },
  em_preparo:          { dot: 'var(--color-status-prep)',     badge: 'rgba(96,165,250,0.12)',  label: 'Em Preparo'   },
  inativa:             { dot: 'var(--color-status-inactive)', badge: 'rgba(75,75,90,0.2)',     label: 'Inativa'      },
}

/** Extrai a label curta da descrição: "F1 — Fora" → "F1" */
function getMesaLabel(mesa: Mesa): string {
  if (mesa.descricao) {
    const match = mesa.descricao.match(/^([A-Z]\d+)/)
    if (match) return match[1]
  }
  return String(mesa.numero)
}

/** Extrai a seção: "F1 — Fora" → "Fora" */
function getMesaSecao(mesa: Mesa): string {
  if (mesa.descricao) {
    const match = mesa.descricao.match(/—\s*(.+)$/)
    if (match) return match[1].trim()
  }
  return mesa.descricao || ''
}

export default function MesasPage() {
  const router = useRouter()
  const supabase = createClient()
  const [mesas, setMesas] = useState<(Mesa & { comanda?: Comanda })[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtroStatus, setFiltroStatus] = useState('todos')

  const carregarMesas = useCallback(async () => {
    const { data, error } = await supabase
      .from('mesas')
      .select(`
        *,
        comandas!mesa_id(
          id, numero, status, total, subtotal, aberta_em,
          garcom:usuarios!garcom_id(nome),
          itens:comanda_itens(count)
        )
      `)
      .eq('ativa', true)
      .order('numero')

    if (error) { toast.error('Erro ao carregar mesas'); return }

    const mesasComComanda = (data || []).map((m: any) => {
      const comandaAtiva = m.comandas?.find((c: any) =>
        ['aberta', 'aguardando_pagamento'].includes(c.status)
      )
      return { ...m, comanda: comandaAtiva }
    })

    setMesas(mesasComComanda)
    setLoading(false)
  }, [])

  useEffect(() => {
    carregarMesas()
    const channel = supabase
      .channel('mesas-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mesas' }, carregarMesas)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comandas' }, carregarMesas)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [carregarMesas])

  async function abrirOuAcessarMesa(mesa: Mesa & { comanda?: Comanda }) {
    if (mesa.status !== 'inativa') router.push(`/mesas/${mesa.id}`)
  }

  const mesasFiltradas = mesas.filter(m => {
    const label = getMesaLabel(m).toLowerCase()
    const secao = getMesaSecao(m).toLowerCase()
    const q = busca.toLowerCase()
    const matchBusca = busca === '' ||
      label.includes(q) ||
      secao.includes(q) ||
      m.numero.toString().includes(q) ||
      m.descricao?.toLowerCase().includes(q)
    const matchStatus = filtroStatus === 'todos' || m.status === filtroStatus
    return matchBusca && matchStatus
  })

  const stats = {
    total:     mesas.length,
    livres:    mesas.filter(m => m.status === 'livre').length,
    ocupadas:  mesas.filter(m => m.status === 'ocupada').length,
    aguardando:mesas.filter(m => m.status === 'aguardando_pagamento').length,
  }

  return (
    <div className="p-4 lg:p-6 space-y-4 max-w-7xl mx-auto animate-fade-in">

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display font-bold text-2xl tracking-tight" style={{ color: 'var(--color-text-main)' }}>Mesas</h1>
          <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
            {stats.livres} livres · {stats.ocupadas} ocupadas
          </p>
        </div>
        <button
          onClick={carregarMesas}
          className="p-2.5 rounded-lg transition-colors"
          style={{ backgroundColor: 'var(--color-surface-card)', color: 'var(--color-text-muted)' }}
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* ── STATS RÁPIDOS ── */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Total',     value: stats.total,     color: 'var(--color-text-main)' },
          { label: 'Livres',    value: stats.livres,    color: 'var(--color-status-free)' },
          { label: 'Ocupadas',  value: stats.ocupadas,  color: 'var(--color-status-busy)' },
          { label: 'Pagamento', value: stats.aguardando,color: 'var(--color-status-wait)' },
        ].map(s => (
          <div key={s.label} className="card py-4 text-center">
            <p className="font-display font-bold text-2xl leading-none" style={{ color: s.color }}>{s.value}</p>
            <p className="text-[10px] uppercase tracking-wider font-semibold mt-1.5" style={{ color: 'var(--color-text-muted)' }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── BUSCA ── */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
        <input
          type="text"
          placeholder="Buscar mesa..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className="input pl-10"
        />
      </div>

      {/* ── FILTROS ── */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-select">
        {STATUS_FILTERS.map(s => (
          <button
            key={s}
            onClick={() => setFiltroStatus(s)}
            className="px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider whitespace-nowrap flex-shrink-0 transition-all"
            style={{
              backgroundColor: filtroStatus === s ? 'var(--color-brand-accent)' : 'var(--color-surface-card)',
              color: filtroStatus === s ? '#fff' : 'var(--color-text-muted)',
            }}
          >
            {s === 'todos' ? 'Todos' : getStatusMesaLabel(s)}
          </button>
        ))}
      </div>

      {/* ── GRID DE MESAS ── */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="h-36 skeleton" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {mesasFiltradas.map(mesa => (
            <MesaCard key={mesa.id} mesa={mesa} onClick={() => abrirOuAcessarMesa(mesa)} />
          ))}
          {mesasFiltradas.length === 0 && (
            <div className="col-span-full text-center py-12" style={{ color: 'var(--color-text-muted)' }}>
              <p className="text-sm">Nenhuma mesa encontrada</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function MesaCard({ mesa, onClick }: { mesa: Mesa & { comanda?: Comanda }, onClick: () => void }) {
  const temComanda = !!mesa.comanda
  const inativa = mesa.status === 'inativa'
  const st = STATUS_STYLE[mesa.status] || STATUS_STYLE['inativa']

  return (
    <button
      onClick={onClick}
      disabled={inativa}
      className="w-full text-left rounded-lg overflow-hidden transition-all duration-200 hover:-translate-y-0.5"
      style={{
        backgroundColor: 'var(--color-surface-card)',
        boxShadow: 'var(--shadow-card)',
        opacity: inativa ? 0.45 : 1,
        cursor: inativa ? 'not-allowed' : 'pointer',
      }}
    >
      {/* Barra de status no topo */}
      <div className="h-1" style={{ backgroundColor: st.dot }} />

      <div className="p-4">
        {/* Label + dot */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--color-text-muted)' }}>{getMesaSecao(mesa) || 'Mesa'}</p>
            <p className="font-display font-bold text-3xl leading-none mt-0.5" style={{ color: 'var(--color-text-main)' }}>
              {getMesaLabel(mesa)}
            </p>
          </div>
          <div
            className="w-2.5 h-2.5 rounded-full"
            style={{
              backgroundColor: st.dot,
              boxShadow: mesa.status === 'ocupada' ? `0 0 0 4px ${st.badge}` : 'none',
            }}
          />
        </div>

        {/* Info da comanda */}
        {temComanda ? (
          <div className="space-y-1.5 pt-3" style={{ borderTop: '1px solid var(--color-surface-border)' }}>
            {mesa.comanda?.garcom && (
              <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                <Users className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{(mesa.comanda.garcom as any).nome}</span>
              </div>
            )}
            {mesa.comanda?.aberta_em && (
              <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--color-text-muted)' }}>
                <Clock className="w-3 h-3 flex-shrink-0" />
                <span>{formatTime(mesa.comanda.aberta_em)}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-sm font-bold mt-1" style={{ color: 'var(--color-brand-accent)' }}>
              <Receipt className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{formatCurrency(mesa.comanda?.total || 0)}</span>
            </div>
          </div>
        ) : (
          <div className="pt-3" style={{ borderTop: '1px solid var(--color-surface-border)' }}>
            <span
              className="badge"
              style={{ backgroundColor: st.badge, color: st.dot }}
            >
              {st.label}
            </span>
          </div>
        )}
      </div>
    </button>
  )
}
