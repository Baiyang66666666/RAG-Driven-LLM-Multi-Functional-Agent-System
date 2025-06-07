import {CloudflareVectorizeStore} from "@langchain/cloudflare";
import {Tool} from "../ai/tools";
import {ChatHistory} from "../ai/history";
import {VivacityAgent} from "../ai/agent";
import {
	B2C_PREFIX,
	B2C_PROMPT_INSTRUCTION,
	CUSTOM_INSTRUCTIONS_PROMPT,
	CUSTOMER_SERVICE_PROMPT, FAQ_LINK_PROMPT, ROOM_TOOLS_EXAMPLES
} from "../utils/b2c.prompts";
import {renderTemplate} from "../utils/common.utils";
import {retrieverWithScore} from "../ai/utils";
import {AzureOpenAIEmbeddings, ChatOpenAI} from "@langchain/openai";
import {AzureAIInferenceLLM} from "../ai/models";


class Chat {
	constructor({env, stream = true, config, organization, ctx, promptContext = {}}) {
		this.embeddings = new AzureOpenAIEmbeddings({
			azureOpenAIApiKey: env.B2C_EMBEDDINGS_API_KEY,
			azureOpenAIApiInstanceName: env.B2C_EMBEDDINGS_INSTANCE_NAME,
			azureOpenAIApiEmbeddingsDeploymentName: env.B2C_EMBEDDINGS_DEPLOYMENT_NAME,
			azureOpenAIApiVersion: env.B2C_EMBEDDINGS_VERSION,
			dimensions: 1536
		})
		this.store = new CloudflareVectorizeStore(this.embeddings, {
			index: env.B2C_AI_INDEX
		});
		this.d1 = env.AIDB
		this.debug = env.DEBUG === 1
		this.stream = stream
		this.ctx = ctx
		this.promptContext = promptContext
		this.organization = organization
		this.config = config
		const organizationSlug = promptContext.organization_slug;

		const modelProvider = this.config?.metadata?.model_provider ?? 'openai';
		if(modelProvider === 'azure_openai'){
			const azureDeploymentName = this.config?.metadata?.azure_openai?.deployment_name ?? organizationSlug;
			const azureModelApiVersion = this.config?.metadata?.azure_openai?.api_version ?? env.B2C_AZURE_OPENAI_API_VERSION;
			const azureModelTemp = this.config?.metadata?.azure_openai?.temperature ?? env.B2C_LLM_TEMP;
			const azureModelInstanceName = this.config?.metadata?.azure_openai?.instance_name ?? env.B2C_AZURE_OPENAI_API_INSTANCE_NAME
			const azureModelApiKey = this.config?.metadata?.azure_openai?.api_key ?? env.B2C_AZURE_OPENAI_API_KEY

			this.llm = new ChatOpenAI({
				temperature: +azureModelTemp,
				azureOpenAIApiInstanceName: azureModelInstanceName,
				azureOpenAIApiKey: azureModelApiKey,
				azureOpenAIApiDeploymentName: azureDeploymentName,
				azureOpenAIApiVersion: azureModelApiVersion,
			})

		}else if(modelProvider === 'azure_foundry'){
			const endpoint = this.config?.metadata?.azure_foundry?.endpoint;
			const modelName = this.config?.metadata?.azure_foundry?.model_name;
			const apiKey = this.config?.metadata?.azure_foundry?.api_key;
			const temp = this.config?.metadata?.azure_foundry?.temperature;

			this.llm = new AzureAIInferenceLLM({
				endpoint,
				modelName,
				apiKey,
				temperature: +temp,
			})
		}



	}

	buildingTool() {
		const retriever = retrieverWithScore({
			store: this.store,
			topK: 20,
			filter: {type: "building", organization: this.organization},
			minSimilarityScore: 0
		})

		return new Tool({
			name: "building_list",
			description: "Useful on questions that are related to city, building information and building booking information",
			retriever: retriever,
			template: "PROPERTY_ID: {{_id}}; {{pageContent}}"
		})
	}

	roomTool() {
		const retriever = retrieverWithScore({
			store: this.store,
			topK: 20,
			filter: {type: "room", organization: this.organization},
			minSimilarityScore: 0,
		})
		return new Tool({
			name: "room_list",
			description: "Useful on questions that are related to building rooms information, you can also directly check here the room price and room area, city",
			retriever: retriever,
			template: "ROOM_ID: {{_id}}; {{pageContent}}",
			examples: ROOM_TOOLS_EXAMPLES
		})
	}

