import {baseVectorSchema} from "./common.schema";


export const dataStoreSchema = {
	type: "object",
	properties: baseVectorSchema,
	required: ['text', '_id', 'organization', 'metadata']
}

export const bulkDataStoreSchema  = {
	type: "array",
	items: dataStoreSchema,
	minItems: 1

}
