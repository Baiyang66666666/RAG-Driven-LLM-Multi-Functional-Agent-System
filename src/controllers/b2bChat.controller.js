import {VivacityAgent} from "../ai/agent";
import {B2C_PREFIX} from "../utils/b2c.prompts";
import {TranslationTool, WebSearchTool} from "../utils/b2b.utils";
import {Tool} from "../ai/tools";
import {CloudflareVectorizeStore, CloudflareWorkersAIEmbeddings} from "@langchain/cloudflare";
import {CloudflareAzureChatOpenAI} from "../ai/models";
import {PROMPT_INSTRUCTION, PROMPT_PREFIX, PROMPT_SUFFIX} from "../ai/prompts";
import {B2B_PREFIX} from "../utils/b2b.prompts";
import {json} from "itty-router";
import {StatusError} from "itty-router";
import { generatePrompt } from "../utils/b2b.utils";



export const B2bChatController = async ({content}, env, ctx) => {

	const embeddings = new CloudflareWorkersAIEmbeddings({
		binding: env.AI,
		modelName: env.EMBEDDINGS_MODEL_NAME
	});

	const store = new CloudflareVectorizeStore(embeddings, {
		index: env.B2B_AI_INDEX
	});


	const translationTool = new TranslationTool({
		name: "translation",
		description: "Useful when you want to translate something,especially when the input text contains translate, or 翻译. and useful when need do text rephrase",
		retriever: null,
		organization_slug: content.organization_slug,
		instruction: content.instruction,
		tone: content.Tone,
		format: content.Format,
		length: content.Length,
		language: content.language,
		text: content.text,
		env: env
	})

	// const translationTool = new Tool({
	// 	name: "translation",
	// 	description: "Useful when you want to translate something.",
	// 	template: "{{pageContent}}"
	// })

	const knowledgeTool = new Tool({
		name: "knowledge_base",
		description: "Useful when you are ask with the general information of vivacity, when using this tool just provide the whole question.",
		retriever: store.asRetriever({k:2}),
		template: `
					# {{title}}

					**Description:**  
					{{description}}

					**Content:**  
					{{pageContent}}
					`
	})

	const webSearchTool = new WebSearchTool({env: env});
	

	const tools = [knowledgeTool, translationTool, webSearchTool];

	const llm = new CloudflareAzureChatOpenAI({
		azureOpenAIApiInstanceName: env.AZURE_OPENAI_API_INSTANCE_NAME,
		azureOpenAIApiKey: env.AZURE_OPENAI_API_KEY,
		azureOpenAIApiDeploymentName: env.AZURE_OPENAI_API_DEPLOYMENT_NAME,
		azureOpenAIApiVersion: env.AZURE_OPENAI_API_VERSION,
		configuration: {
			accountId: env.CF_ACCOUNT_ID,
			gatewayId: content.organization_slug
		}
	})


	const agent = new VivacityAgent({
		debug: true,
		stream: false,
		llm: llm,
		tools,
		ctx: ctx,
		prompt: {
			prefix: B2B_PREFIX
		},
	})

	// const payload = {
	// 	"websites": [],
	// 	"text": "help me to translate: Explore 140 New Walk - Premium Student Accommodation in Leicester Warm, private studio near the University of Leicester and De Montfort University Do you want to live in a modern place while also having a cozy second home that feels like home? You're in luck! 140-42 New Walk is just a short walk from Leicester City Centre, hidden in a quiet Victorian walkway - perfect for those wanting easy access to the city's hustle and bustle while having a comfortable spot they can call home. Surrounded by parks and entertainment venues, the accommodation is less than a mile from De Montfort University and the University of Leicester - literally, a great place for a walk.",
	// 	"instruction": "start translation with the date 26/09/2024",
	// 	"organization_slug": "test-gateway",
	// 	"userid": "123"
	// };

	let prompt;
	if (content.text.includes("please translate") || content.text.includes("请将文本翻译成中文") || content.Tone || content.Format || content.Length) {
 		prompt = generatePrompt(content.instruction, content.text, content.Tone, content.Format, content.Length, content.language)
	} else {
		prompt = content.text
	}
	console.log("prompt1111", prompt);

	return await agent.invoke(prompt)
	.then(async (result) => {
		const t = await result.json();
		console.log("t", t);
	
		// Prepare the response in a structured format
		let responseText = t.output;

		// Only append "Learn More" links if the tool is not the translation tool
		let relatedUrls = [];
		
		relatedUrls = t.sourceDocuments
			.map(doc => {
				console.log("Document metadata:", doc.metadata);
				return doc.metadata?.url;
			})
			.filter((url, index, self) => url && self.indexOf(url) === index);  // Remove duplicates
	

		// Append the "Learn More" section to the response text
		if (relatedUrls.length > 0) {
			responseText += "\n\n**Learn More**:\n" + relatedUrls.join("\n");
		}
		
		let db;
		try {
			db = env.DB;
		} catch (error) {
			console.error("Error connecting to database:", error);
			return new Response("Failed to connect to database", { status: 500 });
		}
		
		const dataToStore = {
			content: responseText,

			// tokenUsage: result.response_metadata.tokenUsage,
			
			tokenUsage: 1,
			prompt: prompt,
			organization_slug: content.organization_slug,
			userid: content.userid,
		};
		if(env.MY_QUEUE){
			console.log("D1");
			await env.MY_QUEUE.send(JSON.stringify(dataToStore)).catch(error => {
				console.error('Queue send error:', error);
			});
		}

	  return json({ text: responseText });
	})
	.catch((error) => {
	  console.error("Error during agent invocation:", error.message);
	  console.error("Full error object:", error);
	  throw new Error("Agent invocation failed.");
	});
  
};


