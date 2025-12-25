import type { Config } from "tailwindcss";
import { iconsPlugin, getIconCollections } from "@egoist/tailwindcss-icons";


export default {
	darkMode: "class",
	content: ["./app/**/{**,.client,.server}/**/*.{js,jsx,ts,tsx,mdx,md}"],
	theme: {
		extend: {
			colors: {
				parchment: "#FFFFFF",
				ink: {
					DEFAULT: "#000000",
					400: "#404040",
					500: "#262626",
					600: "#000000",
				},
				gold: "#000000",
				"madinah-green": "#000000",
				emerald: "#000000",
				main: {
					DEFAULT: "#000000",
					400: "#404040",
					500: "#262626",
					600: "#000000",
					700: "#000000",
				},
			},
			fontFamily: {
				display: ['"Fraunces"', "serif"],
				sans: [
					'"Instrument Sans"',
					"ui-sans-serif",
					"system-ui",
					"sans-serif",
				],
				mono: ['"Commit Mono"', "monospace"],
			},
		},
	},
	plugins: [
		require("@tailwindcss/typography"),
		iconsPlugin({
			// @ts-ignore
			collections: getIconCollections(["simple-icons", "simple-line-icons", "streamline-ultimate-color"])
		}),
		require("tailwindcss-animate")

	],
} satisfies Config;
