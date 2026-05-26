'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { PedidoProducao } from '@/lib/types'
import { formatTime, isAtrasado } from '@/lib/utils'
import {
  ChefHat, Clock, CheckCircle2, AlertTriangle,
  RefreshCw, Flame, Bell, Loader2
} from 'lucide-react'
import { toast } from 'sonner'

const COLUNAS = [
  { status: 'novo', label: 'Novos Pedidos', badge: 'bg-blue-500', headerBg: 'bg-blue-500/5' },
  { status: 'em_preparo', label: 'Em Preparo', badge: 'bg-amber-500', headerBg: 'bg-amber-500/5' },
  { status: 'pronto', label: 'Prontos', badge: 'bg-emerald-500', headerBg: 'bg-emerald-500/5' },
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

    // Realtime
    const channel = supabase
      .channel('producao-pedidos')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'pedidos_producao' }, () => {
        carregarPedidos()
        // Notificação sonora para novo pedido
        if (typeof window !== 'undefined' && 'vibrate' in navigator) {
          navigator.vibrate([200, 100, 200])
        }
      })
      .subscribe()

    // Atualizar a cada 30s para o timer
    const interval = setInterval(carregarPedidos, 30000)

    return () => {
      supabase.removeChannel(channel)
      clearInterval(interval)
    }
  }, [carregarPedidos])

  async function atualizarStatus(pedidoId: string, novoStatus: string) {
    setAtualizando(pedidoId)
    try {
      const update: Record<string, string> = { status: novoStatus }
      if (novoStatus === 'em_preparo') update.preparo_em = new Date().toISOString()
      if (novoStatus === 'pronto') update.pronto_em = new Date().toISOString()
      if (novoStatus === 'entregue') update.entregue_em = new Date().toISOString()

      const { error } = await supabase
        .from('pedidos_producao')
        .update(update)
        .eq('id', pedidoId)

      if (error) throw error

      const labels: Record<string, string> = {
        em_preparo: '👨‍🍳 Em preparo!',
        pronto: '✅ Marcado como pronto!',
        entregue: '🛵 Marcado como entregue!',
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
    <div className="h-full flex flex-col">
      <div className="flex items-center gap-4 p-6 glass-card border-b-0 rounded-b-3xl mb-4 mx-4 mt-2">
        <div className="w-12 h-12 rounded-2xl bg-[#D4A373]/10 flex items-center justify-center shadow-glow">
          <ChefHat className="w-6 h-6 text-[#D4A373]" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-[Fraunces] font-bold text-text-main">Produção</h1>
          <p className="text-xs text-text-muted uppercase tracking-wider font-bold mt-1">{totalAtivos} pedido{totalAtivos !== 1 ? 's' : ''} ativo{totalAtivos !== 1 ? 's' : ''}</p>
        </div>
        {atrasados.length > 0 && (
          <div className="flex items-center gap-1.5 bg-[#D96C6C]/10 text-[#D96C6C] px-3 py-1.5 rounded-xl border border-[#D96C6C]/20 shadow-glow">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-[10px] font-bold uppercase tracking-wider">{atrasados.length} atrasado{atrasados.length > 1 ? 's' : ''}</span>
          </div>
        )}
        <button onClick={carregarPedidos} className="p-3 rounded-xl bg-surface-bg border border-surface-border hover:text-brand-accent transition-all text-text-muted">
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Kanban */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-10 h-10 animate-spin text-orange-500" />
        </div>
      ) : (
        <div className="flex-1 overflow-x-auto">
          <div className="flex gap-4 p-4 h-full min-w-max lg:min-w-0 lg:grid lg:grid-cols-3">
            {COLUNAS.map(col => (
              <div key={col.status} className={`w-80 lg:w-auto flex flex-col rounded-[2rem] glass-card overflow-hidden shadow-xl`}>
                {/* Header coluna */}
                <div className={`p-6 flex items-center gap-4 border-b border-surface-border ${col.headerBg}`}>
                  <div className={`w-8 h-8 rounded-xl ${col.badge} flex items-center justify-center shadow-glow`}>
                    <span className="text-white text-sm font-bold">{pedidosPorStatus[col.status]?.length || 0}</span>
                  </div>
                  <h2 className="font-bold text-text-main text-lg font-[Fraunces]">{col.label}</h2>
                </div>

                {/* Pedidos */}
                <div className="flex-1 overflow-y-auto p-4 space-y-4">
                  {pedidosPorStatus[col.status]?.length === 0 ? (
                    <div className="text-center py-10 text-text-muted">
                      <CheckCircle2 className="w-10 h-10 mx-auto mb-3 opacity-50" />
                      <p className="text-xs font-bold uppercase tracking-wider">Nenhum pedido</p>
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
    <div className={`relative rounded-2xl p-6 transition-all duration-300 hover:shadow-glow hover:-translate-y-1 bg-surface-bg border border-surface-border ${
      atrasado
        ? 'border-[#D96C6C]/50 animate-pulse-orange'
        : ''
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-4 pb-4 border-b border-surface-border">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xl font-[Fraunces] font-bold text-text-main">
              Mesa {pedido.mesa_numero}
            </span>
            {atrasado && (
              <div className="w-5 h-5 rounded-full bg-[#D96C6C] flex items-center justify-center shadow-glow">
                <Flame className="w-3 h-3 text-white" />
              </div>
            )}
          </div>
          <p className="text-[10px] uppercase tracking-widest font-bold text-text-muted">#{String(pedido.numero).padStart(4, '0')} · {pedido.garcom_nome}</p>
        </div>
        <div className={`flex items-center gap-1.5 text-[10px] font-bold px-3 py-1.5 rounded-lg uppercase tracking-wider ${
          atrasado ? 'bg-[#D96C6C]/10 text-[#D96C6C] border border-[#D96C6C]/20' : 'bg-surface-border text-text-muted'
        }`}>
          <Clock className="w-3 h-3" />
          {minutos}min
        </div>
      </div>

      {/* Itens */}
      <div className="space-y-3 mb-5">
        {(pedido.itens as any[] || []).map((item: any) => (
          <div key={item.id} className="flex items-start gap-3">
            <span className="text-sm font-bold text-brand-accent w-6 flex-shrink-0 bg-brand-accent/10 text-center rounded-md py-0.5">{item.quantidade}x</span>
            <div className="flex-1 min-w-0 pt-0.5">
              <p className="text-sm font-bold text-text-main leading-tight">{item.nome_produto}</p>
              {item.observacao && (
                <p className="text-[11px] font-medium text-[#D4A373] italic leading-tight mt-1 bg-[#D4A373]/10 px-2 py-1 rounded">📝 {item.observacao}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Horário */}
      <p className="text-[10px] font-bold text-text-muted/60 uppercase tracking-widest mb-4">
        Recebido às {formatTime(pedido.criado_em)}
      </p>

      {/* Botão de ação */}
      {atualizando ? (
        <div className="flex items-center justify-center py-3">
          <Loader2 className="w-5 h-5 animate-spin text-brand-accent" />
        </div>
      ) : (
        <>
          {pedido.status === 'novo' && (
            <button
              onClick={() => onAtualizar('em_preparo')}
              className="w-full bg-[#D4A373] hover:bg-[#b88c60] text-white font-bold py-3.5 rounded-xl transition-all active:scale-95 text-sm shadow-glow flex justify-center gap-2"
            >
              👨‍🍳 Iniciar Preparo
            </button>
          )}
          {pedido.status === 'em_preparo' && (
            <button
              onClick={() => onAtualizar('pronto')}
              className="w-full bg-[#739E82] hover:bg-[#5f846c] text-white font-bold py-3.5 rounded-xl transition-all active:scale-95 text-sm shadow-glow flex justify-center gap-2"
            >
              ✅ Marcar como Pronto
            </button>
          )}
          {pedido.status === 'pronto' && (
            <button
              onClick={() => onAtualizar('entregue')}
              className="w-full bg-brand-accent hover:bg-[#D15C39] text-white font-bold py-3.5 rounded-xl transition-all active:scale-95 text-sm shadow-glow flex justify-center gap-2"
            >
              🛵 Marcar como Entregue
            </button>
          )}
        </>
      )}
    </div>
  )
}
