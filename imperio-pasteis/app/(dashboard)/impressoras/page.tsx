'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  Printer, Plus, Edit2, Trash2, X, Loader2, CheckCircle2,
  Server, Settings, Wifi
} from 'lucide-react'
import { toast } from 'sonner'
import type { Impressora } from '@/lib/types'

const FORM_INICIAL = {
  nome: '',
  setor: 'producao' as Impressora['setor'],
  tipo_conexao: 'rede' as Impressora['tipo_conexao'],
  endereco_ip: '',
  porta: '9100',
  largura_papel: '80mm' as Impressora['largura_papel'],
  corte_automatico: true,
  impressao_automatica: true,
  modo_teste: false,
  ativa: true
}

export default function ImpressorasPage() {
  const supabase = createClient()
  const [impressoras, setImpressoras] = useState<Impressora[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editando, setEditando] = useState<Impressora | null>(null)
  const [form, setForm] = useState(FORM_INICIAL)
  const [salvando, setSalvando] = useState(false)

  const carregar = useCallback(async () => {
    const { data } = await supabase.from('impressoras').select('*').order('nome')
    if (data) setImpressoras(data)
    setLoading(false)
  }, [])

  useEffect(() => { carregar() }, [carregar])

  function abrirNovo() {
    setEditando(null)
    setForm(FORM_INICIAL)
    setShowForm(true)
  }

  function abrirEditar(imp: Impressora) {
    setEditando(imp)
    setForm({
      nome: imp.nome,
      setor: imp.setor,
      tipo_conexao: imp.tipo_conexao,
      endereco_ip: imp.endereco_ip || '',
      porta: imp.porta ? imp.porta.toString() : '9100',
      largura_papel: imp.largura_papel,
      corte_automatico: imp.corte_automatico,
      impressao_automatica: imp.impressao_automatica,
      modo_teste: imp.modo_teste,
      ativa: imp.ativa
    })
    setShowForm(true)
  }

  async function salvar() {
    if (!form.nome.trim() || !form.endereco_ip.trim() || !form.porta) {
      toast.error('Nome, IP e Porta são obrigatórios')
      return
    }

    setSalvando(true)
    try {
      const payload = {
        nome: form.nome.trim(),
        setor: form.setor,
        tipo_conexao: form.tipo_conexao,
        endereco_ip: form.endereco_ip.trim(),
        porta: parseInt(form.porta),
        largura_papel: form.largura_papel,
        corte_automatico: form.corte_automatico,
        impressao_automatica: form.impressao_automatica,
        modo_teste: form.modo_teste,
        ativa: form.ativa
      }

      if (editando) {
        await supabase.from('impressoras').update(payload).eq('id', editando.id)
        toast.success('✅ Impressora atualizada!')
      } else {
        await supabase.from('impressoras').insert(payload)
        toast.success('✅ Impressora cadastrada!')
      }
      setShowForm(false)
      carregar()
    } catch (err: any) {
      toast.error(`Erro: ${err.message}`)
    } finally {
      setSalvando(false)
    }
  }

  async function excluir(imp: Impressora) {
    if (!confirm(`Excluir a impressora "${imp.nome}"?`)) return
    await supabase.from('impressoras').delete().eq('id', imp.id)
    toast.success('Impressora removida')
    carregar()
  }

  return (
    <div className="p-4 lg:p-6 space-y-5 animate-fade-in">
      <div className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Impressoras</h1>
          <p className="text-sm text-gray-500">Gerencie as impressoras térmicas ESC/POS</p>
        </div>
        <button
          onClick={abrirNovo}
          className="flex items-center gap-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold px-4 py-2.5 rounded-xl shadow-lg shadow-orange-500/20 active:scale-95 transition-all"
        >
          <Plus className="w-5 h-5" />
          <span className="hidden sm:inline">Nova</span>
        </button>
      </div>

      <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 p-4 rounded-2xl flex gap-3 text-sm text-blue-800 dark:text-blue-300">
        <Server className="w-5 h-5 flex-shrink-0" />
        <p>O gateway de impressão local deve estar rodando em um computador ou servidor na mesma rede das impressoras para enviar os comandos via porta 9100.</p>
      </div>

      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2].map(i => <div key={i} className="h-40 skeleton rounded-2xl" />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {impressoras.map(imp => (
            <div key={imp.id} className={`bg-white dark:bg-gray-900 rounded-2xl border p-5 ${imp.ativa ? 'border-gray-200 dark:border-gray-800' : 'border-gray-100 opacity-60'}`}>
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-xl ${imp.status === 'online' ? 'bg-emerald-100 text-emerald-600' : imp.status === 'erro' ? 'bg-red-100 text-red-600' : 'bg-gray-100 text-gray-500'}`}>
                    <Printer className="w-6 h-6" />
                  </div>
                  <div>
                    <h3 className="font-bold text-gray-900 dark:text-white flex items-center gap-2">
                      {imp.nome}
                      {imp.modo_teste && <span className="text-[10px] bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full uppercase tracking-wider">Simulação</span>}
                    </h3>
                    <p className="text-sm text-gray-500 flex items-center gap-1">
                      <Wifi className="w-3 h-3" /> {imp.endereco_ip}:{imp.porta}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-xs bg-gray-100 dark:bg-gray-800 px-2.5 py-1 rounded-lg font-medium text-gray-600 dark:text-gray-400 capitalize">
                    {imp.setor}
                  </span>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 mb-5">
                <Badge label={imp.largura_papel} active />
                <Badge label="Corte Auto" active={imp.corte_automatico} />
                <Badge label="Imp. Auto" active={imp.impressao_automatica} />
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-gray-100 dark:border-gray-800 pt-4">
                <button onClick={() => abrirEditar(imp)} className="p-2 hover:bg-blue-50 text-blue-500 rounded-xl transition-all">
                  <Edit2 className="w-4 h-4" />
                </button>
                <button onClick={() => excluir(imp)} className="p-2 hover:bg-red-50 text-red-500 rounded-xl transition-all">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-end lg:items-center justify-center p-0 lg:p-4 animate-fade-in">
          <div className="bg-white dark:bg-gray-900 w-full lg:max-w-lg rounded-t-3xl lg:rounded-3xl p-5 lg:p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100 dark:border-gray-800">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <Settings className="w-5 h-5" />
                {editando ? 'Editar Impressora' : 'Nova Impressora'}
              </h2>
              <button onClick={() => setShowForm(false)} className="p-2 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-sm font-medium mb-1.5">Nome de exibição</label>
                  <input
                    value={form.nome}
                    onChange={e => setForm(f => ({...f, nome: e.target.value}))}
                    placeholder="Ex: Cozinha 1"
                    className="w-full bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-1.5">Setor destino</label>
                  <select
                    value={form.setor}
                    onChange={e => setForm(f => ({...f, setor: e.target.value as any}))}
                    className="w-full bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  >
                    <option value="producao">Produção (Cozinha)</option>
                    <option value="caixa">Caixa (Recibos)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">Largura do Papel</label>
                  <select
                    value={form.largura_papel}
                    onChange={e => setForm(f => ({...f, largura_papel: e.target.value as Impressora['largura_papel']}))}
                    className="w-full bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400"
                  >
                    <option value="80mm">80mm</option>
                    <option value="58mm">58mm</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">Endereço IP (Rede local)</label>
                  <input
                    value={form.endereco_ip}
                    onChange={e => setForm(f => ({...f, endereco_ip: e.target.value}))}
                    placeholder="192.168.0.100"
                    className="w-full bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 font-mono"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium mb-1.5">Porta TCP</label>
                  <input
                    value={form.porta}
                    onChange={e => setForm(f => ({...f, porta: e.target.value}))}
                    placeholder="9100"
                    className="w-full bg-gray-100 dark:bg-gray-800 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-orange-400 font-mono"
                  />
                </div>
              </div>

              <div className="bg-gray-50 dark:bg-gray-800/50 rounded-2xl p-4 space-y-3">
                <Toggle label="Corte Automático" desc="Cortar papel após imprimir" 
                  value={form.corte_automatico} onChange={v => setForm(f => ({...f, corte_automatico: v}))} />
                <Toggle label="Impressão Automática" desc="Imprimir assim que pedido entrar" 
                  value={form.impressao_automatica} onChange={v => setForm(f => ({...f, impressao_automatica: v}))} />
                <Toggle label="Modo Simulação (Teste)" desc="Salva o cupom no BD mas não imprime" 
                  value={form.modo_teste} onChange={v => setForm(f => ({...f, modo_teste: v}))} />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button onClick={() => setShowForm(false)} className="flex-1 border-2 border-gray-200 dark:border-gray-700 font-semibold py-3.5 rounded-2xl">
                Cancelar
              </button>
              <button
                onClick={salvar}
                disabled={salvando}
                className="flex-1 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-bold py-3.5 rounded-2xl shadow-lg flex items-center justify-center gap-2"
              >
                {salvando ? <Loader2 className="w-5 h-5 animate-spin" /> : <CheckCircle2 className="w-5 h-5" />}
                Salvar Impressora
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Badge({ label, active }: { label: string, active: boolean }) {
  if (!active) return null
  return <span className="text-[10px] font-semibold bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300 px-2 py-1 rounded-md">{label}</span>
}

function Toggle({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
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
