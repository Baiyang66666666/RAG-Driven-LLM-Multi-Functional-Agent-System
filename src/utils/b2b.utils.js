import { Tool } from "../ai/tools";
import { CloudflareAzureChatOpenAI } from "../ai/models";  // Assuming you're using this model for translation
import { formatDocumentsAsString } from "langchain/util/document";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { RunnablePassthrough } from "@langchain/core/runnables";
import { getStore } from "../controllers/glossaries.controller.js";
import {CloudflareVectorizeStore, CloudflareWorkersAIEmbeddings} from "@langchain/cloudflare";
import { tavily } from "@tavily/core";

export function generatePrompt( instruction, text, tone, format, length, language ) {
    // Default user instruction if none is provided
    let UserInstruction = instruction || "Please translate the text into Chinese, only send me the translation text:";
    let prompt;
    // Generate the style instructions (styleInstruction) if tone, format, or length is specified
    let styleInstruction = "";
    if (tone || format || length) {
        // If language is provided and it's not Chinese, add language context
        if (language) {
            styleInstruction += ` Please modify this text in ${language} and `;
        }
        if (tone) styleInstruction += `with a ${tone} tone`; // Add tone if available
        if (format) styleInstruction += `${tone ? "," : ""} in ${format} format`; // Add format with proper punctuation
        if (length) styleInstruction += `${tone || format ? "," : ""} and make it ${length}`; // Add length with proper punctuation
        const rules = "do not start with'请将文本翻译成中文' or 'please translate the text into Chinese' or similar words" ;
        prompt = `${styleInstruction} ${text}`;
    }
    // Combine the instruction, styleInstruction, and text
    else {
        prompt = `${UserInstruction} ${text}`;
    }
    
    // console.log("prompt", prompt);
    
    return prompt; // Return the generated prompt
}

export class TranslationTool extends Tool {
    constructor({ retriever, name, description, template, organization_slug, instruction, tone, format, length, language, text, env }) {
        super({ retriever, name, description, template, organization_slug, instruction, tone, format, length, language, text, env });
        this.env = env;
        this.retriever = {invoke: this.handleInvoke.bind(this)};
        this.organization_slug = organization_slug;
        this.instruction = instruction;
        this.tone = tone;
        this.format = format;
        this.length = length;
        this.language = language;
        this.text = text;


        // console.log("cons env", env);
    }

    // Core translation logic
    async handleInvoke(text) {
        const prompt = generatePrompt(this.instruction, this.text, this.tone, this.format, this.length, this.language);

        // const prompt = `${UserInstruction} ${text}`;

        // Model configuration
        const model = new CloudflareAzureChatOpenAI({
            azureOpenAIApiInstanceName: this.env.AZURE_OPENAI_API_INSTANCE_NAME,
            azureOpenAIApiKey: this.env.AZURE_OPENAI_API_KEY,
            azureOpenAIApiDeploymentName: this.env.AZURE_OPENAI_API_DEPLOYMENT_NAME,
            azureOpenAIApiVersion: this.env.AZURE_OPENAI_API_VERSION,
			configuration: {
				accountId: this.env.CF_ACCOUNT_ID,
				gatewayId: this.organization_slug
			}
        })

        const embeddings = new CloudflareWorkersAIEmbeddings({
            binding: this.env.AI,
            modelName: this.env.EMBEDDINGS_MODEL_NAME
        });

        // const store = await getStore(this.env, this.organization_slug);
        const store = new CloudflareVectorizeStore(embeddings, {
        	index: this.env.VECTORIZE_INDEX
        });
        const storeRetriever = store.asRetriever();

        const promptTemplate = PromptTemplate.fromTemplate(`Answer the question based only on the following context:
            {context}
            Question: {question}`);

        // Using a chain to generate translation results
        const chain = RunnableSequence.from([
            {
                context: storeRetriever.pipe(formatDocumentsAsString),
                question: new RunnablePassthrough({
                    run: async (input) => {
                        return typeof input === 'object' ? input.text || JSON.stringify(input) : input; 
                    }
                }),
            },
            promptTemplate,
            model,
        ]);

        // Execute the translation
        try {
            const res = await chain.invoke(prompt);
            return res.content;
        } catch (error) {
            console.error("Error during translation:", error);
            throw new Error("Translation failed");
        }
    }
}



export class WebSearchTool extends Tool {
    constructor({ env }) {
        super({
            name: "web_search",
            description: "Useful for when you need to answer questions about current events or the current state of the world. input should be a search query.",
            env: env
        });
        this.env = env;
        this.retriever = {invoke: this.handleInvoke.bind(this)};
    }

    async handleInvoke(input) {
        const tvly = new tavily({ apiKey: this.env.TAVILY_API_KEY });
        const model = new CloudflareAzureChatOpenAI({
            azureOpenAIApiInstanceName: this.env.AZURE_OPENAI_API_INSTANCE_NAME,
            azureOpenAIApiKey: this.env.AZURE_OPENAI_API_KEY,
            azureOpenAIApiDeploymentName: this.env.AZURE_OPENAI_API_DEPLOYMENT_NAME,
            azureOpenAIApiVersion: this.env.AZURE_OPENAI_API_VERSION,
			configuration: {
				accountId: this.env.CF_ACCOUNT_ID,
				gatewayId: "test-gateway" // need to change
			}
        })
        const promptTemplate = PromptTemplate.fromTemplate(`Please answer the user's question in Chinese based on the following search results:
        {context}
        Question: {question}`);
        try {
            const searchResults = await tvly.search({ query: input });
            console.log("web search results", searchResults);

            // Format search results as a string for the prompt
            let context = "";
            if (searchResults && searchResults.results && searchResults.results.length > 0) {
                for (const result of searchResults.results[0]) {
                    context += `Title: ${result.title}\nURL: ${result.url}\nContent: ${result.content}\n\n`;
                }
            } else {
                context = "No relevant search results found.";
            }

            const chain = RunnableSequence.from([
                {
                    context: () => context, // Pass the formatted context directly
                    question: new RunnablePassthrough({
                        run: async (input) => {
                            return typeof input === 'object' ? input.text || JSON.stringify(input) : input; 
                        }
                    }),
                },
                promptTemplate,
                model,
            ]);

            const res = await chain.invoke(input);
            return res.content;
        } catch (error) {
            console.error("Error during web search:", error);
            console.error("Tavily API error details:", error.response ? error.response.data : error.message);
            return `Error during web search: ${error.message}`;
        }
    }
}


