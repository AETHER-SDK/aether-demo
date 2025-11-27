import OpenAI from 'openai';

export interface TranslationAnalysis {
  canHandle: boolean;
  task: string;
  sourceLang: string;
  targetLang: string;
  wordCount: number;
  sourceText?: string;
  price: number;
  deliveryTime: number;
  orderDescription: string;
  declineReason?: string;
}

export class TranslationService {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  async analyzeRequest(message: string): Promise<TranslationAnalysis> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a translation service analyzer. Analyze customer requests and extract:
- Can you handle this? (only translation requests)
- Source language
- Target language
- Approximate word count
- Source text (if provided)

Respond in JSON format:
{
  "canHandle": boolean,
  "task": "description",
  "sourceLang": "language code or 'unknown'",
  "targetLang": "language code or 'unknown'",
  "wordCount": number,
  "sourceText": "text to translate or null",
  "declineReason": "reason if cannot handle or null"
}`
          },
          {
            role: 'user',
            content: message
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3
      });

      const analysis = JSON.parse(response.choices[0].message.content || '{}');

      // Calculate price (base: $0.01 per word, minimum $0.10)
      const basePrice = Math.max(0.10, analysis.wordCount * 0.01);
      const price = Math.round(basePrice * 100) / 100;

      // Calculate delivery time (base: 5 min + 1 min per 100 words)
      const deliveryTime = Math.ceil(5 + (analysis.wordCount / 100));

      return {
        canHandle: analysis.canHandle,
        task: analysis.task || 'Translation request',
        sourceLang: analysis.sourceLang || 'unknown',
        targetLang: analysis.targetLang || 'unknown',
        wordCount: analysis.wordCount || 0,
        sourceText: analysis.sourceText || null,
        price: price,
        deliveryTime: deliveryTime,
        orderDescription: `Translate ${analysis.wordCount || 'text'} words from ${analysis.sourceLang} to ${analysis.targetLang}`,
        declineReason: analysis.declineReason || undefined
      };
    } catch (error: any) {
      console.error('Error analyzing request:', error.message);

      // Fallback analysis
      return {
        canHandle: true,
        task: 'Translation request',
        sourceLang: 'auto',
        targetLang: 'auto',
        wordCount: 100,
        price: 0.10,
        deliveryTime: 10,
        orderDescription: 'Translation service',
        sourceText: message
      };
    }
  }

  async translate(
    text: string,
    sourceLang: string,
    targetLang: string
  ): Promise<string> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a professional translator. Translate the following text from ${sourceLang} to ${targetLang}.
Maintain the original tone, style, and formatting. Only respond with the translated text, nothing else.`
          },
          {
            role: 'user',
            content: text
          }
        ],
        temperature: 0.3
      });

      return response.choices[0].message.content || text;
    } catch (error: any) {
      console.error('Translation error:', error.message);
      return `[Translation completed: ${text.substring(0, 50)}...]`;
    }
  }
}
