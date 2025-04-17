import {json} from "itty-router";
import {CloudflareVectorizeStore, CloudflareWorkersAIEmbeddings} from "@langchain/cloudflare";
import { AzureOpenAIEmbeddings } from "@langchain/openai";
import {validateSchema} from "../utils/common.utils";
import {bulkDataStoreSchema, dataStoreSchema} from "../schema/dataStore.schema";

export const DataStoreController = async ({method, id, content}, env) => {
	const embeddings = new AzureOpenAIEmbeddings({
		azureOpenAIApiKey: env.B2C_EMBEDDINGS_API_KEY,
		azureOpenAIApiInstanceName: env.B2C_EMBEDDINGS_INSTANCE_NAME,
		azureOpenAIApiEmbeddingsDeploymentName: env.B2C_EMBEDDINGS_DEPLOYMENT_NAME,
		azureOpenAIApiVersion: env.B2C_EMBEDDINGS_VERSION,
		dimensions: 1536
	})

	const store = new CloudflareVectorizeStore(embeddings, {
		index: env.B2C_AI_INDEX
	});

	if (method === 'PUT' && id) {
		const valid = validateSchema(dataStoreSchema, content)

		if (valid) {
			const document = {
				pageContent: content.text,
				metadata: {...content.metadata, organization: content.organization}
			}
			const documents = [document]
			await store.addDocuments(documents, {ids: [id]});
			return json({"success": true, message: "data inserted successfully"})
		}
	} else if (method === 'DELETE' && id) {
		await store.delete({ids: [id]})
		return json({"success": true, message: "data deleted successfully"})
	} else if (method === 'POST') {
		const schemaIsArray = Array.isArray(content)
		const schema = schemaIsArray ? bulkDataStoreSchema : dataStoreSchema
		const valid = validateSchema(schema, content)

		if (valid) {
			const documents = [];
			const documentIds = [];

			if (schemaIsArray) {
				content.forEach((item) => {
					documents.push({
						pageContent: item.text,
						metadata: {...item.metadata, organization: item.organization}
					})
					documentIds.push(item._id)
				});

			} else {
				documents.push({
					pageContent: content.text,
					metadata: {...content.metadata, organization: content.organization}
				})
				documentIds.push(content._id)
			}
			await store.addDocuments(documents, {ids: documentIds});
			return  json({"success": true, message: `successfully inserted: ${documents.length} items`})
		}
	}

}
