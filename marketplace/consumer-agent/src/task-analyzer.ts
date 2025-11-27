import OpenAI from 'openai';

export interface TaskAnalysis {
  category: string;
  maxBudget: number;
  keywords: string[];
  requirements: string;
}

export interface OrderDecision {
  accept: boolean;
  reason: string;
  counterOffer?: number;
}

export interface ReviewData {
  rating: number;
  comment: string;
}

export class TaskAnalyzer {
  private openai: OpenAI;

  constructor(apiKey: string) {
    this.openai = new OpenAI({ apiKey });
  }

  /**
   * Analyze a task to determine what kind of agent we need
   */
  async analyzeTask(task: string): Promise<TaskAnalysis> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a task analyzer for an AI marketplace. Analyze the user's task and determine:
- Which category of agent is needed (Translation, Data, Code, Design, Writing, Research)
- Maximum reasonable budget in USD (be reasonable, typical prices: translation $0.01/word, writing $0.10-0.50, data $0.05-5.00)
- Keywords for searching
- Specific requirements

Respond in JSON format:
{
  "category": "category name",
  "maxBudget": number,
  "keywords": ["keyword1", "keyword2"],
  "requirements": "detailed requirements"
}`
          },
          {
            role: 'user',
            content: task
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3
      });

      const analysis = JSON.parse(response.choices[0].message.content || '{}');

      return {
        category: analysis.category || 'Translation',
        maxBudget: analysis.maxBudget || 1.00,
        keywords: analysis.keywords || [],
        requirements: analysis.requirements || task
      };
    } catch (error: any) {
      console.error('Error analyzing task:', error.message);

      // Fallback analysis
      return {
        category: 'Translation',
        maxBudget: 1.00,
        keywords: ['translate', 'language'],
        requirements: task
      };
    }
  }

  /**
   * Decide whether to accept an order proposal
   */
  async shouldAcceptOrder(
    originalTask: string,
    orderDescription: string,
    price: number,
    maxBudget: number
  ): Promise<OrderDecision> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a smart purchasing agent. Evaluate if an order proposal matches the original task and is priced fairly.

Consider:
- Does the order description match the task requirements?
- Is the price reasonable and within budget?
- Are there any red flags?

Respond in JSON:
{
  "accept": boolean,
  "reason": "explanation",
  "counterOffer": number or null (if price is too high, suggest a fair counter-offer)
}`
          },
          {
            role: 'user',
            content: `Original task: ${originalTask}

Order proposal:
- Description: ${orderDescription}
- Price: $${price}
- My max budget: $${maxBudget}

Should I accept this order?`
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.3
      });

      const decision = JSON.parse(response.choices[0].message.content || '{}');

      return {
        accept: decision.accept !== false, // Default to true if unclear
        reason: decision.reason || 'Order seems reasonable',
        counterOffer: decision.counterOffer || undefined
      };
    } catch (error: any) {
      console.error('Error making order decision:', error.message);

      // Fallback: accept if within budget
      return {
        accept: price <= maxBudget,
        reason: price <= maxBudget
          ? 'Price is within budget'
          : 'Price exceeds budget',
        counterOffer: price > maxBudget ? maxBudget * 0.9 : undefined
      };
    }
  }

  /**
   * Generate a review based on the delivery quality
   */
  async generateReview(
    originalTask: string,
    result: string,
    message: string
  ): Promise<ReviewData> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: `You are a quality evaluator. Review the work delivered and provide:
- Rating from 1-5 stars (1=poor, 5=excellent)
- Brief comment explaining the rating

Consider:
- Does it fulfill the original request?
- Is the quality good?
- Was it delivered professionally?

Respond in JSON:
{
  "rating": number (1-5),
  "comment": "brief review comment (1-2 sentences)"
}`
          },
          {
            role: 'user',
            content: `Original task: ${originalTask}

Delivery:
${result}

Provider message:
${message}

Please review this delivery.`
          }
        ],
        response_format: { type: 'json_object' },
        temperature: 0.5
      });

      const review = JSON.parse(response.choices[0].message.content || '{}');

      // Ensure rating is between 1-5
      const rating = Math.max(1, Math.min(5, review.rating || 5));

      return {
        rating: rating,
        comment: review.comment || 'Good work, thank you!'
      };
    } catch (error: any) {
      console.error('Error generating review:', error.message);

      // Fallback: positive review
      return {
        rating: 5,
        comment: 'Thank you for the delivery!'
      };
    }
  }
}
