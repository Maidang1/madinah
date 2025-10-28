import type { Config } from "tailwindcss";
import { iconsPlugin, getIconCollections } from "@egoist/tailwindcss-icons";


export default {
	darkMode: "class",
	content: ["./app/**/{**,.client,.server}/**/*.{js,jsx,ts,tsx,mdx,md}"],
	theme: {
		extend: {
			colors: {
				main: {
					DEFAULT: "#2d2d2d",
					400: "#4a4a4a",
					500: "#2d2d2d",
					600: "#1a1a1a",
					700: "#0a0a0a",
				},
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
			// @ts-ignore
			collections: getIconCollections(["simple-icons", "simple-line-icons", "streamline-ultimate-color"])
		}),
		require("tailwindcss-animate")

	],
} satisfies Config;
