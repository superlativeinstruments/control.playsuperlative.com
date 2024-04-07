import fs from 'fs';
import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

// https://vitejs.dev/config/
export default defineConfig(({ command, mode, isSsrBuild, isPreview }) => {
	if (command === 'serve') {
		// Development
		return {
			plugins: [vue()],
			server: {
				host: '0.0.0.0',
				port: 443,
				strictPort: true,
				https: {
					key: fs.readFileSync('./certs/srv.key'),
					cert: fs.readFileSync('./certs/srv.crt'),
				},
				disableHostCheck: true,
			}
		};
	} else {
		// Build
		return {
			plugins: [vue()],
			host: 'control.playsuperlative.com',
			https: true,
		};
	}
});
