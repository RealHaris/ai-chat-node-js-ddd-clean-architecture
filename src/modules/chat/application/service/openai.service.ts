import { injectable, singleton } from 'tsyringe';

// Mock OpenAI response structure
export interface OpenAIUsage {
  prompt_tokens: number;
  completion_tokens: number;
  total_tokens: number;
}

export interface OpenAIChoice {
  index: number;
  message: {
    role: 'assistant';
    content: string;
  };
  finish_reason: 'stop' | 'length' | 'content_filter';
}

export interface OpenAIChatCompletionResponse {
  id: string;
  object: 'chat.completion';
  created: number;
  model: string;
  choices: OpenAIChoice[];
  usage: OpenAIUsage;
}

export interface OpenAIServiceResponse {
  success: boolean;
  data?: OpenAIChatCompletionResponse;
  error?: string;
}

@singleton()
@injectable()
export class OpenAIService {
  private mockResponses = [
    "That's a great question! Based on my analysis, the answer involves several key factors that we should consider carefully.",
    'I understand your query. Let me provide you with a comprehensive response that addresses all aspects of your question.',
    "Thank you for asking. Here's what I can tell you based on my knowledge and understanding of the topic.",
    "Interesting question! The topic you've raised has multiple dimensions that are worth exploring in detail.",
    "I'd be happy to help with that. Let me break down the answer into manageable parts for better understanding.",
    'Great inquiry! This is a fascinating area that requires thoughtful consideration of various perspectives.',
    "Your question touches on an important subject. Here's my take on it with relevant details and insights.",
    'I appreciate the complexity of your question. Let me provide a thorough response with practical examples.',
  ];

  async sendMessage(query: string): Promise<OpenAIServiceResponse> {
    // Simulate 3-5 second delay
    const delay = Math.floor(Math.random() * 2000) + 3000; // 3000-5000ms
    await this.sleep(delay);

    // Simulate 5% failure rate
    if (Math.random() < 0.05) {
      return {
        success: false,
        error: 'OpenAI API temporarily unavailable. Please try again later.',
      };
    }

    // Generate mock response
    const mockResponse = this.generateMockResponse(query);

    return {
      success: true,
      data: mockResponse,
    };
  }

  private generateMockResponse(query: string): OpenAIChatCompletionResponse {
    // Pick a random base response
    const baseResponse =
      this.mockResponses[Math.floor(Math.random() * this.mockResponses.length)];

    // Add some context based on the query
    const contextualResponse = `${baseResponse}\n\nRegarding your specific question about "${query.substring(0, 50)}${query.length > 50 ? '...' : ''}", I would suggest considering the following points:\n\n1. First, it's important to understand the core concepts involved.\n2. Second, we should examine the practical implications.\n3. Third, let's look at potential solutions or approaches.\n4. Finally, consider the long-term effects and sustainability.\n\nIs there anything specific you'd like me to elaborate on?`;

    // Calculate mock token usage (approximation)
    const promptTokens = Math.ceil(query.length / 4);
    const completionTokens = Math.ceil(contextualResponse.length / 4);
    const totalTokens = promptTokens + completionTokens;

    return {
      id: `chatcmpl-${this.generateId()}`,
      object: 'chat.completion',
      created: Math.floor(Date.now() / 1000),
      model: 'gpt-3.5-turbo-0125',
      choices: [
        {
          index: 0,
          message: {
            role: 'assistant',
            content: contextualResponse,
          },
          finish_reason: 'stop',
        },
      ],
      usage: {
        prompt_tokens: promptTokens,
        completion_tokens: completionTokens,
        total_tokens: totalTokens,
      },
    };
  }

  private generateId(): string {
    const chars =
      'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 29; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => globalThis.setTimeout(resolve, ms));
  }
}
