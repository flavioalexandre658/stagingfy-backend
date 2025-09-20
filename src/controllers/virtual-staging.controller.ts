import { Request, Response } from 'express';
import multer from 'multer';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
} from '@aws-sdk/client-s3';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { uploadRepository } from '../repositories/upload.repository';
import { chatGPTService } from '../services/chatgpt.service';
import { VirtualStagingService } from '../services/virtual-staging.service';
import { ProviderConfig } from '../interfaces/virtual-staging-provider.interface';
import { providerConfigManager } from '../config/provider.config';
import {
  CreateUploadRequest,
  RoomType,
  FurnitureStyle,
  Upload,
  Provider,
} from '../interfaces/upload.interface';

// Configuração do S3
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
  },
});

const BUCKET_NAME = process.env.AWS_S3_BUCKET!;

// Configuração do Multer para upload em memória
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não permitido. Use JPEG, PNG ou WebP.'));
    }
  },
});

export class VirtualStagingController {
  private virtualStagingService: VirtualStagingService;

  constructor() {
    // Validar configurações
    const validation = providerConfigManager.validateConfigurations();
    if (!validation.isValid) {
      console.warn('Provider configuration warnings:', validation.errors);
    }

    // Obter configurações dos providers
    const providerConfigs: Record<string, ProviderConfig> = {};
    for (const [name, config] of providerConfigManager.getAllConfigs()) {
      providerConfigs[name] = config;
    }

    // Inicializar o service unificado
    this.virtualStagingService = new VirtualStagingService(providerConfigs);
  }

  /**
   * Middleware do Multer para upload de imagem
   */
  public uploadMiddleware = upload.single('image');

