import { CheerioWebBaseLoader } from "langchain/document_loaders/web/cheerio";
import {CloudflareVectorizeStore, CloudflareWorkersAIEmbeddings} from "@langchain/cloudflare";
import { v4 as uuidv4 } from 'uuid';
import { json } from "itty-router";
// to update links, write links in 'websites' parameter, it will add links in D1 and embeddings with metadata(url) in Vectorize
// To delete links, choose DELETE method, and write links in 'websites' parameter, it will delete in database and return fixed message when it is retrieved again.

const B2BDataStoreController = async (request, env, ctx) => {
    let newWebsites;
    try{
        // Parse the JSON body from the request
        let requestBody;
        try {
            requestBody = await request.json();
        } catch (error) {
            return new Response("Invalid JSON in request body", { status: 400 });
        }
        // Extract relevant fields from the JSON body
        const { websitesParam, id, group } = requestBody;

        // Fetch existing URLs from the database
        let db = env.VIVADB;
        let existingUrls = [];
        //if we need to generate ids for each document, we can use the following code
        // const documentIds = docs.map(() => uuidv4());
        try {
            const result = await db.prepare(`
                SELECT url FROM Content_links
            `).all();

            if (result && result.results) {
                existingUrls = result.results.map(row => row.url);
            }

            // console.log("Existing URLs from the database:", existingUrls);
        } catch (error) {
            console.error("Error fetching existing URLs:", error);
            return new Response("Error fetching existing URLs", { status: 500 });
        }
        // Get the method from the request header
        const method = request.method.toUpperCase();
        
        // if (method === 'GET') {
        //     // Return existingUrls as JSON
        //     return json(existingUrls);            
        // }
        // Default list of websites if no parameter is provided
        const defaultWebsites = [
        "https://www.vivacityapp.com/wechat-news/ultimate-guide-to-uk-pbsa-pre-selling-what-you-need-to-know",
        "https://www.vivacityapp.com/wechat-news/unlocking-potential-of-pbsa-lead-generation-strategies-to-boost-business",
        "https://www.vivacityapp.com/wechat-news/pbsa-untapped-goldmine-enormous-size-international-students-market",
        "https://www.vivacityapp.com/wechat-news/2023-uk-platforms-and-software-solutions-optimise-rental-revenue",
        "https://www.vivacityapp.com/wechat-news/how-technology-is-changing-uk-student-accommodation-market",
        "https://www.vivacityapp.com/wechat-news/top-5-pbsa-providers-in-uk-a-comparison",
        "https://www.vivacityapp.com/wechat-news/exploring-latest-developments-2023-for-pbsa-whats-new-in-student-housing",
        "https://www.vivacityapp.com/wechat-news/navigating-the-international-student-market-strategies-to-attract-chinese-students",
        "https://www.vivacityapp.com/wechat-news/bridging-cultures-how-to-market-to-international-students",
        "https://www.vivacityapp.com/wechat-news/exploring-growth-of-international-student-accommodation-market-a-global-perspective",
        "https://www.vivacityapp.com/wechat-news/streamline-your-strategy-unlock-marketing-to-china-with-vivacity",
        "https://www.vivacityapp.com/wechat-news/working-with-wechat-agency-collaboration-with-vivacity",
        "https://www.vivacityapp.com/wechat-news/explore-chinese-app-landscape-guide-western-brands",
        "https://www.vivacityapp.com/wechat-news/pbsa-marketing-guide-chinese-student-market",
        "https://www.vivacityapp.com/wechat-news/boost-hotels-online-visibility-to-chinese-tourists-0-0",
        "https://www.vivacityapp.com/wechat-news/boost-hotels-online-visibility-to-chinese-tourists-0",
        "https://www.vivacityapp.com/wechat-news/dos-and-donts-of-marketing-to-chinese-tourists",
        "https://www.vivacityapp.com/wechat-news/boost-hotels-online-visibility-to-chinese-tourists",
        "https://www.vivacityapp.com/wechat-news/marketing-your-pbsa-to-chinese-students",
        "https://www.vivacityapp.com/wechat-news/wechat-mini-program-pbsa-marketing-success",
        "https://www.vivacityapp.com/wechat-news/boost-pbsa-business-wechat-strategy",
        "https://www.vivacityapp.com/wechat-news/tips-selling-property-chinese-buyers-london",
        "https://www.vivacityapp.com/wechat-news/pbsa-uk-property-developers-attracting-chines-investors",
        "https://www.vivacityapp.com/wechat-news/unlocking-chinese-market-attract-buyers-western-properties",
        "https://www.vivacityapp.com/wechat-news/understanding-chinese-investors-property-marke-",
        "https://www.vivacityapp.com/wechat-news/navigating-chinese-market-overseas-property",
        "https://www.vivacityapp.com/wechat-news/selling-property-to-chinese-buyers",
        "https://www.vivacityapp.com/wechat-news/why-china-buying-us-real-estate-2023",
        "https://www.vivacityapp.com/wechat-news/improving-customer-journey-wechat-marketing-strategy",
        "https://www.vivacityapp.com/wechat-news/sell-real-estate-to-chinese-buyers-customer-experience",
        "https://www.vivacityapp.com/wechat-news/marketing-china-pbsa-trends-2023",
        "https://www.vivacityapp.com/wechat-news/5-trends-in-wechat-content-marketing",
        "https://www.vivacityapp.com/wechat-news/5-ways-chinese-audience-benefits-wechat-miniprogram",
        "https://www.vivacityapp.com/wechat-news/advertise-wechat-western-business",
        "https://www.vivacityapp.com/wechat-news/improving-chinese-customer-experience-wechat-miniprograms",
        "https://www.vivacityapp.com/wechat-news/wechat-social-media-marketing-uk-real-estate",
        "https://www.vivacityapp.com/wechat-news/wechat-social-media-marketing-0-1",
        "https://www.vivacityapp.com/wechat-news/wechat-social-media-marketing-0",
        "https://www.vivacityapp.com/wechat-news/wechat-social-media-marketing-0-0",
        "https://www.vivacityapp.com/wechat-news/marketing-to-china-5-mistakes-to-avoid-at-all-costs",
        "https://www.vivacityapp.com/wechat-news/wechat-social-media-marketing",
        "https://www.vivacityapp.com/wechat-news/what-is-a-wechat-mini-program",
        "https://support.vivacityapp.com/admin-portal-guides/use-viva-ai-to-ask-questions-and-get-answers",
        "https://support.vivacityapp.com/admin-portal-guides/update-popular-featured-city-in-your-mp",
        "https://support.vivacityapp.com/submit-issue",
        "https://support.vivacityapp.com/admin-portal-guides/chinese-sms-notifications",
        "https://support.vivacityapp.com/admin-portal-guides/update-popular-featured-city-in-your-mp",
        "https://support.vivacityapp.com/admin-portal-guides/create-facilities-in-settings",
        "https://support.vivacityapp.com/admin-portal-guides/invite-new-users",
        "https://support.vivacityapp.com/admin-portal-guides/add-a-mini-program-widget-to-your-website",
        "https://support.vivacityapp.com/admin-portal-guides/update-customer-enquiry-confirmation-email-template",
        "https://support.vivacityapp.com/admin-portal-guides/connect-wechat-oa-articles-to-your-mini-program",
        "https://support.vivacityapp.com/admin-portal-guides/whitelist-domain-to-enable-360-virtual-tour-in-mini-program",
        "https://support.vivacityapp.com/admin-portal-guides/how-to-track-your-marketing-campaign-success-on-admin-portal",
        "https://support.vivacityapp.com/admin-portal-guides/create-and-add-promotions-into-your-mini-program",
        "https://support.vivacityapp.com/admin-portal-guides/connect-with-hubspot-for-enquiries-integration",
        "https://support.vivacityapp.com/admin-portal-guides/connect-with-salesforce-for-enquiries-integration",
        "https://support.vivacityapp.com/admin-portal-guides/upload-images-to-property-rooms-related-properties",
        "https://support.vivacityapp.com/admin-portal-guides/create-a-pbsa-property-on-viva-city-admin-portal",
        "https://support.vivacityapp.com/admin-portal-guides/add-rooms-to-the-pbsa-property",
        "https://support.vivacityapp.com/admin-portal-guides/create-tenancy-length-for-a-pbsa-property",
        "https://support.vivacityapp.com/admin-portal-guides/create-a-build-to-rent-btr-property",
        "https://support.vivacityapp.com/admin-portal-guides/add-a-related-property-for-btr-property",
        "https://support.vivacityapp.com/admin-portal-guides/duplicate-property-assets",
        "https://support.vivacityapp.com/admin-portal-guides/preliminary-settings-before-adding-a-new-property",
        "https://support.vivacityapp.com/admin-portal-guides/update-icons-of-facilities",
        "https://support.vivacityapp.com/admin-portal-guides/marketing-guide-to-create-a-good-property-description-for-mini-program",
        "https://support.vivacityapp.com/admin-portal-guides/create-your-faq-section-on-the-mini-program-mp",
        "https://support.vivacityapp.com/admin-portal-guides/scape-australia-only-availability-integration-configurations"
        ];

        // If websites are provided in the query string, use them; otherwise, use the default list
        let websites = websitesParam ? websitesParam: defaultWebsites;

        // // Compare current websites with processed websites and find new ones
        newWebsites = websites.filter(site => !existingUrls.includes(site));

        const embeddings = new CloudflareWorkersAIEmbeddings({
            binding: env.AI,
            modelName: env.EMBEDDINGS_MODEL_NAME
        });
        
        // const store = new MemoryVectorStore(embeddings);
        const store = new CloudflareVectorizeStore(embeddings, {
            index: env.B2B_AI_INDEX
        });


        if (method === 'GET') {
            // Fetch all URLs from the Content_links table in the database
            try {
                const db = env.VIVADB; // Assuming VIVADB is the D1 database binding
                const result = await db.prepare(`SELECT id, url, \`group\`, created_at FROM Content_links`).all();

                if (result && result.results) {
                    // const urls = result.results.map(row => row.url);
                    return json(result.results);
                } else {
                    return json([]); // Return an empty array if no URLs are found
                }
            } catch (error) {
                console.error("Error fetching URLs from database:", error);
                return new Response("Error fetching URLs from database", { status: 500 });
            }
        }
        
        // Handle DELETE method for multiple URLs
        // Delete the URLs from the database and rebuild the vector store， frontend need to return the id to delete that vector.
        if (method === 'DELETE' && id) {
            if (!websitesParam || !Array.isArray(websitesParam) || websitesParam.length === 0) {
                return new Response("URLs to delete are missing", { status: 400 });
            }

            // Loop through the URLs and delete each from the database
            for (const url of websitesParam) {
                // Remove from the database
                try {
                    await db.prepare(`
                        DELETE FROM Content_links WHERE url = ?
                    `).bind(url).run();
                    console.log(`Deleted ${url} from Content_links`);
                } catch (error) {
                    console.error(`Error deleting ${url} from Content_links:`, error);
                    return new Response(`Error deleting ${url} from database`, { status: 500 });
                }
            }

            // Rebuild the vector store
            const updatedUrls = await db.prepare(`
                SELECT url FROM Content_links
            `).all();

            const updatedExistingUrls = updatedUrls.results.map(row => row.url);

            const updatedDocs = [];
            for (const url of updatedExistingUrls) {
                const loader = new CheerioWebBaseLoader(url);
                const docs = await loader.loadAndSplit();
                updatedDocs.push(...docs.map(doc => ({
                    ...doc,
                    metadata: { url }
                })));
            }

            console.log("Documents with metadata:", updatedDocs);

            // await store.addDocuments(updatedDocs, {ids:[id]});

            await store.delete({ids: [id]}) // delete vectors by ids
            return new Response(`Successfully deleted ${websitesParam.length} URLs`, { status: 200 });
        }


        // If there are new websites, load and add them to the store
        if (newWebsites.length > 0) {
            console.log("New websites found:", newWebsites);
            // Load and split documents

            // Prepend the prefix to each website
            const prefix = "https://r.jina.ai/";
            const originalWebsites = newWebsites;
            const prefixedWebsites  = newWebsites.map(site => prefix + site);
            const loaders = prefixedWebsites .map(site => new CheerioWebBaseLoader(site));
            const allDocs = await Promise.all(loaders.map(async (loader, index) => {
                const docs = await loader.loadAndSplit();
                // Attach the source URL as metadata to each document
                return docs.map(doc => ({
                    ...doc,
                    metadata: { url: originalWebsites[index] }
                }));
            }));

            // Flatten the array of documents
            const docs = allDocs.flat();

            console.log("Documents with metadata:", docs);

            await store.addDocuments(docs, {ids:[id]});

            // add urls to D1 Data store 
            const currentTime = new Date().toISOString(); // get the timestamp

            for (const url of originalWebsites) {
                const query = `INSERT INTO Content_links (id, url, \`group\`, created_at) VALUES (?, ?, ?, ?)`;
                const values = [id, url, group, currentTime];
                
                try{
                    await db.prepare(query).bind(...values).run();
                    console.log(`Inserted ${url} into Content_links`);
                } catch (error) {
                    console.error(`Error inserting ${url} into Content_links:`, error);
                }
            }
        } else {
            // If no new websites are found, return this message
            console.log("No new websites to process.");
            return new Response("No new websites to process.", { status: 200 });
        }
    }catch (error) {
        console.error("Error in vivacity_contentController:", error);
        return new Response("Internal Server Error", { status: 500 });
    }
    if (newWebsites.length > 0) {
        return new Response("Websites processed successfully", { status: 200 });
    }        
};

export default B2BDataStoreController;

