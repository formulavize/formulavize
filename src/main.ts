import { createApp } from "vue";
// @ts-expect-error: remove when vue3-tabs-component types are added
import { Tabs, Tab } from "vue3-tabs-component";
import App from "./App.vue";

createApp(App).component("tabs", Tabs).component("tab", Tab).mount("#app");
