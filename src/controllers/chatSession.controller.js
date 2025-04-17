import {json, StatusError} from "itty-router";
import {ChatHistory} from "../ai/history";
import {uuid} from '@cfworker/uuid';


export const ChatSessionController = async ({content, method, organization, user, session}, env) => {

	return env.B2C_AGENT.get(organization)
		.then((agent) => {
			if (agent) {
				agent = JSON.parse(agent)
				delete agent.metadata
				if (method === 'GET') {
					let query = `SELECT * FROM user_session WHERE organization="${organization}" AND user="${user}"`
					if (agent) {
						query += `AND session != "${method.session}"`
					}
					query += " ORDER BY createdAt ASC"

					return env.AIDB.prepare(query).all()
						.then(({results}) => {
							return json(results.map(item => ({
								...item,
								createdAt: new Date(item.createdAt),
								updatedAt: new Date(item.createdAt)
							})))
						})


				} else if (method === 'PUT' && session && content && content.title && content.title.length) {
					const sessionQuery = `SELECT * from user_session where session="${session}"`

					return env.AIDB.prepare(sessionQuery).first()
						.then((result) => {
							if (result) {
								const updateSessionQuery = `UPDATE user_session SET title="${content.title.slice(0, 30)}" WHERE session="${session}"`
								return env.AIDB.prepare(updateSessionQuery).run()
									.then(() => ({success: true}))

							} else {
								throw new StatusError(404, {"message": "Session not found"})
							}

						})


				} else {

					const sessionKey = `${organization}:${user}`


					const deleteSession = () => {
						const deleteQuery = `DELETE FROM chat_session WHERE id="${sessionKey}"`

						return env.AIDB.prepare(deleteQuery).run()
					}
					const getQuery = `SELECT * FROM chat_session WHERE id="${sessionKey}"`
					return env.AIDB.prepare(getQuery).first()
						.then(async (result) => {
							if (method === 'POST') {

								if(result){
									const expiredAt = result.timestamp + (result.expiration * 1000)
									if (new Date().getTime() >= expiredAt) {
										await deleteSession()
											.then(() => {
												result = null
											})
									}
								}

								if (!result) {
									const data = {
										organization: organization,
										user: user,
										timestamp: new Date().getTime(),
										session: uuid(),
										expiration: env.SESSION_EXPIRATION || 3600
									}


									const insertQuery = `INSERT INTO chat_session (id, session, organization, user, timestamp, expiration) VALUES (?, ?, ?, ?, ?, ?)`

									return env.AIDB.prepare(insertQuery).bind(sessionKey, data.session, data.organization, data.user, data.timestamp, data.expiration).run()
										.then(() => {
											const query = `
												INSERT INTO user_session ( session, user, organization, createdAt, updatedAt)
												VALUES (?, ?, ?, ?, ?)
											`;
											return env.AIDB.prepare(query).bind(data.session, data.user, data.organization, data.timestamp, data.timestamp).run()
												.then(() => {
													return json({"new_session": true, history: [], agent})
												})

										})
								} else {

									const chatHistory = new ChatHistory(result.session, env.AIDB)

									return chatHistory.list()
										.then((result) => {
											return json({new_session: false, history: result, agent})
										})
								}
							} else if (result && method === "DELETE") {

								return deleteSession()
									.then(() => {
										return json({"deleted": true})
									})
							}

						})

				}
			} else {
				throw new StatusError(404, {"message": "No Agent found"})
			}
		})
}
/// Is double occupancy has extra charge item 1, row 3
// Item 28, improve university search
// item 30, check link for enquiry
