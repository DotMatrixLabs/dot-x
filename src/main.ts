import { createApp } from "vue";
import App from "./App.vue";
import "./styles.css";
import Toast from "vue-toastification";
import "vue-toastification/dist/index.css";
import VueVirtualScroller from "vue-virtual-scroller";
import "vue-virtual-scroller/dist/vue-virtual-scroller.css";
// import { createPinia } from "pinia";

const toastOptions = {
  position: "bottom-right",
};

createApp(App)
//   .use(createPinia())
  .use(Toast, toastOptions)
  .use(VueVirtualScroller)
  .mount("#app");
