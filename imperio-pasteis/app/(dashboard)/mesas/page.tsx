'use client'

import { useEffect, useState, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Mesa, Comanda } from '@/lib/types'
import { getStatusMesaColor, getStatusMesaLabel, formatCurrency, formatTime } from '@/lib/utils'
import {
  Plus, Search, RefreshCw, Users, Clock, Receipt,
  MoreHorizontal, Filter
} from 'lucide-react'
import { toast } from 'sonner'

const STATUS_FILTERS = ['todos', 'livre', 'ocupada', 'aguardando_pagamento', 'em_preparo', 'inativa']

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

    // Realtime para mesas
    const channel = supabase
      .channel('mesas-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'mesas' }, carregarMesas)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comandas' }, carregarMesas)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [carregarMesas])

  async function abrirOuAcessarMesa(mesa: Mesa & { comanda?: Comanda }) {
    if (mesa.comanda) {
      // Mesa ocupada — abre a comanda
      router.push(`/mesas/${mesa.id}`)
    } else if (mesa.status === 'livre') {
      // Abrir nova comanda
      router.push(`/mesas/${mesa.id}`)
    }
  }

  const mesasFiltradas = mesas.filter(m => {
    const matchBusca = busca === '' ||
      m.numero.toString().includes(busca) ||
      m.descricao?.toLowerCase().includes(busca.toLowerCase())
    const matchStatus = filtroStatus === 'todos' || m.status === filtroStatus
    return matchBusca && matchStatus
  })

  const stats = {
    total: mesas.length,
    livres: mesas.filter(m => m.status === 'livre').length,
    ocupadas: mesas.filter(m => m.status === 'ocupada').length,
    aguardando: mesas.filter(m => m.status === 'aguardando_pagamento').length,
  }

  return (
    <div className="p-4 lg:p-6 space-y-6 animate-fade-in max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Mesas</h1>
          <p className="text-sm text-gray-500">{stats.livres} livres · {stats.ocupadas} ocupadas</p>
        </div>
        <button
          onClick={carregarMesas}
          className="p-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-orange-500 transition-all"
        >
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Stats rápidos */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { label: 'Total', value: stats.total, cor: 'text-gray-700 bg-gray-100 dark:bg-white/5 dark:text-gray-300 dark:border-white/10' },
          { label: 'Livres', value: stats.livres, cor: 'text-emerald-700 bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20' },
          { label: 'Ocupadas', value: stats.ocupadas, cor: 'text-red-700 bg-red-100 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20' },
          { label: 'Pagamento', value: stats.aguardando, cor: 'text-amber-700 bg-amber-100 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20' },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl border border-transparent px-3 py-3 sm:px-4 sm:py-4 text-center transition-all hover:scale-105 ${s.cor}`}>
            <p className="text-2xl font-bold leading-none mb-1">{s.value}</p>
            <p className="text-[11px] uppercase tracking-wider font-semibold opacity-70">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Busca e filtros */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar mesa..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 transition-all"
          />
        </div>
      </div>

      {/* Filtros de status */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-select">
        {STATUS_FILTERS.map(s => (
          <button
            key={s}
            onClick={() => setFiltroStatus(s)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap transition-all flex-shrink-0 ${
              filtroStatus === s
                ? 'bg-gradient-to-r from-orange-500 to-orange-600 text-white shadow-lg shadow-orange-500/25'
                : 'bg-white dark:bg-white/5 text-gray-600 dark:text-gray-400 border border-gray-200 dark:border-white/10 hover:dark:bg-white/10'
            }`}
          >
            {s === 'todos' ? 'Todos' : getStatusMesaLabel(s)}
          </button>
        ))}
      </div>

      {/* Grid de mesas */}
      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {[...Array(12)].map((_, i) => (
            <div key={i} className="h-40 skeleton rounded-2xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
          {mesasFiltradas.map(mesa => (
            <MesaCard key={mesa.id} mesa={mesa} onClick={() => abrirOuAcessarMesa(mesa)} />
          ))}
        </div>
      )}
    </div>
  )
}

function MesaCard({ mesa, onClick }: { mesa: Mesa & { comanda?: Comanda }, onClick: () => void }) {
  const temComanda = !!mesa.comanda
  const inatival = mesa.status === 'inativa'

  return (
    <button
      onClick={onClick}
      disabled={inatival}
      className={`relative w-full text-left rounded-2xl border overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-glow glass-card
        ${getStatusBorderColor(mesa.status)}
        ${inatival ? 'opacity-50 cursor-not-allowed grayscale' : ''}
        bg-white
      `}
    >
      {/* Status stripe */}
      <div className={`h-2 w-full ${getStatusMesaColor(mesa.status)}`} />

      <div className="p-4">
        {/* Número da mesa */}
        <div className="flex items-start justify-between mb-3">
          <div>
            <p className="text-xs text-gray-500 dark:text-gray-400 font-medium uppercase tracking-wide">Mesa</p>
            <p className="text-3xl font-black text-gray-900 dark:text-white leading-none">{mesa.numero}</p>
          </div>
          <StatusDot status={mesa.status} />
        </div>

        {/* Info da comanda */}
        {temComanda ? (
          <div className="space-y-1.5">
            {mesa.comanda?.garcom && (
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <Users className="w-3.5 h-3.5 flex-shrink-0" />
                <span className="truncate">{(mesa.comanda.garcom as any).nome}</span>
              </div>
            )}
            {mesa.comanda?.aberta_em && (
              <div className="flex items-center gap-1.5 text-xs text-gray-500">
                <Clock className="w-3.5 h-3.5 flex-shrink-0" />
                <span>{formatTime(mesa.comanda.aberta_em)}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5 text-xs font-semibold text-orange-600 dark:text-orange-400">
              <Receipt className="w-3.5 h-3.5 flex-shrink-0" />
              <span>{formatCurrency(mesa.comanda?.total || 0)}</span>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center mt-2">
            <span className={`text-xs font-semibold px-2 py-1 rounded-lg ${
              mesa.status === 'livre'
                ? 'text-emerald-700 bg-emerald-100'
                : 'text-gray-500 bg-gray-100'
            }`}>
              {getStatusMesaLabel(mesa.status)}
            </span>
          </div>
        )}
      </div>
    </button>
  )
}

function StatusDot({ status }: { status: string }) {
  return (
    <div className={`w-3 h-3 rounded-full flex-shrink-0 ${getStatusMesaColor(status)} ${
      status === 'ocupada' ? 'animate-pulse' : ''
    }`} />
  )
}

function getStatusBorderColor(status: string): string {
  const m: Record<string, string> = {
    livre: 'border-emerald-200 dark:border-emerald-500/30',
    ocupada: 'border-red-200 dark:border-red-500/30 shadow-[0_0_15px_rgba(248,113,113,0.1)] dark:shadow-[0_0_20px_rgba(248,113,113,0.15)]',
    aguardando_pagamento: 'border-amber-200 dark:border-amber-500/30',
    em_preparo: 'border-blue-200 dark:border-blue-500/30',
    inativa: 'border-gray-200 dark:border-white/10',
  }
  return m[status] || 'border-gray-200'
}
