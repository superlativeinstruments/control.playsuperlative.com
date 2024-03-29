const defaultTheme = require('tailwindcss/defaultTheme')

module.exports = {
	mode: 'jit',
	content: ['./index.html', './src/**/*.{vue,js,ts,jsx,tsx}'],
	daisyui: {
		themes: ['light', 'dark'], // enable theme switching
		// 	{
		// 		light: {
		// 			...require("daisyui/src/theming/themes")["[data-theme=light]"],
		// 			// 'primary': '#FF8383',
		// 		},
		// 		dark: {
		// 			...require("daisyui/src/theming/themes")["[data-theme=dark]"],
		// 			// 'primary': '#FF8383',
		// 			// 'secondary': '#9E97DA',
		// 			// 'accent': '#c48e4c',
		// 			// 'neutral': '#2a323c',
		// 			// 'base-100': '#1d232a',
		// 			// 'info': '#3abff8',
		// 			// 'success': '#36d399',
		// 			// 'warning': '#fbbd23',
		// 			// 'error': '#f87272',
		// 		}
		// 	}
		// ],
	},
	theme: {
		extend: {
			fontFamily: {
				'sans': ['Roboto', ...defaultTheme.fontFamily.sans],
				'sans-condensed': ['Roboto\ Condensed', ...defaultTheme.fontFamily.sans],
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
