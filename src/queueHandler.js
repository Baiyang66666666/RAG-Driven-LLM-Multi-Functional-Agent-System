const dataStorage = async (content, tokenUsage, prompt, organization_slug, userid, db) => {
    try {
        if (!db) {
            throw new Error("Database connection is undefined");
        }
        // Extract tokenUsage specific values from the response_metadata object
        
        // const totalTokens = tokenUsage.totalTokens;
        // const promptTokens = tokenUsage.promptTokens;
        // const completionTokens = tokenUsage.completionTokens;
        const promptTokens = 1;
        const completionTokens = 2;
        const totalTokens = 3;
        // Get current timestamp
        const timestamp = new Date().toISOString();

        const query = `
            INSERT INTO usage_data (timestamp, userid, organization_slug, prompt, answer, totalTokens, promptTokens, completionTokens)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        await db.prepare(query).bind(timestamp, userid, organization_slug, prompt, content, totalTokens, promptTokens, completionTokens).run();

        console.log("Data stored successfully");
    } catch (error) {
        console.error("Error storing data:", error);
    }
};

const queueHandler = {
  async queue(batch, env) {
    try {
        
        for (const message of batch.messages){
            const body = JSON.parse(message.body)

            const { content, tokenUsage, prompt, organization_slug, userid } = body;
            let db = env.DB;
            
            await dataStorage(content,tokenUsage,prompt, organization_slug, userid, db);

        }
        console.log("Batch processed successfully");
    
    } catch (error) {
    console.error('Data storage error:', error);
    }
  },
};

export default queueHandler;
