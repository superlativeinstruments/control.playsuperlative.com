<script setup>
import { ref } from 'vue'
import { useStorage } from '@vueuse/core'
import ControlPanel from './components/ControlPanel.vue'

const theme = useStorage('theme', 'dark')
document.documentElement.setAttribute('data-theme', theme.value);

function toggleThemes() {
	theme.value = theme.value === 'dark' ? 'cmyk' : 'dark';
	document.documentElement.setAttribute('data-theme', theme.value);
}
</script>

<template>
	<Suspense>
	<template #default>
		<main class="min-h-screen grid gap-4 p-4 py-12 justify-items-center items-center">

			<button @click="toggleThemes" class="fixed top-4 right-4">
				<v-icon name="md-darkmode" v-if="theme == 'cmyk'" />
				<v-icon name="md-lightmode" v-if="theme == 'dark'" />
			</button>

			<ControlPanel />
		</main>
	</template>
	<template #fallback>
		<main class="min-h-screen grid gap-4 p-4 py-12 justify-items-center items-center">
			<h2>Loading...</h2>
		</main>
	</template>
	</Suspense>
</template>

<style scoped lang="postcss">
</style>
