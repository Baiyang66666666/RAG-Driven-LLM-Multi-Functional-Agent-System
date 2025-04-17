import {AutoRouter, withContent, withParams, cors} from 'itty-router'
import GlossariesController from "./controllers/glossaries.controller.js";
import translateController from './controllers/translate.controller.js';
import {DataStoreController} from "./controllers/dataStore.controller";
import {AuthMiddleware, ChatB2CMiddleware, ChatMiddleware, SchemaValidator} from "./utils/app.middleware";
import {ChatController} from "./controllers/chat.controller";
import queueHandler from './queueHandler.js';

export {ChatHistory} from "./durables/chatHistory"
export {AIAgent} from "./durables/aiAgent"
import {withDurables} from 'itty-durable';
import {chatSchema} from "./schema/chat.schema";
import {ChatSessionController} from "./controllers/chatSession.controller";
import {AIAgentsController} from "./controllers/aiAgents.controller";
import {HistoriesController} from "./controllers/histories.controller";
import B2BDataStoreController from "./controllers/b2bdatastore.controller";
import {B2bChatController} from "./controllers/b2bChat.controller";
import {BenchmarkController} from "./controllers/benchmark.controller";

const {preflight, corsify} = cors()

const router = AutoRouter({
		before: [preflight],  // add preflight upstream
		finally: [corsify],
		base: "/cf-ai"
	}
)


router
	.all('*', withDurables({parse: true}))
	.all("*", AuthMiddleware)

	.all('/glossaries', withContent, withParams, GlossariesController)
	.all('/glossaries/:id', withContent, withParams, GlossariesController)
	.post('/translate', translateController)

	.post("/b2b/chat", withContent, B2bChatController)
	.post('/benchmark', withContent, BenchmarkController)
	.all('/b2b/data-stores', withContent, withParams, B2BDataStoreController)

	.all('/data-stores', withContent, withParams, DataStoreController)
	.all('/data-stores/:id', withContent, withParams, DataStoreController)
	.post('/chat', withContent, ChatB2CMiddleware, SchemaValidator(chatSchema), ChatMiddleware, ChatController)
	.post('/chat/sessions', withContent, ChatB2CMiddleware, ChatSessionController)
	.get('/chat/sessions', ChatB2CMiddleware, ChatSessionController)
	.delete('/chat/sessions', withContent, ChatB2CMiddleware, ChatSessionController)
	.put('/chat/sessions/:session', withContent, ChatB2CMiddleware, ChatSessionController)
	.get("/chat/sessions/:session/histories", withParams, ChatB2CMiddleware, HistoriesController)


	.all('/ai-agents', withContent, withParams, AIAgentsController)
	.all('/ai-agents/:id', withContent, withParams, AIAgentsController)


// Export a default object containing event handlers
export default {
	...router,
	async queue(message, env) {
		await queueHandler.queue(message, env);
	},
};


