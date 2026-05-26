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
  { status: 'novo', label: 'Novos Pedidos', cor: 'border-blue-400 dark:border-blue-600', badge: 'bg-blue-500', headerBg: 'bg-blue-50 dark:bg-blue-950/30' },
  { status: 'em_preparo', label: 'Em Preparo', cor: 'border-amber-400 dark:border-amber-600', badge: 'bg-amber-500', headerBg: 'bg-amber-50 dark:bg-amber-950/30' },
  { status: 'pronto', label: 'Prontos', cor: 'border-emerald-400 dark:border-emerald-600', badge: 'bg-emerald-500', headerBg: 'bg-emerald-50 dark:bg-emerald-950/30' },
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
      {/* Header */}
      <div className="flex items-center gap-3 p-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-orange-500 to-orange-600 flex items-center justify-center">
          <ChefHat className="w-5 h-5 text-white" />
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
        <button onClick={carregarPedidos} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500">
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
              <div key={col.status} className={`w-80 lg:w-auto flex flex-col rounded-2xl border-2 ${col.cor} ${col.headerBg} overflow-hidden`}>
                {/* Header coluna */}
                <div className="p-4 flex items-center gap-2 border-b border-current/20">
                  <div className={`w-6 h-6 rounded-lg ${col.badge} flex items-center justify-center`}>
                    <span className="text-white text-xs font-bold">{pedidosPorStatus[col.status]?.length || 0}</span>
                  </div>
                  <h2 className="font-bold text-gray-900 dark:text-white text-sm">{col.label}</h2>
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
    <div className={`bg-white dark:bg-gray-900 rounded-2xl border p-4 shadow-sm transition-all ${
      atrasado
        ? 'border-red-300 dark:border-red-700 animate-pulse-orange'
        : 'border-gray-200 dark:border-gray-800'
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
        <div className={`flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-xl ${
          atrasado ? 'bg-red-100 text-red-600' : 'bg-gray-100 dark:bg-gray-800 text-gray-500'
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
              className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-3 rounded-xl transition-all active:scale-95 text-sm"
            >
              👨‍🍳 Iniciar Preparo
            </button>
          )}
          {pedido.status === 'em_preparo' && (
            <button
              onClick={() => onAtualizar('pronto')}
              className="w-full bg-emerald-500 hover:bg-emerald-600 text-white font-bold py-3 rounded-xl transition-all active:scale-95 text-sm"
            >
              ✅ Marcar como Pronto
            </button>
          )}
          {pedido.status === 'pronto' && (
            <button
              onClick={() => onAtualizar('entregue')}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 rounded-xl transition-all active:scale-95 text-sm"
            >
              🛵 Marcar como Entregue
            </button>
          )}
        </>
      )}
    </div>
  )
}
