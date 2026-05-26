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
      <div className="flex items-center gap-4 p-5 glass-card border-b-0 rounded-b-3xl mb-4 mx-4 mt-2">
        <div className="w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center">
          <ChefHat className="w-6 h-6 text-amber-600" />
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Produção</h1>
          <p className="text-xs text-gray-500">{totalAtivos} pedido{totalAtivos !== 1 ? 's' : ''} ativo{totalAtivos !== 1 ? 's' : ''}</p>
        </div>
        {atrasados.length > 0 && (
          <div className="flex items-center gap-1.5 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 px-3 py-1.5 rounded-xl">
            <AlertTriangle className="w-4 h-4" />
            <span className="text-xs font-bold">{atrasados.length} atrasado{atrasados.length > 1 ? 's' : ''}</span>
          </div>
        )}
        <button onClick={carregarPedidos} className="p-3 rounded-full glass-card hover:text-amber-500 transition-all text-gray-500">
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
              <div key={col.status} className={`w-80 lg:w-auto flex flex-col rounded-3xl glass-card overflow-hidden shadow-xl`}>
                {/* Header coluna */}
                <div className={`p-5 flex items-center gap-3 border-b border-gray-200 dark:border-white/5 ${col.headerBg}`}>
                  <div className={`w-7 h-7 rounded-full ${col.badge} flex items-center justify-center shadow-glow`}>
                    <span className="text-white text-xs font-black">{pedidosPorStatus[col.status]?.length || 0}</span>
                  </div>
                  <h2 className="font-bold text-gray-900 dark:text-white text-base">{col.label}</h2>
                </div>

                {/* Pedidos */}
                <div className="flex-1 overflow-y-auto p-3 space-y-3">
                  {pedidosPorStatus[col.status]?.length === 0 ? (
                    <div className="text-center py-8 text-gray-400">
                      <CheckCircle2 className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">Nenhum pedido</p>
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
    <div className={`relative rounded-3xl p-6 transition-all duration-300 hover:shadow-glow hover:-translate-y-1 glass-card ${
      atrasado
        ? 'border-red-400/50 dark:border-red-500/50 animate-pulse-orange'
        : ''
    }`}>
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-lg font-black text-gray-900 dark:text-white">
              Mesa {pedido.mesa_numero}
            </span>
            {atrasado && (
              <div className="w-5 h-5 rounded-full bg-red-500 flex items-center justify-center">
                <Flame className="w-3 h-3 text-white" />
              </div>
            )}
          </div>
          <p className="text-xs text-gray-500">#{String(pedido.numero).padStart(4, '0')} · {pedido.garcom_nome}</p>
        </div>
        <div className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-full ${
          atrasado ? 'bg-red-500/20 text-red-500' : 'bg-gray-500/10 text-gray-500 dark:text-gray-400'
        }`}>
          <Clock className="w-3 h-3" />
          {minutos}min
        </div>
      </div>

      {/* Itens */}
      <div className="space-y-1.5 mb-4">
        {(pedido.itens as any[] || []).map((item: any) => (
          <div key={item.id} className="flex items-start gap-2">
            <span className="text-xs font-bold text-orange-500 w-6 flex-shrink-0">{item.quantidade}x</span>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 dark:text-white leading-tight">{item.nome_produto}</p>
              {item.observacao && (
                <p className="text-xs text-amber-600 dark:text-amber-400 italic leading-tight">📝 {item.observacao}</p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Horário */}
      <p className="text-[10px] text-gray-400 mb-3">
        Recebido às {formatTime(pedido.criado_em)}
      </p>

      {/* Botão de ação */}
      {atualizando ? (
        <div className="flex items-center justify-center py-2.5">
          <Loader2 className="w-5 h-5 animate-spin text-orange-500" />
        </div>
      ) : (
        <>
          {pedido.status === 'novo' && (
            <button
              onClick={() => onAtualizar('em_preparo')}
              className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3.5 rounded-full transition-all active:scale-95 text-sm shadow-glow"
            >
              👨‍🍳 Iniciar Preparo
            </button>
          )}
          {pedido.status === 'em_preparo' && (
            <button
              onClick={() => onAtualizar('pronto')}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3.5 rounded-full transition-all active:scale-95 text-sm shadow-glow"
            >
              ✅ Marcar como Pronto
            </button>
          )}
          {pedido.status === 'pronto' && (
            <button
              onClick={() => onAtualizar('entregue')}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3.5 rounded-full transition-all active:scale-95 text-sm shadow-glow"
            >
              🛵 Marcar como Entregue
            </button>
          )}
        </>
      )}
    </div>
  )
}
