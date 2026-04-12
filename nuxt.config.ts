// https://nuxt.com/docs/api/configuration/nuxt-config
import tailwindcss from "@tailwindcss/vite";

const siteUrl = "https://devcongress.org";
const defaultTitle =
	"Devcongress | Where Africa’s tech talents learn, grow, and build the future of Africa";
const defaultDescription =
	"Devcongress is Africa’s home for tech talents — PMs, designers, engineers, marketers, legal advisors, and sales pros. Join cohorts, mentorship, and real-world launches that turn ideas into resilient technology businesses.";
const socialPreview = `${siteUrl}/images/devcongress-social-card.jpg`;
const defaultOgAlt =
	"Devcongress – community of Africa’s tech talents collaborating";

const organizationJsonLd = {
	"@context": "https://schema.org",
	"@type": "Organization",
	name: "Devcongress",
	url: siteUrl,
	logo: socialPreview,
	sameAs: [
		"https://twitter.com/devcongress",
		"https://github.com/devcongress",
		"https://www.linkedin.com/company/devcongress",
	],
	description:
		"Devcongress is a community helping Africa’s tech talents grow through mentorship, events, and collaborative programs.",
	contactPoint: [
		{
			"@type": "ContactPoint",
			contactType: "Community Support",
			email: "hello@devcongress.org",
		},
	],
};

export default defineNuxtConfig({
	compatibilityDate: "2025-07-15",
	devtools: { enabled: true },
	ssr: false,

	modules: ["@nuxt/image", "@nuxt/ui", "nuxt-lucide-icons"],
	css: ["~/assets/css/main.css"],

	runtimeConfig: {
		public: {
			siteUrl,
			socialPreview,
			defaultOgAlt,
		},
	},

	app: {
		baseURL: "/",
		buildAssetsDir: "assets",
		head: {
			title: defaultTitle,
			meta: [
				{ name: "description", content: defaultDescription },
				{
					name: "keywords",
					content:
						"Devcongress, African tech talent, developer community, tech events, mentorship, open source, Ghana tech, software engineering Africa",
				},
				{ name: "robots", content: "index, follow" },
				{ name: "theme-color", content: "#fb7185" },

				// Open Graph / Twitter defaults (route-specific tags are set in a plugin)
				{ property: "og:title", content: defaultTitle },
				{ property: "og:description", content: defaultDescription },
				{ property: "og:type", content: "website" },

				// Provide default image + size + alt
				{ property: "og:image", content: socialPreview },
				{ property: "og:image:width", content: "1200" },
				{ property: "og:image:height", content: "630" },
				{ property: "og:image:alt", content: defaultOgAlt },

				// Twitter mirrors
				{ name: "twitter:card", content: "summary_large_image" },
				{ name: "twitter:title", content: defaultTitle },
				{ name: "twitter:description", content: defaultDescription },
				{ name: "twitter:image", content: socialPreview },
			],

			// Canonical is set dynamically per route in the plugin (remove static one here)
			link: [
				// If you still load a web font via link, keep preconnects here.
				{ rel: "preconnect", href: "https://fonts.googleapis.com" },
				{
					rel: "preconnect",
					href: "https://fonts.gstatic.com",
					crossorigin: "",
				},
			],

			script: [
				{
					key: "ld-org",
					type: "application/ld+json",
					innerHTML: JSON.stringify(organizationJsonLd),
				},
			],
		},
	},
	nitro: {
		preset: "static",
	},

	vite: {
		plugins: [tailwindcss()],
	},
});
