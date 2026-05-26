'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Produto, EstoqueMovimentacao } from '@/lib/types'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import {
  Package, AlertTriangle, TrendingDown, TrendingUp, Plus,
  Minus, RefreshCw, Search, History, X, Loader2, CheckCircle2,
  BarChart3, ArrowUpRight, ArrowDownRight
} from 'lucide-react'
import { toast } from 'sonner'

type TipoMovimento = 'entrada' | 'saida' | 'ajuste'

export default function EstoquePage() {
  const supabase = createClient()
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [movimentacoes, setMovimentacoes] = useState<EstoqueMovimentacao[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<'todos' | 'baixo' | 'zerado'>('todos')

  // Modal de movimentação
  const [showModal, setShowModal] = useState(false)
  const [produtoSelecionado, setProdutoSelecionado] = useState<Produto | null>(null)
  const [tipoMov, setTipoMov] = useState<TipoMovimento>('entrada')
  const [quantidade, setQuantidade] = useState(1)
  const [observacao, setObservacao] = useState('')
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async () => {
    const [{ data: prods }, { data: movs }] = await Promise.all([
      supabase.from('produtos').select('*, categoria:categorias(nome, icone)')
        .eq('controlar_estoque', true).order('nome'),
      supabase.from('estoque_movimentacoes')
        .select('*, produto:produtos(nome), usuario:usuarios(nome)')
        .order('criado_em', { ascending: false }).limit(30),
    ])
    if (prods) setProdutos(prods)
    if (movs) setMovimentacoes(movs)
    setLoading(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  async function registrarMovimento() {
    if (!produtoSelecionado || quantidade <= 0) return
    setSalvando(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const qAnt = produtoSelecionado.estoque_atual
      let qNova = qAnt
      if (tipoMov === 'entrada') qNova = qAnt + quantidade
      else if (tipoMov === 'saida') qNova = Math.max(0, qAnt - quantidade)
      else qNova = quantidade // ajuste direto

      await supabase.from('estoque_movimentacoes').insert({
        produto_id: produtoSelecionado.id,
        tipo: tipoMov,
        quantidade,
        quantidade_anterior: qAnt,
        quantidade_posterior: qNova,
        usuario_id: user?.id,
        observacao: observacao || null,
      })

      await supabase.from('produtos').update({ estoque_atual: qNova }).eq('id', produtoSelecionado.id)

      const labels = { entrada: 'Entrada', saida: 'Saída', ajuste: 'Ajuste' }
      toast.success(`✅ ${labels[tipoMov]} registrada! Estoque: ${qAnt} → ${qNova}`)
      setShowModal(false)
      setQuantidade(1)
      setObservacao('')
      carregar()
    } catch {
      toast.error('Erro ao registrar movimentação')
    } finally {
      setSalvando(false)
    }
  }

  const produtosFiltrados = produtos.filter(p => {
    const matchBusca = !busca || p.nome.toLowerCase().includes(busca.toLowerCase())
    const matchFiltro = filtro === 'todos' || 
      (filtro === 'baixo' && p.estoque_atual <= p.estoque_minimo && p.estoque_atual > 0) ||
      (filtro === 'zerado' && p.estoque_atual === 0)
    return matchBusca && matchFiltro
  })

  const stats = {
    total: produtos.length,
    baixo: produtos.filter(p => p.estoque_atual <= p.estoque_minimo && p.estoque_atual > 0).length,
    zerado: produtos.filter(p => p.estoque_atual === 0).length,
  }

  return (
    <div className="p-4 lg:p-6 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Estoque</h1>
          <p className="text-sm text-gray-500">{stats.total} produtos monitorados</p>
        </div>
        <button onClick={carregar} className="p-2.5 rounded-xl bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-500 hover:text-orange-500 transition-all">
          <RefreshCw className="w-5 h-5" />
        </button>
      </div>

      {/* Alertas */}
      {(stats.baixo > 0 || stats.zerado > 0) && (
        <div className="space-y-2">
          {stats.zerado > 0 && (
            <div className="flex items-center gap-3 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-2xl">
              <AlertTriangle className="w-5 h-5 text-red-500 flex-shrink-0" />
              <p className="text-sm text-red-700 dark:text-red-300 font-medium">
                ⚠️ {stats.zerado} produto{stats.zerado > 1 ? 's' : ''} com estoque zerado!
              </p>
            </div>
          )}
          {stats.baixo > 0 && (
            <div className="flex items-center gap-3 p-4 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl">
              <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
              <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">
                🔶 {stats.baixo} produto{stats.baixo > 1 ? 's' : ''} com estoque abaixo do mínimo
              </p>
            </div>
          )}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total', value: stats.total, cor: 'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300', icon: Package },
          { label: 'Estoque Baixo', value: stats.baixo, cor: 'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300', icon: TrendingDown },
          { label: 'Zerado', value: stats.zerado, cor: 'bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-300', icon: AlertTriangle },
        ].map(s => (
          <div key={s.label} className={`rounded-2xl p-3 ${s.cor}`}>
            <p className="text-2xl font-black leading-tight">{s.value}</p>
            <p className="text-[11px] font-medium opacity-80">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Filtros */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Buscar produto..."
            value={busca}
            onChange={e => setBusca(e.target.value)}
            className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
          />
        </div>
        {(['todos', 'baixo', 'zerado'] as const).map(f => (
          <button key={f} onClick={() => setFiltro(f)}
            className={`px-3 py-2 rounded-xl text-xs font-medium capitalize transition-all flex-shrink-0 ${filtro === f ? 'bg-orange-500 text-white' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600'}`}>
            {f}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">
        {/* Lista de produtos */}
        <div className="lg:col-span-3 space-y-2">
          {loading ? (
            [...Array(5)].map((_, i) => <div key={i} className="h-20 skeleton rounded-2xl" />)
          ) : produtosFiltrados.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum produto encontrado</p>
            </div>
          ) : (
            produtosFiltrados.map(produto => {
              const status = produto.estoque_atual === 0 ? 'zerado'
                : produto.estoque_atual <= produto.estoque_minimo ? 'baixo' : 'ok'
              return (
                <div key={produto.id}
                  className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 flex items-center gap-4">
                  <div className="w-12 h-12 bg-orange-100 dark:bg-orange-900/20 rounded-xl flex items-center justify-center text-xl flex-shrink-0">
                    {(produto as any).categoria?.icone || '📦'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 dark:text-white truncate">{produto.nome}</p>
                    <div className="flex items-center gap-2 mt-1">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-lg ${
                        status === 'zerado' ? 'bg-red-100 text-red-700' :
                        status === 'baixo' ? 'bg-amber-100 text-amber-700' :
                        'bg-emerald-100 text-emerald-700'
                      }`}>
                        {produto.estoque_atual} un.
                      </span>
                      <span className="text-xs text-gray-400">mín: {produto.estoque_minimo}</span>
                    </div>
                  </div>
                  <button
                    onClick={() => { setProdutoSelecionado(produto); setShowModal(true); setTipoMov('entrada') }}
                    className="flex items-center gap-1.5 bg-orange-500 text-white text-sm font-semibold px-3 py-2 rounded-xl active:scale-95 transition-all"
                  >
                    <Plus className="w-4 h-4" />
                    Mov.
                  </button>
                </div>
              )
            })
          )}
        </div>

        {/* Histórico de movimentações */}
        <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
          <div className="flex items-center gap-2 mb-4">
            <History className="w-5 h-5 text-orange-500" />
            <h2 className="font-semibold text-gray-900 dark:text-white">Histórico</h2>
          </div>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {movimentacoes.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Nenhuma movimentação registrada</p>
            ) : movimentacoes.map(mov => (
              <div key={mov.id} className="flex items-start gap-3">
                <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                  mov.tipo === 'entrada' ? 'bg-emerald-100 text-emerald-600' :
                  mov.tipo === 'saida' ? 'bg-red-100 text-red-600' :
                  'bg-blue-100 text-blue-600'
                }`}>
                  {mov.tipo === 'entrada' ? <ArrowUpRight className="w-4 h-4" /> : mov.tipo === 'saida' ? <ArrowDownRight className="w-4 h-4" /> : <BarChart3 className="w-4 h-4" />}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{(mov.produto as any)?.nome}</p>
                  <p className="text-[10px] text-gray-400">
                    {mov.quantidade_anterior} → {mov.quantidade_posterior} un. · {(mov.usuario as any)?.nome}
                  </p>
                  {mov.observacao && <p className="text-[10px] text-gray-500 italic">{mov.observacao}</p>}
                  <p className="text-[10px] text-gray-400">{formatDateTime(mov.criado_em)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Modal de movimentação */}
      {showModal && produtoSelecionado && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end lg:items-center justify-center p-0 lg:p-6 animate-fade-in">
          <div className="bg-white dark:bg-gray-900 w-full lg:max-w-md lg:rounded-3xl rounded-t-3xl p-5 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white">Movimentar Estoque</h3>
              <button onClick={() => setShowModal(false)} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-2xl">
              <p className="font-semibold text-gray-900 dark:text-white">{produtoSelecionado.nome}</p>
              <p className="text-sm text-gray-500">Estoque atual: <strong>{produtoSelecionado.estoque_atual}</strong> unidades</p>
            </div>

            {/* Tipo */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { id: 'entrada', label: 'Entrada', icon: ArrowUpRight, cor: 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20' },
                { id: 'saida', label: 'Saída', icon: ArrowDownRight, cor: 'border-red-500 bg-red-50 dark:bg-red-900/20' },
                { id: 'ajuste', label: 'Ajuste', icon: BarChart3, cor: 'border-blue-500 bg-blue-50 dark:bg-blue-900/20' },
              ].map(t => {
                const Icon = t.icon
                return (
                  <button key={t.id} onClick={() => setTipoMov(t.id as TipoMovimento)}
                    className={`flex flex-col items-center gap-1 p-3 rounded-xl border-2 transition-all ${tipoMov === t.id ? t.cor : 'border-gray-200 dark:border-gray-700'}`}>
                    <Icon className={`w-5 h-5 ${tipoMov === t.id ? '' : 'text-gray-400'}`} />
                    <span className="text-xs font-medium">{t.label}</span>
                  </button>
                )
              })}
            </div>

            {/* Quantidade */}
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                {tipoMov === 'ajuste' ? 'Novo valor do estoque' : 'Quantidade'}
              </label>
              <div className="flex items-center gap-4">
                <button onClick={() => setQuantidade(Math.max(0, quantidade - 1))}
                  className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center">
                  <Minus className="w-5 h-5" />
                </button>
                <input
                  type="number"
                  min="0"
                  value={quantidade}
                  onChange={e => setQuantidade(Math.max(0, parseInt(e.target.value) || 0))}
                  className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-3 text-center text-xl font-bold focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
                <button onClick={() => setQuantidade(quantidade + 1)}
                  className="w-12 h-12 rounded-xl bg-orange-500 flex items-center justify-center text-white">
                  <Plus className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Observação */}
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5 block">Observação (opcional)</label>
              <input
                value={observacao}
                onChange={e => setObservacao(e.target.value)}
                placeholder="Ex: Compra do fornecedor, quebra, etc."
                className="w-full bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
              />
            </div>

            {/* Preview do resultado */}
            {tipoMov !== 'ajuste' && (
              <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-2xl">
                <span className="text-sm text-gray-500">Resultado:</span>
                <span className="font-bold text-gray-900 dark:text-white">
                  {produtoSelecionado.estoque_atual} → {
                    tipoMov === 'entrada'
                      ? produtoSelecionado.estoque_atual + quantidade
                      : Math.max(0, produtoSelecionado.estoque_atual - quantidade)
                  } un.
                </span>
              </div>
            )}

            <button
              onClick={registrarMovimento}
              disabled={salvando || quantidade <= 0}
              className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-orange-500/20 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {salvando ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
              Registrar Movimentação
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
