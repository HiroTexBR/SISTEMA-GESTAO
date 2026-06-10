'use client'

import { usePWAInstall } from '@/hooks/usePWAInstall'
import { X, Download, Share } from 'lucide-react'

export function InstallPWA() {
  const { canInstall, isInstalled, isIOS, promptInstall, dismissInstall } = usePWAInstall()

  if (isInstalled) return null

  if (!canInstall && !isIOS) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] p-4 animate-in slide-in-from-bottom-full duration-500">
      <div className="max-w-md mx-auto bg-surface-card border border-surface-border shadow-2xl rounded-2xl p-5 relative overflow-hidden" style={{ backgroundColor: 'var(--color-surface-card)' }}>
        
        {/* Close Button */}
        <button 
          onClick={dismissInstall}
          className="absolute top-3 right-3 p-2 rounded-full hover:bg-surface-bg transition-colors"
          style={{ color: 'var(--color-text-muted)' }}
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex gap-4 items-start">
          <div className="w-12 h-12 rounded-xl flex-shrink-0 flex items-center justify-center text-2xl shadow-sm border border-surface-border" style={{ background: 'var(--color-surface-bg)' }}>
            👑
          </div>
          
          <div className="flex-1">
            <h3 className="font-display font-bold text-[17px] mb-1" style={{ color: 'var(--color-text-main)' }}>
              Instalar Império Pastéis
            </h3>
            
            {canInstall && (
              <>
                <p className="text-[13px] leading-relaxed mb-4" style={{ color: 'var(--color-text-muted)' }}>
                  Instale o sistema no seu celular ou tablet para acessar mais rápido, como se fosse um aplicativo.
                </p>
                <div className="flex gap-3">
                  <button 
                    onClick={promptInstall}
                    className="flex-1 py-2.5 rounded-xl font-semibold text-[14px] flex items-center justify-center gap-2 transition-transform active:scale-95 text-white"
                    style={{ backgroundColor: 'var(--color-brand-accent)' }}
                  >
                    <Download className="w-4 h-4" />
                    Instalar App
                  </button>
                  <button 
                    onClick={dismissInstall}
                    className="px-4 py-2.5 rounded-xl font-medium text-[14px] transition-colors"
                    style={{ backgroundColor: 'var(--color-surface-bg)', color: 'var(--color-text-main)' }}
                  >
                    Agora não
                  </button>
                </div>
              </>
            )}

            {/* Fallback for iOS Safari */}
            {!canInstall && isIOS && (
              <>
                <p className="text-[13px] leading-relaxed mb-4" style={{ color: 'var(--color-text-muted)' }}>
                  Para instalar no iPhone: toque em <Share className="inline w-3 h-3 mx-1" /> Compartilhar e depois em <strong>Adicionar à Tela de Início</strong>.
                </p>
                <button 
                  onClick={dismissInstall}
                  className="w-full py-2.5 rounded-xl font-medium text-[14px] transition-colors"
                  style={{ backgroundColor: 'var(--color-surface-bg)', color: 'var(--color-text-main)' }}
                >
                  Entendi
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
