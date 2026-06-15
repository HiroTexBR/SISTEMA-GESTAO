/**
 * DIAGNÓSTICO DE IMPRESSORA USB — KP-IMP609
 *
 * Usa a API nativa do módulo 'usb' (v2+) diretamente,
 * sem depender do escpos-usb que tem incompatibilidade com Node.js v24.
 *
 * COMO USAR:
 *   cd gateway
 *   npm install
 *   node testar-usb.js
 */

const { getDeviceList } = require('usb')

console.log('\n🔍 Iniciando diagnóstico de impressora USB...\n')

// Comandos ESC/POS básicos
const ESC = 0x1B
const GS  = 0x1D
const LF  = 0x0A

function buildCupomTeste() {
  const agora = new Date().toLocaleString('pt-BR')
  const linhas = [
    '============================',
    '  TESTE DE IMPRESSAO USB   ',
    '============================',
    '',
    'Impressora: KP-IMP609',
    `Data/hora: ${agora}`,
    '',
    'Se voce ve este cupom,',
    'a impressora USB esta',
    'funcionando corretamente!',
    '',
    'Sistema Imperio Pasteis',
    '============================',
    '', '', '',
  ]
  const texto = linhas.join('\n') + '\n'

  const cmdInit    = Buffer.from([ESC, 0x40])          // inicializar
  const cmdCharset = Buffer.from([ESC, 0x74, 0x02])    // CP850 (PT-BR)
  const cmdCorte   = Buffer.from([GS, 0x56, 0x41, 0x00]) // corte total

  return Buffer.concat([
    cmdInit,
    cmdCharset,
    Buffer.from(texto, 'latin1'),
    cmdCorte,
  ])
}

// Encontrar impressora ESC/POS USB por classe ou Vendor conhecido
function encontrarImpressora() {
  const devices = getDeviceList()
  console.log(`📋 Total de dispositivos USB detectados: ${devices.length}`)

  // KP-IMP609 VendorID conhecido ou por classe PRINTER (0x07)
  const KP_VENDOR  = 0x0483
  const KP_PRODUCT = 0x5743

  // Tenta primeiro pelo VendorID/ProductID exato
  let impressora = devices.find(d =>
    d.deviceDescriptor.idVendor === KP_VENDOR &&
    d.deviceDescriptor.idProduct === KP_PRODUCT
  )

  // Fallback: qualquer dispositivo de classe impressora
  if (!impressora) {
    impressora = devices.find(d => {
      try {
        d.open()
        const intf = d.interface(0)
        const isImpr = intf.descriptor.bInterfaceClass === 0x07
        d.close()
        return isImpr
      } catch (_) {
        return false
      }
    })
  }

  return impressora
}

function enviarParaUSB(device, payload) {
  return new Promise((resolve, reject) => {
    try {
      device.open()
    } catch (e) {
      return reject(new Error(`Não foi possível abrir a impressora USB: ${e.message}`))
    }

    const intf = device.interface(0)

    // No Windows, pode ser necessário desanexar kernel driver
    try {
      if (intf.isKernelDriverActive()) {
        intf.detachKernelDriver()
      }
    } catch (_) { /* normal no Windows */ }

    try {
      intf.claim()
    } catch (e) {
      device.close()
      return reject(new Error(`Não foi possível reivindicar a interface USB: ${e.message}`))
    }

    // Encontrar endpoint de saída (OUT)
    const endpoint = intf.endpoints.find(ep => ep.direction === 'out')
    if (!endpoint) {
      intf.release(() => device.close())
      return reject(new Error('Endpoint de saída não encontrado na impressora USB'))
    }

    endpoint.transfer(payload, (err) => {
      intf.release(() => {
        try { device.close() } catch (_) {}
      })
      if (err) {
        reject(new Error(`Erro ao transferir dados USB: ${err.message}`))
      } else {
        resolve(true)
      }
    })
  })
}

async function main() {
  const impressora = encontrarImpressora()

  if (!impressora) {
    console.error('\n❌ Nenhuma impressora USB encontrada!')
    console.error('\n💡 Verifique:')
    console.error('   • A impressora KP-IMP609 está ligada?')
    console.error('   • O cabo USB está bem conectado?')
    console.error('   • No Gerenciador de Dispositivos, aparece sem erros?')
    process.exit(1)
  }

  const vid = impressora.deviceDescriptor.idVendor.toString(16).padStart(4, '0').toUpperCase()
  const pid = impressora.deviceDescriptor.idProduct.toString(16).padStart(4, '0').toUpperCase()
  console.log(`✅ Impressora encontrada! VendorID: 0x${vid}  ProductID: 0x${pid}`)
  console.log('\n🖨️  Enviando cupom de teste...\n')

  try {
    const payload = buildCupomTeste()
    await enviarParaUSB(impressora, payload)
    console.log('✅ Cupom de teste enviado com sucesso!')
    console.log('\n🎉 A impressora USB está funcionando!')
    console.log('\nPróximos passos:')
    console.log('  1. No sistema → Configurações → Impressoras')
    console.log('  2. Cadastre com Tipo de Conexão = "USB (cabo)"')
    console.log('  3. Inicie o gateway: node index.js')
  } catch (err) {
    console.error(`\n❌ Erro ao imprimir: ${err.message}`)
    console.error('\n💡 Possíveis soluções:')
    console.error('   • Reinicie a impressora e tente novamente')
    console.error('   • Verifique se o driver WinUSB/libusb está instalado')
    console.error('     (use Zadig: https://zadig.akeo.ie/ para instalar)')
    process.exit(1)
  }
}

main()
