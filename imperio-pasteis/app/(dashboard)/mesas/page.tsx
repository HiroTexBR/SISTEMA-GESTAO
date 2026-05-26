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
          { label: 'Total', value: stats.total, cor: 'text-gray-900 dark:text-gray-100' },
          { label: 'Livres', value: stats.livres, cor: 'text-emerald-600 dark:text-emerald-400' },
          { label: 'Ocupadas', value: stats.ocupadas, cor: 'text-red-600 dark:text-red-400' },
          { label: 'Pagamento', value: stats.aguardando, cor: 'text-amber-600 dark:text-amber-400' },
        ].map(s => (
          <div key={s.label} className={`glass-card rounded-3xl px-3 py-3 sm:px-4 sm:py-4 text-center transition-all hover:-translate-y-1 ${s.cor}`}>
            <p className="text-2xl lg:text-3xl font-black leading-none mb-1">{s.value}</p>
            <p className="text-[10px] sm:text-[11px] uppercase tracking-wider font-bold opacity-60">{s.label}</p>
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
              className="w-full glass-card border border-gray-200 dark:border-white/10 rounded-full pl-10 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500/50 transition-all text-gray-900 dark:text-white placeholder:text-gray-400"
            />
        </div>
      </div>

      {/* Filtros de status */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-select">
        {STATUS_FILTERS.map(s => (
          <button
            key={s}
            onClick={() => setFiltroStatus(s)}
            className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-all flex-shrink-0 ${
              filtroStatus === s
                ? 'bg-orange-500 text-white shadow-glow'
                : 'glass-card text-gray-600 dark:text-gray-300 hover:-translate-y-0.5'
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
      className={`relative w-full text-left rounded-3xl overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-glow glass-card
        ${inatival ? 'opacity-50 cursor-not-allowed grayscale' : ''}
      `}
    >
      <div className="p-5">
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
          <div className="flex items-center mt-3">
            <span className={`text-xs font-bold px-3 py-1.5 rounded-full ${
              mesa.status === 'livre' ? 'badge-livre' :
              mesa.status === 'inativa' ? 'badge-inativa' : 'badge-preparo'
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
  const badgeCls = 
    status === 'livre' ? 'badge-livre' : 
    status === 'ocupada' ? 'badge-ocupada' :
    status === 'aguardando_pagamento' ? 'badge-aguardando' :
    status === 'em_preparo' ? 'badge-preparo' : 'badge-inativa';

  return (
    <div className={`w-3.5 h-3.5 rounded-full flex-shrink-0 ${badgeCls} ${
      status === 'ocupada' ? 'animate-pulse' : ''
    }`} style={{ opacity: 1 }} />
  )
}
