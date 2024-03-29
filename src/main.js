import { createApp } from 'vue'
import { OhVueIcon, addIcons } from 'oh-vue-icons'
import './style.css'
import App from './App.vue'

import {
	MdUsb,
} from 'oh-vue-icons/icons'

addIcons(
	MdUsb,
)

const appHeight = () => {
    document.documentElement.style.setProperty('--app-height', `${window.innerHeight}px`)
}

window.addEventListener('resize', appHeight)

appHeight()

const app = createApp(App)

app.component('v-icon', OhVueIcon);

app.mount('#app')
