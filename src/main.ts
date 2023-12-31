import { createApp } from 'vue'
//@ts-ignore
import { Tabs, Tab } from 'vue3-tabs-component';
import App from './App.vue'

createApp(App)
  .component('tabs', Tabs)
  .component('tab', Tab)
  .mount('#app')
