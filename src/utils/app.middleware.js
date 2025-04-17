import {parseJwt} from "@cfworker/jwt";
import {StatusError} from "itty-router";
import {validateSchema} from "./common.utils";

const validateToken = (accessToken, issuer, audience, customClaimKey) => {
	return parseJwt(accessToken, issuer, audience)
		.then((result) => {
			if (result.valid) {
				const payload = result.payload;
				const userId = payload[`${customClaimKey}app-metadata`]
				const user = {
					...payload,
					...(userId && {_id: userId.user, is_superuser: userId.is_superuser})
				}

				return {
					valid: result.valid,
					user
				}
			}
			return result
		})


}
export const AuthMiddleware = async (request, env) => {
	const authorization = request.headers.get('authorization');
	const m2mAuth = request.headers.get('m2m-authorization')
	const mpAuth = request.headers.get('mp-authorization')
	let authorized = false

	if (authorization && authorization.length) {
		const [_, accessToken] = authorization.split(" ")
		const result = await validateToken(accessToken, env.AUTH0_ISSUER, env.AUTH0_AUDIENCE, env.AUTH0_CUSTOM_CLAIM_KEY)
		if (result.valid) {
			authorized = true
			request.user = result.user
		}
	}
	if (m2mAuth && m2mAuth.length) {

		if (env.M2M_SECRET_KEY === m2mAuth) {
			authorized = true
		}
	}

	if (mpAuth && mpAuth.length) {
		if (env.MP_SECRET_KEY === mpAuth) {
			authorized = true
		}
	}

	if (!authorized) {
		throw new StatusError(401, {"message": "Unauthorized"})
	}
}

export const CorsMiddleware = async (request) => {
	if (request.headers.get('Origin') !== null &&
		request.headers.get('Access-Control-Request-Method') !== null &&
		request.headers.get('Access-Control-Request-Headers') !== null) {
		let response = await fetch(request)
		response = new Response(response.body, response)
		response.headers.delete('set-cookie')
		response.headers.set('x-tag', 'checked')
		response.headers.set('Access-Control-Max-Age', 60000)
		return response
	} else {
		return new Response(null, {
			headers: {
				'Allow': 'GET, HEAD, POST, OPTIONS',
				'access-control-allow-origin': '*',
			},
		})
	}
}

export const SchemaValidator = (schema, methods = ["*"]) => (request) => {
	const method = request.method;

	if (methods.includes(method) || methods.includes("*")) {
		validateSchema(schema, request.content ?? {}, true)
	}

}

export const ChatMiddleware = async (request, env) => {
	const sessionKey = `${request.organization}:${request.user}`
	const aiAgent = await env.B2C_AGENT.get(request.organization).then((data) => data && JSON.parse(data))

	await env.B2C_AGENT.get(request.organization)
		.then((data) => data && JSON.parse(data))
		.then((agent) => {
			if (!agent) {
				throw new StatusError(404, {"message": "No Agent found"})
			}

			if (request.content.session) {
				let query = `SELECT * FROM user_session WHERE organization="${request.organization}" AND user="${request.user}" AND session="${request.content.session}"`
				return env.AIDB.prepare(query).first()
					.then((result)=> {
						if(result){
							request.chatSession = {...result, agent}
						}else{
							throw new StatusError(400, {message: "No Session found"})
						}

					})

			} else {
				const deleteSession = () => {
					const deleteQuery = `DELETE FROM chat_session WHERE id="${sessionKey}"`

					return env.AIDB.prepare(deleteQuery).run()
				}
				const getQuery = `SELECT * FROM chat_session WHERE id="${sessionKey}"`
				return env.AIDB.prepare(getQuery).first()
					.then(async (session)=> {
						if(!session){
							throw new StatusError(400, {message: "No Session found"})
						}

						const expiredAt = session.timestamp + (session.expiration * 1000)

						if (new Date().getTime() >= expiredAt) {
							await deleteSession()
								.then(() => {
									session = null
								})
						}

						if (!session) {
							throw new StatusError(400, {message: "No Session found"})
						} else {
							request.chatSession = {...session, agent}
						}

					})

			}
		})

}


export const ChatB2CMiddleware = (request) => {
	const organization = request.headers.get('x-organization-id');
	const user = request.headers.get('x-user-id')

	if (!(organization && organization.length) || !(user && user.length)) {
		throw new StatusError(400, {message: "No organization or user found in request header"})
	}
	request.organization = organization
	request.user = user
}
