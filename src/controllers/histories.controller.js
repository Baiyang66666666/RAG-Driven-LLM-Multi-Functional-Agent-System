import {json} from "itty-router";

export const HistoriesController = ({method, organization, user, session}, env) => {
	if (method === 'GET') {
		const query = `SELECT * FROM session_history WHERE session="${session}" ORDER BY createdAt ASC`

		return env.AIDB.prepare(query).all()
			.then(({results}) => {

				const history = results.map(item => {
					return {
						...item,
						ai: item.ai,
						human: item.human,
						createdAt: new Date(item.createdAt),
						updatedAt: new Date(item.updatedAt),
					}

				})
				return json(history)
			})

	}
}
