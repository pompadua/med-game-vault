import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// BASE_PATH ใช้ตอน deploy ไป GitHub Pages (เช่น /med-game-vault/) ค่าเริ่มต้น './' ใช้ได้ทั้ง dev และ preview
export default defineConfig({
  base: process.env.BASE_PATH ?? './',
  plugins: [react()],
  server: { host: true },
});
