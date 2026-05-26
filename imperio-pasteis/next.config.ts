import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Permitir importações de imagens externas (Supabase Storage)
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
        pathname: '/storage/**',
      },
    ],
  },

  // Headers de segurança e PWA
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]
  },

  // Ignorar erros de TypeScript em prod (temporário durante desenvolvimento)
  typescript: {
    ignoreBuildErrors: false,
  },

  // Módulos Node.js nativos (net) — suporte ao teste de conexão TCP
  serverExternalPackages: ['net'],
};

export default nextConfig;
