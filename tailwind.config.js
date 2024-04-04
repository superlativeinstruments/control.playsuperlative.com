const defaultTheme = require('tailwindcss/defaultTheme')

module.exports = {
	mode: 'jit',
	content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
	daisyui: {
		themes: [
			{
				superlative: {
					'accent': '#cd7925',
					// 'accent': '#ccc',
					'neutral': '#333333',
					'base-100': '#202020',
					'--bc': '75% 0 0',
					'--rounded-box': '0.3rem',
					'--rounded-btn': '0.3rem',
					'--rounded-badge': '0.3rem',
					'--tab-radius': '0.3rem',
				},
				cmyk: {
					...require("daisyui/src/theming/themes")["cmyk"],
					'accent': '#000',
				},
				nord: {
					...require("daisyui/src/theming/themes")["nord"],
					'accent': '#000',
				},
				retro: {
					...require("daisyui/src/theming/themes")["retro"],
					// 'accent': '#fff',
					'accent': '#cd7925',
				},
				light: {
					...require("daisyui/src/theming/themes")["light"],
					// 'accent': '#fff',
					'accent': '#cd7925',
				},
				dark: {
					...require("daisyui/src/theming/themes")["dark"],
					// 'accent': '#fff',
					'accent': '#cd7925',
				},
			},
			'lofi',
		],
	},
	theme: {
		extend: {
			fontFamily: {
				'sans': ['SL-Regular', 'Roboto', ...defaultTheme.fontFamily.sans],
				'sans-condensed': ['SL-Regular-Condensed', 'Roboto\ Condensed', ...defaultTheme.fontFamily.sans],
				'music': ['Noto\ Music'],
			},
		},
	},
	plugins: [
		require('daisyui'),
		require('@tailwindcss/typography'),
		require('@tailwindcss/aspect-ratio'),
		require('@vueform/slider/tailwind'),
	],
}
