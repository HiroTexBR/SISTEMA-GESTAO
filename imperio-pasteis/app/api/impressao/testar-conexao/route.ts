import { NextResponse } from 'next/server'
import * as net from 'net'

// Esta rota testa a conexão TCP com a impressora diretamente
// ATENÇÃO: Só funciona em ambiente Node.js (não Edge Runtime)
export const runtime = 'nodejs'

export async function POST(req: Request) {
  try {
    const { ip, porta } = await req.json()

    if (!ip || !porta) {
      return NextResponse.json({ ok: false, erro: 'IP e porta são obrigatórios' }, { status: 400 })
    }

    // Verificar formato do IP
    const ipRegex = /^(\d{1,3}\.){3}\d{1,3}$/
    if (!ipRegex.test(ip)) {
      return NextResponse.json({ ok: false, erro: 'IP inválido' }, { status: 400 })
    }

    // Testar conexão TCP
    const resultado = await testarConexaoTCP(ip, Number(porta))

    if (resultado.ok) {
      return NextResponse.json({ ok: true, tempo_ms: resultado.tempo_ms })
    } else {
      return NextResponse.json({ ok: false, erro: resultado.erro })
    }
  } catch (err: any) {
    return NextResponse.json({ ok: false, erro: err.message }, { status: 500 })
  }
}

function testarConexaoTCP(ip: string, porta: number): Promise<{ ok: boolean; tempo_ms?: number; erro?: string }> {
  return new Promise((resolve) => {
    const inicio = Date.now()
    const socket = new net.Socket()
    const timeout = 5000 // 5 segundos

    socket.setTimeout(timeout)

    socket.connect(porta, ip, () => {
      const tempo_ms = Date.now() - inicio
      socket.destroy()
      resolve({ ok: true, tempo_ms })
    })

    socket.on('timeout', () => {
      socket.destroy()
      resolve({ ok: false, erro: `Timeout: impressora não respondeu em ${timeout / 1000}s` })
    })

    socket.on('error', (err) => {
      resolve({ ok: false, erro: `Erro de conexão: ${err.message}` })
    })
  })
}
