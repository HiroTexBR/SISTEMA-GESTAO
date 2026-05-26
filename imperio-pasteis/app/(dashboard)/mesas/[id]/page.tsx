'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Mesa, Comanda, ComandaItem, Produto, Categoria } from '@/lib/types'
import { formatCurrency, getStatusImpressaoLabel, getStatusImpressaoColor } from '@/lib/utils'
import {
  ArrowLeft, Plus, Minus, Trash2, Send, Printer,
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

  // Estados do cardápio
  const [showCardapio, setShowCardapio] = useState(false)
  const [buscaProduto, setBuscaProduto] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>('todas')

  // Novo item selecionado
  const [produtoSelecionado, setProdutoSelecionado] = useState<Produto | null>(null)
  const [quantidade, setQuantidade] = useState(1)
  const [observacao, setObservacao] = useState('')
  const [showObs, setShowObs] = useState(false)

  // Carregar tudo
  const carregar = useCallback(async () => {
    try {
      // Mesa
      const { data: mesaData } = await supabase.from('mesas').select('*').eq('id', mesaId).single()
      if (mesaData) setMesa(mesaData)

      // Comanda ativa
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
        // Itens da comanda
        const { data: itensData } = await supabase
          .from('comanda_itens')
          .select(`*, produto:produtos(*)`)
          .eq('comanda_id', comandaData.id)
          .neq('status', 'cancelado')
          .order('criado_em')
        if (itensData) setItens(itensData)
      }

      // Produtos e categorias
      const [{ data: prods }, { data: cats }] = await Promise.all([
        supabase.from('produtos').select('*, categoria:categorias(*)').eq('ativo', true).order('nome'),
        supabase.from('categorias').select('*').eq('ativo', true).order('ordem'),
      ])
      if (prods) setProdutos(prods)
      if (cats) setCategorias(cats)
    } catch (err) {
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

    // Auto-reparo: verifica se o usuário autenticado existe na tabela 'usuarios'
    // Se não existir (ex: admin criado manualmente no Supabase), ele insere automaticamente
    // para evitar o erro de foreign key constraint (comandas_garcom_id_fkey).
    const { data: userExists } = await supabase.from('usuarios').select('id').eq('id', user.id).single()
    if (!userExists) {
      const { error: insertUserError } = await supabase.from('usuarios').insert({
        id: user.id,
        nome: user.email?.split('@')[0] || 'Usuário',
        email: user.email,
        cargo: 'admin',
        ativo: true
      })
      if (insertUserError) {
        toast.error('Erro no auto-reparo do usuário: ' + insertUserError.message)
        console.error('Erro ao inserir usuario:', insertUserError)
        return
      }
    }

    const { data, error } = await supabase
      .from('comandas')
      .insert({ mesa_id: mesaId, garcom_id: user.id, status: 'aberta' })
      .select()
      .single()

    if (error) { 
      toast.error('Erro ao abrir comanda: ' + error.message)
      console.error(error)
      return 
    }
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
    if (itensNaoEnviados.length === 0) {
      toast.info('Todos os itens já foram enviados para produção')
      return
    }

    setEnviando(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const { data: usuarioData } = await supabase
        .from('usuarios').select('nome').eq('id', user?.id).single()

      // Criar pedido de produção
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
        .select()
        .single()

      if (pedidoError) throw pedidoError

      // Adicionar itens ao pedido
      const pedidoItens = itensNaoEnviados.map(item => ({
        pedido_producao_id: pedido.id,
        comanda_item_id: item.id,
        produto_id: item.produto_id,
        nome_produto: item.nome_produto,
        quantidade: item.quantidade,
        observacao: item.observacao,
      }))

      await supabase.from('pedido_itens').insert(pedidoItens)

      // Marcar itens como enviados
      const idsNaoEnviados = itensNaoEnviados.map(i => i.id)
      await supabase.from('comanda_itens')
        .update({ enviado_para_producao: true, enviado_em: new Date().toISOString(), status: 'enviado' })
        .in('id', idsNaoEnviados)

      // Criar fila de impressão
      const conteudo = gerarConteudoImpressao(mesa, comanda, itensNaoEnviados, usuarioData?.nome)
      const { data: impressora } = await supabase
        .from('impressoras')
        .select('id, modo_teste')
        .eq('setor', 'producao')
        .eq('ativa', true)
        .single()

      if (impressora) {
        await supabase.from('fila_impressao').insert({
          tipo_documento: 'pedido_producao',
          comanda_id: comanda.id,
          pedido_producao_id: pedido.id,
          impressora_id: impressora.id,
          conteudo,
          status: 'pendente',
          modo_simulacao: impressora.modo_teste,
        })
      }

      toast.success('✅ Pedido enviado para produção!')
      if (impressora?.modo_teste) {
        toast.info('🖨️ Impressão simulada (modo teste ativo)')
      } else {
        toast.info('🖨️ Impressão automática enviada')
      }

      carregar()
    } catch (err) {
      toast.error('Erro ao enviar pedido para produção')
      console.error(err)
    } finally {
      setEnviando(false)
    }
  }

  function gerarConteudoImpressao(mesa: Mesa | null, comanda: Comanda | null, itens: ComandaItem[], garcom?: string): string {
    const linha = '--------------------------------'
    const linhas = [
      '',
      `        MESA ${mesa?.numero || '?'}`,
      `     COMANDA #${String(comanda?.numero || '?').padStart(6, '0')}`,
      `GARÇOM: ${garcom || '?'}`,
      `HORÁRIO: ${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`,
      linha,
      ...itens.map(item =>
        `${item.quantidade}x ${item.nome_produto}${item.observacao ? `\n   OBS: ${item.observacao}` : ''}`
      ),
      linha,
      '      SETOR: PRODUÇÃO',
      '   IMPRESSÃO AUTOMÁTICA',
      '',
    ]
    return linhas.join('\n')
  }

  const itensNaoEnviados = itens.filter(i => !i.enviado_para_producao)
  const produtosFiltrados = produtos
    .filter(p => categoriaFiltro === 'todas' || p.categoria_id === categoriaFiltro)
    .filter(p => buscaProduto === '' || p.nome.toLowerCase().includes(buscaProduto.toLowerCase()))

  const totalComanda = itens.reduce((acc, i) => acc + i.total, 0)

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen">
      <Loader2 className="w-10 h-10 animate-spin text-orange-500" />
    </div>
  )

  return (
    <div className="flex flex-col h-full relative">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800 sticky top-0 z-20">
        <button onClick={() => router.back()} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-all">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-gray-900 dark:text-white">Mesa {mesa?.numero}</h1>
          {comanda ? (
            <p className="text-xs text-gray-500">Comanda #{String(comanda.numero).padStart(6, '0')}</p>
          ) : (
            <p className="text-xs text-gray-500">Mesa livre</p>
          )}
        </div>
        {comanda && (
          <div className="text-right">
            <p className="text-xs text-gray-500">Total</p>
            <p className="text-lg font-bold text-orange-500">{formatCurrency(totalComanda)}</p>
          </div>
        )}
      </div>

      {/* Sem comanda — botão abrir */}
      {!comanda ? (
        <div className="flex-1 flex items-center justify-center p-8">
          <div className="text-center">
            <div className="w-20 h-20 bg-emerald-100 rounded-3xl flex items-center justify-center mx-auto mb-4">
              <Receipt className="w-10 h-10 text-emerald-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Mesa Livre</h2>
            <p className="text-gray-500 text-sm mb-6">Toque para abrir uma comanda</p>
            <button
              onClick={criarComanda}
              className="bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold px-8 py-4 rounded-2xl shadow-lg shadow-orange-500/30 text-lg transition-all active:scale-95"
            >
              Abrir Comanda
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Lista de itens */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2 pb-40">
            {itens.length === 0 ? (
              <div className="text-center py-16 text-gray-400">
                <ShoppingCart className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p className="text-sm">Nenhum item adicionado</p>
                <p className="text-xs mt-1">Toque em "+ Adicionar" para começar</p>
              </div>
            ) : (
              itens.map(item => (
                <ItemCard key={item.id} item={item} onRemover={() => removerItem(item.id, item.nome_produto)} />
              ))
            )}
          </div>

          {/* Barra inferior */}
          <div className="fixed bottom-0 inset-x-0 lg:relative bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 p-4 space-y-3 safe-bottom">
            {itensNaoEnviados.length > 0 && (
              <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-xl px-4 py-2 flex items-center gap-2">
                <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0" />
                <p className="text-xs text-amber-700 dark:text-amber-300">
                  {itensNaoEnviados.length} {itensNaoEnviados.length === 1 ? 'item não enviado' : 'itens não enviados'} para produção
                </p>
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => setShowCardapio(true)}
                className="flex-1 flex items-center justify-center gap-2 bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300 font-semibold py-3.5 rounded-xl transition-all active:scale-95"
              >
                <Plus className="w-5 h-5" />
                Adicionar
              </button>
              <button
                onClick={enviarParaProducao}
                disabled={enviando || itensNaoEnviados.length === 0}
                className="flex-1 flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-orange-500/30 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {enviando ? (
                  <><Loader2 className="w-5 h-5 animate-spin" /> Enviando...</>
                ) : (
                  <><Send className="w-5 h-5" /> Enviar ({itensNaoEnviados.length})</>
                )}
              </button>
            </div>

            <button
              onClick={() => router.push(`/caixa?comanda=${comanda.id}`)}
              className="w-full flex items-center justify-center gap-2 border-2 border-emerald-500 text-emerald-600 font-bold py-3.5 rounded-xl transition-all active:scale-95"
            >
              <Receipt className="w-5 h-5" />
              Fechar Conta — {formatCurrency(totalComanda)}
            </button>
          </div>
        </>
      )}

      {/* Modal Cardápio */}
      {showCardapio && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end lg:items-center justify-center p-0 lg:p-6 animate-fade-in">
          <div className="bg-white dark:bg-gray-900 w-full lg:max-w-2xl lg:rounded-3xl rounded-t-3xl max-h-[90vh] flex flex-col">
            {/* Header modal */}
            <div className="flex items-center gap-3 p-4 border-b border-gray-100 dark:border-gray-800 flex-shrink-0">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Buscar produto..."
                  value={buscaProduto}
                  onChange={e => setBuscaProduto(e.target.value)}
                  autoFocus
                  className="w-full bg-gray-100 dark:bg-gray-800 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>
              <button onClick={() => { setShowCardapio(false); setProdutoSelecionado(null) }}
                aria-label="Fechar cardápio"
                className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Categorias */}
            <div className="flex gap-2 px-4 py-3 overflow-x-auto flex-shrink-0 border-b border-gray-100 dark:border-gray-800">
              <button
                onClick={() => setCategoriaFiltro('todas')}
                className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap flex-shrink-0 ${
                  categoriaFiltro === 'todas' ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600'
                }`}
              >
                Todos
              </button>
              {categorias.map(cat => (
                <button
                  key={cat.id}
                  onClick={() => setCategoriaFiltro(cat.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap flex-shrink-0 ${
                    categoriaFiltro === cat.id ? 'bg-orange-500 text-white' : 'bg-gray-100 text-gray-600'
                  }`}
                >
                  {cat.icone} {cat.nome}
                </button>
              ))}
            </div>

            {/* Lista de produtos ou detalhe do produto */}
            {produtoSelecionado ? (
              <div className="flex-1 p-4 overflow-y-auto">
                <div className="space-y-4">
                  <div className="flex items-start gap-3">
                    <div className="w-14 h-14 bg-orange-100 rounded-2xl flex items-center justify-center flex-shrink-0 text-2xl">
                      🥟
                    </div>
                    <div>
                      <h3 className="font-bold text-gray-900 dark:text-white">{produtoSelecionado.nome}</h3>
                      <p className="text-orange-500 font-bold text-lg">{formatCurrency(produtoSelecionado.preco_venda)}</p>
                    </div>
                    <button onClick={() => setProdutoSelecionado(null)} className="ml-auto p-1.5 rounded-xl hover:bg-gray-100">
                      <X className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Quantidade */}
                  <div>
                    <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Quantidade</label>
                    <div className="flex items-center gap-4">
                      <button
                        onClick={() => setQuantidade(Math.max(1, quantidade - 1))}
                        className="w-12 h-12 rounded-xl bg-gray-100 dark:bg-gray-800 flex items-center justify-center text-gray-700 dark:text-gray-300"
                      >
                        <Minus className="w-5 h-5" />
                      </button>
                      <span className="text-2xl font-bold text-gray-900 dark:text-white w-8 text-center">{quantidade}</span>
                      <button
                        onClick={() => setQuantidade(quantidade + 1)}
                        className="w-12 h-12 rounded-xl bg-orange-500 flex items-center justify-center text-white"
                      >
                        <Plus className="w-5 h-5" />
                      </button>
                    </div>
                  </div>

                  {/* Observação */}
                  <div>
                    <button
                      onClick={() => setShowObs(!showObs)}
                      className="flex items-center gap-2 text-sm text-gray-500 hover:text-orange-500 transition-colors"
                    >
                      <MessageSquare className="w-4 h-4" />
                      {showObs ? 'Fechar observação' : 'Adicionar observação'}
                    </button>
                    {showObs && (
                      <textarea
                        value={observacao}
                        onChange={e => setObservacao(e.target.value)}
                        placeholder="Ex: Sem cebola, bem passado..."
                        rows={2}
                        className="w-full mt-2 bg-gray-100 dark:bg-gray-800 rounded-xl p-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                      />
                    )}
                  </div>

                  {/* Total */}
                  <div className="flex items-center justify-between p-4 bg-orange-50 dark:bg-orange-900/20 rounded-2xl">
                    <span className="font-medium text-gray-700 dark:text-gray-300">Total</span>
                    <span className="text-xl font-bold text-orange-500">{formatCurrency(quantidade * produtoSelecionado.preco_venda)}</span>
                  </div>

                  <button
                    onClick={adicionarItem}
                    className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-orange-500/30 flex items-center justify-center gap-2 text-base active:scale-95 transition-all"
                  >
                    <Plus className="w-5 h-5" />
                    Adicionar à Comanda
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
                {produtosFiltrados.map(produto => (
                  <button
                    key={produto.id}
                    onClick={() => { setProdutoSelecionado(produto); setQuantidade(1); setObservacao('') }}
                    className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 dark:hover:bg-gray-800 active:bg-gray-100 transition-colors text-left"
                  >
                    <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0 text-xl">
                      {(produto as any).categoria?.icone || '🍽️'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-gray-900 dark:text-white truncate">{produto.nome}</p>
                      <p className="text-xs text-gray-500 truncate">{(produto as any).categoria?.nome}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-orange-500">{formatCurrency(produto.preco_venda)}</span>
                      <ChevronRight className="w-4 h-4 text-gray-400" />
                    </div>
                  </button>
                ))}
                {produtosFiltrados.length === 0 && (
                  <div className="text-center py-10 text-gray-400">
                    <p>Nenhum produto encontrado</p>
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
    <div className={`bg-white dark:bg-gray-900 rounded-2xl border p-4 flex gap-3 transition-all ${
      item.enviado_para_producao
        ? 'border-gray-200 dark:border-gray-800'
        : 'border-orange-200 dark:border-orange-900 bg-orange-50/50 dark:bg-orange-900/10'
    }`}>
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2">
          <span className="text-sm font-bold text-gray-900 dark:text-white flex-1 truncate">{item.nome_produto}</span>
          {item.enviado_para_producao ? (
            <CheckCircle2 className="w-4 h-4 text-emerald-500 flex-shrink-0 mt-0.5" />
          ) : (
            <div className="w-2 h-2 rounded-full bg-orange-400 flex-shrink-0 mt-1.5 animate-pulse" />
          )}
        </div>
        {item.observacao && (
          <p className="text-xs text-gray-500 mt-0.5 italic">📝 {item.observacao}</p>
        )}
        <div className="flex items-center gap-2 mt-2">
          <span className="text-xs bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400 px-2 py-0.5 rounded-lg">
            {item.quantidade}x
          </span>
          <span className="text-xs text-gray-500">{formatCurrency(item.preco_unitario)}</span>
          <span className="text-sm font-bold text-orange-500 ml-auto">{formatCurrency(item.total)}</span>
        </div>
      </div>
      {!item.enviado_para_producao && (
        <button
          onClick={onRemover}
          className="w-8 h-8 rounded-xl bg-red-100 dark:bg-red-900/30 flex items-center justify-center text-red-500 flex-shrink-0 self-start"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      )}
    </div>
  )
}
