import type { Config } from "tailwindcss";
import { iconsPlugin, getIconCollections } from "@egoist/tailwindcss-icons";


export default {
	darkMode: "class",
	content: ["./app/**/{**,.client,.server}/**/*.{js,jsx,ts,tsx,mdx,md}"],
	theme: {
		extend: {
			colors: {
				main: {
					DEFAULT: "#a18cd1",
					500: "#a18cd1",
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
			collections: getIconCollections(["simple-icons", "simple-line-icons"])
		}),
		require("tailwindcss-animate")

	],
} satisfies Config;
