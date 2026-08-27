import { createApp } from "vue";
import App from "./App.vue";
import "./styles.css";
import "vue-sonner/style.css";
import VueVirtualScroller from "vue-virtual-scroller";
import "vue-virtual-scroller/dist/vue-virtual-scroller.css";
import "@fortawesome/fontawesome-free/js/all";
import { createPinia } from 'pinia'

createApp(App)
  .use(createPinia())
  .use(VueVirtualScroller)
  .mount("#app");

