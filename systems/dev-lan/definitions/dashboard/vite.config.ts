import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { nitro } from 'nitro/vite'

export default defineConfig({
  plugins: [
    tailwindcss(),
    tanstackStart({ srcDirectory: 'src' }),
    react(),
    nitro(),
  ],
})
