'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Produto, EstoqueMovimentacao } from '@/lib/types'
import { formatDateTime } from '@/lib/utils'
import {
  Package, AlertTriangle, TrendingDown, Plus, Minus,
  RefreshCw, Search, History, X, Loader2, CheckCircle2,
  BarChart3, ArrowUpRight, ArrowDownRight
} from 'lucide-react'
import { toast } from 'sonner'

type TipoMovimento = 'entrada' | 'saida' | 'ajuste'

const S = {
  bg: 'var(--color-surface-bg)', card: 'var(--color-surface-card)',
  cardH: 'var(--color-surface-card-hover)', border: 'var(--color-surface-border)',
  main: 'var(--color-text-main)', sub: 'var(--color-text-sub)', muted: 'var(--color-text-muted)',
  accent: 'var(--color-brand-accent)', green: 'var(--color-status-free)',
  red: 'var(--color-status-busy)', yellow: 'var(--color-status-wait)',
  blue: 'var(--color-status-prep)',
}

export default function EstoquePage() {
  const supabase = createClient()
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [movimentacoes, setMovimentacoes] = useState<EstoqueMovimentacao[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<'todos' | 'baixo' | 'zerado'>('todos')
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
      else qNova = quantidade

      await supabase.from('estoque_movimentacoes').insert({
        produto_id: produtoSelecionado.id, tipo: tipoMov, quantidade,
        quantidade_anterior: qAnt, quantidade_posterior: qNova,
        usuario_id: user?.id, observacao: observacao || null,
      })
      await supabase.from('produtos').update({ estoque_atual: qNova }).eq('id', produtoSelecionado.id)
      toast.success(`✅ Movimentação registrada! ${qAnt} → ${qNova}`)
      setShowModal(false); setQuantidade(1); setObservacao(''); carregar()
    } catch { toast.error('Erro ao registrar movimentação') }
    finally { setSalvando(false) }
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

  const TIPOS_MOV = [
    { id: 'entrada', label: 'Entrada', icon: ArrowUpRight, color: S.green },
    { id: 'saida',   label: 'Saída',   icon: ArrowDownRight, color: S.red },
    { id: 'ajuste',  label: 'Ajuste',  icon: BarChart3, color: S.blue },
  ]

  return (
    <div className="p-4 lg:p-6 space-y-5 animate-fade-in max-w-7xl mx-auto">

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-2xl tracking-tight" style={{ color: S.main }}>Estoque</h1>
          <p className="text-xs mt-0.5" style={{ color: S.muted }}>{stats.total} produtos monitorados</p>
        </div>
        <button onClick={carregar} className="p-2.5 rounded-lg transition-colors"
          style={{ backgroundColor: S.card, color: S.muted }}>
          <RefreshCw className="w-4 h-4" />
        </button>
      </div>

      {/* ── ALERTAS ── */}
      {(stats.baixo > 0 || stats.zerado > 0) && (
        <div className="space-y-2">
          {stats.zerado > 0 && (
            <div className="flex items-center gap-3 p-3.5 rounded-lg"
              style={{ backgroundColor: 'rgba(248,113,113,0.08)', border: `1px solid rgba(248,113,113,0.2)` }}>
              <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: S.red }} />
              <p className="text-sm font-medium" style={{ color: S.red }}>
                {stats.zerado} produto{stats.zerado > 1 ? 's' : ''} com estoque zerado
              </p>
            </div>
          )}
          {stats.baixo > 0 && (
            <div className="flex items-center gap-3 p-3.5 rounded-lg"
              style={{ backgroundColor: 'rgba(251,191,36,0.08)', border: `1px solid rgba(251,191,36,0.2)` }}>
              <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: S.yellow }} />
              <p className="text-sm font-medium" style={{ color: S.yellow }}>
                {stats.baixo} produto{stats.baixo > 1 ? 's' : ''} abaixo do mínimo
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── STATS ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total',  value: stats.total,  color: S.blue, icon: Package },
          { label: 'Baixo',  value: stats.baixo,  color: S.yellow, icon: TrendingDown },
          { label: 'Zerado', value: stats.zerado, color: S.red, icon: AlertTriangle },
        ].map(s => (
          <div key={s.label} className="card p-4">
            <p className="font-display font-bold text-2xl leading-none" style={{ color: s.color }}>{s.value}</p>
            <p className="text-[11px] uppercase tracking-wider font-semibold mt-1.5" style={{ color: S.muted }}>{s.label}</p>
          </div>
        ))}
      </div>

      {/* ── FILTROS ── */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: S.muted }} />
          <input type="text" placeholder="Buscar produto..."
            value={busca} onChange={e => setBusca(e.target.value)}
            className="input pl-9"
          />
        </div>
        {(['todos', 'baixo', 'zerado'] as const).map(f => (
          <button key={f} onClick={() => setFiltro(f)}
            className="px-3 py-2 rounded-lg text-xs font-bold capitalize transition-all flex-shrink-0"
            style={{
              backgroundColor: filtro === f ? S.accent : S.card,
              color: filtro === f ? '#fff' : S.muted,
            }}>
            {f}
          </button>
        ))}
      </div>

      {/* ── CONTEÚDO ── */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-4">

        {/* Lista de produtos */}
        <div className="lg:col-span-3 space-y-2">
          {loading ? (
            [...Array(5)].map((_, i) => <div key={i} className="h-20 skeleton" />)
          ) : produtosFiltrados.length === 0 ? (
            <div className="text-center py-14" style={{ color: S.muted }}>
              <Package className="w-10 h-10 mx-auto mb-3 opacity-40" />
              <p className="text-sm">Nenhum produto encontrado</p>
            </div>
          ) : produtosFiltrados.map(produto => {
            const status = produto.estoque_atual === 0 ? 'zerado'
              : produto.estoque_atual <= produto.estoque_minimo ? 'baixo' : 'ok'
            const statusColor = status === 'zerado' ? S.red : status === 'baixo' ? S.yellow : S.green
            return (
              <div key={produto.id}
                className="flex items-center gap-4 p-4 rounded-lg"
                style={{ backgroundColor: S.card }}>
                <div className="w-11 h-11 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
                  style={{ backgroundColor: 'rgba(249,115,22,0.08)' }}>
                  {(produto as any).categoria?.icone || '📦'}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate" style={{ color: S.main }}>{produto.nome}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="badge" style={{
                      backgroundColor: `${statusColor}15`,
                      color: statusColor,
                    }}>
                      {produto.estoque_atual} un.
                    </span>
                    <span className="text-xs" style={{ color: S.muted }}>mín: {produto.estoque_minimo}</span>
                  </div>
                </div>
                <button
                  onClick={() => { setProdutoSelecionado(produto); setShowModal(true); setTipoMov('entrada') }}
                  className="btn-secondary text-sm px-3 py-2"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Mov.
                </button>
              </div>
            )
          })}
        </div>

        {/* Histórico */}
        <div className="lg:col-span-2 card p-5">
          <div className="flex items-center gap-2 mb-4">
            <History className="w-4 h-4" style={{ color: S.accent }} />
            <h2 className="font-display font-semibold text-sm" style={{ color: S.main }}>Histórico</h2>
          </div>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {movimentacoes.length === 0 ? (
              <p className="text-sm text-center py-6" style={{ color: S.muted }}>Nenhuma movimentação</p>
            ) : movimentacoes.map(mov => {
              const color = mov.tipo === 'entrada' ? S.green : mov.tipo === 'saida' ? S.red : S.blue
              const Icon = mov.tipo === 'entrada' ? ArrowUpRight : mov.tipo === 'saida' ? ArrowDownRight : BarChart3
              return (
                <div key={mov.id} className="flex items-start gap-2.5">
                  <div className="w-7 h-7 rounded-md flex items-center justify-center flex-shrink-0"
                    style={{ backgroundColor: `${color}12` }}>
                    <Icon className="w-3.5 h-3.5" style={{ color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold truncate" style={{ color: S.main }}>
                      {(mov.produto as any)?.nome}
                    </p>
                    <p className="text-[10px]" style={{ color: S.muted }}>
                      {mov.quantidade_anterior} → {mov.quantidade_posterior} un. · {(mov.usuario as any)?.nome}
                    </p>
                    {mov.observacao && (
                      <p className="text-[10px] italic" style={{ color: S.muted }}>{mov.observacao}</p>
                    )}
                    <p className="text-[10px]" style={{ color: S.muted }}>{formatDateTime(mov.criado_em)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ── MODAL MOVIMENTAÇÃO ── */}
      {showModal && produtoSelecionado && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end lg:items-center justify-center animate-fade-in">
          <div className="w-full lg:max-w-md max-h-[90vh] overflow-y-auto"
            style={{ backgroundColor: S.card, borderRadius: '12px 12px 0 0' }}>
            <div className="flex justify-center pt-3 pb-1 lg:hidden">
              <div className="w-10 h-1 rounded-full" style={{ backgroundColor: S.border }} />
            </div>
            <div className="p-5 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-lg" style={{ color: S.main }}>Movimentar Estoque</h3>
                <button onClick={() => setShowModal(false)} className="p-2 rounded-lg"
                  style={{ color: S.muted, backgroundColor: S.cardH }}>
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3.5 rounded-lg" style={{ backgroundColor: 'rgba(249,115,22,0.06)' }}>
                <p className="font-semibold text-sm" style={{ color: S.main }}>{produtoSelecionado.nome}</p>
                <p className="text-xs mt-0.5" style={{ color: S.muted }}>
                  Estoque atual: <strong style={{ color: S.main }}>{produtoSelecionado.estoque_atual}</strong> unidades
                </p>
              </div>

              {/* Tipo */}
              <div className="grid grid-cols-3 gap-2">
                {TIPOS_MOV.map(t => {
                  const Icon = t.icon
                  const sel = tipoMov === t.id
                  return (
                    <button key={t.id} onClick={() => setTipoMov(t.id as TipoMovimento)}
                      className="flex flex-col items-center gap-1.5 p-3 rounded-lg transition-all"
                      style={{
                        backgroundColor: sel ? `${t.color}12` : S.cardH,
                        border: `1.5px solid ${sel ? t.color : S.border}`,
                      }}>
                      <Icon className="w-4 h-4" style={{ color: sel ? t.color : S.muted }} />
                      <span className="text-xs font-medium" style={{ color: sel ? t.color : S.muted }}>
                        {t.label}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* Quantidade */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider mb-3 block" style={{ color: S.muted }}>
                  {tipoMov === 'ajuste' ? 'Novo valor' : 'Quantidade'}
                </label>
                <div className="flex items-center gap-3">
                  <button onClick={() => setQuantidade(Math.max(0, quantidade - 1))}
                    className="w-11 h-11 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: S.cardH, color: S.main }}>
                    <Minus className="w-4 h-4" />
                  </button>
                  <input type="number" min="0" value={quantidade}
                    onChange={e => setQuantidade(Math.max(0, parseInt(e.target.value) || 0))}
                    className="input flex-1 text-center font-display font-bold text-2xl"
                  />
                  <button onClick={() => setQuantidade(quantidade + 1)}
                    className="w-11 h-11 rounded-lg flex items-center justify-center text-white"
                    style={{ backgroundColor: S.accent }}>
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* Observação */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider mb-1.5 block" style={{ color: S.muted }}>
                  Observação (opcional)
                </label>
                <input value={observacao} onChange={e => setObservacao(e.target.value)}
                  placeholder="Ex: Compra do fornecedor..." className="input" />
              </div>

              {/* Preview */}
              {tipoMov !== 'ajuste' && (
                <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: S.bg }}>
                  <span className="text-sm" style={{ color: S.muted }}>Resultado:</span>
                  <span className="font-bold text-sm" style={{ color: S.main }}>
                    {produtoSelecionado.estoque_atual} →{' '}
                    {tipoMov === 'entrada'
                      ? produtoSelecionado.estoque_atual + quantidade
                      : Math.max(0, produtoSelecionado.estoque_atual - quantidade)
                    } un.
                  </span>
                </div>
              )}

              <button onClick={registrarMovimento} disabled={salvando || quantidade <= 0} className="btn-primary w-full py-3.5">
                {salvando ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Registrar Movimentação
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
