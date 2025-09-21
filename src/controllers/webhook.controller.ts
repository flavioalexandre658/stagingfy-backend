import { Request, Response } from 'express';
import { BaseController } from './base.controller';
import { uploadRepository } from '../repositories/upload.repository';
import { logger } from '../lib/logger';
import { InstantDecoWebhookResponse } from '../interfaces/instant-deco.interface';
import { BlackForestWebhookResponse } from '../interfaces/upload.interface';
import { InstantDecoProvider } from '../services/providers/instant-deco.provider';
import { ProviderConfig } from '../interfaces/virtual-staging-provider.interface';

export class WebhookController extends BaseController {
  private instantDecoProvider: InstantDecoProvider;

  constructor() {
    super();
    // Configuração básica para o provider
    const config: ProviderConfig = {
      apiKey: process.env.INSTANT_DECO_API_KEY || '',
      baseUrl:
        process.env.INSTANT_DECO_BASE_URL || 'https://api.instantdeco.com',
      webhookUrl: process.env.INSTANT_DECO_WEBHOOK_URL || '',
    };
    this.instantDecoProvider = new InstantDecoProvider(config);
  }

  /**
   * Handle InstantDeco webhook
   */
  async handleInstantDecoWebhook(req: Request, res: Response): Promise<void> {
    try {
      const webhookData: InstantDecoWebhookResponse = req.body;

      logger.info('InstantDeco webhook received', {
        requestId: webhookData.request_id,
        status: webhookData.status,
      });

      // Processar resposta do webhook usando o provider InstantDeco
      const result =
        await this.instantDecoProvider.processWebhookResponse!(webhookData);

      if (result.success && (result.outputImageUrl || result.outputImageUrls)) {
        // Buscar upload pelo request_id
        const upload = await uploadRepository.findByInstantDecoRequestId(
          result.requestId!
        );

        if (upload) {
          // Atualizar com as imagens finais (múltiplas URLs quando disponíveis)
          await uploadRepository.updateOutputImage(
            upload.id,
            result.outputImageUrl ||
              (result.outputImageUrls && result.outputImageUrls[0]) ||
              '',
            result.outputImageUrls
          );
          await uploadRepository.updateStatus(upload.id, 'completed');
          console.log('result', result);
        } else {
          logger.warn('Upload not found for InstantDeco request', {
            requestId: result.requestId,
          });
        }
      } else {
        // Buscar upload pelo request_id para marcar como falha
        const upload = await uploadRepository.findByInstantDecoRequestId(
          result.requestId!
        );

        if (upload) {
          await uploadRepository.updateStatus(
            upload.id,
            'failed',
            result.errorMessage
          );

          logger.error('InstantDeco processing failed', {
            uploadId: upload.id,
            requestId: result.requestId,
            error: result.errorMessage,
          });
        }
      }

      // Responder ao webhook
      res.status(200).json({ received: true });
    } catch (error) {
      logger.error('InstantDeco webhook processing failed', {
        error: error as any,
      });
      this.error(res, 'Webhook processing failed', 400, error);
    }
  }

  /**
   * Handle Black Forest webhook
   */
  async handleBlackForestWebhook(req: Request, res: Response): Promise<void> {
    try {
      const webhookData: BlackForestWebhookResponse = req.body;

      logger.info('Black Forest webhook received', {
        jobId: webhookData.id,
        status: webhookData.status,
      });

      // Buscar upload pelo Black Forest job ID
      const upload = await uploadRepository.findByBlackForestJobId(webhookData.id);

      if (!upload) {
        logger.warn('Upload not found for Black Forest job', {
          jobId: webhookData.id,
        });
        res.status(200).json({ received: true });
        return;
      }

      if (webhookData.status === 'Ready' && webhookData.result?.sample) {
        // Processamento concluído com sucesso
        await uploadRepository.updateOutputImage(
          upload.id,
          webhookData.result.sample,
          undefined
        );
        await uploadRepository.updateStatus(upload.id, 'completed');

        logger.info('Black Forest processing completed successfully', {
          uploadId: upload.id,
          jobId: webhookData.id,
          imageUrl: webhookData.result.sample,
        });
      } else if (webhookData.status === 'Error' || webhookData.status === 'Content Moderated') {
        // Processamento falhou
        const errorMessage = webhookData.error || `Processing failed with status: ${webhookData.status}`;
        
        await uploadRepository.updateStatus(
          upload.id,
          'failed',
          errorMessage
        );

        logger.error('Black Forest processing failed', {
          uploadId: upload.id,
          jobId: webhookData.id,
          status: webhookData.status,
          error: errorMessage,
        });
      }

      // Responder ao webhook
      res.status(200).json({ received: true });
    } catch (error) {
      logger.error('Black Forest webhook processing failed', {
        error: error as any,
      });
      this.error(res, 'Webhook processing failed', 400, error);
    }
  }
}

export const webhookController = new WebhookController();
