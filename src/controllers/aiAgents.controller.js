import {json, StatusError} from "itty-router";


export const AIAgentsController = async ({
											 id,
											 content,
											 query,
											 AI_AGENT,
											 method,
										 }, env) => {
	const organization = query.organization

	if (!organization) {
		throw new StatusError(400, 'No organization found')
	}
	const key = id

	if (method === 'GET' && !key) {
		const data = await env.B2C_AGENT.get(organization).then((data) => data && JSON.parse(data))
		return json(data)
	} else if (method === 'GET' && key) {
		const data = await env.B2C_AGENT.get(organization).then((data) => data && JSON.parse(data))
		return json(data)
	} else if (method === 'PUT' && key) {
		await env.B2C_AGENT.put(organization, JSON.stringify(content))
		return {"success": true}
	} else if (method === 'DELETE') {
		await env.B2C_AGENT.delete(organization)
		return {"success": true}
	} else {
		throw new StatusError(405, 'Method not found')
	}
}
