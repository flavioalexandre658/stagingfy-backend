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
            result.outputImageUrls,
            true
          );
          logger.info('InstantDeco processing completed', { uploadId: upload.id, result });
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
      // Mapear task_id para jobId
      const webhookData = {
        jobId: req.body.task_id || req.body.id,
        status: req.body.status === 'SUCCESS' ? 'completed' : req.body.status,
        result: req.body.result,
        timestamp: new Date().toISOString()
      };

      logger.info('Black Forest webhook received', {
        jobId: webhookData.jobId,
        status: webhookData.status
      });

      if (!webhookData.jobId) {
        logger.warn('No job ID found in webhook payload');
        res.status(400).json({ error: 'No job ID found' });
        return;
      }

      // Buscar upload pelo jobId (primeiro no cache, depois no banco)
      const upload = await this.findUpload(webhookData.jobId);
      
      if (!upload) {
        // Se não encontrou nem no cache nem no banco, pode ser um webhook duplicado ou inválido
        logger.debug('Upload not found for Black Forest job - possibly duplicate webhook', { jobId: webhookData.jobId });
        res.status(200).json({ success: true, message: 'Webhook processed' });
        return;
      }

      // Se o job foi concluído com sucesso
      if (webhookData.status === 'completed' && webhookData.result?.sample) {
        const imageUrl = this.extractImageUrl(webhookData.result.sample);
        
        if (imageUrl) {
          // Verificar se é um upload com staging plan (múltiplas etapas)
          if (upload.currentStage && upload.stagingPlan) {
            logger.info(`Stage ${upload.currentStage} completed for upload ${upload.id}`);
            
            // Verificar se há próxima etapa
            const currentStageIndex = upload.stagingPlan.stages.findIndex((s: any) => s.stage === upload.currentStage);
            const nextStageIndex = currentStageIndex + 1;
            
            if (nextStageIndex < upload.stagingPlan.stages.length) {
              // Há próxima etapa - processar primeiro para obter o jobId
              const nextStage = upload.stagingPlan.stages[nextStageIndex];
              if (nextStage) {
                logger.info(`Starting next stage ${nextStage.stage} for upload ${upload.id}`);
                const nextStageJobId = await this.processNextStageAndGetJobId(upload, imageUrl, nextStage, nextStageIndex);
                
                // Agora atualizar resultado da etapa atual com o nextStageJobId
                await uploadRepository.updateStageResult(upload.id, {
                  stage: upload.currentStage,
                  imageUrl,
                  success: true,
                  validationPassed: true,
                  retryCount: 0
                } as any, nextStageJobId || undefined);
              }
            } else {
              // Última etapa concluída - atualizar resultado sem nextStageJobId (isso marca como completed)
              await uploadRepository.updateStageResult(upload.id, {
                stage: upload.currentStage,
                imageUrl,
                success: true,
                validationPassed: true,
                retryCount: 0
              } as any);
              
              // Salvar no S3 e finalizar
              logger.info(`All stages completed for upload ${upload.id}`);
              const finalImageUrl = await this.saveImageToS3(upload.id, imageUrl, upload.userId);
              await uploadRepository.updateOutputImage(upload.id, finalImageUrl, undefined, false); // false para não duplicar o completed
            }
          } else {
            // Upload simples (sem staging plan) - salvar no S3 e finalizar
            logger.info(`Simple upload completed for upload ${upload.id}`);
            const finalImageUrl = await this.saveImageToS3(upload.id, imageUrl, upload.userId);
            await uploadRepository.updateOutputImage(upload.id, finalImageUrl, undefined, true);
          }
        } else {
          logger.warn(`No image URL found in webhook result for upload ${upload.id}`);
          await this.handleStageFailure(upload);
        }
      } else if (webhookData.status === 'failed') {
        logger.error(`Job failed for upload ${upload.id}`);
        await this.handleStageFailure(upload);
      } else {
        // Status de processamento - apenas atualizar
        logger.debug(`Status update for upload ${upload.id}: ${webhookData.status}`);
        await uploadRepository.updateStatus(upload.id, webhookData.status);
      }

      res.status(200).json({ success: true });
    } catch (error) {
      logger.error('Webhook processing failed:', error as Error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  private extractImageUrl(sample: any): string | null {
    if (typeof sample === 'string') {
      return sample;
    }
    if (sample && typeof sample === 'object' && sample.url) {
      return sample.url;
    }
    return null;
  }

  private async findUpload(jobId: string): Promise<any> {
    // Primeiro, verificar cache para jobIds recém-criados
    const { BlackForestProvider } = await import('../services/providers/black-forest.provider');
    const cached = BlackForestProvider.getFromCache(jobId);
    
    if (cached) {
      logger.debug(`Found jobId ${jobId} in cache for upload ${cached.uploadId}`);
      // Buscar upload pelo ID do cache
      const upload = await uploadRepository.findById(cached.uploadId);
      if (upload) {
        return upload;
      }
    }

    // Buscar upload pelo jobId (pode estar em blackForestJobId ou em stageJobIds)
    let upload = await uploadRepository.findByBlackForestJobId(jobId);
    
    if (!upload) {
      // Tentar buscar por stage job ID
      upload = await uploadRepository.findByStageJobId(jobId);
    }
    
    return upload;
  }

  private async processNextStageAndGetJobId(upload: any, inputImageUrl: string, nextStage: any, stageIndex: number): Promise<string | null> {
    try {
      // Atualizar currentStage
      await uploadRepository.updateCurrentStage(upload.id, nextStage.stage);
      
      // Importar e instanciar o BlackForestProvider
      const { providerConfigManager } = await import('../config/provider.config');
      const blackForestConfig = providerConfigManager.getConfig('black-forest');
      
      if (!blackForestConfig) {
        throw new Error('Black Forest provider não configurado');
      }

      const { BlackForestProvider } = await import('../services/providers/black-forest.provider');
      const provider = new BlackForestProvider(blackForestConfig);
      
      // Converter URL da imagem para base64
      const imageBase64 = await provider.downloadAndConvertToBase64(inputImageUrl);
      
      // Executar a próxima etapa
      const result = await (provider as any).executeStage(
        upload.id,
        imageBase64,
        nextStage,
        upload.roomType,
        upload.furnitureStyle
      );
      
      if (result.success && result.jobId) {
        // Atualizar o stageJobIds com o novo jobId
        const updatedStageJobIds = {
          ...(upload.stageJobIds || {}),
          [nextStage.stage]: result.jobId
        };
        
        // Atualizar o stageJobIds
        await uploadRepository.updateStageJobIds(upload.id, updatedStageJobIds);
        
        logger.info(`Stage ${nextStage.stage} submitted for upload ${upload.id}`, { jobId: result.jobId });
        return result.jobId;
      } else {
        throw new Error(`Falha ao enviar etapa ${nextStage.stage}`);
      }
      
    } catch (error) {
      logger.error(`Error processing next stage for upload ${upload.id}:`, error as Error);
      await this.handleStageFailure(upload);
      return null;
    }
  }

  private async processNextStage(upload: any, inputImageUrl: string, nextStage: any, stageIndex: number): Promise<void> {
    await this.processNextStageAndGetJobId(upload, inputImageUrl, nextStage, stageIndex);
  }

  /**
   * Salva a imagem final no AWS S3
   */
  private async saveImageToS3(uploadId: string, imageUrl: string, userId: string): Promise<string> {
    try {
      // Importar o serviço S3
      const { s3Service } = await import('../lib/s3');
      
      // Download da imagem
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Erro ao baixar imagem: ${response.statusText}`);
      }

      const imageBuffer = Buffer.from(await response.arrayBuffer());
      
      // Gerar chave única para o arquivo
      const key = s3Service.generateFileKey(userId, 'output', 'jpg');
      
      // Upload para S3
      const s3Url = await s3Service.uploadFile(key, imageBuffer, 'image/jpeg', {
        uploadId,
        userId,
        uploadedAt: new Date().toISOString(),
      });
      
      logger.info(`Image saved to S3 for upload ${uploadId}`, { s3Url });
      return s3Url;
      
    } catch (error) {
      logger.error(`Error saving image to S3 for upload ${uploadId}:`, error as Error);
      // Em caso de erro, retornar a URL original
      return imageUrl;
    }
  }

  /**
   * Trata falhas em stages - usa o resultado do stage anterior ou falha completamente
   */
  private async handleStageFailure(upload: any): Promise<void> {
    try {
      if (upload.stagingPlan && upload.stageResults && upload.stageResults.length > 0) {
        // Buscar o último stage bem-sucedido
        const lastSuccessfulStage = upload.stageResults
          .filter((result: any) => result.success && result.imageUrl)
          .sort((a: any, b: any) => b.stage.localeCompare(a.stage))[0];
        
        if (lastSuccessfulStage) {
          logger.info(`Using result from last successful stage ${lastSuccessfulStage.stage} for upload ${upload.id}`);
          
          // Salvar a imagem do último stage bem-sucedido no S3
          const finalImageUrl = await this.saveImageToS3(upload.id, lastSuccessfulStage.imageUrl, upload.userId);
          
          // Finalizar com o resultado do stage anterior
          await uploadRepository.updateOutputImage(upload.id, finalImageUrl, undefined, true);
          
          logger.info(`Upload ${upload.id} completed with result from stage ${lastSuccessfulStage.stage}`);
          
          return;
        }
      }
      
      // Se não há stages anteriores bem-sucedidos, marcar como falha
      logger.error(`No successful stages found for upload ${upload.id}, marking as failed`);
      await uploadRepository.updateStatus(upload.id, 'failed', 'Processing failed with no successful stages');
      
    } catch (error) {
      logger.error(`Error handling stage failure for upload ${upload.id}:`, error as Error);
      await uploadRepository.updateStatus(upload.id, 'failed', 'Error handling stage failure');
    }
  }
}

export const webhookController = new WebhookController();
