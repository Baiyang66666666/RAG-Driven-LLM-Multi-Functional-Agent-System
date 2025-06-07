export const wrapCorsHeader = (response, options = {}) => {
	const {
		origin = '*',
	} = options

	response.headers.set('Access-Control-Allow-Origin', origin)

	return response
}
