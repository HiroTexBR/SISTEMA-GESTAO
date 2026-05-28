'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatDateTime } from '@/lib/utils'
import {
  Package, AlertTriangle, TrendingDown, Plus, Minus,
  RefreshCw, Search, History, X, Loader2, CheckCircle2,
  BarChart3, ArrowUpRight, ArrowDownRight, Edit2, Trash2,
  Save, PackagePlus
} from 'lucide-react'
import { toast } from 'sonner'

type TipoMovimento = 'entrada' | 'saida' | 'ajuste'

type Produto = {
  id: string
  nome: string
  unidade: string
  estoque_atual: number
  estoque_minimo: number
  controlar_estoque: boolean
  categoria?: { nome: string; icone: string } | null
  [key: string]: any
}

type Movimentacao = {
  id: string
  tipo: string
  quantidade: number
  quantidade_anterior: number
  quantidade_posterior: number
  observacao: string | null
  criado_em: string
  produto?: { nome: string } | null
  usuario?: { nome: string } | null
}

const S = {
  bg: 'var(--color-surface-bg)', card: 'var(--color-surface-card)',
  cardH: 'var(--color-surface-card-hover)', border: 'var(--color-surface-border)',
  main: 'var(--color-text-main)', sub: 'var(--color-text-sub)', muted: 'var(--color-text-muted)',
  accent: 'var(--color-brand-accent)', green: 'var(--color-status-free)',
  red: 'var(--color-status-busy)', yellow: 'var(--color-status-wait)',
  blue: 'var(--color-status-prep)',
}

const UNIDADES = ['un', 'kg', 'g', 'L', 'ml', 'cx', 'pct', 'sc', 'lt', 'fardo']

const TIPOS_MOV = [
  { id: 'entrada', label: 'Entrada', icon: ArrowUpRight, color: 'var(--color-status-free)' },
  { id: 'saida',   label: 'Saída',   icon: ArrowDownRight, color: 'var(--color-status-busy)' },
  { id: 'ajuste',  label: 'Ajuste',  icon: BarChart3, color: 'var(--color-status-prep)' },
]

