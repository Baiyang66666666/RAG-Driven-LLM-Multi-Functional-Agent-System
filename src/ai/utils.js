

export const retrieverParams = (dataType, organization = null) => {
	const filters = {"type": dataType}
	const k = 30

	if (organization && organization.length) {
		filters['organization'] = organization
	}

	return {filters, k}

}

export const cloneDeep = (data) => {
	return JSON.parse(JSON.stringify(data))

}

export const finalOutputParser = (finishOutput) => {

	const patterns = {
		building: {
			pattern: /FMTBLDG:(.*?):(.*?):(.*?):END/,
			replacement: '<div><property-link href="http://www.qq.com" data-miniprogram-appid="$1" data-miniprogram-path="/property/index?id=$2">$3</property-link></div>'
		},
		room: {
			pattern: /FMTRM:(.*?):(.*?):(.*?):END/,
			replacement: '<div><property-link href="http://www.qq.com" data-miniprogram-appid="$1" data-miniprogram-path="/property/index?id=$2">$3</property-link></div>'
		},
		enquiry: {
			pattern: /FMTINQ:(.*?):END/,
			replacement: '<div><property-link href="http://www.qq.com" data-miniprogram-appid="$1" data-miniprogram-path="/enquiry/index">Click Here</property-link></div>',
		}
	};
	for (let key in patterns) {
		if (patterns.hasOwnProperty(key)) {
			const value = patterns[key];
			finishOutput = finishOutput.replace(value.pattern, value.replacement);
		}
	}

	return finishOutput;
}

export const intents = {
	"nodes": [
		{
			"id": "welcome_intent",

			data: {
				"text": "I'm going to assist you today, What brings you to the MP?",
				"routes": [
					{
						"id": "1",
						"intent": "Browse around"
					},
					{
						"id": "2",
						"intent": "Interest to book"
					},
					{
						"id": "3",
						"intent": "Want to know more about a room"
					},
					{
						"id": "4",
						"intent": "Want to find out more about the building"
					}
				]
			}
		},
		{
			"id": "intent1",
			data: {
				"text": "What city you are interested?",
				action: "reply"
			}
		},
		{
			"id": "intent2",
			data: {
				text: "Which university you are interested?",
				action: "reply"
			}
		},
		{
			"id": "intent3",
			data: {
				"text": "Which building you interested?",
				action: "reply"
			}
		},
		{
			"id": "intent4",
			data: {
				"text": "Which building you interested?",
				action: "reply"
			}
		},
		{
			"id": "intent5",
			data: {
				text: "Show buildings data",
				action: "instruction"
			}
		},
		{
			"id": "intent6",
			data: {
				text: "Show Enquiry link",
				action: "instruction"
			}
		}
	],
	edges: [
		{"id": 'con1', source: "welcome_intent", target: "intent1", data: {route: 1}},
		{"id": 'con2', source: "welcome_intent", target: "intent2", data: {route: 2}},
		{"id": 'con3', source: "welcome_intent", target: "intent3", data: {route: 3}},
		{"id": 'con4', source: "welcome_intent", target: "intent4", data: {route: 4}},
		{"id": 'con5', source: "intent1", target: "intent5"},
		{"id": 'con6', source: "intent2", target: "intent6"}

	]
}


export const retrieverWithScore = ({store, topK = 20, filter, minSimilarityScore = 0}) => {

	return {
		invoke: (query) => store.similaritySearchWithScore(query, topK, filter).then((result)=>{
			return result.reduce(( acc, [item, score])=> {
				if(score >= minSimilarityScore){
					acc.push({...item, "__score": score})
				}
				return acc
			}, [])
		})
	}
}

