import {hasMatchingText} from "../utils/common.utils";

export class AgentFinish {
	constructor(output, text) {
		this.output = output
		this.text = text
	}
}

export class AgentAction {
	constructor(action, actionInput, thought, text) {
		this.action = action
		this.actionInput = actionInput
		this.text = text
	}
}

export const baseOutputParser = (text, finalAnswerPrefix) => {

	const actionPrefix = "Action: "
	const actionInputPrefix = "Action Input: "

	if (text.includes('Observation')) {
		text = text.split(/Observation/)[0]
	}
	const actionBlock = text.split("\n")

	const {action, actionInput, thought} = actionBlock.reduce((acc, cur) => {
		if (cur.includes(actionPrefix)) {
			acc['action'] = cur.trim().slice(actionPrefix.length)
		} else if (cur.includes(actionInputPrefix)) {
			acc['actionInput'] = cur.trim().slice(actionInputPrefix.length)
		}
		return acc;
	}, {});

	if (hasMatchingText(text, [finalAnswerPrefix])) {
		return new AgentFinish(text.split(/Final Answer:/).pop().trim(), text)


	} else if (action === 'Finish') {
		return new AgentFinish(actionInput, text)
	} else if(action) {
		return new AgentAction(action, actionInput, thought, text)
	}else {
		return new AgentFinish(text, text)
	}
}
