'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { formatCurrency, formatDateTime } from '@/lib/utils'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
  LineChart, Line
} from 'recharts'
import { Calendar, Download, TrendingUp, DollarSign, ArrowRightLeft, FileText, Loader2 } from 'lucide-react'

export default function RelatoriosPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(true)
  const [periodo, setPeriodo] = useState('mes') // hoje, semana, mes
  
  // Dados
  const [resumo, setResumo] = useState({
    total_vendas: 0,
    qtd_pedidos: 0,
    ticket_medio: 0,
    dinheiro: 0,
    pix: 0,
    cartao: 0
  })
  const [dadosGrafico, setDadosGrafico] = useState<any[]>([])
  const [produtosMaisVendidos, setProdutosMaisVendidos] = useState<any[]>([])

  const carregarDados = useCallback(async () => {
    setLoading(true)
    
    // Calcular datas baseadas no período
    const hoje = new Date()
    let dataInicio = new Date()
    
    if (periodo === 'hoje') {
      dataInicio.setHours(0, 0, 0, 0)
    } else if (periodo === 'semana') {
      dataInicio.setDate(hoje.getDate() - 7)
    } else {
      dataInicio.setMonth(hoje.getMonth() - 1)
    }

    const isoInicio = dataInicio.toISOString()

    // Buscar pagamentos no período
    const { data: pagamentos } = await supabase
      .from('pagamentos')
      .select('valor, forma_pagamento, criado_em')
      .gte('criado_em', isoInicio)

    // Buscar comandas finalizadas no período
    const { data: comandas } = await supabase
      .from('comandas')
      .select('id, valor_final, criado_em')
      .eq('status', 'finalizada')
      .gte('criado_em', isoInicio)

    // Calcular resumo financeiro
    let total = 0
    let dinheiro = 0
    let pix = 0
    let cartao = 0

    pagamentos?.forEach(p => {
      total += p.valor
      if (p.forma_pagamento === 'dinheiro') dinheiro += p.valor
      if (p.forma_pagamento === 'pix') pix += p.valor
      if (p.forma_pagamento.includes('credito') || p.forma_pagamento.includes('debito')) cartao += p.valor
    })

    const qtd = comandas?.length || 0
    
    setResumo({
      total_vendas: total,
      qtd_pedidos: qtd,
      ticket_medio: qtd > 0 ? total / qtd : 0,
      dinheiro,
      pix,
      cartao
    })

    // Agrupar dados para o gráfico (por dia)
    const agrupadoDia: Record<string, number> = {}
    
    // Inicializar dias vazios
    const dias = periodo === 'mes' ? 30 : periodo === 'semana' ? 7 : 1
    for (let i = dias; i >= 0; i--) {
      const d = new Date()
      d.setDate(d.getDate() - i)
      const dataStr = d.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
      if (periodo !== 'hoje') {
        agrupadoDia[dataStr] = 0
      }
    }

    if (periodo === 'hoje') {
      // Por hora
      for (let i = 8; i <= 23; i++) {
        agrupadoDia[`${i}h`] = 0
      }
      pagamentos?.forEach(p => {
        const h = new Date(p.criado_em).getHours()
        if (agrupadoDia[`${h}h`] !== undefined) agrupadoDia[`${h}h`] += p.valor
      })
    } else {
      pagamentos?.forEach(p => {
        const dia = new Date(p.criado_em).toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
        if (agrupadoDia[dia] !== undefined) agrupadoDia[dia] += p.valor
      })
    }

    setDadosGrafico(Object.keys(agrupadoDia).map(k => ({
      name: k,
      total: agrupadoDia[k]
    })))

    setLoading(false)
  }, [periodo, supabase])

  useEffect(() => {
    carregarDados()
  }, [carregarDados])

  return (
    <div className="p-4 lg:p-6 space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Relatórios</h1>
          <p className="text-sm text-gray-500">Acompanhamento financeiro e métricas</p>
        </div>

        <div className="flex items-center gap-2">
          <select
            value={periodo}
            onChange={(e) => setPeriodo(e.target.value)}
            className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm rounded-xl px-4 py-2 font-medium focus:outline-none focus:ring-2 focus:ring-orange-400"
          >
            <option value="hoje">Hoje</option>
            <option value="semana">Últimos 7 dias</option>
            <option value="mes">Últimos 30 dias</option>
          </select>

          <button className="flex items-center gap-2 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold px-4 py-2 rounded-xl transition-all">
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Exportar</span>
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
        </div>
      ) : (
        <>
          {/* Resumo Financeiro */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
              <div className="flex items-center gap-3 text-orange-600 mb-2">
                <div className="p-2 bg-orange-100 rounded-lg">
                  <DollarSign className="w-5 h-5" />
                </div>
                <p className="text-sm font-medium">Vendas Brutas</p>
              </div>
              <p className="text-2xl font-black text-gray-900 dark:text-white">
                {formatCurrency(resumo.total_vendas)}
              </p>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
              <div className="flex items-center gap-3 text-blue-600 mb-2">
                <div className="p-2 bg-blue-100 rounded-lg">
                  <FileText className="w-5 h-5" />
                </div>
                <p className="text-sm font-medium">Pedidos</p>
              </div>
              <p className="text-2xl font-black text-gray-900 dark:text-white">
                {resumo.qtd_pedidos}
              </p>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
              <div className="flex items-center gap-3 text-emerald-600 mb-2">
                <div className="p-2 bg-emerald-100 rounded-lg">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <p className="text-sm font-medium">Ticket Médio</p>
              </div>
              <p className="text-2xl font-black text-gray-900 dark:text-white">
                {formatCurrency(resumo.ticket_medio)}
              </p>
            </div>

            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
              <div className="flex items-center gap-3 text-purple-600 mb-2">
                <div className="p-2 bg-purple-100 rounded-lg">
                  <ArrowRightLeft className="w-5 h-5" />
                </div>
                <p className="text-sm font-medium">PIX</p>
              </div>
              <p className="text-2xl font-black text-gray-900 dark:text-white">
                {formatCurrency(resumo.pix)}
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Representa {resumo.total_vendas > 0 ? Math.round((resumo.pix / resumo.total_vendas) * 100) : 0}%
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* Gráfico principal */}
            <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-6">Evolução das Vendas</h3>
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={dadosGrafico}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
                    <XAxis 
                      dataKey="name" 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: '#6b7280' }}
                      dy={10}
                    />
                    <YAxis 
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 12, fill: '#6b7280' }}
                      tickFormatter={(value) => `R$ ${value}`}
                    />
                    <RechartsTooltip 
                      cursor={{ fill: 'transparent' }}
                      content={({ active, payload, label }) => {
                        if (active && payload && payload.length) {
                          return (
                            <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-xl rounded-xl p-3">
                              <p className="text-sm text-gray-500 mb-1">{label}</p>
                              <p className="font-bold text-orange-500">
                                {formatCurrency(payload[0].value as number)}
                              </p>
                            </div>
                          );
                        }
                        return null;
                      }}
                    />
                    <Bar 
                      dataKey="total" 
                      fill="#f97316" 
                      radius={[4, 4, 0, 0]} 
                      barSize={periodo === 'mes' ? 12 : 30}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Formas de pagamento */}
            <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-5">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-6">Receitas por Forma</h3>
              
              <div className="space-y-5">
                {[
                  { label: 'PIX', valor: resumo.pix, cor: 'bg-teal-500' },
                  { label: 'Cartões', valor: resumo.cartao, cor: 'bg-blue-500' },
                  { label: 'Dinheiro', valor: resumo.dinheiro, cor: 'bg-emerald-500' },
                ].map(item => {
                  const perc = resumo.total_vendas > 0 ? (item.valor / resumo.total_vendas) * 100 : 0
                  
                  return (
                    <div key={item.label}>
                      <div className="flex justify-between items-end mb-2">
                        <div>
                          <p className="text-sm font-medium text-gray-700 dark:text-gray-300">{item.label}</p>
                          <p className="text-xs text-gray-400">{perc.toFixed(1)}%</p>
                        </div>
                        <p className="font-bold text-gray-900 dark:text-white">{formatCurrency(item.valor)}</p>
                      </div>
                      <div className="w-full bg-gray-100 dark:bg-gray-800 rounded-full h-2">
                        <div 
                          className={`h-2 rounded-full ${item.cor}`}
                          style={{ width: `${perc}%` }}
                        />
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
