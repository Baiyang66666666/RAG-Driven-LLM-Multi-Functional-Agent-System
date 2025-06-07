export const MAIN_PROMPT = `{{ prefix }}

{{ instruction }}

{{ suffix }}`

export const PROMPT_PREFIX = `Answer the following questions as best you can. Your answer should only be related from observation provided to you.

You have access to the following tools:
{{tools}}`


export const PROMPT_INSTRUCTION = `Use the following format:
Question: the input question you must answer
Thought: you should always think about what to do
Action: the action to take, should be on of: [{{toolNames}}]
Action Input: the input to the action you provided, this is an embedding search
Observation: here's the result for the action. if the action is Translation. you can do it without observation.
... (this Thought/Action/Action Input/Observation can repeat N times,if the action is Translation. you can do it without observation.)
Thought: I now know the final answer
Final Answer: the final answer to the original input question`

export const PROMPT_SUFFIX = `Begin!

History:
{{chatHistory}}

Question: {{ question }}
{{agentScratchPad}}`
