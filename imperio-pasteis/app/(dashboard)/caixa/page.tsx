'use client'

import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import type { Comanda, ComandaItem } from '@/lib/types'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import {
  CreditCard, Search, Receipt, CheckCircle2,
  DollarSign, Smartphone, ChevronRight, Loader2, X,
  Calculator, Banknote
} from 'lucide-react'
import { toast } from 'sonner'

const FORMAS_PAGAMENTO = [
  { id: 'pix', label: 'PIX', icon: Smartphone, cor: 'from-teal-500 to-cyan-500' },
  { id: 'dinheiro', label: 'Dinheiro', icon: Banknote, cor: 'from-emerald-500 to-green-600' },
  { id: 'credito', label: 'Crédito', icon: CreditCard, cor: 'from-blue-500 to-blue-600' },
  { id: 'debito', label: 'Débito', icon: CreditCard, cor: 'from-purple-500 to-violet-600' },
  { id: 'misto', label: 'Misto', icon: Calculator, cor: 'from-orange-500 to-orange-600' },
]

export default function CaixaPage() {
  const searchParams = useSearchParams()
  const supabase = createClient()

  const [comandasAbertas, setComandasAbertas] = useState<Comanda[]>([])
  const [comandaSelecionada, setComandaSelecionada] = useState<Comanda | null>(null)
  const [itens, setItens] = useState<ComandaItem[]>([])
  const [busca, setBusca] = useState('')
  const [loading, setLoading] = useState(true)
  const [pagando, setPagando] = useState(false)

  // Estados do pagamento
  const [showPagamento, setShowPagamento] = useState(false)
  const [formaPagamento, setFormaPagamento] = useState('pix')
  const [desconto, setDesconto] = useState(0)
  const [descontoTipo, setDescontoTipo] = useState<'reais' | 'pct'>('reais')
  const [taxaServico, setTaxaServico] = useState(0)
  const [valorRecebido, setValorRecebido] = useState(0)

  const carregarComandas = useCallback(async () => {
    const { data } = await supabase
      .from('comandas')
      .select(`
        *,
        mesa:mesas(numero),
        garcom:usuarios!garcom_id(nome)
      `)
      .in('status', ['aberta', 'aguardando_pagamento'])
      .order('aberta_em', { ascending: false })

    if (data) setComandasAbertas(data)
    setLoading(false)
  }, [])

  useEffect(() => {
    carregarComandas()

    // Se veio de redirecionamento da comanda
    const comandaId = searchParams.get('comanda')
    if (comandaId) {
      // Auto-selecionar a comanda
      setTimeout(() => selecionarComanda(comandaId), 500)
    }

    const interval = setInterval(carregarComandas, 15000)
    return () => clearInterval(interval)
  }, [carregarComandas])

  async function selecionarComanda(comandaId: string) {
    const { data: comanda } = await supabase
      .from('comandas')
      .select(`*, mesa:mesas(numero), garcom:usuarios!garcom_id(nome)`)
      .eq('id', comandaId)
      .single()

    if (comanda) {
      setComandaSelecionada(comanda)
      const { data: itensData } = await supabase
        .from('comanda_itens')
        .select(`*`)
        .eq('comanda_id', comandaId)
        .neq('status', 'cancelado')
        .order('criado_em')
      if (itensData) setItens(itensData)
    }
  }

  const subtotal = itens.reduce((acc, i) => acc + i.total, 0)
  const descontoValor = descontoTipo === 'reais' ? desconto : subtotal * desconto / 100
  const total = Math.max(0, subtotal - descontoValor + taxaServico)
  const troco = formaPagamento === 'dinheiro' ? Math.max(0, valorRecebido - total) : 0

  async function finalizarPagamento() {
    if (!comandaSelecionada) return
    setPagando(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()

      // Registrar pagamento
      await supabase.from('pagamentos').insert({
        comanda_id: comandaSelecionada.id,
        usuario_id: user?.id,
        forma_pagamento: formaPagamento,
        valor: total,
        valor_recebido: formaPagamento === 'dinheiro' ? valorRecebido : total,
        troco,
      })

      // Atualizar comanda
      await supabase.from('comandas').update({
        status: 'fechada',
        desconto_reais: descontoTipo === 'reais' ? descontoValor : 0,
        desconto_percentual: descontoTipo === 'pct' ? desconto : 0,
        taxa_servico: taxaServico,
        total,
        fechada_em: new Date().toISOString(),
      }).eq('id', comandaSelecionada.id)

      // Criar impressão do recibo
      const { data: impressora } = await supabase
        .from('impressoras')
        .select('id, modo_teste')
        .eq('setor', 'caixa')
        .eq('ativa', true)
        .single()

      if (impressora) {
        const conteudo = gerarRecibo(comandaSelecionada, itens, total, formaPagamento, troco)
        await supabase.from('fila_impressao').insert({
          tipo_documento: 'recibo_final',
          comanda_id: comandaSelecionada.id,
          impressora_id: impressora.id,
          conteudo,
          status: 'pendente',
          modo_simulacao: impressora.modo_teste,
        })
      }

      toast.success('✅ Pagamento finalizado com sucesso!')
      setShowPagamento(false)
      setComandaSelecionada(null)
      setItens([])
      carregarComandas()
    } catch (err) {
      toast.error('Erro ao finalizar pagamento')
    } finally {
      setPagando(false)
    }
  }

  function gerarRecibo(comanda: Comanda, itens: ComandaItem[], total: number, forma: string, troco: number): string {
    const linha = '--------------------------------'
    const nome = process.env.NEXT_PUBLIC_NOME_ESTABELECIMENTO || 'IMPÉRIO PASTÉIS'
    const linhas = [
      '',
      `        ${nome}`,
      `      Mesa ${(comanda.mesa as any)?.numero || '?'}`,
      `Comanda #${String(comanda.numero).padStart(6, '0')}`,
      linha,
      ...itens.map(i => `${i.quantidade}x ${i.nome_produto} - ${formatCurrency(i.total)}`),
      linha,
      `TOTAL: ${formatCurrency(total)}`,
      `PAGAMENTO: ${forma.toUpperCase()}`,
      troco > 0 ? `TROCO: ${formatCurrency(troco)}` : '',
      linha,
      '    Obrigado pela preferência!',
      '',
    ].filter(Boolean)
    return linhas.join('\n')
  }

  const comandasFiltradas = comandasAbertas.filter(c => {
    if (!busca) return true
    const mesa = (c.mesa as any)?.numero?.toString() || ''
    return mesa.includes(busca) || c.numero?.toString().includes(busca)
  })

  return (
    <div className="flex flex-col lg:flex-row h-full">
      {/* Lista de comandas */}
      <div className={`${comandaSelecionada ? 'hidden lg:flex' : 'flex'} flex-col lg:w-80 border-r border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900`}>
        {/* Header */}
        <div className="p-4 border-b border-gray-100 dark:border-gray-800">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
              <CreditCard className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-bold text-gray-900 dark:text-white">Caixa</h1>
              <p className="text-xs text-gray-500">{comandasAbertas.length} comanda{comandasAbertas.length !== 1 ? 's' : ''} abertas</p>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar mesa ou comanda..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="w-full bg-gray-100 dark:bg-gray-800 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400"
            />
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-gray-800">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-500" />
            </div>
          ) : comandasFiltradas.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Receipt className="w-10 h-10 mx-auto mb-3 opacity-50" />
              <p className="text-sm">Nenhuma comanda aberta</p>
            </div>
          ) : (
            comandasFiltradas.map(comanda => (
              <button
                key={comanda.id}
                onClick={() => selecionarComanda(comanda.id)}
                className={`w-full flex items-center gap-3 p-4 hover:bg-gray-50 dark:hover:bg-gray-800 active:bg-gray-100 transition-colors text-left ${
                  comandaSelecionada?.id === comanda.id ? 'bg-emerald-50 dark:bg-emerald-900/20' : ''
                }`}
              >
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-orange-400 to-orange-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-white font-black text-lg">{(comanda.mesa as any)?.numero || '?'}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-900 dark:text-white">
                    Mesa {(comanda.mesa as any)?.numero || '?'}
                  </p>
                  <p className="text-xs text-gray-500">
                    #{String(comanda.numero).padStart(6, '0')} · {(comanda.garcom as any)?.nome || '?'}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-emerald-600">{formatCurrency(comanda.total || 0)}</p>
                  <ChevronRight className="w-4 h-4 text-gray-400 ml-auto" />
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Detalhe da comanda */}
      {comandaSelecionada ? (
        <div className="flex-1 flex flex-col">
          {/* Header da comanda */}
          <div className="flex items-center gap-3 p-4 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-800">
            <button
              onClick={() => { setComandaSelecionada(null); setItens([]) }}
              className="lg:hidden p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800"
            >
              <X className="w-5 h-5" />
            </button>
            <div className="flex-1">
              <h2 className="font-bold text-gray-900 dark:text-white">
                Mesa {(comandaSelecionada.mesa as any)?.numero}
              </h2>
              <p className="text-xs text-gray-500">
                #{String(comandaSelecionada.numero).padStart(6, '0')} · Aberta {formatDateTime(comandaSelecionada.aberta_em)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500">Total</p>
              <p className="text-xl font-black text-emerald-600">{formatCurrency(comandaSelecionada.total || 0)}</p>
            </div>
          </div>

          {/* Itens */}
          <div className="flex-1 overflow-y-auto p-4 space-y-2">
            {itens.map(item => (
              <div key={item.id} className="flex items-center gap-3 p-3 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
                <span className="text-sm font-bold text-orange-500 w-8">{item.quantidade}x</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900 dark:text-white truncate">{item.nome_produto}</p>
                  {item.observacao && <p className="text-xs text-gray-400 italic">{item.observacao}</p>}
                </div>
                <p className="font-semibold text-gray-900 dark:text-white">{formatCurrency(item.total)}</p>
              </div>
            ))}
          </div>

          {/* Resumo + Fechar */}
          <div className="p-4 bg-white dark:bg-gray-900 border-t border-gray-200 dark:border-gray-800 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-500">Subtotal</span>
              <span className="font-medium">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex items-center justify-between font-bold text-lg">
              <span className="text-gray-900 dark:text-white">Total</span>
              <span className="text-emerald-600">{formatCurrency(comandaSelecionada.total || 0)}</span>
            </div>
            <button
              onClick={() => setShowPagamento(true)}
              className="w-full bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-emerald-500/30 text-lg active:scale-95 transition-all flex items-center justify-center gap-3"
            >
              <CreditCard className="w-6 h-6" />
              Fechar Conta
            </button>
          </div>
        </div>
      ) : (
        <div className="hidden lg:flex flex-1 items-center justify-center bg-gray-50 dark:bg-gray-950">
          <div className="text-center">
            <Receipt className="w-16 h-16 mx-auto mb-4 text-gray-300" />
            <p className="text-gray-400">Selecione uma comanda para fechar</p>
          </div>
        </div>
      )}

      {/* Modal de pagamento */}
      {showPagamento && comandaSelecionada && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end lg:items-center justify-center p-0 lg:p-6 animate-fade-in">
          <div className="bg-white dark:bg-gray-900 w-full lg:max-w-md lg:rounded-3xl rounded-t-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-5 space-y-5">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-gray-900 dark:text-white">Fechar Conta</h3>
                <button onClick={() => setShowPagamento(false)} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Forma de pagamento */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Forma de Pagamento</label>
                <div className="grid grid-cols-3 gap-2">
                  {FORMAS_PAGAMENTO.map(f => {
                    const Icon = f.icon
                    return (
                      <button
                        key={f.id}
                        onClick={() => setFormaPagamento(f.id)}
                        className={`flex flex-col items-center gap-1.5 p-3 rounded-2xl border-2 transition-all ${
                          formaPagamento === f.id
                            ? 'border-emerald-500 bg-emerald-50 dark:bg-emerald-900/20'
                            : 'border-gray-200 dark:border-gray-700'
                        }`}
                      >
                        <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${f.cor} flex items-center justify-center`}>
                          <Icon className="w-4 h-4 text-white" />
                        </div>
                        <span className="text-xs font-medium text-gray-700 dark:text-gray-300">{f.label}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Desconto */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Desconto</label>
                <div className="flex gap-2">
                  <div className="flex rounded-xl overflow-hidden border border-gray-200 dark:border-gray-700 flex-shrink-0">
                    <button
                      onClick={() => setDescontoTipo('reais')}
                      className={`px-3 py-2 text-sm font-medium transition-all ${descontoTipo === 'reais' ? 'bg-orange-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-600'}`}
                    >R$</button>
                    <button
                      onClick={() => setDescontoTipo('pct')}
                      className={`px-3 py-2 text-sm font-medium transition-all ${descontoTipo === 'pct' ? 'bg-orange-500 text-white' : 'bg-white dark:bg-gray-800 text-gray-600'}`}
                    >%</button>
                  </div>
                  <input
                    type="number"
                    min="0"
                    value={desconto || ''}
                    onChange={e => setDesconto(Number(e.target.value))}
                    placeholder="0"
                    className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
              </div>

              {/* Taxa de serviço */}
              <div>
                <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Taxa de Serviço (R$)</label>
                <input
                  type="number"
                  min="0"
                  value={taxaServico || ''}
                  onChange={e => setTaxaServico(Number(e.target.value))}
                  placeholder="0"
                  className="w-full bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>

              {/* Valor recebido (dinheiro) */}
              {formaPagamento === 'dinheiro' && (
                <div>
                  <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">Valor Recebido</label>
                  <input
                    type="number"
                    min="0"
                    value={valorRecebido || ''}
                    onChange={e => setValorRecebido(Number(e.target.value))}
                    placeholder={total.toString()}
                    className="w-full bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
              )}

              {/* Resumo final */}
              <div className="bg-gray-50 dark:bg-gray-800 rounded-2xl p-4 space-y-2">
                {descontoValor > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Desconto</span>
                    <span className="text-red-500">- {formatCurrency(descontoValor)}</span>
                  </div>
                )}
                {taxaServico > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-500">Taxa de Serviço</span>
                    <span className="text-gray-700 dark:text-gray-300">+ {formatCurrency(taxaServico)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xl font-black border-t border-gray-200 dark:border-gray-700 pt-2">
                  <span className="text-gray-900 dark:text-white">Total</span>
                  <span className="text-emerald-600">{formatCurrency(total)}</span>
                </div>
                {troco > 0 && (
                  <div className="flex justify-between text-sm font-semibold">
                    <span className="text-gray-500">Troco</span>
                    <span className="text-emerald-600">{formatCurrency(troco)}</span>
                  </div>
                )}
              </div>

              <button
                onClick={finalizarPagamento}
                disabled={pagando}
                className="w-full bg-gradient-to-r from-emerald-500 to-green-600 text-white font-bold py-4 rounded-2xl shadow-lg shadow-emerald-500/30 text-lg active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-3"
              >
                {pagando ? (
                  <><Loader2 className="w-6 h-6 animate-spin" /> Finalizando...</>
                ) : (
                  <><CheckCircle2 className="w-6 h-6" /> Confirmar Pagamento</>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
