export interface LLMProvider {
  name: string
  complete(system: string, user: string): Promise<string>
}
