import {Validator} from '@cfworker/json-schema';
import {StatusError} from "itty-router";
import mustache from "mustache";


export const slugify = (str) => {
	str = str.trim().toLowerCase(); // Trim whitespace and convert to lowercase

	// Remove accents, replace with spaces
	const from = "ãàáäâẽèéëêìíïîõòóöôùúũûñçĕšžŸÿð";
	const to = "aaaaaeeeeeeeiiiiioooooouuuuncsyzyyd";
	var newStr = "";
	for (var i = 0; i < str.length; i++) {
		var char = str[i];
		const index = from.indexOf(char);
		if (index !== -1) {
			newStr += to[index];
		} else {
			newStr += char;
		}
	}
	str = newStr;

	// Remove characters that aren't alphanumeric, underscores or hyphens
	str = str.replace(/[^a-z0-9\-_]/g, '-');

	// Replace multiple hyphens with a single hyphen
	str = str.replace(/-+/g, '-');

	return str;
}


export const validateSchema = (schema, content, raiseError = true) => {
	const validator = new Validator(schema)
	const result = validator.validate(content)

	if (!result.valid) {
		if (raiseError) {
			throw new StatusError(400, {message: result.errors})
		}
	}
	return result


}


export const renderTemplate = (template, context) => {
	return mustache.render(template, context)
}

export function hasMatchingText(text, words) {
	const regex = new RegExp(words.join("|"), "i"); // 'i' makes it case-insensitive
	return regex.test(text);
}

export function formatSurvey(survey) {
	return survey.questions.reduce((acc, cur) => {
		const question = cur?.question?.['zh-hans'] ? cur.question['zh-hans'] : cur.question['en']
		if (cur.type === 'text') {
			acc.push(question)
		} else if (cur.type === 'radio_group') {
			const textChoices = cur.choices.reduce((acc2, choice, idx) => {
				const text = choice['zh-hans'].length ? choice['zh-hans'] : choice['en']
				if (text && text.length) {
					acc2.push(`${idx + 1}. ${text}`)
				}
				return acc2
			}, []).join("\n")
			acc.push(`${question}\n${textChoices}`)

		}


		return acc;
	}, []).join("\n")

}
