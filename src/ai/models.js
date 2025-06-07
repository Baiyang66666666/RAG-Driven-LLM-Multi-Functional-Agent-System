import {ChatOpenAI} from "@langchain/openai"
import {AzureOpenAI} from "openai"
import ModelClient from "@azure-rest/ai-inference";
import { AzureKeyCredential } from "@azure/core-auth";
import { BaseChatModel } from "@langchain/core/language_models/chat_models";

export class CloudflareAzureChatOpenAI extends ChatOpenAI {

	_getClientOptions(options) {
		const config = {
			azureOpenAIApiInstanceName: this.azureOpenAIApiInstanceName,
			apiKey: this.azureOpenAIApiKey,
			deployment: this.azureOpenAIApiDeploymentName,
			apiVersion: this.azureOpenAIApiVersion,
		}

		const customHeaders = {
			...(this.clientConfig.customCost && {"cf-aig-custom-cost": this.clientConfig.customCost}),
			...(this.clientConfig.customMetadata && {"cf-aig-metadata": this.clientConfig.customMetadata}),
		}

		const endpoints = `https://gateway.ai.cloudflare.com/v1/${this.clientConfig.accountId}/${this.clientConfig.gatewayId}/azure-openai/${config.azureOpenAIApiInstanceName}/${config.deployment}/chat/completions?api-version=${config.apiVersion}`;

		this.client = new AzureOpenAI({
			...config,
			endpoint: endpoints,
			defaultHeaders: {
				...customHeaders
			}
		});
		const requestOptions = {
			...this.clientConfig,
			...options,
		}
		requestOptions.headers = {
			"api-key": config.apiKey,
		};
		requestOptions.query = {
			"api-version": config.apiVersion,
		};
		return requestOptions;


	}

}

export class AzureAIInferenceLLM extends BaseChatModel {
	constructor(fields = {}) {
		super(fields);
		this.modelName = fields.modelName
		this.endpoint = fields.endpoint
		this.apiKey = fields.apiKey
		this.temprature = fields.temprature || 0.8;
		this.client = new ModelClient(this.endpoint, new AzureKeyCredential(this.apiKey));

	}

	_llmType() {
		return "azure-ai-inference";
	}

	async *_stream(prompt, options, runManager) {

		const response = await this.client.path("/chat/completions").post({
			body: {
				messages: [
					{ role: "system", content: "You are a helpful assistant." },
					{ role: "user", content: prompt },
				],
				max_tokens: options?.max_tokens || 2048,
				temperature: options?.temperature || 0.8,
				top_p: options?.top_p || 0.1,
				presence_penalty: options?.presence_penalty || 0,
				frequency_penalty: options?.frequency_penalty || 0,
				model: this.modelName,
				stream: true, // Enable streaming
			},
		}).asBrowserStream();
		const stream = response.body;

		if (response.status !== "200") {
			throw new Error(`Failed to get chat completions, http operation failed with ${response.status} code`);
		}
		const reader = response.body.getReader();
		const decoder = new TextDecoder();
		let buffer = "";

		try {
			while (true) {
				const { done, value } = await reader.read();
				if (done) break;

				buffer += decoder.decode(value, { stream: true });

				// Process each SSE event
				const parts = buffer.split("\n\n");
				buffer = parts.pop() || "";

				for (const part of parts) {
					const event = part.trim();
					if (!event) continue;

					try {
						const jsonStr = event.replace(/^data: /, "");

						if (jsonStr === "[DONE]") break;

						const data = JSON.parse(jsonStr);
						const content = data.choices[0]?.delta?.content || "";
						const finishReason = data.choices[0]?.finish_reason;

						if (content) {
							yield {
								content: content,
								message: data
							};
						}

						if (finishReason) break;
					} catch (err) {
						console.error("Error parsing event:", err);
					}
				}
			}
		} finally {
			reader.releaseLock();
		}

	}

	async _call(prompt, options) {

		const response = await this.client.path("/chat/completions").post({
			body: {
				messages: [
					{ role: "system", content: "You are a helpful assistant." },
					{ role: "user", content: prompt },
				],
				max_tokens: options?.max_tokens || 2048,
				temperature: this.temprature || 0.8,
				top_p: options?.top_p || 0.1,
				presence_penalty: options?.presence_penalty || 0,
				frequency_penalty: options?.frequency_penalty || 0,
				model: modelName,
			},
		});

		if (response.status !== 200) {
			throw new Error(response.body.error);
		}

		return response.body.choices[0].message.content;
	}
	stream(prompt, options) {
		return this._stream(prompt, options);
	}

	async invoke(input, options) {
		return this._call(input, options);
	}
}


