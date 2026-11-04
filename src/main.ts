import { createApp } from 'vue'
import App from './App.vue'
import { useAppStore } from './app/store'
import { requestPersist } from './storage/prefs'
import './styles/main.scss'

useAppStore()
  .init()
  .finally(() => {
    createApp(App).mount('#app')
    void requestPersist()
  })
