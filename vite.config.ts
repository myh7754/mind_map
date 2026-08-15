// vitest 설정(test 키)까지 타입이 맞으려면 vite가 아니라 vitest/config의
// defineConfig를 써야 한다. (vite의 UserConfig에는 test 키가 없다)
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  plugins: [react(), tailwindcss()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./src/test/setup.ts'],
  },
});
