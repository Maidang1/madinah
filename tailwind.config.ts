import type { Config } from "tailwindcss";
import { iconsPlugin, getIconCollections } from "@egoist/tailwindcss-icons";


export default {
	darkMode: "class",
	content: ["./app/**/{**,.client,.server}/**/*.{js,jsx,ts,tsx,mdx,md}"],
	safelist: ["max-w-[--reading-measure]"],
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
			spacing: {
				"stack-sm": "var(--space-stack-sm)",
				"stack-md": "var(--space-stack-md)",
				"stack-lg": "var(--space-stack-lg)",
				"inline-sm": "var(--space-inline-sm)",
				"inline-md": "var(--space-inline-md)",
				"inset-sm": "var(--space-inset-sm)",
				"inset-md": "var(--space-inset-md)",
			},
			maxWidth: {
				"reading-measure": "var(--reading-measure)",
			},
			fontSize: {
				body: ["var(--font-size-body)", { lineHeight: "var(--line-height-body)" }],
				"heading-lg": ["var(--font-size-heading-lg)", { lineHeight: "1.2" }],
			},
			lineHeight: {
				body: "var(--line-height-body)",
			},
			transitionDuration: {
				fast: "var(--transition-fast)",
			},
			transitionTimingFunction: {
				standard: "var(--ease-standard)",
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
