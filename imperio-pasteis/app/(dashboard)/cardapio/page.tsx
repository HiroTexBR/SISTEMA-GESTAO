'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import type { Produto, Categoria } from '@/lib/types'
import { formatCurrency } from '@/lib/utils'
import {
  Plus, Search, Edit2, Trash2, X, Loader2,
  Package, ChevronDown, ChevronUp, ToggleLeft, ToggleRight,
  Camera, DollarSign, Clock, AlertCircle, CheckCircle2
} from 'lucide-react'
import { toast } from 'sonner'

const FORM_INICIAL = {
  nome: '',
  descricao: '',
  categoria_id: '',
  preco_venda: '',
  preco_custo: '',
  estoque_atual: '0',
  estoque_minimo: '5',
  controlar_estoque: false,
  enviar_para_producao: true,
  tempo_preparo_min: '10',
  codigo_interno: '',
  ativo: true,
}

export default function CardapioPage() {
  const supabase = createClient()
  const [produtos, setProdutos] = useState<Produto[]>([])
  const [categorias, setCategorias] = useState<Categoria[]>([])
  const [loading, setLoading] = useState(true)
  const [busca, setBusca] = useState('')
  const [categoriaFiltro, setCategoriaFiltro] = useState('todas')
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState<Produto | null>(null)
  const [form, setForm] = useState(FORM_INICIAL)
  const [salvando, setSalvando] = useState(false)

  // Form de categoria
  const [showFormCat, setShowFormCat] = useState(false)
  const [nomeCategoria, setNomeCategoria] = useState('')
  const [iconeCategoria, setIconeCategoria] = useState('🍽️')

  const carregar = useCallback(async () => {
    const [{ data: prods }, { data: cats }] = await Promise.all([
      supabase.from('produtos').select('*, categoria:categorias(*)').order('nome'),
      supabase.from('categorias').select('*').eq('ativo', true).order('ordem'),
    ])
    if (prods) setProdutos(prods)
    if (cats) setCategorias(cats)
    setLoading(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  function abrirEditar(produto: Produto) {
    setEditando(produto)
    setForm({
      nome: produto.nome,
      descricao: produto.descricao || '',
      categoria_id: produto.categoria_id || '',
      preco_venda: produto.preco_venda.toString(),
      preco_custo: produto.preco_custo.toString(),
      estoque_atual: produto.estoque_atual.toString(),
      estoque_minimo: produto.estoque_minimo.toString(),
      controlar_estoque: produto.controlar_estoque,
      enviar_para_producao: produto.enviar_para_producao,
      tempo_preparo_min: produto.tempo_preparo_min.toString(),
      codigo_interno: produto.codigo_interno || '',
      ativo: produto.ativo,
    })
    setShowForm(true)
  }

  function abrirNovo() {
    setEditando(null)
    setForm(FORM_INICIAL)
    setShowForm(true)
  }

  async function salvar() {
    if (!form.nome.trim() || !form.preco_venda) {
      toast.error('Nome e preço de venda são obrigatórios')
      return
    }
    setSalvando(true)
    try {
      const payload = {
        nome: form.nome.trim(),
        descricao: form.descricao || null,
        categoria_id: form.categoria_id || null,
        preco_venda: parseFloat(form.preco_venda),
        preco_custo: parseFloat(form.preco_custo || '0'),
        estoque_atual: parseInt(form.estoque_atual || '0'),
        estoque_minimo: parseInt(form.estoque_minimo || '0'),
        controlar_estoque: form.controlar_estoque,
        enviar_para_producao: form.enviar_para_producao,
        tempo_preparo_min: parseInt(form.tempo_preparo_min || '10'),
        codigo_interno: form.codigo_interno || null,
        ativo: form.ativo,
      }
      if (editando) {
        const { error } = await supabase.from('produtos').update(payload).eq('id', editando.id)
        if (error) throw error
        toast.success('✅ Produto atualizado!')
      } else {
        const { error } = await supabase.from('produtos').insert(payload)
        if (error) throw error
        toast.success('✅ Produto criado!')
      }
      setShowForm(false)
      carregar()
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`)
    } finally {
      setSalvando(false)
    }
  }

  async function toggleAtivo(produto: Produto) {
    await supabase.from('produtos').update({ ativo: !produto.ativo }).eq('id', produto.id)
    toast.success(produto.ativo ? 'Produto desativado' : 'Produto ativado')
    carregar()
  }

  async function excluir(produto: Produto) {
    if (!confirm(`Excluir "${produto.nome}"? Esta ação não pode ser desfeita.`)) return
    await supabase.from('produtos').delete().eq('id', produto.id)
    toast.success('Produto excluído')
    carregar()
  }

  async function salvarCategoria() {
    if (!nomeCategoria.trim()) return
    const { error } = await supabase.from('categorias').insert({
      nome: nomeCategoria.trim(),
      icone: iconeCategoria,
      ordem: categorias.length + 1,
    })
    if (error) { toast.error('Erro ao criar categoria'); return }
    toast.success('Categoria criada!')
    setNomeCategoria('')
    setShowFormCat(false)
    carregar()
  }

  const produtosFiltrados = produtos.filter(p => {
    const matchBusca = !busca || p.nome.toLowerCase().includes(busca.toLowerCase())
    const matchCat = categoriaFiltro === 'todas' || p.categoria_id === categoriaFiltro
    return matchBusca && matchCat
  })

  const EMOJIS_CATEGORIA = ['🍽️','🥟','🍕','🍔','🌭','🍦','☕','🥤','🍺','🍹','🧃','🍰','🥗','🍤','🌮']

  return (
    <div className="p-4 lg:p-6 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Cardápio</h1>
          <p className="text-sm text-gray-500">{produtos.filter(p=>p.ativo).length} produtos ativos</p>
        </div>
        <button
          onClick={abrirNovo}
          className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold px-4 py-2.5 rounded-xl shadow-lg shadow-orange-500/20 active:scale-95 transition-all"
        >
          <Plus className="w-5 h-5" />
          <span className="hidden sm:inline">Novo Produto</span>
        </button>
      </div>

      {/* Categorias — chips */}
      <div className="flex gap-2 overflow-x-auto pb-1 no-select">
        <button
          onClick={() => setCategoriaFiltro('todas')}
          className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap flex-shrink-0 transition-all ${categoriaFiltro === 'todas' ? 'bg-orange-500 text-white' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600'}`}
        >
          🍽️ Todos
        </button>
        {categorias.map(cat => (
          <button
            key={cat.id}
            onClick={() => setCategoriaFiltro(cat.id)}
            className={`px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap flex-shrink-0 transition-all ${categoriaFiltro === cat.id ? 'bg-orange-500 text-white' : 'bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-gray-600'}`}
          >
            {cat.icone} {cat.nome}
          </button>
        ))}
        <button
          onClick={() => setShowFormCat(!showFormCat)}
          className="px-3 py-1.5 rounded-xl text-xs font-medium whitespace-nowrap flex-shrink-0 border-2 border-dashed border-gray-300 dark:border-gray-700 text-gray-400 hover:border-orange-400 hover:text-orange-500 transition-all"
        >
          + Categoria
        </button>
      </div>

      {/* Form nova categoria */}
      {showFormCat && (
        <div className="bg-white dark:bg-gray-900 rounded-2xl border border-gray-200 dark:border-gray-800 p-4 animate-fade-in">
          <h3 className="font-semibold text-sm text-gray-900 dark:text-white mb-3">Nova Categoria</h3>
          <div className="flex gap-3">
            <div className="flex gap-1 flex-wrap">
              {EMOJIS_CATEGORIA.map(e => (
                <button key={e} onClick={() => setIconeCategoria(e)}
                  className={`w-8 h-8 rounded-lg text-lg transition-all ${iconeCategoria === e ? 'bg-orange-100 ring-2 ring-orange-500' : 'hover:bg-gray-100 dark:hover:bg-gray-800'}`}>
                  {e}
                </button>
              ))}
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <input
              value={nomeCategoria}
              onChange={e => setNomeCategoria(e.target.value)}
              placeholder="Nome da categoria..."
              className="flex-1 bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
            />
            <button onClick={salvarCategoria} className="bg-orange-500 text-white px-4 py-2 rounded-xl text-sm font-semibold">
              Criar
            </button>
            <button onClick={() => setShowFormCat(false)} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
        <input
          type="text"
          placeholder="Buscar produto..."
          value={busca}
          onChange={e => setBusca(e.target.value)}
          className="w-full bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
        />
      </div>

      {/* Lista de produtos */}
      {loading ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => <div key={i} className="h-20 skeleton rounded-2xl" />)}
        </div>
      ) : (
        <div className="space-y-2">
          {produtosFiltrados.map(produto => (
            <div
              key={produto.id}
              className={`bg-white dark:bg-gray-900 rounded-2xl border p-4 flex items-center gap-4 transition-all ${produto.ativo ? 'border-gray-200 dark:border-gray-800' : 'border-gray-100 dark:border-gray-900 opacity-50'}`}
            >
              {/* Ícone/foto */}
              <div className="w-14 h-14 bg-orange-100 dark:bg-orange-900/20 rounded-2xl flex items-center justify-center text-2xl flex-shrink-0">
                {(produto as any).categoria?.icone || '🍽️'}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-start gap-2">
                  <p className="font-semibold text-gray-900 dark:text-white truncate">{produto.nome}</p>
                  {produto.estoque_atual <= produto.estoque_minimo && produto.controlar_estoque && (
                    <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                  )}
                </div>
                <div className="flex items-center gap-3 mt-1 flex-wrap">
                  <span className="text-sm font-bold text-orange-500">{formatCurrency(produto.preco_venda)}</span>
                  <span className="text-xs text-gray-400">{(produto as any).categoria?.nome || 'Sem categoria'}</span>
                  {produto.controlar_estoque && (
                    <span className={`text-xs px-2 py-0.5 rounded-lg font-medium ${produto.estoque_atual > produto.estoque_minimo ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-600'}`}>
                      Estoque: {produto.estoque_atual}
                    </span>
                  )}
                  {produto.enviar_para_producao && (
                    <span className="text-xs bg-blue-100 text-blue-600 px-2 py-0.5 rounded-lg">Produção</span>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-1 flex-shrink-0">
                <button onClick={() => toggleAtivo(produto)}
                  className={`p-2 rounded-xl transition-all ${produto.ativo ? 'text-emerald-500 hover:bg-emerald-50' : 'text-gray-400 hover:bg-gray-100'}`}>
                  {produto.ativo ? <ToggleRight className="w-6 h-6" /> : <ToggleLeft className="w-6 h-6" />}
                </button>
                <button onClick={() => abrirEditar(produto)} className="p-2 rounded-xl hover:bg-blue-50 text-blue-500 transition-all">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => excluir(produto)} className="p-2 rounded-xl hover:bg-red-50 text-red-500 transition-all">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
          {produtosFiltrados.length === 0 && (
            <div className="text-center py-16 text-gray-400">
              <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Nenhum produto encontrado</p>
            </div>
          )}
        </div>
      )}

      {/* Modal de produto */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end lg:items-center justify-center p-0 lg:p-6 animate-fade-in">
          <div className="bg-white dark:bg-gray-900 w-full lg:max-w-2xl lg:rounded-3xl rounded-t-3xl max-h-[95vh] overflow-y-auto">
            <div className="p-5 space-y-4">
              {/* Header */}
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">
                  {editando ? 'Editar Produto' : 'Novo Produto'}
                </h2>
                <button onClick={() => setShowForm(false)} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800">
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Nome */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Nome do produto *</label>
                <input
                  value={form.nome}
                  onChange={e => setForm(f => ({...f, nome: e.target.value}))}
                  placeholder="Ex: Pastel de Carne"
                  className="w-full bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                />
              </div>

              {/* Descrição */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Descrição</label>
                <textarea
                  value={form.descricao}
                  onChange={e => setForm(f => ({...f, descricao: e.target.value}))}
                  placeholder="Descrição breve do produto..."
                  rows={2}
                  className="w-full bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 resize-none"
                />
              </div>

              {/* Categoria */}
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Categoria</label>
                <select
                  value={form.categoria_id}
                  onChange={e => setForm(f => ({...f, categoria_id: e.target.value}))}
                  className="w-full bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                >
                  <option value="">Sem categoria</option>
                  {categorias.map(cat => (
                    <option key={cat.id} value={cat.id}>{cat.icone} {cat.nome}</option>
                  ))}
                </select>
              </div>

              {/* Preços */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Preço de Venda *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.preco_venda}
                      onChange={e => setForm(f => ({...f, preco_venda: e.target.value}))}
                      className="w-full bg-gray-100 dark:bg-gray-800 rounded-xl pl-9 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Preço de Custo</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">R$</span>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={form.preco_custo}
                      onChange={e => setForm(f => ({...f, preco_custo: e.target.value}))}
                      className="w-full bg-gray-100 dark:bg-gray-800 rounded-xl pl-9 pr-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    />
                  </div>
                </div>
              </div>

              {/* Tempo de preparo + código */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Tempo de Preparo (min)</label>
                  <input
                    type="number"
                    min="0"
                    value={form.tempo_preparo_min}
                    onChange={e => setForm(f => ({...f, tempo_preparo_min: e.target.value}))}
                    className="w-full bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Código Interno</label>
                  <input
                    value={form.codigo_interno}
                    onChange={e => setForm(f => ({...f, codigo_interno: e.target.value}))}
                    placeholder="Ex: PAST-001"
                    className="w-full bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
              </div>

              {/* Toggles */}
              <div className="space-y-3 bg-gray-50 dark:bg-gray-800 rounded-2xl p-4">
                <Toggle2 label="Enviar para produção" desc="Aparece no painel da cozinha" value={form.enviar_para_producao} onChange={v => setForm(f => ({...f, enviar_para_producao: v}))} />
                <Toggle2 label="Controlar estoque" desc="Alerta quando estoque baixar" value={form.controlar_estoque} onChange={v => setForm(f => ({...f, controlar_estoque: v}))} />
                <Toggle2 label="Produto ativo" desc="Aparece no cardápio" value={form.ativo} onChange={v => setForm(f => ({...f, ativo: v}))} />
              </div>

              {/* Estoque (se controlar) */}
              {form.controlar_estoque && (
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Estoque Atual</label>
                    <input
                      type="number"
                      min="0"
                      value={form.estoque_atual}
                      onChange={e => setForm(f => ({...f, estoque_atual: e.target.value}))}
                      className="w-full bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1.5">Estoque Mínimo</label>
                    <input
                      type="number"
                      min="0"
                      value={form.estoque_minimo}
                      onChange={e => setForm(f => ({...f, estoque_minimo: e.target.value}))}
                      className="w-full bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                    />
                  </div>
                </div>
              )}

              {/* Botões */}
              <div className="flex gap-3 pt-2">
                <button onClick={() => setShowForm(false)} className="flex-1 border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 font-semibold py-3.5 rounded-2xl transition-all active:scale-95">
                  Cancelar
                </button>
                <button
                  onClick={salvar}
                  disabled={salvando}
                  className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold py-3.5 rounded-2xl shadow-lg shadow-orange-500/20 active:scale-95 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {salvando ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                  {editando ? 'Salvar Alterações' : 'Criar Produto'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Toggle2({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-medium text-gray-900 dark:text-white">{label}</p>
        <p className="text-xs text-gray-400">{desc}</p>
      </div>
      <button
        onClick={() => onChange(!value)}
        className={`relative flex-shrink-0 transition-colors rounded-full ${value ? 'bg-orange-500' : 'bg-gray-300 dark:bg-gray-600'}`}
        style={{ width: 44, height: 24 }}
      >
        <div className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${value ? 'translate-x-5' : 'translate-x-0.5'}`} />
      </button>
    </div>
  )
}
