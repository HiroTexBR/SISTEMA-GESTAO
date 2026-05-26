'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { PedidoProducao } from '@/lib/types'
import { formatTime, isAtrasado } from '@/lib/utils'
import {
  ChefHat, Clock, CheckCircle2, AlertTriangle,
  RefreshCw, Flame, Loader2
} from 'lucide-react'
import { toast } from 'sonner'

const COLUNAS = [
  { status: 'novo',       label: 'Novos',    accent: 'var(--color-status-prep)',   accentBg: 'rgba(96,165,250,0.08)' },
  { status: 'em_preparo', label: 'Preparo',  accent: 'var(--color-status-wait)',   accentBg: 'rgba(251,191,36,0.08)' },
  { status: 'pronto',     label: 'Pronto',   accent: 'var(--color-status-free)',   accentBg: 'rgba(34,197,94,0.08)'  },
]

export default function ProducaoPage() {
  const supabase = createClient()
  const [pedidos, setPedidos] = useState<PedidoProducao[]>([])
  const [loading, setLoading] = useState(true)
  const [atualizando, setAtualizando] = useState<string | null>(null)

  const carregarPedidos = useCallback(async () => {
    const { data, error } = await supabase
      .from('view_pedidos_producao_completo')
      .select('*')
      .in('status', ['novo', 'em_preparo', 'pronto'])
      .order('criado_em', { ascending: true })

    if (!error && data) setPedidos(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    carregarPedidos()
    const channel = supabase
      .channel('producao-pedidos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos_producao' }, () => {
        carregarPedidos()
        if (typeof window !== 'undefined' && 'vibrate' in navigator) navigator.vibrate([200, 100, 200])
      })
      .subscribe()
    const interval = setInterval(carregarPedidos, 30000)
    return () => { supabase.removeChannel(channel); clearInterval(interval) }
  }, [carregarPedidos])

  async function atualizarStatus(pedidoId: string, novoStatus: string) {
    setAtualizando(pedidoId)
    try {
      const update: Record<string, string> = { status: novoStatus }
      if (novoStatus === 'em_preparo') update.preparo_em = new Date().toISOString()
      if (novoStatus === 'pronto')     update.pronto_em = new Date().toISOString()
      if (novoStatus === 'entregue')   update.entregue_em = new Date().toISOString()

      const { error } = await supabase.from('pedidos_producao').update(update).eq('id', pedidoId)
      if (error) throw error

      const labels: Record<string, string> = {
        em_preparo: '👨‍🍳 Em preparo!',
        pronto: '✅ Marcado como pronto!',
        entregue: '🛵 Entregue!',
      }
      toast.success(labels[novoStatus] || 'Atualizado!')
      carregarPedidos()
    } catch {
      toast.error('Erro ao atualizar pedido')
    } finally {
      setAtualizando(null)
    }
  }

  const pedidosPorStatus = COLUNAS.reduce((acc, col) => {
    acc[col.status] = pedidos.filter(p => p.status === col.status)
    return acc
  }, {} as Record<string, PedidoProducao[]>)

  const totalAtivos = pedidos.filter(p => p.status !== 'entregue').length
  const atrasados = pedidos.filter(p => isAtrasado(p.criado_em, 20) && p.status !== 'pronto')

  return (
    <div className="h-full flex flex-col" style={{ backgroundColor: 'var(--color-surface-bg)' }}>

      {/* ── HEADER ── */}
      <div className="flex items-center gap-3 px-4 lg:px-6 py-4 flex-shrink-0"
        style={{ borderBottom: '1px solid var(--color-surface-border)' }}>
        <div className="w-9 h-9 rounded-lg flex items-center justify-center"
          style={{ backgroundColor: 'rgba(251,191,36,0.1)' }}>
          <ChefHat className="w-5 h-5" style={{ color: 'var(--color-status-wait)' }} />
        </div>
        <div className="flex-1">
          <h1 className="font-display font-bold text-xl tracking-tight" style={{ color: 'var(--color-text-main)' }}>
            Produção
          </h1>
          <p className="text-xs font-semibold" style={{ color: 'var(--color-text-muted)' }}>
            {totalAtivos} pedido{totalAtivos !== 1 ? 's' : ''} ativo{totalAtivos !== 1 ? 's' : ''}
          </p>
        </div>
        {atrasados.length > 0 && (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold"
            style={{ backgroundColor: 'rgba(248,113,113,0.1)', color: 'var(--color-status-busy)' }}>
            <AlertTriangle className="w-3.5 h-3.5" />
            {atrasados.length} atrasado{atrasados.length > 1 ? 's' : ''}
          </div>
        )}
        <button
          onClick={carregarPedidos}
          className="p-2.5 rounded-lg transition-colors"
          style={{ backgroundColor: 'var(--color-surface-card)', color: 'var(--color-text-muted)' }}
        >
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* ── KANBAN ── */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--color-brand-accent)' }} />
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-3 p-4 h-full min-w-max lg:min-w-0 lg:grid lg:grid-cols-3">
            {COLUNAS.map(col => (
              <div
                key={col.status}
                className="w-80 lg:w-auto flex flex-col rounded-lg overflow-hidden"
                style={{ backgroundColor: 'var(--color-surface-card)' }}
              >
                {/* Header coluna */}
                <div
                  className="px-4 py-3 flex items-center gap-3 flex-shrink-0"
                  style={{ backgroundColor: col.accentBg, borderBottom: '1px solid var(--color-surface-border)' }}
                >
                  <div
                    className="w-6 h-6 rounded-md flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                    style={{ backgroundColor: col.accent }}
                  >
                    {pedidosPorStatus[col.status]?.length || 0}
                  </div>
                  <h2 className="font-display font-bold text-sm" style={{ color: 'var(--color-text-main)' }}>
                    {col.label}
                  </h2>
                </div>

                {/* Lista de pedidos */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {pedidosPorStatus[col.status]?.length === 0 ? (
                    <div className="text-center py-10" style={{ color: 'var(--color-text-muted)' }}>
                      <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-40" />
                      <p className="text-xs font-bold uppercase tracking-wider">Vazio</p>
                    </div>
                  ) : (
                    pedidosPorStatus[col.status]?.map(pedido => (
                      <PedidoCard
                        key={pedido.id}
                        pedido={pedido}
                        atualizando={atualizando === pedido.id}
                        onAtualizar={(status) => atualizarStatus(pedido.id, status)}
                      />
                    ))
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function PedidoCard({ pedido, atualizando, onAtualizar }: {
  pedido: PedidoProducao
  atualizando: boolean
  onAtualizar: (status: string) => void
}) {
  const atrasado = isAtrasado(pedido.criado_em, 20) && pedido.status !== 'pronto'
  const minutos = Math.floor(pedido.minutos_espera || 0)

  return (
    <div
      className={`rounded-lg overflow-hidden transition-all duration-200 ${atrasado ? 'animate-pulse-red' : ''}`}
      style={{
        backgroundColor: 'var(--color-surface-bg)',
        border: `1px solid ${atrasado ? 'rgba(248,113,113,0.3)' : 'var(--color-surface-border)'}`,
      }}
    >
      {/* Barra de urgência */}
      {atrasado && <div className="h-0.5" style={{ backgroundColor: 'var(--color-status-busy)' }} />}

      <div className="p-4">
        {/* Header do card */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-display font-bold text-xl" style={{ color: 'var(--color-text-main)' }}>
                Mesa {pedido.mesa_numero}
              </span>
              {atrasado && <Flame className="w-4 h-4" style={{ color: 'var(--color-status-busy)' }} />}
            </div>
            <p className="text-[10px] font-bold uppercase tracking-wider mt-0.5" style={{ color: 'var(--color-text-muted)' }}>
              #{String(pedido.numero).padStart(4, '0')} · {pedido.garcom_nome}
            </p>
          </div>
          <div
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-md text-[10px] font-bold"
            style={{
              backgroundColor: atrasado ? 'rgba(248,113,113,0.1)' : 'var(--color-surface-card)',
              color: atrasado ? 'var(--color-status-busy)' : 'var(--color-text-muted)',
            }}
          >
            <Clock className="w-3 h-3" />
            {minutos}min
          </div>
        </div>

        {/* Separador */}
        <div className="mb-3" style={{ borderTop: '1px solid var(--color-surface-border)' }} />

        {/* Itens */}
        <div className="space-y-2.5 mb-4">
          {(pedido.itens as any[] || []).map((item: any) => (
            <div key={item.id} className="flex items-start gap-2.5">
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-md flex-shrink-0 mt-0.5"
                style={{ backgroundColor: 'rgba(249,115,22,0.1)', color: 'var(--color-brand-accent)' }}
              >
                {item.quantidade}x
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold leading-tight" style={{ color: 'var(--color-text-main)' }}>
                  {item.nome_produto}
                </p>
                {item.observacao && (
                  <p
                    className="text-[11px] italic mt-1 px-2 py-0.5 rounded-md"
                    style={{ backgroundColor: 'rgba(251,191,36,0.08)', color: 'var(--color-status-wait)' }}
                  >
                    📝 {item.observacao}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>

        <p className="text-[10px] font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--color-text-muted)' }}>
          Recebido às {formatTime(pedido.criado_em)}
        </p>

        {/* Botão de ação */}
        {atualizando ? (
          <div className="flex items-center justify-center py-3">
            <Loader2 className="w-5 h-5 animate-spin" style={{ color: 'var(--color-brand-accent)' }} />
          </div>
        ) : (
          <>
            {pedido.status === 'novo' && (
              <button
                onClick={() => onAtualizar('em_preparo')}
                className="w-full font-bold py-3 rounded-lg text-sm text-white transition-all active:scale-98"
                style={{ backgroundColor: 'var(--color-status-wait)' }}
              >
                👨‍🍳 Iniciar Preparo
              </button>
            )}
            {pedido.status === 'em_preparo' && (
              <button
                onClick={() => onAtualizar('pronto')}
                className="w-full font-bold py-3 rounded-lg text-sm text-white transition-all active:scale-98"
                style={{ backgroundColor: 'var(--color-status-free)' }}
              >
                ✅ Marcar como Pronto
              </button>
            )}
            {pedido.status === 'pronto' && (
              <button
                onClick={() => onAtualizar('entregue')}
                className="w-full font-bold py-3 rounded-lg text-sm text-white transition-all active:scale-98"
                style={{ backgroundColor: 'var(--color-brand-accent)' }}
              >
                🛵 Marcar Entregue
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
