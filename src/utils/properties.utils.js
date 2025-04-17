import {slugify} from "./common.utils";

const formatPropertyFeatures = (data, value, featureType) => {
	return data[featureType].reduce((acc, item) => {
		if (feature_type === 'facilities') {
			name = item.get('name').get('en')
			const featureText = `building: ${value.name}; facility: ${name}; location: ${value.city}, ${value.country}`

			const metadata = {
				"_id": `${value._id}-${slugify(name)}`,
				"name": value.name,
			}
			acc.push({
				text: featureText,
				...metadata,
				organization: value.organization,
				organization_name: value.organization_name
			})
		}else if(['universities', 'stations'].includes(featureType)){
			name = item.get('name')
			const featureKeys = {"universities": "university", "stations": "station"}
			let featureText = `building: ${value.name}; ${featureKeys[featureType]}: ${item.name}; location: ${value.city}, ${value.country}`
			const lat = item?.latitude
			const lng = item?.longitude

			if (lat && lng){
				const latlng = `${lat.toFixed(4)},${lat.toFixed(4)}`
				featureText += `; latlng: ${latlng}`
			}

			const metadata = {
				"_id": `${value._id}-${slugify(name)}`,
				"name": value.get('name'),
			}

			acc.push({
				text: featureText,
				...metadata,
				organization: value.organization,
				organization_name: value.organization_name
			})

		}
		return acc
	}, [])
}

export const formatProperty = (data) => {
	const prices = data?.prices ?? [];
	const minPrice = prices.map(price => price?.amount_max ?? 0)
	let minPriceUnit = null
	const minPriceValue = minPrice && Math.min(...minPrice) || null
	let minPriceCurrency = null
	const parentId = data?.parent?._id ?? ""

	if (minPriceValue !== null) {
		const minPriceIndex = minPrice.findIndex(item => item === minPriceValue)
		const minPriceData = prices[minPriceIndex]
		minPriceCurrency = minPriceData?.currency

		if (minPriceData?.contract) {
			minPriceUnit = minPriceData?.contract?.period_unit?.value
		} else if (minPriceData?.unit) {
			minPriceUnit = minPriceData?.unit?.value
		}
	}

	const value = {
		name: data?.name,
		organization: data?.organization?._id,
		organization_name: data?.organization?.name,
		property_type: data?.property_type?.value,
		mini_program_appid: data?.wechat_connection?.authorizer_appid ?? "",
		status: data?.status?.value,
		parent_name: data?.parent?.name,
		parent_id: parentId,
		min_price_currency: minPriceCurrency,
		min_price: minPrice,
		min_price_unit: minPriceUnit,
		primary_image: data?.primary_image?.url,
		address_line_1: data?.address?.address_line_1,
		country: data?.address?.country,
		city: data?.address?.city,
		floor_size_unit: data?.floor_size_unit?.value,
		floor_size_value: data?.floor_size_value,
		latitude: data.latitude,
		longitude: data.longitude
	}


	value['text'] = `${value.property_type}: ${value.name}; status: ${value.status}; location: ${value.city}, ${value.country}`

	if (data?.facilities) {
		value['facilities'] = formatPropertyFeatures(data, value, 'facilities')
	}

	if (data?.universities) {
		value['universities'] = formatPropertyFeatures(data, value, 'universities')
	}
	if (data?.stations) {
		value['stations'] = formatPropertyFeatures(data, value, 'stations')
	}

	return value


}