export default function EstoquePage() {
  const supabase = createClient()

  const [produtos, setProdutos] = useState<Produto[]>([])
  const [movimentacoes, setMovimentacoes] = useState<Movimentacao[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [filtro, setFiltro] = useState<'todos' | 'baixo' | 'zerado'>('todos')

  // Modal movimentação
  const [showMovModal, setShowMovModal] = useState(false)
  const [produtoSelecionado, setProdutoSelecionado] = useState<Produto | null>(null)
  const [tipoMov, setTipoMov] = useState<TipoMovimento>('entrada')
  const [quantidade, setQuantidade] = useState(1)
  const [observacao, setObservacao] = useState('')
  const [salvandoMov, setSalvandoMov] = useState(false)

  // Modal cadastro/edição
  const [showCadModal, setShowCadModal] = useState(false)
  const [editando, setEditando] = useState<Produto | null>(null)
  const [formNome, setFormNome] = useState('')
  const [formUnidade, setFormUnidade] = useState('un')
  const [formEstoqueAtual, setFormEstoqueAtual] = useState(0)
  const [formEstoqueMinimo, setFormEstoqueMinimo] = useState(0)
  const [salvandoCad, setSalvandoCad] = useState(false)

  // Modal histórico detalhado
  const [showHistModal, setShowHistModal] = useState(false)

  // Modal confirmação exclusão
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletando, setDeletando] = useState<Produto | null>(null)
  const [excluindo, setExcluindo] = useState(false)

  const carregar = useCallback(async () => {
    const [{ data: prods }, { data: movs }] = await Promise.all([
      supabase.from('produtos')
        .select('*, categoria:categorias(nome, icone)')
        .eq('controlar_estoque', true)
        .order('nome'),
      supabase.from('estoque_movimentacoes')
        .select('*, produto:produtos(nome), usuario:usuarios(nome)')
        .order('criado_em', { ascending: false })
        .limit(50),
    ])
    if (prods) setProdutos(prods as Produto[])
    if (movs) setMovimentacoes(movs as Movimentacao[])
    setLoading(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  // ── Cadastrar / Editar ─────────────────────────────────
  function abrirNovo() {
    setEditando(null)
    setFormNome('')
    setFormUnidade('un')
    setFormEstoqueAtual(0)
    setFormEstoqueMinimo(0)
    setShowCadModal(true)
  }

  function abrirEdicao(p: Produto) {
    setEditando(p)
    setFormNome(p.nome)
    setFormUnidade(p.unidade || 'un')
    setFormEstoqueAtual(p.estoque_atual)
    setFormEstoqueMinimo(p.estoque_minimo)
    setShowCadModal(true)
  }

  async function salvarCadastro() {
    if (!formNome.trim()) { toast.error('Informe o nome do item'); return }
    setSalvandoCad(true)
    try {
      if (editando) {
        // Tenta atualizar com unidade; se falhar (coluna inexistente), atualiza sem ela
        const { error: e1 } = await supabase.from('produtos').update({
          nome: formNome.trim(),
          unidade: formUnidade,
          estoque_minimo: formEstoqueMinimo,
        }).eq('id', editando.id)
        if (e1 && e1.message.includes('unidade')) {
          await supabase.from('produtos').update({
            nome: formNome.trim(),
            estoque_minimo: formEstoqueMinimo,
          }).eq('id', editando.id)
        } else if (e1) throw e1
        toast.success('✅ Item atualizado!')
      } else {
        // Tenta inserir com unidade; se falhar, insere sem ela
        const payload: Record<string, any> = {
          nome: formNome.trim(),
          unidade: formUnidade,
          estoque_atual: formEstoqueAtual,
          estoque_minimo: formEstoqueMinimo,
          controlar_estoque: true,
          enviar_para_producao: false,
          preco_venda: 0,
          ativo: true,
        }
        const { error: e1 } = await supabase.from('produtos').insert(payload)
        if (e1 && e1.message.includes('unidade')) {
          // Coluna nao existe ainda — insere sem ela
          delete payload.unidade
          const { error: e2 } = await supabase.from('produtos').insert(payload)
          if (e2) throw e2
          toast.success('✅ Item cadastrado! (unidade semántica será exibida após migration)')
        } else if (e1) {
          throw e1
        } else {
          toast.success('✅ Item cadastrado no estoque!')
        }
      }
      setShowCadModal(false)
      carregar()
    } catch (err: any) { toast.error('Erro ao salvar: ' + (err?.message || '')) }
    finally { setSalvandoCad(false) }
  }

  // ── Excluir ────────────────────────────────────────────
  async function confirmarExclusao() {
    if (!deletando) return
    setExcluindo(true)
    try {
      // Marca como não controlar estoque (soft delete)
      await supabase.from('produtos').update({ controlar_estoque: false }).eq('id', deletando.id)
      toast.success('Item removido do estoque')
      setShowDeleteModal(false)
      setDeletando(null)
      carregar()
    } catch { toast.error('Erro ao remover item') }
    finally { setExcluindo(false) }
  }

  // ── Movimentação ───────────────────────────────────────
  function abrirMovimentacao(p: Produto, tipo: TipoMovimento = 'entrada') {
    setProdutoSelecionado(p)
    setTipoMov(tipo)
    setQuantidade(1)
    setObservacao('')
    setShowMovModal(true)
  }

  async function registrarMovimento() {
    if (!produtoSelecionado || quantidade <= 0) return
    setSalvandoMov(true)
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
      setShowMovModal(false); setQuantidade(1); setObservacao(''); carregar()
    } catch { toast.error('Erro ao registrar movimentação') }
    finally { setSalvandoMov(false) }
  }

  // ── Filtros ────────────────────────────────────────────
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

  const troco = tipoMov === 'entrada'
    ? (produtoSelecionado?.estoque_atual || 0) + quantidade
    : tipoMov === 'saida'
      ? Math.max(0, (produtoSelecionado?.estoque_atual || 0) - quantidade)
      : quantidade

  return (
    <div className="p-4 lg:p-6 space-y-5 animate-fade-in max-w-7xl mx-auto">

      {/* ── HEADER ── */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="font-display font-bold text-2xl tracking-tight" style={{ color: S.main }}>Estoque</h1>
          <p className="text-xs mt-0.5" style={{ color: S.muted }}>{stats.total} itens monitorados</p>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={carregar} className="p-2.5 rounded-lg transition-colors"
            style={{ backgroundColor: S.card, color: S.muted }}>
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={abrirNovo}
            className="btn-primary px-4 py-2.5 text-sm"
          >
            <PackagePlus className="w-4 h-4" />
            <span className="hidden sm:inline">Adicionar Item</span>
            <span className="sm:hidden">Adicionar</span>
          </button>
        </div>
      </div>

      {/* ── ALERTAS ── */}
      {(stats.baixo > 0 || stats.zerado > 0) && (
        <div className="space-y-2">
          {stats.zerado > 0 && (
            <div className="flex items-center gap-3 p-3.5 rounded-lg"
              style={{ backgroundColor: 'rgba(248,113,113,0.08)', border: `1px solid rgba(248,113,113,0.2)` }}>
              <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: S.red }} />
              <p className="text-sm font-medium" style={{ color: S.red }}>
                {stats.zerado} item{stats.zerado > 1 ? 's' : ''} com estoque zerado — reabastecer urgente!
              </p>
            </div>
          )}
          {stats.baixo > 0 && (
            <div className="flex items-center gap-3 p-3.5 rounded-lg"
              style={{ backgroundColor: 'rgba(251,191,36,0.08)', border: `1px solid rgba(251,191,36,0.2)` }}>
              <AlertTriangle className="w-4 h-4 flex-shrink-0" style={{ color: S.yellow }} />
              <p className="text-sm font-medium" style={{ color: S.yellow }}>
                {stats.baixo} item{stats.baixo > 1 ? 's' : ''} abaixo do estoque mínimo
              </p>
            </div>
          )}
        </div>
      )}

      {/* ── STATS ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Total',  value: stats.total,  color: S.blue },
          { label: 'Baixo',  value: stats.baixo,  color: S.yellow },
          { label: 'Zerado', value: stats.zerado, color: S.red },
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
          <input type="text" placeholder="Buscar item..."
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

        {/* Lista */}
        <div className="lg:col-span-3 space-y-2">
          {loading ? (
            [...Array(5)].map((_, i) => <div key={i} className="h-20 skeleton" />)
          ) : produtosFiltrados.length === 0 ? (
            <div className="text-center py-14 card rounded-xl" style={{ color: S.muted }}>
              <Package className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm font-semibold">Nenhum item encontrado</p>
              {produtos.length === 0 && (
                <p className="text-xs mt-2 opacity-70">
                  Clique em <strong>"Adicionar Item"</strong> para cadastrar Queijo, Batata Palha e outros ingredientes
                </p>
              )}
              {produtos.length === 0 && (
                <button onClick={abrirNovo} className="btn-primary mt-4 px-5 py-2.5 text-sm mx-auto">
                  <PackagePlus className="w-4 h-4" />
                  Adicionar primeiro item
                </button>
              )}
            </div>
          ) : produtosFiltrados.map(produto => {
            const status = produto.estoque_atual === 0 ? 'zerado'
              : produto.estoque_atual <= produto.estoque_minimo ? 'baixo' : 'ok'
            const statusColor = status === 'zerado' ? S.red : status === 'baixo' ? S.yellow : S.green
            return (
              <div key={produto.id}
                className="flex items-center gap-3 p-4 rounded-xl transition-all"
                style={{ backgroundColor: S.card, border: `1px solid ${S.border}` }}>

                {/* Ícone */}
                <div className="w-11 h-11 rounded-lg flex items-center justify-center text-xl flex-shrink-0"
                  style={{ backgroundColor: 'rgba(249,115,22,0.08)' }}>
                  {produto.categoria?.icone || '📦'}
                </div>

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate" style={{ color: S.main }}>{produto.nome}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    <span className="badge font-bold" style={{
                      backgroundColor: `${statusColor}18`,
                      color: statusColor,
                    }}>
                      {produto.estoque_atual} {produto.unidade || 'un'}
                    </span>
                    <span className="text-xs" style={{ color: S.muted }}>mín: {produto.estoque_minimo} {produto.unidade || 'un'}</span>
                    {status === 'zerado' && (
                      <span className="text-[10px] font-bold uppercase" style={{ color: S.red }}>⚠ ZERADO</span>
                    )}
                    {status === 'baixo' && (
                      <span className="text-[10px] font-bold uppercase" style={{ color: S.yellow }}>⚠ BAIXO</span>
                    )}
                  </div>
                </div>

                {/* Ações */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {/* Entrada rápida */}
                  <button
                    onClick={() => abrirMovimentacao(produto, 'entrada')}
                    title="Entrada de estoque"
                    className="w-9 h-9 rounded-lg flex items-center justify-center transition-all"
                    style={{ backgroundColor: 'rgba(34,197,94,0.1)', color: S.green }}
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                  {/* Saída rápida */}
                  <button
                    onClick={() => abrirMovimentacao(produto, 'saida')}
                    title="Saída de estoque"
                    className="w-9 h-9 rounded-lg flex items-center justify-center transition-all"
                    style={{ backgroundColor: 'rgba(248,113,113,0.1)', color: S.red }}
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  {/* Editar */}
                  <button
                    onClick={() => abrirEdicao(produto)}
                    title="Editar item"
                    className="w-9 h-9 rounded-lg flex items-center justify-center transition-all"
                    style={{ backgroundColor: S.cardH, color: S.muted }}
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                  </button>
                  {/* Excluir */}
                  <button
                    onClick={() => { setDeletando(produto); setShowDeleteModal(true) }}
                    title="Remover do estoque"
                    className="w-9 h-9 rounded-lg flex items-center justify-center transition-all"
                    style={{ backgroundColor: 'rgba(248,113,113,0.08)', color: S.red }}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>

        {/* Histórico */}
        <div className="lg:col-span-2 card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <History className="w-4 h-4" style={{ color: S.accent }} />
              <h2 className="font-display font-semibold text-sm" style={{ color: S.main }}>Histórico</h2>
            </div>
            <span className="text-[10px] uppercase tracking-wider font-bold" style={{ color: S.muted }}>
              últimos 50
            </span>
          </div>
          <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
            {movimentacoes.length === 0 ? (
              <p className="text-sm text-center py-6" style={{ color: S.muted }}>Nenhuma movimentação ainda</p>
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
                      <p className="text-[10px] italic truncate" style={{ color: S.muted }}>{mov.observacao}</p>
                    )}
                    <p className="text-[10px]" style={{ color: S.muted }}>{formatDateTime(mov.criado_em)}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════
          MODAL — CADASTRAR / EDITAR ITEM
      ══════════════════════════════════════════════════════ */}
      {showCadModal && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end lg:items-center justify-center animate-fade-in">
          <div className="w-full lg:max-w-md max-h-[92vh] overflow-y-auto"
            style={{ backgroundColor: S.card, borderRadius: '16px 16px 0 0' }}>

            {/* Handle mobile */}
            <div className="flex justify-center pt-3 pb-1 lg:hidden">
              <div className="w-10 h-1 rounded-full" style={{ backgroundColor: S.border }} />
            </div>

            <div className="p-5 space-y-5">
              {/* Título */}
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-display font-bold text-lg" style={{ color: S.main }}>
                    {editando ? 'Editar Item' : '+ Novo Item de Estoque'}
                  </h3>
                  <p className="text-xs mt-0.5" style={{ color: S.muted }}>
                    {editando ? 'Atualize as informações do item' : 'Queijo, Batata Palha, Óleo, etc.'}
                  </p>
                </div>
                <button onClick={() => setShowCadModal(false)} className="p-2 rounded-lg"
                  style={{ color: S.muted, backgroundColor: S.cardH }}>
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Nome */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider mb-1.5 block" style={{ color: S.muted }}>
                  Nome do Item *
                </label>
                <input
                  value={formNome}
                  onChange={e => setFormNome(e.target.value)}
                  placeholder="Ex: Queijo, Batata Palha, Óleo de Soja..."
                  className="input"
                  autoFocus
                />
              </div>

              {/* Unidade */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider mb-2 block" style={{ color: S.muted }}>
                  Unidade de Medida
                </label>
                <div className="flex flex-wrap gap-2">
                  {UNIDADES.map(u => (
                    <button
                      key={u}
                      onClick={() => setFormUnidade(u)}
                      className="px-3 py-1.5 rounded-lg text-sm font-bold transition-all"
                      style={{
                        backgroundColor: formUnidade === u ? S.accent : S.cardH,
                        color: formUnidade === u ? '#fff' : S.muted,
                        border: `1.5px solid ${formUnidade === u ? S.accent : S.border}`,
                      }}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>

              {/* Estoque Atual (só no cadastro) */}
              {!editando && (
                <div>
                  <label className="text-xs font-bold uppercase tracking-wider mb-1.5 block" style={{ color: S.muted }}>
                    Estoque Atual ({formUnidade})
                  </label>
                  <div className="flex items-center gap-3">
                    <button onClick={() => setFormEstoqueAtual(Math.max(0, formEstoqueAtual - 1))}
                      className="w-11 h-11 rounded-lg flex items-center justify-center"
                      style={{ backgroundColor: S.cardH, color: S.main }}>
                      <Minus className="w-4 h-4" />
                    </button>
                    <input type="number" min="0" value={formEstoqueAtual}
                      onChange={e => setFormEstoqueAtual(Math.max(0, Number(e.target.value)))}
                      className="input flex-1 text-center font-display font-bold text-xl"
                    />
                    <button onClick={() => setFormEstoqueAtual(formEstoqueAtual + 1)}
                      className="w-11 h-11 rounded-lg flex items-center justify-center text-white"
                      style={{ backgroundColor: S.accent }}>
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              )}

              {/* Estoque Mínimo */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider mb-1.5 block" style={{ color: S.muted }}>
                  Estoque Mínimo ({formUnidade}) — alerta de reposição
                </label>
                <div className="flex items-center gap-3">
                  <button onClick={() => setFormEstoqueMinimo(Math.max(0, formEstoqueMinimo - 1))}
                    className="w-11 h-11 rounded-lg flex items-center justify-center"
                    style={{ backgroundColor: S.cardH, color: S.main }}>
                    <Minus className="w-4 h-4" />
                  </button>
                  <input type="number" min="0" value={formEstoqueMinimo}
                    onChange={e => setFormEstoqueMinimo(Math.max(0, Number(e.target.value)))}
                    className="input flex-1 text-center font-display font-bold text-xl"
                  />
                  <button onClick={() => setFormEstoqueMinimo(formEstoqueMinimo + 1)}
                    className="w-11 h-11 rounded-lg flex items-center justify-center text-white"
                    style={{ backgroundColor: S.accent }}>
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
                <p className="text-[11px] mt-1.5" style={{ color: S.muted }}>
                  Quando o estoque atingir esse valor, o sistema vai alertar.
                </p>
              </div>

              {/* Botão salvar */}
              <button
                onClick={salvarCadastro}
                disabled={salvandoCad || !formNome.trim()}
                className="btn-primary w-full py-3.5"
              >
                {salvandoCad
                  ? <Loader2 className="w-4 h-4 animate-spin" />
                  : <Save className="w-4 h-4" />
                }
                {editando ? 'Salvar Alterações' : 'Cadastrar Item'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          MODAL — MOVIMENTAÇÃO DE ESTOQUE
      ══════════════════════════════════════════════════════ */}
      {showMovModal && produtoSelecionado && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end lg:items-center justify-center animate-fade-in">
          <div className="w-full lg:max-w-md max-h-[90vh] overflow-y-auto"
            style={{ backgroundColor: S.card, borderRadius: '16px 16px 0 0' }}>

            <div className="flex justify-center pt-3 pb-1 lg:hidden">
              <div className="w-10 h-1 rounded-full" style={{ backgroundColor: S.border }} />
            </div>

            <div className="p-5 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="font-display font-bold text-lg" style={{ color: S.main }}>Movimentar Estoque</h3>
                <button onClick={() => setShowMovModal(false)} className="p-2 rounded-lg"
                  style={{ color: S.muted, backgroundColor: S.cardH }}>
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Produto */}
              <div className="p-3.5 rounded-lg" style={{ backgroundColor: 'rgba(249,115,22,0.06)', border: `1px solid rgba(249,115,22,0.15)` }}>
                <p className="font-semibold text-sm" style={{ color: S.main }}>{produtoSelecionado.nome}</p>
                <p className="text-xs mt-0.5" style={{ color: S.muted }}>
                  Estoque atual: <strong style={{ color: S.main }}>{produtoSelecionado.estoque_atual} {produtoSelecionado.unidade || 'un'}</strong>
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
                      <span className="text-xs font-semibold" style={{ color: sel ? t.color : S.muted }}>
                        {t.label}
                      </span>
                    </button>
                  )
                })}
              </div>

              {/* Quantidade */}
              <div>
                <label className="text-xs font-bold uppercase tracking-wider mb-3 block" style={{ color: S.muted }}>
                  {tipoMov === 'ajuste' ? `Novo valor (${produtoSelecionado.unidade || 'un'})` : `Quantidade (${produtoSelecionado.unidade || 'un'})`}
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
                  placeholder="Ex: Compra do fornecedor, validade..." className="input" />
              </div>

              {/* Preview resultado */}
              {tipoMov !== 'ajuste' && (
                <div className="flex items-center justify-between p-3 rounded-lg" style={{ backgroundColor: S.bg }}>
                  <span className="text-sm" style={{ color: S.muted }}>Resultado:</span>
                  <div className="flex items-center gap-2">
                    <span className="text-sm" style={{ color: S.muted }}>{produtoSelecionado.estoque_atual}</span>
                    <ArrowUpRight className="w-3 h-3" style={{ color: S.muted }} />
                    <span className="font-bold text-sm" style={{ color: troco < produtoSelecionado.estoque_minimo ? S.yellow : S.green }}>
                      {troco} {produtoSelecionado.unidade || 'un'}
                    </span>
                  </div>
                </div>
              )}

              <button onClick={registrarMovimento} disabled={salvandoMov || quantidade <= 0} className="btn-primary w-full py-3.5">
                {salvandoMov ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                Registrar Movimentação
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          MODAL — CONFIRMAR EXCLUSÃO
      ══════════════════════════════════════════════════════ */}
      {showDeleteModal && deletando && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center animate-fade-in px-4">
          <div className="w-full max-w-sm rounded-2xl p-6 space-y-4"
            style={{ backgroundColor: S.card }}>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mx-auto"
              style={{ backgroundColor: 'rgba(248,113,113,0.12)' }}>
              <Trash2 className="w-6 h-6" style={{ color: S.red }} />
            </div>
            <div className="text-center">
              <h3 className="font-display font-bold text-lg" style={{ color: S.main }}>Remover do Estoque?</h3>
              <p className="text-sm mt-1" style={{ color: S.muted }}>
                <strong style={{ color: S.main }}>{deletando.nome}</strong> será removido do controle de estoque.
                O histórico de movimentações será mantido.
              </p>
            </div>
            <div className="flex gap-3">
              <button onClick={() => { setShowDeleteModal(false); setDeletando(null) }}
                className="btn-secondary flex-1 py-3">
                Cancelar
              </button>
              <button onClick={confirmarExclusao} disabled={excluindo}
                className="flex-1 py-3 rounded-lg font-semibold text-sm flex items-center justify-center gap-2 transition-all text-white"
                style={{ backgroundColor: S.red }}>
                {excluindo ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                Remover
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