  /**
   * Processa virtual staging usando ChatGPT + flux-kontext-pro
   */
  async processVirtualStaging(req: Request, res: Response): Promise<void> {
    try {
      // Validar se a imagem foi enviada
      if (!req.file) {
        res.status(400).json({
          success: false,
          message: 'Nenhuma imagem foi enviada',
        });
        return;
      }

      // Validar dados do corpo da requisição
      const {
        roomType,
        furnitureStyle,
        provider = 'black-forest',
        plan = 'free',
      } = req.body as CreateUploadRequest & { plan: string };

      if (!roomType || !furnitureStyle) {
        res.status(400).json({
          success: false,
          message: 'roomType e furnitureStyle são obrigatórios',
        });
        return;
      }

      // Validar provider
      const validProviders: Provider[] = ['black-forest', 'instant-deco'];
      if (!validProviders.includes(provider as Provider)) {
        res.status(400).json({
          success: false,
          message: 'provider inválido. Use "black-forest" ou "instant-deco"',
        });
        return;
      }

      // Validar tipos permitidos
      const validRoomTypes: RoomType[] = [
        'bedroom',
        'living_room',
        'kitchen',
        'bathroom',
        'home_office',
        'dining_room',
        'kids_room',
        'outdoor',
      ];
      const validFurnitureStyles: FurnitureStyle[] = [
        'standard',
        'modern',
        'scandinavian',
        'industrial',
        'midcentury',
        'luxury',
        'coastal',
        'farmhouse',
      ];

      if (!validRoomTypes.includes(roomType as RoomType)) {
        res.status(400).json({
          success: false,
          message: 'roomType inválido',
        });
        return;
      }

      if (!validFurnitureStyles.includes(furnitureStyle as FurnitureStyle)) {
        res.status(400).json({
          success: false,
          message: 'furnitureStyle inválido',
        });
        return;
      }

      // Obter ID do usuário
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Usuário não autenticado',
        });
        return;
      }

      // Verificar se os serviços estão configurados
      if (!chatGPTService) {
        res.status(500).json({
          success: false,
          message: 'Serviço ChatGPT não configurado',
        });
        return;
      }

      if (provider === 'black-forest' && !process.env.BLACK_FOREST_API_KEY) {
        res.status(500).json({
          success: false,
          message: 'Serviço Black Forest não configurado',
        });
        return;
      }

      if (provider === 'instant-deco' && !process.env.INSTANT_DECO_API_KEY) {
        res.status(500).json({
          success: false,
          message: 'Serviço InstantDeco não configurado',
        });
        return;
      }

      // Gerar nome único para o arquivo
      const fileExtension = path.extname(req.file.originalname);
      const fileName = `virtual-staging/input/${userId}/${uuidv4()}${fileExtension}`;

      // Upload para S3
      const uploadCommand = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileName,
        Body: req.file.buffer,
        ContentType: req.file.mimetype,
      });

      await s3Client.send(uploadCommand);

      // Gerar URL da imagem no S3
      const inputImageUrl = `https://${BUCKET_NAME}.s3.amazonaws.com/${fileName}`;

      // Criar registro no banco de dados
      const uploadRecord = await uploadRepository.create({
        userId,
        roomType: roomType as RoomType,
        furnitureStyle: furnitureStyle as FurnitureStyle,
        provider: provider as Provider,
        inputImageUrl,
      });

      // Iniciar processamento assíncrono
      this.processVirtualStagingAsync(
        uploadRecord.id,
        inputImageUrl,
        req.file.buffer,
        roomType as RoomType,
        furnitureStyle as FurnitureStyle,
        provider as Provider
      );

      // Retornar resposta imediata
      res.status(200).json({
        success: true,
        data: {
          uploadId: uploadRecord.id,
          status: uploadRecord.status,
          inputImageUrl: uploadRecord.inputImageUrl,
          createdAt: uploadRecord.createdAt,
        },
      });
    } catch (error) {
      console.error('Erro no processamento de virtual staging:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
      });
    }
  }

  /**
   * Processamento assíncrono de virtual staging
   */
  private async processVirtualStagingAsync(
    uploadId: string,
    inputImageUrl: string,
    imageBuffer: Buffer,
    roomType: RoomType,
    furnitureStyle: FurnitureStyle,
    provider: Provider
  ): Promise<void> {
    const startTime = Date.now();
    console.log(
      `[${uploadId}] Iniciando processamento assíncrono de virtual staging`,
      {
        uploadId,
        inputImageUrl,
        roomType,
        furnitureStyle,
        imageSize: imageBuffer.length,
        timestamp: new Date().toISOString(),
      }
    );

    try {
      // Atualizar status para "processing"
      console.log(`[${uploadId}] Atualizando status para 'processing'`);
      await uploadRepository.updateStatus(uploadId, 'processing');

      // Converter imagem para base64
      const imageBase64 = imageBuffer.toString('base64');

      // Usar o service unificado para processar virtual staging
      const webhookUrl = process.env.INSTANT_DECO_WEBHOOK_URL || undefined;
      const result = await this.virtualStagingService.processVirtualStaging({
        imageBase64,
        imageUrl: inputImageUrl,
        roomType,
        furnitureStyle,
        uploadId,
        ...(webhookUrl && { webhookUrl }),
      }, provider);

      let finalImageUrl: string | null = null;
      let finalImageUrls: string[] | null = null;

      if (result.success) {
        if (result.outputImageUrl || result.outputImageUrls) {
          // Resultado imediato (ex: alguns providers síncronos)
          finalImageUrl = result.outputImageUrl || null;
          finalImageUrls = result.outputImageUrls || null;
        } else if (result.requestId) {
          // Processamento assíncrono - aguardar resultado
          if (provider === 'black-forest') {
            finalImageUrl = await this.pollForResult(result.requestId, provider);
          }
          // Para instant-deco, será atualizado via webhook
        }
      } else {
        throw new Error(result.errorMessage || 'Virtual staging failed');
      }

      // Atualizar registro com resultado final (apenas para Black Forest)
      if (finalImageUrl || finalImageUrls) {
        console.log(`[${uploadId}] Atualizando registro no banco de dados...`);
        await uploadRepository.updateOutputImage(
          uploadId, 
          finalImageUrl || (finalImageUrls && finalImageUrls[0]) || '', 
          finalImageUrls || undefined
        );
        await uploadRepository.updateStatus(uploadId, 'completed');

        const processingTime = Date.now() - startTime;
        console.log(`[${uploadId}] Virtual staging concluído com sucesso!`, {
          uploadId,
          outputImageUrl: finalImageUrl,
          outputImageUrls: finalImageUrls,
          numImages: finalImageUrls?.length || 1,
          processingTimeMs: processingTime,
          processingTimeSeconds: Math.round(processingTime / 1000),
          timestamp: new Date().toISOString(),
        });
      }
    } catch (error) {
      const processingTime = Date.now() - startTime;
      console.error(`[${uploadId}] Erro no processamento assíncrono:`, {
        uploadId,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
        stack: error instanceof Error ? error.stack : undefined,
        processingTimeMs: processingTime,
        timestamp: new Date().toISOString(),
      });

      // Atualizar status para "failed" com mensagem de erro
      const errorMessage =
        error instanceof Error ? error.message : 'Erro desconhecido';
      await uploadRepository.updateStatus(uploadId, 'failed', errorMessage);
    }
  }

  /**
   * Faz polling para obter resultado de processamento assíncrono
   */
  private async pollForResult(requestId: string, provider: Provider): Promise<string | null> {
    const maxAttempts = 30; // 5 minutos com intervalos de 10s
    const interval = 10000; // 10 segundos

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      try {
        const result = await this.virtualStagingService.checkJobStatus(requestId, provider);
        
        if (result.success && result.outputImageUrl) {
          return result.outputImageUrl;
        } else if (!result.success && result.errorMessage) {
          throw new Error(result.errorMessage);
        }

        // Aguardar antes da próxima tentativa
        await new Promise(resolve => setTimeout(resolve, interval));
      } catch (error) {
        console.error(`Polling attempt ${attempt + 1} failed:`, error);
        if (attempt === maxAttempts - 1) {
          throw error;
        }
      }
    }

    throw new Error('Timeout waiting for processing result');
  }

  /**
   * Salva a imagem processada no S3
   */
  private async saveProcessedImage(
    uploadId: string,
    imageUrl: string
  ): Promise<string> {
    try {
      // Baixar a imagem processada
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Erro ao baixar imagem: ${response.status}`);
      }

      const imageBuffer = Buffer.from(await response.arrayBuffer());

      // Gerar nome único para a imagem processada
      const fileName = `virtual-staging/output/${uploadId}/${uuidv4()}.jpg`;

      // Upload para S3
      const uploadCommand = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileName,
        Body: imageBuffer,
        ContentType: 'image/jpeg',
      });

      await s3Client.send(uploadCommand);

      // Retornar URL da imagem no S3
      return `https://${BUCKET_NAME}.s3.amazonaws.com/${fileName}`;
    } catch (error) {
      console.error('Erro ao salvar imagem processada:', error);
      throw new Error('Falha ao salvar imagem processada');
    }
  }

  /**
   * Busca o status de um processamento de virtual staging
   */
  async getVirtualStagingStatus(req: Request, res: Response): Promise<void> {
    try {
      const { uploadId } = req.params;
      const userId = (req as any).user?.id;

      if (!uploadId) {
        res.status(400).json({
          success: false,
          message: 'uploadId é obrigatório',
        });
        return;
      }

      // Buscar upload no banco de dados
      const upload = await uploadRepository.findById(uploadId);

      if (!upload) {
        res.status(404).json({
          success: false,
          message: 'Upload não encontrado',
        });
        return;
      }

      // Verificar se o upload pertence ao usuário
      if (upload.userId !== userId) {
        res.status(403).json({
          success: false,
          message: 'Acesso negado',
        });
        return;
      }

      res.status(200).json({
        success: true,
        data: {
          uploadId: upload.id,
          status: upload.status,
          inputImageUrl: upload.inputImageUrl,
          outputImageUrl: upload.outputImageUrl,
          outputImageUrls: upload.outputImageUrls, // Múltiplas URLs de imagem
          roomType: upload.roomType,
          furnitureStyle: upload.furnitureStyle,
          errorMessage: upload.errorMessage,
          createdAt: upload.createdAt,
          updatedAt: upload.updatedAt,
        },
      });
    } catch (error) {
      console.error('Erro ao buscar status:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
      });
    }
  }

  /**
   * Lista todos os processamentos de virtual staging do usuário
   */
  async getUserVirtualStagings(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const limit = parseInt(req.query.limit as string) || 20;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Usuário não autenticado',
        });
        return;
      }

      // Buscar uploads do usuário
      const uploads = await uploadRepository.findByUserId(userId, limit);

      res.status(200).json({
        success: true,
        data: uploads.map(upload => ({
          uploadId: upload.id,
          status: upload.status,
          inputImageUrl: upload.inputImageUrl,
          outputImageUrl: upload.outputImageUrl,
          outputImageUrls: upload.outputImageUrls, // Múltiplas URLs de imagem
          roomType: upload.roomType,
          furnitureStyle: upload.furnitureStyle,
          createdAt: upload.createdAt,
          updatedAt: upload.updatedAt,
        })),
      });
    } catch (error) {
      console.error('Erro ao buscar uploads do usuário:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
      });
    }
  }


}

export const virtualStagingController = new VirtualStagingController();
