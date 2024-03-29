<script setup>
import ControlPanel from './components/ControlPanel.vue'
</script>

<template>
	<Suspense>
	<template #default>
		<main class="w-screen h-screen grid gap-4 p-4 justify-items-center items-center">
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
