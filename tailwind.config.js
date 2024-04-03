const defaultTheme = require('tailwindcss/defaultTheme')

module.exports = {
	mode: 'jit',
	content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
	daisyui: {
		themes: [
			{
				superlative: {
					'accent': 'rgb(247, 171, 87)',
					// 'accent': '#fff',
					'neutral': '#333333',
					'base-100': '#202020',
					'--bc': '75% 0 0',
				}
			},
			'light',
			'dark',
		],
	},
	theme: {
		extend: {
			fontFamily: {
				'sans': ['Roboto', ...defaultTheme.fontFamily.sans],
				'sans-condensed': ['Roboto\ Condensed', ...defaultTheme.fontFamily.sans],
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
