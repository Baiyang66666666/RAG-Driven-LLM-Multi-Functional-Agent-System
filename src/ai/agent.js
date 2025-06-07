import {hasMatchingText, renderTemplate} from "../utils/common.utils";
import {MAIN_PROMPT, PROMPT_INSTRUCTION, PROMPT_PREFIX, PROMPT_SUFFIX} from "./prompts";
import {json} from "itty-router";
import {AgentAction, baseOutputParser} from "./outputParser";


export class VivacityAgent {
	stop = ['\nObservation']
	chatHistory = ""
	toolRetriever = {}
	steps = []
	stepSimilarityLimit = 2
	question = null
	invalidActionMessage = `Invalid action: {{action}}, AI need to retry the process.`
	outputParser = baseOutputParser
	sourceDocuments = []


	constructor({llm, tools, history = null, stream, ctx, options, debug, promptContext = {}, prompt = {}, returnSourceDocuments = true}) {
		this.finalAnswerPrefix = "Final Answer: ";
		this.stream = stream
		this.history = history
		this.tools = tools
		this.llm = llm
		this.ctx = ctx
		this.debug = debug
		this.prompt = prompt
		this.promptContext = promptContext
		this.tools.forEach(tool => {
			this.toolRetriever[tool.name] = tool
		})

		this.returnSourceDocuments = returnSourceDocuments
		this.streamStarted = null

		if (stream) {
			const transformStream = new TransformStream()
			this.readable = transformStream.readable
			this.writer = transformStream.writable.getWriter()
			this.textEncoder = new TextEncoder()


			this.response = new Response(this.readable, {
				headers: {
					"Content-Type": "text/event-stream",
				}
			})
		}


	}

	toolsPrompt() {
		const tools = this.tools.map(tool => tool.prompt()).join("\n")
		const template = `{{ tools }}`
		const prompt = renderTemplate(template, {tools})
		const toolNames = Object.keys(this.toolRetriever)

		const toolsExample = this.tools.map(tool => tool.getExamples()).filter(item=>item && item.length).join("\n")


		return [prompt, toolNames, toolsExample]
	}

	promptTemplate(context, customPrompt = null) {
		const prompt = renderTemplate(MAIN_PROMPT, {
			prefix: PROMPT_PREFIX,
			instruction: PROMPT_INSTRUCTION,
			suffix: PROMPT_SUFFIX,
			...customPrompt
		})

		return renderTemplate(prompt, context)
	}

	async toolCalling(action, actionInput) {
		if (this.debug) {
			console.debug(`Tool calling: Action: ${action}, Action Input: ${actionInput}`)
		}

		const tool = this.toolRetriever[action]
		if (!tool) {
			return renderTemplate(this.invalidActionMessage, {action})
		}
		return await tool.retriever.invoke(actionInput)
		.then(result => {

            if (!Array.isArray(result)) {
                result = [result];
            }
				this.sourceDocuments = result
				const formatResult =  result.map(item => {
					if (tool.template) {
						return renderTemplate(tool.template, {...item, ...item.metadata})

					} else {
						return item.pageContent
					}
				}).join("\n")
				return `TOOL USED: ${action}; TOOL RESULT:\n${formatResult}`
			}).then((result) => {
				if (this.debug) {
					console.debug(`Tool calling result: ${result}`)
				}
				return result

			})
	}

	async updateSteps({action, actionInput, observation}) {
		const previousSteps = this.steps.slice(-this.stepSimilarityLimit)

		if(previousSteps.length  === this.stepSimilarityLimit){
			const duplicateSteps = previousSteps.every(item => item.action === action && item.actionInput === actionInput)
			if (duplicateSteps){
				 observation = `Similar steps taken in ${this.stepSimilarityLimit} consecutive times is not allowed, say you don't have information about your question`;
			}
		}


		this.steps.push({
			text:`Action: ${action}\nAction Input: ${actionInput}\nObservation: ${observation}`,
			actionInput,
			action,
			observation})


		return this.steps
	}

	async generate() {
		const [tools, toolNames, toolExamples] = this.toolsPrompt()
		const agentScratchPad = this.steps.map(item => item.text).join("\n")
		const promptContext = {
			tools,
			toolNames,
			toolExamples,
			agentScratchPad: agentScratchPad,
			question: this.question,
			chatHistory: this.chatHistory,
			...this.promptContext,
		}
		const prompt = this.promptTemplate(promptContext, this.prompt)

		if (this.debug) {
			console.debug("prompt", prompt)
		}

		const result = await this.llm.stream(prompt)

		let fullContent = ""
		let withFinalAnswer = false
		let hasStop = false
		let debugFullContent = ""


		for await (const chunk of result) {
			fullContent += chunk.content
			debugFullContent += chunk.content

			if (hasMatchingText(fullContent, this.stop)) {
				hasStop = true
				break
			}

			if (hasMatchingText(fullContent, [this.finalAnswerPrefix]) && !withFinalAnswer && this.stream) {
				withFinalAnswer = true
				fullContent = chunk.content
			}

			if (withFinalAnswer && this.stream) {
				if(!this.streamStarted){
					this.streamStarted = new Date()
				}

				await this.writer.write(this.textEncoder.encode(chunk.content))
			}
		}

		if(this.debug){
			console.debug("full content: ", debugFullContent)
		}

		if (hasStop || !withFinalAnswer || !this.stream) {
			const output = this.outputParser(fullContent, this.finalAnswerPrefix)
			if (output instanceof AgentAction) {

				const toolResult = await this.toolCalling(output.action, output.actionInput)

				await this.updateSteps({...output, observation: toolResult})
				return await this.generate()
			} else {
				return output
			}
		}

		if (withFinalAnswer) {
			if (this.history) {
				await this.history.insert(this.question, fullContent, this.streamStarted)
			}
			this.writer.close()
		}

	}


	async invoke(question, context = {}) {
		this.question = question
		if (this.history) {
			this.chatHistory = await this.history.template()
		}

		if (this.stream) {
			this.ctx.waitUntil((async () => {
				await this.generate()
			})())
			return this.response
		} else {
			const result = await this.generate()
			if (this.history) {
				await this.history.insert(this.question, result.output)
			}
			return json({output: result.output, ...(this.returnSourceDocuments && {sourceDocuments: this.sourceDocuments})})
		}
	}

}
