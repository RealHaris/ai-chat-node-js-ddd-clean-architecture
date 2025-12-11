import express from 'express';
import { inject, injectable } from 'tsyringe';
import { fromZodError } from 'zod-validation-error';

import {
  ChatMessageResponseDTO,
  SendMessageDTOSchema,
} from '~/modules/chat/application/dto/dto';
import { OpenAIService } from '~/modules/chat/application/service/openai.service';
import { ChatMessageReadRepository } from '~/modules/chat/infra/persistence/repository/read';
import { ChatMessageWriteRepository } from '~/modules/chat/infra/persistence/repository/write';
import { QuotaService } from '~/modules/subscription/application/service/quota.service';
import HttpStatus from '~/shared/common/enums/http_status';
import { ChatMessage } from '~/shared/infra/db/types';
import {
  AuthenticatedRequest,
  authMiddleware,
} from '~/shared/infra/http/middleware/auth';
import { BaseController } from '~/shared/infra/http/utils/base_controller';

@injectable()
export class ChatController extends BaseController {
  private router: express.Router;

  constructor(
    @inject(OpenAIService)
    private openAIService: OpenAIService,
    @inject(QuotaService)
    private quotaService: QuotaService,
    @inject(ChatMessageReadRepository)
    private chatMessageReadRepository: ChatMessageReadRepository,
    @inject(ChatMessageWriteRepository)
    private chatMessageWriteRepository: ChatMessageWriteRepository
  ) {
    super();
    this.router = express.Router();
  }

  register() {
    // All routes require authentication
    this.router.use(authMiddleware);

    // Send a message
    this.router.post('/send', this.sendMessage.bind(this));

    // Get chat history
    this.router.get('/history', this.getHistory.bind(this));

    return this.router;
  }

  sendMessage = async (
    req: AuthenticatedRequest,
    res: express.Response
  ): Promise<void> => {
    try {
      if (!req.user) {
        res.status(HttpStatus.UNAUTHORIZED).json({
          error: 'User not authenticated',
        });
        return;
      }

      // Validate input
      const validation = SendMessageDTOSchema.safeParse(req.body);

      if (!validation.success) {
        const validationError = fromZodError(validation.error);
        res.status(HttpStatus.BAD_REQUEST).json({
          error: validationError.toString(),
        });
        return;
      }

      const { query } = validation.data;
      const userId = req.user.id;

      // Check quota
      const quotaInfo = await this.quotaService.getQuotaInfo(userId);

      if (!quotaInfo.hasQuota) {
        res.status(HttpStatus.FORBIDDEN).json({
          error:
            'You have no remaining messages. Please upgrade your plan or wait for renewal.',
          quotaInfo,
        });
        return;
      }

      // Create pending message
      const pendingMessage =
        await this.chatMessageWriteRepository.createPending({
          userId,
          query,
        });

      // Deduct quota (do this before API call to prevent abuse)
      if (!quotaInfo.isUnlimited) {
        await this.quotaService.deductQuota(userId, 1);
      }

      // Call OpenAI service
      const openAIResponse = await this.openAIService.sendMessage(query);

      let completedMessage: ChatMessage;

      if (openAIResponse.success && openAIResponse.data) {
        // Update message with response
        completedMessage =
          await this.chatMessageWriteRepository.updateWithResponse(
            pendingMessage.id,
            {
              response: openAIResponse.data.choices[0].message.content,
              tokens: {
                prompt_tokens: openAIResponse.data.usage.prompt_tokens,
                completion_tokens: openAIResponse.data.usage.completion_tokens,
                total_tokens: openAIResponse.data.usage.total_tokens,
              },
              status: 'completed',
            }
          );
      } else {
        // Mark as failed
        completedMessage = await this.chatMessageWriteRepository.markFailed(
          pendingMessage.id,
          openAIResponse.error || 'Unknown error'
        );
      }

      // Get updated quota info
      const updatedQuotaInfo = await this.quotaService.getQuotaInfo(userId);

      const response: ChatMessageResponseDTO = {
        id: completedMessage.id,
        userId: completedMessage.userId,
        query: completedMessage.query,
        response: completedMessage.response,
        tokens: completedMessage.tokens as {
          prompt_tokens: number;
          completion_tokens: number;
          total_tokens: number;
        } | null,
        status: completedMessage.status as 'pending' | 'completed' | 'failed',
        errorMessage: completedMessage.errorMessage,
        createdAt: completedMessage.createdAt,
        updatedAt: completedMessage.updatedAt,
      };

      res.status(HttpStatus.OK).json({
        message: completedMessage,
        quotaRemaining: updatedQuotaInfo.totalRemainingMessages,
        data: response,
      });
    } catch (error: unknown) {
      const errorName = error instanceof Error ? error.name : 'Error';

      if (errorName === 'QuotaExceededError') {
        res.status(HttpStatus.FORBIDDEN).json({
          error: error instanceof Error ? error.message : 'Quota exceeded',
        });
        return;
      }

      console.error('Send message error:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to send message',
      });
    }
  };

  getHistory = async (
    req: AuthenticatedRequest,
    res: express.Response
  ): Promise<void> => {
    try {
      if (!req.user) {
        res.status(HttpStatus.UNAUTHORIZED).json({
          error: 'User not authenticated',
        });
        return;
      }

      const page = parseInt(req.query.page as string) || 1;
      const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
      const offset = (page - 1) * limit;

      const userId = req.user.id;

      const [messages, total] = await Promise.all([
        this.chatMessageReadRepository.findByUserId(userId, { limit, offset }),
        this.chatMessageReadRepository.countByUserId(userId),
      ]);

      const response: ChatMessageResponseDTO[] = messages.map(
        (message: ChatMessage) => ({
          id: message.id,
          userId: message.userId,
          query: message.query,
          response: message.response,
          tokens: message.tokens as {
            prompt_tokens: number;
            completion_tokens: number;
            total_tokens: number;
          } | null,
          status: message.status as 'pending' | 'completed' | 'failed',
          errorMessage: message.errorMessage,
          createdAt: message.createdAt,
          updatedAt: message.updatedAt,
        })
      );

      res.status(HttpStatus.OK).json({
        data: {
          messages: response,
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit),
        },
      });
    } catch (error: unknown) {
      console.error('Get history error:', error);
      res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to retrieve chat history',
      });
    }
  };
}
