const { CloudflareVectorizeStore, CloudflareWorkersAIEmbeddings } = require("@langchain/cloudflare");

let store;
let storeInitialized = false; // Flag to track if store has been initialized
let db;

// Initialize embeddings and vector store
const initializeStore = async (env, organization) => {
    const embeddings = new CloudflareWorkersAIEmbeddings({
        binding: env.AI,
        modelName: env.EMBEDDINGS_MODEL_NAME
    });

    store = new CloudflareVectorizeStore(embeddings, {
        index: env.VECTORIZE_INDEX
    });
    db = env.DB;

    // Initialize embeddings and vector store
    let terms = [];
    let tableName = organization ? organization.toUpperCase() : 'STANDARD_APARTMENTS';

    try {
        const queryResults = await db.prepare(`
            SELECT id, OriginalWord, Translation FROM ${tableName}
        `).all();

        terms = queryResults.results;
    } catch (error) {
        console.error('Error fetching data from database:', error);
        throw new Error('Failed to fetch data from database');
    }

    // Adding data from a database to a vector store
    const documents = terms.map((term) => ({
        pageContent: `${term.OriginalWord} means ${term.Translation} in Chinese`,
        metadata: {},
    }));

    const ids = terms.map((term) => `id${term.id}`);

    try {
        await store.addDocuments(documents, { ids });
    } catch (error) {
        console.error('Error adding documents to vector store:', error);
        throw new Error('Failed to add documents to vector store');
    }

    // Set the flag to true once initialization is complete
    storeInitialized = true;

    // Return the initialized store
    return store;
};

const GlossariesController = async (request, env, ctx) => {
    try {
        // Initialize store if not already initialized
        if (!storeInitialized) {
            await initializeStore(env);
        }

        let requestData;
        try {
            requestData = await request.json();
        } catch (error) {
            return new Response("Invalid JSON in request body", { status: 400 });
        }

        // Get the method from the request header
        const method = request.method.toUpperCase();

        const { id, source, target, organization } = requestData;
        const organizationName = organization || "standard_apartments";

        if (method === "PUT") {
            try {

                const documents = [{
                    pageContent: `${source} means ${target} in Chinese`,
                    metadata: {
                        type: "glossary",
                        organization: organizationName
                    },
                }];
                await store.addDocuments(documents, { id });

                return new Response(`Entry with id '${id}' updated successfully`, { status: 200 });
            } catch (error) {
                console.error("Error processing database operation:", error);
                return new Response("Failed to process database operation", { status: 500 });
            }

        } else if (method === "DELETE") {
            try {
                if (id) {
                    console.log(`Deleting entry with id '${id}' from '${organizationName}'`);

                    // Delete document from vector store
                    await store.delete({ ids: ['id'] });

                    return new Response(`Entry with id '${id}' deleted successfully`, { status: 200 });
                } else {
                    return new Response("Missing 'id' parameter for DELETE method", { status: 400 });
                }
            } catch (error) {
                console.error("Error deleting entry from database:", error);
                return new Response("Failed to delete entry from database", { status: 500 });
            }
        }

        return new Response("Invalid method or missing id", { status: 400 });

    } catch (error) {
        console.error("Error in GlossariesController:", error);
        return new Response("Internal Server Error", { status: 500 });
    }
};

// Export store only after it has been initialized
const getStore = async (env) => {
    if (!storeInitialized) {
        await initializeStore(env);
    }
    return store;
};

export { getStore };

export default GlossariesController;
