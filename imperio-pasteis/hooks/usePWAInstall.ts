'use client'

import { useState, useEffect } from 'react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed', platform: string }>
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [isInstalled, setIsInstalled] = useState(false)
  const [canInstall, setCanInstall] = useState(false)
  const [isDismissed, setIsDismissed] = useState(false)
  const [isIOS, setIsIOS] = useState(false)

  useEffect(() => {
    // Check if dismissed previously
    const dismissed = localStorage.getItem('pwa_install_dismissed')
    if (dismissed === 'true') {
      setIsDismissed(true)
    }

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true) {
      setIsInstalled(true)
    }

    // Detect iOS for fallback message
    const userAgent = window.navigator.userAgent.toLowerCase()
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent)
    setIsIOS(isIosDevice)

    // Listen for the install prompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setCanInstall(true)
    }

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)

    // Listen for successful installation
    const handleAppInstalled = () => {
      setIsInstalled(true)
      setDeferredPrompt(null)
      setCanInstall(false)
    }

    window.addEventListener('appinstalled', handleAppInstalled)

    // Service Worker Registration
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/service-worker.js')
        .then(registration => {
          console.log('Service Worker registrado com sucesso:', registration.scope)
        })
        .catch(error => {
          console.error('Falha ao registrar Service Worker:', error)
        })
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      window.removeEventListener('appinstalled', handleAppInstalled)
    }
  }, [])

  const promptInstall = async () => {
    if (!deferredPrompt) return

    await deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    
    if (outcome === 'accepted') {
      setCanInstall(false)
    }
    // We clear the prompt regardless of outcome as it can only be used once
    setDeferredPrompt(null)
  }

  const dismissInstall = () => {
    localStorage.setItem('pwa_install_dismissed', 'true')
    setIsDismissed(true)
    setCanInstall(false)
  }

  return {
    canInstall: canInstall && !isInstalled && !isDismissed,
    isInstalled,
    isIOS: isIOS && !isInstalled && !isDismissed,
    promptInstall,
    dismissInstall
  }
}
