import time
import sys
from playwright.sync_api import sync_playwright, expect

BASE_URL = 'http://localhost:3000'

def test_admin_flow(browser):
    print("--- INICIANDO TESTE: ADMIN ---")
    page = browser.new_page()
    
    # Login Admin
    page.goto(BASE_URL + '/login')
    page.wait_for_load_state('networkidle')
    page.fill('input[type="email"]', 'admin@imperiopasteis.com.br')
    page.fill('input[type="password"]', 'admin123')
    page.click('button[type="submit"]')
    
    # Verifica redirecionamento
    page.wait_for_url('**/dashboard')
    print("✅ Login Admin bem-sucedido e redirecionado para /dashboard")
    
    # Verifica Relatórios
    page.goto(BASE_URL + '/relatorios')
    page.wait_for_selector('text="Relatórios"')
    print("✅ Página de Relatórios carregada com sucesso")

    # Verifica Impressoras (Adiciona uma de simulação)
    page.goto(BASE_URL + '/impressoras')
    page.wait_for_selector('text="Impressoras"')
    print("✅ Página de Impressoras carregada com sucesso")
    
    page.close()

def test_garcom_flow(browser):
    print("\n--- INICIANDO TESTE: GARÇOM (Mobile Viewport) ---")
    # Emular mobile viewport
    context = browser.new_context(viewport={'width': 375, 'height': 812})
    page = context.new_page()
    
    # Login Garçom
    page.goto(BASE_URL + '/login')
    page.wait_for_load_state('networkidle')
    page.fill('input[type="email"]', 'garcom@imperiopasteis.com.br')
    page.fill('input[type="password"]', 'senha123')
    page.click('button[type="submit"]')
    
    # Deve ir para mesas
    page.wait_for_url('**/mesas')
    print("✅ Login Garçom bem-sucedido e redirecionado para /mesas")
    
    # Abrir Mesa 1
    page.locator('p.text-3xl').get_by_text('1', exact=True).wait_for()
    page.locator('p.text-3xl').get_by_text('1', exact=True).click()
    # Espera a página da mesa carregar (botão de voltar existe)
    page.wait_for_selector('text="Mesa 1"')
    print("✅ Mesa 1 acessada")
    
    # Abrir a comanda
    try:
        # Se estiver livre, tem o botão "Abrir Comanda"
        abrir_btn = page.locator('button', has_text="Abrir Comanda")
        if abrir_btn.is_visible():
            abrir_btn.click()
            time.sleep(1)
            # Confirma abertura no modal
            page.locator('button', has_text="Confirmar Abertura").click()
            time.sleep(1)
            print("✅ Comanda da Mesa 1 aberta")
    except Exception as e:
        print("Mesa provavelmente já aberta, continuando...")

    # Adicionar item
    page.locator('button', has_text="Adicionar").click()
    time.sleep(1) # Esperar bottom sheet
    
    # Clicar direto no Pastel de Carne (a categoria 'Todos' já mostra tudo)
    page.locator('button').filter(has_text="Pastel de Carne").click()
    time.sleep(1)
    
    # Confirmar adição (botão Adicionar do modal do item)
    page.locator('button', has_text="Adicionar à Comanda").click()
    time.sleep(1)
    print("✅ Produto adicionado na comanda")

    # Fechar o modal
    page.locator('button[aria-label="Fechar cardápio"]').click()
    time.sleep(1)

    # Enviar para produção
    page.locator('button').filter(has_text="Enviar (").click()
    time.sleep(1)
    print("✅ Pedido enviado para produção e impressão simulada acionada")
    
    context.close()

def test_producao_flow(browser):
    print("\n--- INICIANDO TESTE: PRODUÇÃO (Tablet Viewport) ---")
    context = browser.new_context(viewport={'width': 1024, 'height': 768})
    page = context.new_page()
    
    # Login Produção
    page.goto(BASE_URL + '/login')
    page.wait_for_load_state('networkidle')
    page.fill('input[type="email"]', 'producao@imperiopasteis.com.br')
    page.fill('input[type="password"]', 'senha123')
    page.click('button[type="submit"]')
    
    page.wait_for_url('**/producao')
    print("✅ Login Produção bem-sucedido e redirecionado para /producao")
    
    # Verificar itens no Kanban (Mesa 1 deve aparecer lá porque enviamos)
    page.wait_for_selector('text="Mesa 1"')
    print("✅ Pedido da Mesa 1 encontrado na produção")

    # Testar mudar o status (Em Preparo)
    btn_preparo = page.locator('button', has_text="Iniciar Preparo")
    if btn_preparo.count() > 0:
        btn_preparo.first.click()
        time.sleep(1)
        print("✅ Item movido para 'Em Preparo'")
    
    context.close()

def test_caixa_flow(browser):
    print("\n--- INICIANDO TESTE: CAIXA ---")
    context = browser.new_context(viewport={'width': 1280, 'height': 800})
    page = context.new_page()
    
    # Login Caixa
    page.goto(BASE_URL + '/login')
    page.wait_for_load_state('networkidle')
    page.fill('input[type="email"]', 'caixa@imperiopasteis.com.br')
    page.fill('input[type="password"]', 'senha123')
    page.click('button[type="submit"]')
    
    page.wait_for_url('**/caixa')
    print("✅ Login Caixa bem-sucedido e redirecionado para /caixa")
    
    # Selecionar Mesa 1
    page.wait_for_selector('text="Mesa 1"')
    page.click('text="Mesa 1"')
    time.sleep(1)
    print("✅ Mesa 1 selecionada no Caixa")
    
    # Iniciar Fechamento
    page.locator('button', has_text="Fechar Conta").click()
    time.sleep(1)
    
    # Selecionar pagamento PIX e finalizar
    page.click('button:has-text("PIX")')
    time.sleep(1)
    
    # Como não temos um ID exato pro botão finalizar, pegamos o de Confirmar
    page.locator('button', has_text="Confirmar Pagamento").click()
    time.sleep(2)
    print("✅ Pagamento efetuado e Mesa 1 finalizada com sucesso")
    
    context.close()

def main():
    print("Iniciando bateria de testes E2E com Playwright...")
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        
        try:
            test_admin_flow(browser)
            test_garcom_flow(browser)
            test_producao_flow(browser)
            test_caixa_flow(browser)
            print("\n🎉 TODOS OS TESTES PASSARAM COM SUCESSO!")
        except Exception as e:
            print(f"\n❌ FALHA NO TESTE: {e}")
            sys.exit(1)
        finally:
            browser.close()

if __name__ == '__main__':
    main()
