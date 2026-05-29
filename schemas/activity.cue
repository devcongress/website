package schema

import "strings"

#Activity: {
	title!:       strings.MinRunes(2)
	description!: strings.MinRunes(10)
	link?:        =~"^(https?://|/)"
	color!:       =~"^#[0-9a-fA-F]{6}$"
	order!:       int & >=1
	status!:      "active" | "ongoing" | "upcoming" | "completed"
}
