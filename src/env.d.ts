/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<object, object, unknown>
  export default component
}

interface Navigator {
  audioSession?: { type: string }
  standalone?: boolean
}

declare const __APP_VERSION__: string
