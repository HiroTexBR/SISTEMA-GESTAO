// Tipos do banco de dados
export type Cargo = 'admin' | 'caixa' | 'garcom' | 'producao'
export type StatusMesa = 'livre' | 'ocupada' | 'aguardando_pagamento' | 'em_preparo' | 'inativa'
export type StatusComanda = 'aberta' | 'aguardando_pagamento' | 'fechada' | 'cancelada'
export type StatusItem = 'pendente' | 'enviado' | 'em_preparo' | 'pronto' | 'entregue' | 'cancelado'
export type StatusPedido = 'novo' | 'em_preparo' | 'pronto' | 'entregue' | 'cancelado'
export type StatusImpressao = 'pendente' | 'imprimindo' | 'impresso' | 'falhou' | 'reimpressao_solicitada' | 'simulado' | 'teste_enviado'
export type TipoConexao = 'ethernet' | 'wifi' | 'bluetooth' | 'usb'
export type LarguraPapel = '58mm' | '80mm'
export type StatusImpressora = 'online' | 'offline' | 'erro' | 'nao_configurada'
export type SetorImpressora = 'producao' | 'caixa'
export type TipoDocumento = 'pedido_producao' | 'comanda_completa' | 'novos_itens' | 'recibo_final' | 'fechamento_caixa' | 'relatorio_diario' | 'teste_simples' | 'teste_completo' | 'teste_corte' | 'teste_acentuacao' | 'teste_largura'
export type ModoTeste = 'simulacao' | 'real'
export type FormaPagamento = 'dinheiro' | 'pix' | 'credito' | 'debito' | 'misto'
export type TipoMovimentacao = 'entrada' | 'saida' | 'ajuste' | 'cancelamento'

export interface Usuario {
  id: string
  nome: string
  email: string
  cargo: Cargo
  ativo: boolean
  avatar_url?: string
  criado_em: string
}

export interface Categoria {
  id: string
  nome: string
  icone?: string
  cor?: string
  ordem: number
  ativo: boolean
}

export interface Produto {
  id: string
  nome: string
  descricao?: string
  categoria_id?: string
  categoria?: Categoria
  preco_venda: number
  preco_custo: number
  foto_url?: string
  estoque_atual: number
  estoque_minimo: number
  controlar_estoque: boolean
  enviar_para_producao: boolean
  tempo_preparo_min: number
  codigo_interno?: string
  ativo: boolean
}

export interface Mesa {
  id: string
  numero: number
  descricao?: string
  capacidade: number
  status: StatusMesa
  ativa: boolean
  // joins
  comanda_ativa?: Comanda
}

export interface Comanda {
  id: string
  numero: number
  mesa_id?: string
  mesa?: Mesa
  cliente_nome?: string
  garcom_id?: string
  garcom?: Usuario
  status: StatusComanda
  subtotal: number
  desconto_reais: number
  desconto_percentual: number
  taxa_servico: number
  acrescimo: number
  total: number
  observacoes?: string
  aberta_em: string
  fechada_em?: string
  itens?: ComandaItem[]
}

export interface ComandaItem {
  id: string
  comanda_id: string
  produto_id?: string
  produto?: Produto
  nome_produto: string
  quantidade: number
  preco_unitario: number
  total: number
  observacao?: string
  status: StatusItem
  enviado_para_producao: boolean
  enviado_em?: string
  garcom_id?: string
  criado_em: string
}

export interface PedidoProducao {
  id: string
  numero: number
  comanda_id?: string
  mesa_id?: string
  mesa_numero?: number
  garcom_id?: string
  garcom_nome?: string
  status: StatusPedido
  status_impressao: StatusImpressao
  observacoes?: string
  criado_em: string
  aceito_em?: string
  preparo_em?: string
  pronto_em?: string
  entregue_em?: string
  itens?: PedidoItem[]
  minutos_espera?: number
}

export interface PedidoItem {
  id: string
  pedido_producao_id: string
  produto_id?: string
  nome_produto: string
  quantidade: number
  observacao?: string
}

export interface Impressora {
  id: string
  nome: string
  setor: SetorImpressora
  tipo_conexao: TipoConexao
  endereco_ip?: string
  porta: number
  dispositivo_bluetooth?: string
  largura_papel: LarguraPapel
  corte_automatico: boolean
  impressao_automatica: boolean
  modo_teste: boolean
  ativa: boolean
  status: StatusImpressora
  ultimo_teste_em?: string
  ultimo_erro?: string
}

export interface FilaImpressao {
  id: string
  tipo_documento: TipoDocumento
  comanda_id?: string
  pedido_producao_id?: string
  impressora_id?: string
  impressora?: Impressora
  conteudo: string
  status: StatusImpressao
  tentativas: number
  erro?: string
  modo_simulacao: boolean
  criado_em: string
  impresso_em?: string
}

export interface TesteImpressora {
  id: string
  impressora_id?: string
  impressora?: Impressora
  usuario_id?: string
  usuario?: Usuario
  tipo_teste: string
  modo: ModoTeste
  resultado: 'sucesso' | 'falhou' | 'pendente'
  conteudo_teste?: string
  erro?: string
  duracao_ms?: number
  criado_em: string
}

export interface Pagamento {
  id: string
  comanda_id: string
  forma_pagamento: FormaPagamento
  valor: number
  valor_recebido?: number
  troco: number
  observacao?: string
  criado_em: string
}

export interface Caixa {
  id: string
  usuario_id: string
  usuario?: Usuario
  status: 'aberto' | 'fechado'
  valor_inicial: number
  valor_final?: number
  total_dinheiro: number
  total_pix: number
  total_credito: number
  total_debito: number
  total_geral: number
  aberto_em: string
  fechado_em?: string
}

export interface EstoqueMovimentacao {
  id: string
  produto_id: string
  produto?: Produto
  tipo: TipoMovimentacao
  quantidade: number
  quantidade_anterior?: number
  quantidade_posterior?: number
  usuario_id?: string
  usuario?: Usuario
  observacao?: string
  criado_em: string
}

export interface DashboardResumo {
  vendas_hoje: number
  vendas_mes: number
  comandas_abertas: number
  comandas_fechadas_hoje: number
  ticket_medio_hoje: number
}
