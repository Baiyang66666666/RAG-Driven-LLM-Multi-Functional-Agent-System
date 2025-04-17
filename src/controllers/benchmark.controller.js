import {AzureOpenAIEmbeddings, ChatOpenAI} from "@langchain/openai";
import {benchmarkPrompts} from "../utils/benchmark.prompts";
import {json} from "itty-router";
import {CloudflareAzureChatOpenAI} from "../ai/models";
import {ChatGoogleGenerativeAI} from "@langchain/google-genai";
import {CloudflareVectorizeStore} from "@langchain/cloudflare";

export const BenchmarkController =async ({content, connection}, env)=> {
	// Log the content of the connection
	console.log("content", connection)

	// Initialize AzureOpenAIEmbeddings with environment variables
	const embeddings = new AzureOpenAIEmbeddings({
		azureOpenAIApiKey: env.B2C_EMBEDDINGS_API_KEY,
		azureOpenAIApiInstanceName: env.B2C_EMBEDDINGS_INSTANCE_NAME,
		azureOpenAIApiEmbeddingsDeploymentName: env.B2C_EMBEDDINGS_DEPLOYMENT_NAME,
		azureOpenAIApiVersion: env.B2C_EMBEDDINGS_VERSION,
		dimensions: 1536
	})

	// Initialize CloudflareVectorizeStore with the embeddings and index
	const store = new CloudflareVectorizeStore(embeddings, {
		index: env.B2C_AI_INDEX
	});

	// Declare variables for the language model (llm) and its name (llmName)
	let llm;
	let llmName;

	// Check the content.llm value and initialize the appropriate language model
	if(content.llm  === 'gpt4-with-ai-gateway'){
		llmName = "gpt4-with-ai-gateway"
		llm = new CloudflareAzureChatOpenAI({
			temperature: 0.2,
			azureOpenAIApiInstanceName: "vivacity-b2c-uk-south",
			azureOpenAIApiKey: "b1cb005e67bc4cea965a941872e20c82",
			azureOpenAIApiDeploymentName: 'downing-students',
			azureOpenAIApiVersion: "2024-08-01-preview",
			configuration: {
				accountId: "5ff5e53470602f594510405e2e07a620",
				gatewayId: 'downing-students',
			}
		})
	}else if(content.llm === 'gpt4o'){
		llmName = "gpt4o"
		llm = new ChatOpenAI({
			temperature: 0.2,
			azureOpenAIApiInstanceName: "vivacity-b2c-uk-south",
			azureOpenAIApiKey: "b1cb005e67bc4cea965a941872e20c82",
			azureOpenAIApiDeploymentName: "gpt-4o",
			azureOpenAIApiVersion: "2024-08-01-preview",
		})

	}else if(content.llm ==='gemini'){
		llmName = "gemini"
		 llm = new ChatGoogleGenerativeAI({
			model: "gemini-1.5-pro",
			temperature: 0.2,
			apiKey: ,

		});
	}else if(content.llm === 'gemini-ai-gateway'){
		llmName = "gemini-ai-gateway"
		llm = new ChatGoogleGenerativeAI({
			model: "gemini-1.5-pro",
			temperature: 0.2,
			apiKey: ,
			baseUrl: `https://gateway.ai.cloudflare.com/v1/5ff5e53470602f594510405e2e07a620/downing-students/google-ai-studio`,

		});
	}else{
		llmName = "gpt4"
		llm = new ChatOpenAI({
			temperature: 0.2,
			azureOpenAIApiInstanceName: "vivacity-b2c-uk-south",
			azureOpenAIApiKey: "b1cb005e67bc4cea965a941872e20c82",
			azureOpenAIApiDeploymentName: "downing-students",
			azureOpenAIApiVersion: "2024-08-01-preview",
		})
	}

	const started = new Date()
	let streamStarts = null
	const result = await llm.stream(benchmarkPrompts)

	let fullContent = ""
	for await (const chunk of result) {
		if(!streamStarts) streamStarts = new Date()
		fullContent += chunk.content

	}

	const ended = new Date()

	const fullDuration = ended - started

	const streamStartedAt = streamStarts - started


	const storageStarted = new Date()

	const filters = {
		organization: "619f769188dd84c30eb782cb"
	}

	await store.similaritySearchWithScore("down payment", 10, filters)

	const storageEnded = new Date()

	const fullDurationVector = storageEnded - storageStarted

	const data = {
		llm: content.llm,
		fullDuration: fullDuration,
		streamStartedAt,
		fullDurationVector,
		id: content.id,
		result: fullContent
	}

	await env.BENCHMARK.put(new Date().getTime(), JSON.stringify(data))

	return json({fullDuration, streamStartedAt, fullDurationVector, llmName})
}