	faqTool() {
		const retriever = retrieverWithScore({
			store: this.store,
			topK: 10,
			filter: {type: "faq", organization: this.organization},
			minSimilarityScore: 0
		})

		return new Tool({
			name: "FAQ",
			description: "These are data that Frequent Asked Questions, you need to check the question here first, before other tools.",
			retriever: retriever,
			template: "FAQ_ID: {{_id}}, QUESTION: {{pageContent}}, ANSWER: {{answer}}"
		})
	}


	facilityTool() {

		const retriever = retrieverWithScore({
			store: this.store,
			topK: 20,
			filter: {type: "facility", organization: this.organization},
			minSimilarityScore: 0
		})

		return new Tool({
			name: "facility_list",
			description: "Useful when asked about the facilities of a city, building like gym, game room, study lounge and many more. Best if you can provide the facility name, city name or building name as parameters for the tool",
			retriever: retriever,
			template: "{{pageContent}}"
		})
	}

	universityTool() {
		const retriever = retrieverWithScore({
			store: this.store,
			topK: 20,
			filter: {type: "university", organization: this.organization},
			minSimilarityScore: 0
		})

		return new Tool({
			name: "university_list",
			description: `Useful on questions that are related to building university/colleges, best if you provide the Building Name or a City Name`,
			retriever: retriever,
			template: "Property id: {{model}}, pageContent: {{pageContent}}, School: {{name}} driving:{{driving}}, driving:{{driving}}, walking:{{walking}}, bicycle: {{bicycling}}"
		})
	}


	async ask(question, historyKey) {
		let FAQ = ""
		let FAQ_LINK = ""
		const buildingTool = this.buildingTool()
		const roomTool = this.roomTool()
		const faqTool = this.faqTool()
		const facilityTool = this.facilityTool()
		const universityTool = this.universityTool()
		const chatHistory = new ChatHistory(historyKey, this.d1, new Date())

		const tools = [buildingTool, roomTool, facilityTool, universityTool]
		if (this.config.include_faq === true) {
			FAQ_LINK = FAQ_LINK_PROMPT
			tools.push(faqTool)
		}

		let customerService = ""
		if (this.config.cs_transfer === true) {
			let csTransferValue = ""

			if (this.config.cs_transfer_value === 'wechat') {
				csTransferValue = "此类问题麻烦联系公寓咨询哦~ 请联系我们的 @[customer-service](客服)"
			} else if (this.config.cs_transfer_value === 'wecom') {
				csTransferValue = "此类问题麻烦联系公寓咨询哦~ 请联系我们的 @[customer-wecom](客服)"
			} else if (this.config.cs_transfer_value === 'qrcode' && this.config.cs_qrcode && this.config.cs_qrcode.length) {
				csTransferValue = `此类问题麻烦联系公寓咨询哦~ 请联系我们的客服 @[qrcode]`
			}
			if (csTransferValue && csTransferValue.length) {
				customerService = renderTemplate(CUSTOMER_SERVICE_PROMPT, {csTransferValue})
			}
		}

		let emoji = "";
		let tone = "";

		if (this.config?.metadata?.enable_emoji === true) {
			emoji += "FINAL ANSWER WITH EMOJI: YES"
		}

		if (this.config?.metadata?.tone && this.config?.metadata?.tone.length) {
			tone = `FINAL ANSWER TONE: ${this.config.metadata.tone}`

		}

		let customInstruction = "";
		if (this.config.instructions && this.config.instructions.length) {
			customInstruction = renderTemplate(CUSTOM_INSTRUCTIONS_PROMPT, {instructions: this.config.instructions})
		}

		let cities = "";
		if (this.config.cities && this.config.cities.length) {
			cities += "Available Cities with building or apartments: "
			cities += this.config.cities.map(item => item?.name?.en || item.shortname).filter(item => item).join(", ")
		}

		const agent = new VivacityAgent({
			debug: this.debug,
			stream: this.stream,
			llm: this.llm,
			history: chatHistory,
			tools,
			ctx: this.ctx,
			promptContext: {
				...this.promptContext,
				customerService,
				customInstruction,
				cities,
				emoji: emoji,
				tone: tone,
				FAQ_LINK
			},
			prompt: {prefix: B2C_PREFIX, instruction: B2C_PROMPT_INSTRUCTION},
			returnSourceDocuments: false
		})

		return agent.invoke(question)

	}

}

export const ChatController = async ({query, content, method, chatSession, organization}, env, ctx) => {

	const historyKey = chatSession.session;
	const chat = new Chat({
		env,
		stream: content.stream === true,
		organization: organization,
		ctx,
		debug: true,
		config: chatSession.agent,
		promptContext: {
			language: content.language || "zh-hans",
			instructions: chatSession?.agent?.instructions,
			organization_slug: content.organization_slug
		}
	})

	return chat.ask(content.question, historyKey)
}




