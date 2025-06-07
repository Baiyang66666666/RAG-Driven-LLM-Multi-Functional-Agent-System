const chatCommonSchema = {
	"organization": {type: "string", minLength: 1},
	'user': {type: "string", minLength: 1}
}

export const chatSchema = {
	type: "object",
	properties: {
		"question": {type: "string"},
		"appid": {type: "string"},
		"language": {type: "string"},
		session: {type: 'string'},
		organization_slug: {type: "string"}
	},
	required: ['question', "appid", "language"]

}
