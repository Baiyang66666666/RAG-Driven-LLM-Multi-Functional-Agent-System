export class Tool {
	constructor({retriever, name, description, template, examples}) {
		this.name = name
		this.description = description
		this.retriever = retriever
		this.template = template
		this.examples = examples
	}

	prompt() {
		return `${this.name}: ${this.description}`
	}

	getExamples() {
		if (this.examples && this.examples.length && Array.isArray(this.examples)) {
			const examples = this.examples.reduce((acc, cur) => {
				acc.push(`Question: ${cur.question}\n${cur.answer}`)
				return acc;
			}, []).join("\n")

			return `## ${this.name} tool Thought, Action, Action Input examples: \n${examples}`
		}
	}
}

