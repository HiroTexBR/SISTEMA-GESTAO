/**
 * DIAGNÓSTICO DE IMPRESSORA USB — KP-IMP609
 *
 * Rode este script para verificar se a impressora USB está sendo
 * detectada corretamente antes de configurar pelo sistema.
 *
 * COMO USAR:
 *   cd gateway
 *   npm install
 *   node testar-usb.js
 */

console.log('\n🔍 Iniciando diagnóstico de impressora USB...\n')

// Verificar se escpos-usb está instalado
let escpos, EscPosUSB
try {
  escpos = require('escpos')
  escpos.USB = require('escpos-usb')
  EscPosUSB = escpos.USB
  console.log('✅ Biblioteca escpos-usb carregada com sucesso\n')
} catch (e) {
  console.error('❌ Erro ao carregar escpos-usb:', e.message)
  console.error('\n💡 Solução: Execute "npm install" dentro da pasta "gateway" e tente novamente.')
  process.exit(1)
}

// Listar impressoras USB disponíveis
let devices
try {
  devices = EscPosUSB.findPrinter()
} catch (e) {
  console.error('❌ Erro ao listar impressoras USB:', e.message)
  console.error('\n💡 Possíveis causas:')
  console.error('   • A impressora não está ligada')
  console.error('   • O cabo USB não está conectado')
  console.error('   • Driver USB não instalado (veja Gerenciador de Dispositivos)')
  process.exit(1)
}

if (!devices || devices.length === 0) {
  console.error('❌ Nenhuma impressora USB encontrada!')
  console.error('\n💡 Verifique:')
  console.error('   • A impressora KP-IMP609 está ligada? (verifique a luz de status)')
  console.error('   • O cabo USB está bem conectado no computador e na impressora?')
  console.error('   • No Gerenciador de Dispositivos, a impressora aparece sem erros?')
  process.exit(1)
}

console.log(`✅ ${devices.length} impressora(s) USB encontrada(s):\n`)
devices.forEach((d, i) => {
  console.log(`   [${i + 1}] VendorID: 0x${d.deviceDescriptor.idVendor.toString(16).padStart(4, '0').toUpperCase()}  ProductID: 0x${d.deviceDescriptor.idProduct.toString(16).padStart(4, '0').toUpperCase()}`)
})

console.log('\n🖨️  Tentando imprimir cupom de teste...\n')

const device = new EscPosUSB(devices[0])

device.open(function (err) {
  if (err) {
    console.error('❌ Erro ao abrir impressora USB:', err.message)
    console.error('\n💡 Isso pode acontecer se outro programa estiver usando a impressora.')
    console.error('   Feche o spooler de impressão do Windows ou reinicie a impressora.')
    process.exit(1)
  }

  const printer = new escpos.Printer(device)
  const agora = new Date().toLocaleString('pt-BR')

  printer
    .font('a')
    .align('ct')
    .style('bu')
    .size(1, 1)
    .text('============================')
    .text('  TESTE DE IMPRESSAO USB')
    .text('============================')
    .style('normal')
    .align('lt')
    .text('')
    .text('Impressora: KP-IMP609')
    .text(`Data/hora: ${agora}`)
    .text('')
    .align('ct')
    .text('Se voce ve este cupom,')
    .text('a impressora USB esta')
    .text('funcionando corretamente!')
    .text('')
    .text('Sistema Imperio Pasteis')
    .text('============================')
    .feed(3)
    .cut()
    .close(function () {
      console.log('✅ Cupom de teste impresso com sucesso!')
      console.log('\n🎉 Tudo certo! A impressora USB está funcionando.')
      console.log('\nPróximos passos:')
      console.log('  1. No sistema, vá em Configurações > Impressoras')
      console.log('  2. Cadastre a impressora com Tipo de Conexão = "USB"')
      console.log('  3. Inicie o gateway: node index.js')
    })
})
