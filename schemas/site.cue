package schema

#Site: {
	community_slack_url!: =~"^https://"
	paystack_url!:        =~"^https://"
	youtube_embed_url!:   =~"^https://"
	stats!: {
		members!:  string
		hired!:    string
		events!:   string
		mentored!: string
	}
	socials!: [...#Social]
	roles!:   [...string]
	mission!: [...#MissionItem]
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

#MissionItem: {
	heading!:     string
	description!: string
	stat!:        string
}
