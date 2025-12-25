import type { Config } from "tailwindcss";
import { iconsPlugin, getIconCollections } from "@egoist/tailwindcss-icons";


export default {
	darkMode: "class",
	content: ["./app/**/{**,.client,.server}/**/*.{js,jsx,ts,tsx,mdx,md}"],
	theme: {
		extend: {
			colors: {
				parchment: "#F9F7F2",
				ink: {
					DEFAULT: "#0A0A0B",
					400: "#2D2D2D",
					500: "#1A1A1A",
					600: "#0A0A0B",
				},
				gold: "#D4AF37",
				"madinah-green": "#064E3B",
				emerald: "#10B981",
				main: {
					DEFAULT: "#0A0A0B",
					400: "#2D2D2D",
					500: "#1A1A1A",
					600: "#0A0A0B",
					700: "#050505",
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
