import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatCurrency(value: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value)
}

export function formatDate(date: string | Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(new Date(date))
}

export function formatDateTime(date: string | Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

export function formatTime(date: string | Date): string {
  return new Intl.DateTimeFormat('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(date))
}

export function formatMinutes(minutes: number): string {
  if (minutes < 60) return `${Math.floor(minutes)}min`
  const h = Math.floor(minutes / 60)
  const m = Math.floor(minutes % 60)
  return `${h}h${m > 0 ? ` ${m}min` : ''}`
}

export function getStatusMesaColor(status: string): string {
  const colors: Record<string, string> = {
    livre: 'bg-emerald-500',
    ocupada: 'bg-red-500',
    aguardando_pagamento: 'bg-amber-500',
    em_preparo: 'bg-blue-500',
    inativa: 'bg-gray-400',
  }
  return colors[status] || 'bg-gray-400'
}

export function getStatusMesaLabel(status: string): string {
  const labels: Record<string, string> = {
    livre: 'Livre',
    ocupada: 'Ocupada',
    aguardando_pagamento: 'Aguard. Pgto',
    em_preparo: 'Em Preparo',
    inativa: 'Inativa',
  }
  return labels[status] || status
}

export function getStatusPedidoColor(status: string): string {
  const colors: Record<string, string> = {
    novo: 'bg-blue-500',
    em_preparo: 'bg-amber-500',
    pronto: 'bg-emerald-500',
    entregue: 'bg-gray-400',
    cancelado: 'bg-red-500',
  }
  return colors[status] || 'bg-gray-400'
}

export function getStatusPedidoLabel(status: string): string {
  const labels: Record<string, string> = {
    novo: 'Novo Pedido',
    em_preparo: 'Em Preparo',
    pronto: 'Pronto!',
    entregue: 'Entregue',
    cancelado: 'Cancelado',
  }
  return labels[status] || status
}

export function getStatusImpressaoLabel(status: string): string {
  const labels: Record<string, string> = {
    pendente: 'Pendente',
    imprimindo: 'Imprimindo...',
    impresso: 'Impresso ✓',
    falhou: 'Falha ✗',
    reimpressao_solicitada: 'Reimpressão',
    simulado: 'Simulado',
    teste_enviado: 'Teste Enviado',
  }
  return labels[status] || status
}

export function getStatusImpressaoColor(status: string): string {
  const colors: Record<string, string> = {
    pendente: 'text-amber-500',
    imprimindo: 'text-blue-500',
    impresso: 'text-emerald-500',
    falhou: 'text-red-500',
    reimpressao_solicitada: 'text-purple-500',
    simulado: 'text-gray-400',
    teste_enviado: 'text-teal-500',
  }
  return colors[status] || 'text-gray-400'
}

export function isAtrasado(criadoEm: string, minutosLimite = 20): boolean {
  const diff = (Date.now() - new Date(criadoEm).getTime()) / 60000
  return diff > minutosLimite
}
