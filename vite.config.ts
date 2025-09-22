import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
export default defineConfig({
  base: '/rechnungsscanner/', // exakt dein Repo-Name
  plugins: [react()],
})
