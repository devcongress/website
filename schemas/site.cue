package schema

#Site: {
	community_slack_url!: =~"^https://"
	paystack_url!:        =~"^https://"
	youtube_embed_url!:   =~"^https://"
	stats!: [...#StatItem]
	socials!: [...#Social]
	roles!:   [...string]
	mission_section!: {
		eyebrow!:  string
		headline!: string
		body!:     string
		cta!:      string
		items!:    [...#MissionItem]
	}
	hero!: {
		eyebrow!:    string
		headline!:   string
		cta_primary!: {
			text!:  string
			color!: "pink" | "outline" | "white" | "yellow"
		}
		cta_secondary!: {
			text!:  string
			color!: "pink" | "outline" | "white" | "yellow"
		}
		video_label!: string
		video_live!:  string
	}
}

#Social: {
	platform!: "x" | "linkedin" | "github" | "website" | "youtube" | "instagram" | "facebook" | "discord" | "slack"
	url!:      =~"^https?://"
}

#StatItem: {
	value!:        string
	label!:        string
	description?:  string
}

#MissionItem: {
	heading!:     string
	description!: string
	stat!:        string
}
