import { getStore } from "./glossaries.controller.js";
import { HttpResponseOutputParser } from "langchain/output_parsers";
import { PromptTemplate } from "@langchain/core/prompts";
import { RunnableSequence } from "@langchain/core/runnables";
import { formatDocumentsAsString } from "langchain/util/document";
import { RunnablePassthrough } from "@langchain/core/runnables";
import {StatusError} from "itty-router";
import {CloudflareAzureChatOpenAI} from "../ai/models";

const translateController = async (request, env, ctx) => {
    try {
        const { text, organization, organization_slug, instruction, Tone, Format, Length, language, streaming, userid } = await request.json();

        if (!text) {
            return new Response("Please provide 'text' in the request body", { status: 400 });
        }
		if(!organization_slug){
			return new Response("Please provide 'organization_slug' in the request body", { status: 400 });
		}

        const organizationName = organization_slug || "standard_apartments";
        let UserInstruction = instruction || "Please translate the text into Chinese, only send me the translation text:";

        let db;
        try {
            db = env.DB;
        } catch (error) {
            console.error("Error connecting to database:", error);
            return new Response("Failed to connect to database", { status: 500 });
        }

        // Fetch the organization instruction from the database
        try {
            const queryResult = await db.prepare(`
                SELECT Instructions FROM organization_instructions WHERE OrganizationName = ?
            `).bind(organizationName).first();

            if (queryResult && queryResult.Instructions) {
                UserInstruction = instruction ? `${instruction} Please translate the text:` : "Please translate the text";
            }
        } catch (error) {
            console.error('Error fetching instruction from DB:', error);
            return new Response("Failed to fetch instructions from database", { status: 500 });
        }


        const model = new CloudflareAzureChatOpenAI({
            azureOpenAIApiInstanceName: env.AZURE_OPENAI_API_INSTANCE_NAME,
            azureOpenAIApiKey: env.AZURE_OPENAI_API_KEY,
            azureOpenAIApiDeploymentName: env.AZURE_OPENAI_API_DEPLOYMENT_NAME,
            azureOpenAIApiVersion: env.AZURE_OPENAI_API_VERSION,
			configuration: {
				accountId: env.CF_ACCOUNT_ID,
				gatewayId: organization_slug
			}
        })

        // Get the already initialized store, set streaming
        const store = await getStore(env, organization_slug);
        const storeRetriever = store.asRetriever();

        const prompt_temp = PromptTemplate.fromTemplate(`Answer the question based only on the following context:
            {context}

            Question: {question}`);

        const chain = RunnableSequence.from([
            {
                context: storeRetriever.pipe(formatDocumentsAsString),
                question: new RunnablePassthrough(),
            },
            prompt_temp,
            model,
        ]);

        let prompt;

        // only transform the sentence style if any feature input, otherwise, translate the sentence
        // Create a combined instruction with tone, format, and length
        let styleInstruction = "";
        if (Tone || Format || Length) {
            prompt = `${text}`;
            styleInstruction += ` Please modify this text in the ${language} and `;
            if (Tone) {
                styleInstruction += `with a ${Tone} Tone`;
            }
            if (Format) {
                styleInstruction += `${Tone ? "," : ""} in ${Format} Format`;
            }
            if (Length) {
                styleInstruction += `${Tone || Format ? "," : ""} and make it ${Length}`;
            }
            prompt += styleInstruction;
            console.log(prompt);
        } else {
            prompt = `${UserInstruction} ${text}`;
            console.log(prompt);
        }

        // Check for update or delete commands in the text: update(source:target); delete(source or id). eg.update(apple:苹果)， delete(apple).
        const updateMatch = text.match(/update\(([^:]+):([^)]+)\)/);
        const deleteMatch = text.match(/delete\(([^)]+)\)/);

        if (updateMatch) {
            const source = updateMatch[1].trim();
            const target = updateMatch[2].trim();
            const documents = [{
                pageContent: `${source} means ${target} in Chinese`,
                metadata: {
                    type: "glossary",
                    organization_slug: organizationName
                },
            }];

            try {
                const query = `SELECT id FROM ${organizationName.toUpperCase()} WHERE OriginalWord = ?`;
                const queryResult = await db.prepare(query).bind(source).first();

                if (queryResult) {
                    // Update existing entry
                    const id = queryResult.id;
                    await store.addDocuments(documents, { ids: [`id${id}`] });
                    return new Response(`Entry with source '${source}' updated successfully`, { status: 200 });
                } else {
                    // Add new entry
                    await store.addDocuments(documents);
                    return new Response(`New entry with source '${source}' added successfully`, { status: 201 });
                }
            } catch (error) {
                console.error("Error updating or adding entry:", error);
                return new Response("Failed to update or add entry", { status: 500 });
            }
        } else if (deleteMatch) {
            const identifier = deleteMatch[1].trim();

            try {
                if (isNaN(identifier)) {
                    // identifier is a source word
                    const query = `SELECT id FROM ${organizationName.toUpperCase()} WHERE OriginalWord = ?`;
                    const queryResult = await db.prepare(query).bind(identifier).first();

                    if (queryResult) {
                        const id = queryResult.id;
                        await store.delete({ ids: [`id${id}`] });
                        return new Response(`Entry with source '${identifier}' deleted successfully`, { status: 200 });
                    } else {
                        return new Response(`No entry found for source '${identifier}'`, { status: 404 });
                    }
                } else {
                    // identifier is an id.
                    const id = `id${identifier}`;
                    await store.delete({ ids: [id] });
                    return new Response(`Entry with id '${identifier}' deleted successfully`, { status: 200 });
                }
            } catch (error) {
                console.error("Error deleting entry:", error);
                return new Response("Failed to delete entry", { status: 500 });
            }
        }

        // Process translation
        if (streaming) {
            // as the stream mode can not be used to track token, adding this has no affects on response speed
            const res_store = await chain.invoke(prompt).catch(err => {

			})

            // Send data to the queue without awaiting it
            const dataToStore = {
                content: res_store.content,
                tokenUsage: res_store.response_metadata.tokenUsage,
                prompt: prompt,
                organization_slug: organization_slug,
                userid: userid,
            };

			if(env.MY_QUEUE){
				await env.MY_QUEUE.send(JSON.stringify(dataToStore)).catch(error => {
					console.error('Queue send error:', error);
				});
			}
            const res = await chain.pipe(new HttpResponseOutputParser({ contentType: "text/event-stream" })).stream(prompt).catch(err => {   
				throw new StatusError(err.status, {"message": err.error})
			})

            return new Response(res, {
                headers: {
                    "Content-Type": "text/event-stream",
                    "Connection": "keep-alive",
                },
            });
        } else {
            const res = await chain.invoke(prompt).catch(err => {
				throw new StatusError(err.status, {"message": err.error})
			})

            // Send data to the queue without awaiting it
            const dataToStore = {
                content: res.content,
                tokenUsage: res.response_metadata.tokenUsage,
                prompt: prompt,
                organization_slug: organization_slug,
                userid: userid,
            };

			if(env.MY_QUEUE){
				await env.MY_QUEUE.send(JSON.stringify(dataToStore))
			}

            const content = res.content;
            return new Response(JSON.stringify(content), {
                headers: {
                    "Content-Type": "application/json"
                },
            });
        }
    } catch (error) {
		throw new StatusError(error.status || 500, {"message": error.message || "Internal Server Error"})
    }
};

export default translateController;
