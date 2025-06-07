import { renderTemplate} from "../utils/common.utils";
import {uuid} from '@cfworker/uuid';


export class ChatHistory {
	constructor(key, d1, startedAt) {
		this.key = key
		this.d1 = d1
		this.startedAt = startedAt
	}

	async insert(human, ai, streamStarted) {
		const date = new Date().getTime()
		const id = uuid();

		const query = `	INSERT INTO session_history (id, session, human, ai, createdAt, updatedAt, total_time, stream_time)
							VALUES (?, ?, ?, ?, ?, ?, ?, ?)`;

		const data = {
			session: this.key,
			id,
			ai: ai,
			human: human,
			createdAt: date,
			updatedAt: date,
			total_time: new Date() - this.startedAt ?? null,
			stream_time: streamStarted - this.startedAt ?? null
		}

		const sessionQuery = `SELECT * from user_session where session="${this.key}"`

		return  this.d1.prepare(sessionQuery).first()
			.then(async (result)=> {
				if(!result.title){
					const updateSessionQuery = `UPDATE user_session SET title="${human.slice(0, 30)}" WHERE session="${this.key}"`

					await this.d1.prepare(updateSessionQuery).run()
				}
				return this.d1.prepare(query).bind(data.id, data.session, human, ai, data.createdAt, data.updatedAt, data.total_time, data.stream_time).run()
					.then(() => data)
			})

	}

	list() {
		const query = `SELECT * FROM session_history WHERE session="${this.key}" ORDER BY createdAt ASC`
		return this.d1.prepare(query).all()
			.then(({results})=> results.map(item => {
				return {
					...item,
					createdAt: new Date(item.createdAt),
					updatedAt: new Date(item.createdAt)
				}
			}))

	}

	async retrieve() {
		const history = await this.list()
		return history.reduce((acc, cur) => {
			acc.push(`HUMAN: ${cur.human}\nAI: ${cur.ai}`)
		}, []).join("\n")
	}

	async template() {
		const result = await this.list()

		if (result) {
			return result.map(item => {
				return renderTemplate(`Human: {{human}}\nAI: {{ai}}`, item)
			}).join("\n")
		}
		return null
	}
}
