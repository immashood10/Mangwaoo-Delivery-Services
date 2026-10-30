import { GoogleGenAI, type Schema } from '@google/genai';

export type AiProviderName = 'gemini' | null;

export function selectedAiProvider(): AiProviderName {
  const configured = process.env.AI_PROVIDER?.trim().toLowerCase();
  if (!configured || configured === 'gemini') return 'gemini';
  return null;
}

export function aiConfigured() {
  return selectedAiProvider() === 'gemini' && Boolean(process.env.GEMINI_API_KEY?.trim());
}

export async function generateJson<T>(input: { system: string; prompt: string; schema: Schema }): Promise<T | null> {
  if (!aiConfigured()) return null;

  try {
    const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY!.trim() });
    const result = await ai.models.generateContent({
      model: process.env.GEMINI_MODEL?.trim() || 'gemini-3.8-flash',
      contents: input.prompt,
      config: {
        systemInstruction: input.system,
        responseMimeType: 'application/json',
        responseSchema: input.schema,
        maxOutputTokens: 220,
        temperature: 0.1,
      },
    });
    const text = result.text?.trim();
    if (!text || text.length > 3000) return null;
    return JSON.parse(text) as T;
  } catch (error) {
    console.warn('[ai-provider] Gemini request failed', error instanceof Error ? error.name : 'unknown-error');
    return null;
  }
}
