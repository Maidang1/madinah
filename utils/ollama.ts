import { Ollama } from "ollama";


export async function getSummary(content: string) {
  try {
    const ollama = new Ollama()
    const result = await ollama.chat({ model: "llama3.2", stream: false, messages: [{ role: "user", content: `Summarize the following content in one sentence Return requires plain text, no markdown and other formats, and limit the length of the summarized text to less than 200。 the content is ${content}` }] })
    return result.message.content;
  } catch {
    return ''
  }
}