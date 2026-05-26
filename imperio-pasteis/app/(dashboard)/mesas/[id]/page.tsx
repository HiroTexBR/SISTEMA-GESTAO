'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Mesa, Comanda, ComandaItem, Produto, Categoria } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import {
  ArrowLeft, Plus, Minus, Trash2, Send,
  Search, ShoppingCart, ChevronRight, Loader2, X,
  MessageSquare, CheckCircle2, AlertCircle, Receipt
} from 'lucide-react'
import { toast } from 'sonner'

export default function ComandaPage() {
  const params = useParams()
  const router = useRouter()
  const supabase = createClient()
  const mesaId = params.id as string

  const [mesa, setMesa] = useState<Mesa | null>(null)
  const [comanda, setComanda] = useState<Comanda | null>(null)
  const [itens, setItens] = useState<ComandaItem[]>([])
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [enviando, setEnviando] = useState(false)
  const [showCardapio, setShowCardapio] = useState(false)
  const [buscaProduto, setBuscaProduto] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('todas')
  const [produtoSelecionado, setProdutoSelecionado] = useState<Produto | null>(null)
  const [quantidade, setQuantidade] = useState(1)
  const [observacao, setObservacao] = useState('')
  const [showObs, setShowObs] = useState(false)

  const carregar = useCallback(async () => {
    try {
      const { data: mesaData } = await supabase.from('mesas').select('*').eq('id', mesaId).single()
      if (mesaData) setMesa(mesaData)

      const { data: comandaData } = await supabase
        .from('comandas')
        .select('*')
        .eq('mesa_id', mesaId)
        .in('status', ['aberta', 'aguardando_pagamento'])
        .order('aberta_em', { ascending: false })
        .limit(1)
        .single()

      if (comandaData) {
        setComanda(comandaData)
        const { data: itensData } = await supabase
          .from('comanda_itens')
          .select(`*, produto:produtos(*)`)
          .eq('comanda_id', comandaData.id)
          .neq('status', 'cancelado')
          .order('criado_em')
        if (itensData) setItens(itensData)
      }

      const [{ data: prods }, { data: cats }] = await Promise.all([
        supabase.from('produtos').select('*, categoria:categorias(*)').eq('ativo', true).order('nome'),
        supabase.from('categorias').select('*').eq('ativo', true).order('ordem'),
      ])
      if (prods) setProdutos(prods)
      if (cats) setCategorias(cats)
    } catch {
      toast.error('Erro ao carregar comanda')
    } finally {
      setLoading(false)
    }
  }, [mesaId])

  useEffect(() => {
    carregar()
    const channel = supabase
      .channel(`comanda-${mesaId}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comanda_itens' }, carregar)
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [carregar])

  async function criarComanda() {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { data: userExists } = await supabase.from('usuarios').select('id').eq('id', user.id).single()
    if (!userExists) {
      const { error: insertUserError } = await supabase.from('usuarios').insert({
        id: user.id,
        nome: user.email?.split('@')[0] || 'Usuário',
        email: user.email,
        cargo: 'admin',
        ativo: true
      })
      if (insertUserError) { toast.error('Erro ao criar usuário: ' + insertUserError.message); return }
    }

    const { data, error } = await supabase
      .from('comandas')
      .insert({ mesa_id: mesaId, garcom_id: user.id, status: 'aberta' })
      .select().single()

    if (error) { toast.error('Erro ao abrir comanda: ' + error.message); return }
    setComanda(data)
    toast.success('Comanda aberta!')
  }

  async function adicionarItem() {
    if (!comanda || !produtoSelecionado) return
    const { data: { user } } = await supabase.auth.getUser()

    const { error } = await supabase.from('comanda_itens').insert({
      comanda_id: comanda.id,
      produto_id: produtoSelecionado.id,
      nome_produto: produtoSelecionado.nome,
      quantidade,
      preco_unitario: produtoSelecionado.preco_venda,
      total: quantidade * produtoSelecionado.preco_venda,
      observacao: observacao || null,
      garcom_id: user?.id,
      status: 'pendente',
    })

    if (error) { toast.error('Erro ao adicionar item'); return }
    setProdutoSelecionado(null)
    setQuantidade(1)
    setObservacao('')
    setShowObs(false)
    toast.success(`${produtoSelecionado.nome} adicionado!`)
    carregar()
  }

  async function removerItem(itemId: string, nome: string) {
    if (!confirm(`Remover "${nome}"?`)) return
    await supabase.from('comanda_itens')
      .update({ status: 'cancelado', motivo_cancelamento: 'Removido pelo garçom' })
      .eq('id', itemId)
    toast.success('Item removido')
    carregar()
  }

  async function enviarParaProducao() {
    if (!comanda || itens.length === 0) return
    const itensNaoEnviados = itens.filter(i => !i.enviado_para_producao)
    if (itensNaoEnviados.length === 0) { toast.info('Todos os itens já foram enviados'); return }

    setEnviando(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: usuarioData } = await supabase.from('usuarios').select('nome').eq('id', user?.id).single()

      const { data: pedido, error: pedidoError } = await supabase
        .from('pedidos_producao')
        .insert({
          comanda_id: comanda.id,
          mesa_id: mesaId,
          mesa_numero: mesa?.numero,
          garcom_id: user?.id,
          garcom_nome: usuarioData?.nome,
          status: 'novo',
          status_impressao: 'pendente',
        })
        .select().single()

      if (pedidoError) throw pedidoError

      await supabase.from('pedido_itens').insert(
        itensNaoEnviados.map(item => ({
          pedido_producao_id: pedido.id,
          comanda_item_id: item.id,
          produto_id: item.produto_id,
          nome_produto: item.nome_produto,
          quantidade: item.quantidade,
          observacao: item.observacao,
        }))
      )

      await supabase.from('comanda_itens')
        .update({ enviado_para_producao: true, enviado_em: new Date().toISOString(), status: 'enviado' })
        .in('id', itensNaoEnviados.map(i => i.id))

      const { data: impressora } = await supabase
        .from('impressoras').select('id, modo_teste').eq('setor', 'producao').eq('ativa', true).single()

      if (impressora) {
        const linhas = [
          '', `        MESA ${mesa?.numero || '?'}`,
          `     COMANDA #${String(comanda?.numero || '?').padStart(6, '0')}`,
          `GARÇOM: ${usuarioData?.nome || '?'}`,
          `HORÁRIO: ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
          '--------------------------------',
          ...itensNaoEnviados.map(item => `${item.quantidade}x ${item.nome_produto}${item.observacao ? `\n   OBS: ${item.observacao}` : ''}`),
          '--------------------------------', '      SETOR: PRODUÇÃO', '',
        ]
        await supabase.from('fila_impressao').insert({
          tipo_documento: 'pedido_producao',
          comanda_id: comanda.id,
          pedido_producao_id: pedido.id,
          impressora_id: impressora.id,
          conteudo: linhas.join('\n'),
          status: 'pendente',
          modo_simulacao: impressora.modo_teste,
        })
      }

      toast.success('✅ Pedido enviado para produção!')
      carregar()
    } catch {
      toast.error('Erro ao enviar pedido')
    } finally {
      setEnviando(false)
    }
  }

  const itensNaoEnviados = itens.filter(i => !i.enviado_para_producao)
  const produtosFiltrados = produtos
    .filter(p => categoriaFiltro === 'todas' || p.categoria_id === categoriaFiltro)
    .filter(p => buscaProduto === '' || p.nome.toLowerCase().includes(buscaProduto.toLowerCase()))
  const totalComanda = itens.reduce((acc, i) => acc + i.total, 0)

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-8 h-8 animate-spin" style={{ color: 'var(--color-brand-accent)' }} />
    </div>
  )

  return (
    <div className="flex flex-col h-full" style={{ backgroundColor: 'var(--color-surface-bg)' }}>

      {/* ── HEADER ── */}
      <div
        className="flex items-center gap-3 px-4 h-14 flex-shrink-0 sticky top-0 z-20"
        style={{ backgroundColor: 'var(--color-surface-card)', borderBottom: '1px solid var(--color-surface-border)' }}
      >
        <button
          onClick={() => router.back()}
          className="p-2 rounded-lg transition-colors"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="flex-1">
          <h1 className="font-display font-bold text-base tracking-tight" style={{ color: 'var(--color-text-main)' }}>
            Mesa {mesa?.numero}
          </h1>
          {comanda ? (
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Comanda #{String(comanda.numero).padStart(6, '0')}
            </p>
          ) : (
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Mesa livre</p>
          )}
        </div>
        {comanda && (
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-wider" style={{ color: 'var(--color-text-muted)' }}>Total</p>
            <p className="font-display font-bold text-base" style={{ color: 'var(--color-brand-accent)' }}>
              {formatCurrency(totalComanda)}
            </p>
          </div>
        )}
      </div>

      {/* ── ESTADO: SEM COMANDA ── */}
      {!comanda ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <div
              className="w-16 h-16 rounded-xl flex items-center justify-center mx-auto mb-5"
              style={{ backgroundColor: 'rgba(34,197,94,0.1)' }}
            >
              <Receipt className="w-8 h-8" style={{ color: 'var(--color-status-free)' }} />
            </div>
            <h2 className="font-display font-bold text-xl mb-2" style={{ color: 'var(--color-text-main)' }}>
              Mesa Livre
            </h2>
            <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>Toque para abrir uma comanda</p>
            <button onClick={criarComanda} className="btn-primary px-8 py-3.5 text-base">
              Abrir Comanda
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* ── LISTA DE ITENS ── */}
          <div className="flex-1 overflow-y-auto p-4 pb-44 space-y-2">
            {itens.length === 0 ? (
              <div className="text-center py-16" style={{ color: 'var(--color-text-muted)' }}>
                <ShoppingCart className="w-10 h-10 mx-auto mb-3 opacity-30" />
                <p className="text-sm">Nenhum item adicionado</p>
                <p className="text-xs mt-1 opacity-60">Toque em "+ Adicionar" para começar</p>
              </div>
            ) : (
              itens.map(item => (
                <ItemCard key={item.id} item={item} onRemover={() => removerItem(item.id, item.nome_produto)} />
              ))
            )}
          </div>

          {/* ── BARRA INFERIOR ── */}
          <div
            className="fixed bottom-0 inset-x-0 lg:relative p-4 space-y-3 safe-bottom"
            style={{ backgroundColor: 'var(--color-surface-card)', borderTop: '1px solid var(--color-surface-border)' }}
          >
            {itensNaoEnviados.length > 0 && (
              <div
                className="flex items-center gap-2 px-3 py-2.5 rounded-lg text-xs font-semibold"
                style={{ backgroundColor: 'rgba(251,191,36,0.08)', color: 'var(--color-status-wait)' }}
              >
                <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                {itensNaoEnviados.length} {itensNaoEnviados.length === 1 ? 'item não enviado' : 'itens não enviados'} para produção
              </div>
            )}

            <div className="flex gap-2">
              <button
                onClick={() => setShowCardapio(true)}
                className="btn-secondary flex-1"
              >
                <Plus className="w-4 h-4" />
                Adicionar
              </button>
              <button
                onClick={enviarParaProducao}
                disabled={enviando || itensNaoEnviados.length === 0}
                className="btn-primary flex-1"
              >
                {enviando ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                {enviando ? 'Enviando...' : `Enviar (${itensNaoEnviados.length})`}
              </button>
            </div>

            <button
              onClick={() => router.push(`/caixa?comanda=${comanda.id}`)}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-sm transition-all active:scale-98"
              style={{ border: '1.5px solid var(--color-status-free)', color: 'var(--color-status-free)' }}
            >
              <Receipt className="w-4 h-4" />
              Fechar Conta — {formatCurrency(totalComanda)}
            </button>
          </div>
        </>
      )}

      {/* ── MODAL CARDÁPIO ── */}
      {showCardapio && (
        <div className="fixed inset-0 bg-black/70 z-50 flex items-end lg:items-center justify-center p-0 lg:p-6 animate-fade-in">
          <div
            className="w-full lg:max-w-xl max-h-[92vh] flex flex-col"
            style={{ backgroundColor: 'var(--color-surface-card)', borderRadius: '12px 12px 0 0' }}
          >
            {/* Handle mobile */}
            <div className="flex justify-center pt-3 pb-1 lg:hidden">
              <div className="w-10 h-1 rounded-full" style={{ backgroundColor: 'var(--color-surface-border-light)' }} />
            </div>

            {/* Header modal */}
            <div className="flex items-center gap-3 px-4 py-3 flex-shrink-0"
              style={{ borderBottom: '1px solid var(--color-surface-border)' }}>
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
                <input
                  type="text"
                  placeholder="Buscar produto..."
                  value={buscaProduto}
                  onChange={e => setBuscaProduto(e.target.value)}
                  autoFocus
                  className="input pl-9 py-2.5"
                />
              </div>
              <button
                onClick={() => { setShowCardapio(false); setProdutoSelecionado(null) }}
                className="p-2 rounded-lg"
                style={{ color: 'var(--color-text-muted)', backgroundColor: 'var(--color-surface-card-hover)' }}
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Filtro de categorias */}
            <div className="flex gap-2 px-4 py-2.5 overflow-x-auto flex-shrink-0 no-select"
              style={{ borderBottom: '1px solid var(--color-surface-border)' }}>
              <button
                onClick={() => setCategoriaFiltro('todas')}
                className="px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap flex-shrink-0 transition-all"
                style={{
                  backgroundColor: categoriaFiltro === 'todas' ? 'var(--color-brand-accent)' : 'var(--color-surface-card-hover)',
                  color: categoriaFiltro === 'todas' ? '#fff' : 'var(--color-text-muted)',
                }}
              >
                Todos
              </button>
              {categorias.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setCategoriaFiltro(cat.id)}
                  className="px-3 py-1.5 rounded-md text-xs font-bold whitespace-nowrap flex-shrink-0 transition-all"
                  style={{
                    backgroundColor: categoriaFiltro === cat.id ? 'var(--color-brand-accent)' : 'var(--color-surface-card-hover)',
                    color: categoriaFiltro === cat.id ? '#fff' : 'var(--color-text-muted)',
                  }}
                >
                  {cat.icone} {cat.nome}
                </button>
              ))}
            </div>

            {/* Conteúdo: produto selecionado ou lista */}
            {produtoSelecionado ? (
              <div className="flex-1 p-4 overflow-y-auto">
                <div className="space-y-4">
                  {/* Produto header */}
                  <div className="flex items-center gap-3">
                    <div
                      className="w-12 h-12 rounded-lg flex items-center justify-center flex-shrink-0 text-2xl"
                      style={{ backgroundColor: 'rgba(249,115,22,0.1)' }}
                    >
                      🥟
                    </div>
                    <div className="flex-1">
                      <h3 className="font-display font-bold" style={{ color: 'var(--color-text-main)' }}>
                        {produtoSelecionado.nome}
                      </h3>
                      <p className="font-bold text-lg" style={{ color: 'var(--color-brand-accent)' }}>
                        {formatCurrency(produtoSelecionado.preco_venda)}
                      </p>
                    </div>
                    <button
                      onClick={() => setProdutoSelecionado(null)}
                      className="p-1.5 rounded-lg"
                      style={{ color: 'var(--color-text-muted)', backgroundColor: 'var(--color-surface-card-hover)' }}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Quantidade */}
                  <div>
                    <label className="text-xs font-bold uppercase tracking-wider mb-3 block" style={{ color: 'var(--color-text-muted)' }}>
                      Quantidade
                    </label>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => setQuantidade(Math.max(1, quantidade - 1))}
                        className="w-11 h-11 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: 'var(--color-surface-card-hover)', color: 'var(--color-text-main)' }}
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="font-display font-bold text-2xl w-10 text-center" style={{ color: 'var(--color-text-main)' }}>
                        {quantidade}
                      </span>
                      <button
                        onClick={() => setQuantidade(quantidade + 1)}
                        className="w-11 h-11 rounded-lg flex items-center justify-center"
                        style={{ backgroundColor: 'var(--color-brand-accent)', color: '#fff' }}
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Observação */}
                  <div>
                    <button
                      onClick={() => setShowObs(!showObs)}
                      className="flex items-center gap-2 text-sm font-medium transition-colors"
                      style={{ color: showObs ? 'var(--color-brand-accent)' : 'var(--color-text-muted)' }}
                    >
                      <MessageSquare className="w-4 h-4" />
                      {showObs ? 'Remover observação' : 'Adicionar observação'}
                    </button>
                    {showObs && (
                      <textarea
                        value={observacao}
                        onChange={e => setObservacao(e.target.value)}
                        placeholder="Ex: Sem cebola, bem passado..."
                        rows={2}
                        className="input mt-2 resize-none"
                      />
                    )}
                  </div>

                  {/* Total */}
                  <div
                    className="flex items-center justify-between p-3 rounded-lg"
                    style={{ backgroundColor: 'rgba(249,115,22,0.08)' }}
                  >
                    <span className="font-medium text-sm" style={{ color: 'var(--color-text-sub)' }}>Total</span>
                    <span className="font-display font-bold text-lg" style={{ color: 'var(--color-brand-accent)' }}>
                      {formatCurrency(quantidade * produtoSelecionado.preco_venda)}
                    </span>
                  </div>

                  <button onClick={adicionarItem} className="btn-primary w-full py-3.5">
                    <Plus className="w-4 h-4" />
                    Adicionar à Comanda
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto">
                {produtosFiltrados.map(produto => (
                  <button
                    key={produto.id}
                    onClick={() => { setProdutoSelecionado(produto); setQuantidade(1); setObservacao('') }}
                    className="w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors"
                    style={{ borderBottom: '1px solid var(--color-surface-border)' }}
                    onMouseEnter={e => (e.currentTarget.style.backgroundColor = 'var(--color-surface-card-hover)')}
                    onMouseLeave={e => (e.currentTarget.style.backgroundColor = '')}
                  >
                    <div
                      className="w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 text-lg"
                      style={{ backgroundColor: 'rgba(249,115,22,0.08)' }}
                    >
                      {(produto as any).categoria?.icone || '🍽️'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-semibold text-sm truncate" style={{ color: 'var(--color-text-main)' }}>{produto.nome}</p>
                      <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>{(produto as any).categoria?.nome}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm" style={{ color: 'var(--color-brand-accent)' }}>
                        {formatCurrency(produto.preco_venda)}
                      </span>
                      <ChevronRight className="w-4 h-4" style={{ color: 'var(--color-text-muted)' }} />
                    </div>
                  </button>
                ))}
                {produtosFiltrados.length === 0 && (
                  <div className="text-center py-10" style={{ color: 'var(--color-text-muted)' }}>
                    <p className="text-sm">Nenhum produto encontrado</p>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

function ItemCard({ item, onRemover }: { item: ComandaItem; onRemover: () => void }) {
  return (
    <div
      className="flex gap-3 p-3.5 rounded-lg transition-all"
      style={{
        backgroundColor: item.enviado_para_producao ? 'var(--color-surface-card)' : 'rgba(249,115,22,0.05)',
        border: `1px solid ${item.enviado_para_producao ? 'var(--color-surface-border)' : 'rgba(249,115,22,0.15)'}`,
      }}
    >
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <span className="text-sm font-semibold flex-1 truncate" style={{ color: 'var(--color-text-main)' }}>
            {item.nome_produto}
          </span>
          {item.enviado_para_producao ? (
            <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" style={{ color: 'var(--color-status-free)' }} />
          ) : (
            <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5 animate-pulse" style={{ backgroundColor: 'var(--color-brand-accent)' }} />
          )}
        </div>
        {item.observacao && (
          <p className="text-xs italic mt-0.5" style={{ color: 'var(--color-text-muted)' }}>📝 {item.observacao}</p>
        )}
        <div className="flex items-center gap-2 mt-2">
          <span
            className="text-xs font-bold px-1.5 py-0.5 rounded-md"
            style={{ backgroundColor: 'var(--color-surface-card-hover)', color: 'var(--color-text-muted)' }}
          >
            {item.quantidade}x
          </span>
          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{formatCurrency(item.preco_unitario)}</span>
          <span className="text-sm font-bold ml-auto" style={{ color: 'var(--color-brand-accent)' }}>
            {formatCurrency(item.total)}
          </span>
        </div>
      </div>
      {!item.enviado_para_producao && (
        <button
          onClick={onRemover}
          className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 self-start transition-colors"
          style={{ backgroundColor: 'rgba(248,113,113,0.1)', color: 'var(--color-status-busy)', minHeight: 'unset' }}
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      )}
    </div>
  )
}
