import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// BASE_PATH ใช้ตอน deploy ไป GitHub Pages (เช่น /med-game-vault/) ค่าเริ่มต้น './' ใช้ได้ทั้ง dev และ preview
export default defineConfig({
  base: process.env.BASE_PATH ?? './',
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      includeAssets: ['icon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Med Game Vault',
        short_name: 'MedVault',
        description: 'คลังเกมการเรียนแพทย์ + ระบบทวน FSRS',
        lang: 'th',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#f6f7f9',
        theme_color: '#2557d6',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          { src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' },
        ],
      },
      workbox: {
        // precache ทุกอย่างรวมถึง chunk ของทุก pack → ใช้ offline ได้ทั้งคลัง
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  server: { host: true },
  build: {
    rolldownOptions: {
      output: {
        // แยก library ใหญ่ออกจากโค้ดแอป ให้ cache ได้นานและโหลดหน้าแรกเร็วขึ้น
        codeSplitting: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler)[\\/]/ },
            { name: 'data', test: /node_modules[\\/](dexie|dexie-react-hooks|zod|ts-fsrs)[\\/]/ },
          ],
        },
      },
    },
  },
});
