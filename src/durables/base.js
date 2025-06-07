import {createDurable} from "itty-durable";

export class BaseDurable extends createDurable({ autoPersist: true }) {

	constructor (props) {
		super(props);
		this.data = new Map();
	}

	retrieve (key) {
		const data = this.data.get(key);
		return !data ? null : data;
	}

	async list () {
		return [...this.data.values()].sort((a, b) => a.order - b.order);
	}

	async update (key, data) {

		this.data.set(key, data);
		return data;
	}

	async delete (key) {
		this.data.delete(key);
		return {};
	}

	async clear(){
		this.data.clear()
		return {}
	}
}
