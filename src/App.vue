<script setup>
import { ref } from 'vue'
import ControlPanel from './components/ControlPanel.vue'

const theme = ref('dark')

function toggleThemes() {
	theme.value = theme.value === 'dark' ? 'cmyk' : 'dark';
	document.documentElement.setAttribute('data-theme', theme.value);
}
</script>

<template>
	<Suspense>
	<template #default>
		<main class="w-screen h-screen grid gap-4 p-4 justify-items-center items-center">

			<button @click="toggleThemes" class="absolute top-4 right-4">
				<v-icon name="md-darkmode" v-if="theme == 'cmyk'" />
				<v-icon name="md-lightmode" v-if="theme == 'dark'" />
			</button>

			<ControlPanel />
		</main>
	</template>
	<template #fallback>
		<h2>Loading...</h2>
	</template>
	</Suspense>
</template>

<style scoped lang="postcss">
</style>
