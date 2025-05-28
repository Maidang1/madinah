import type { Config } from "tailwindcss";
import { iconsPlugin, getIconCollections } from "@egoist/tailwindcss-icons";


export default {
	darkMode: "class",
	content: ["./app/**/{**,.client,.server}/**/*.{js,jsx,ts,tsx,mdx,md}"],
	theme: {
		extend: {
			colors: {
				"primary": {
					DEFAULT: "#646cff",
					50: "#f0f1ff",
					100: "#e3e5ff", 
					200: "#cacfff",
					300: "#a8b0ff",
					400: "#818bff",
					500: "#646cff",
					600: "#5a5fcf",
					700: "#4a4fa3",
					800: "#3d4183",
					900: "#343869",
					950: "#21233e",
				},
				"primary-dark": "#5a5fcf",
				"primary-light": "#7b82ff",
				"purple": "#646cff",
			},
			fontFamily: {
				sans: [
					'"Inter"',
					"ui-sans-serif",
					"system-ui",
					"sans-serif",
					'"Apple Color Emoji"',
					'"Segoe UI Emoji"',
					'"Segoe UI Symbol"',
					'"Noto Color Emoji"',
				],
			},
		},
	},
	plugins: [
		require("@tailwindcss/typography"),
		iconsPlugin({
			collections: getIconCollections(["simple-icons", "simple-line-icons"])
		}),
		require("tailwindcss-animate")

	],
} satisfies Config;
