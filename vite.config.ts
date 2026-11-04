/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages 저장소 경로. https://yes-eul-jeong.github.io/timer-for-hwang/
const base = '/timer-for-hwang/'

export default defineConfig({
  base,
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: '땡',
        short_name: '땡',
        description: '체육관 바닥에 두고 보는 인터벌 타이머',
        lang: 'ko',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'portrait',
        background_color: '#0A0A0A',
        theme_color: '#0A0A0A',
        // 임시 아이콘. 아이콘 디자인이 정해지면 PNG(192, 512, maskable)로 바꾼다
        icons: [{ src: 'icon.svg', sizes: 'any', type: 'image/svg+xml' }],
      },
      workbox: {
        // 음성 파일과 글꼴까지 전부 미리 캐시해서 오프라인에서도 동작하게 한다
        globPatterns: ['**/*.{js,css,html,svg,png,woff2,m4a}'],
      },
    }),
  ],
  server: {
    port: 5173,
    strictPort: true,
  },
  test: {
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
  },
})
