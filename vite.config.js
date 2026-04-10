import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  const origin = (env.VITE_SITE_URL || '').replace(/\/$/, '')
  const ogImage = origin ? `${origin}/profile.png` : '/profile.png'

  return {
    plugins: [
      react(),
      {
        name: 'og-image-absolute-url',
        transformIndexHtml(html) {
          return html.replaceAll('content="/profile.png"', `content="${ogImage}"`)
        },
      },
    ],
  }
})
