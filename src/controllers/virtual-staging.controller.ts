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
import { blackForestService } from '../services/black-forest.service';
import {
  CreateUploadRequest,
  RoomType,
  FurnitureStyle,
  Upload,
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
        plan = 'free',
      } = req.body as CreateUploadRequest & { plan: string };

      if (!roomType || !furnitureStyle) {
        res.status(400).json({
          success: false,
          message: 'roomType e furnitureStyle são obrigatórios',
        });
        return;
      }

      // Validar tipos permitidos
      const validRoomTypes: RoomType[] = [
        'living_room',
        'bedroom',
        'kitchen',
        'bathroom',
        'dining_room',
        'office',
        'balcony',
      ];
      const validFurnitureStyles: FurnitureStyle[] = [
        'modern',
        'japanese_minimalist',
        'scandinavian',
        'industrial',
        'classic',
        'contemporary',
        'rustic',
        'bohemian',
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
      if (!chatGPTService || !process.env.BLACK_FOREST_API_KEY) {
        res.status(500).json({
          success: false,
          message: 'Serviços de IA não configurados',
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
        inputImageUrl,
      });

      // Iniciar processamento assíncrono
      this.processVirtualStagingAsync(
        uploadRecord.id,
        inputImageUrl,
        req.file.buffer,
        roomType as RoomType,
        furnitureStyle as FurnitureStyle
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
    furnitureStyle: FurnitureStyle
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

      // Etapa 1: Gerar prompt otimizado com ChatGPT Vision
      console.log(
        `[${uploadId}] Etapa 1: Gerando prompt otimizado com ChatGPT Vision...`
      );
      const stagingPrompt = await chatGPTService.generateVirtualStagingPrompt(
        roomType,
        furnitureStyle,
        imageBase64
      );
      console.log(`[${uploadId}] Prompt gerado:`, {
        promptLength: stagingPrompt.prompt.length,
        designPrinciplesCount: stagingPrompt.designPrinciples.length,
        suggestedElementsCount: stagingPrompt.suggestedElements.length,
      });

      console.log('prompt', stagingPrompt.prompt);

      // Etapa 2: Processar com flux-kontext-pro
      console.log(`[${uploadId}] Etapa 2: Processando com flux-kontext-pro...`);
      const fluxResponse = await blackForestService.generateVirtualStaging(
        imageBase64,
        stagingPrompt.prompt
      );

      // Salvar job ID no banco de dados
      if (fluxResponse.id) {
        console.log(
          `[${uploadId}] Salvando job ID ${fluxResponse.id} no banco de dados...`
        );
        await uploadRepository.updateBlackForestJobId(
          uploadId,
          fluxResponse.id
        );
      }

      // Etapa 3: Aguardar conclusão (se necessário)
      console.log(
        `[${uploadId}] Etapa 3: Aguardando conclusão do processamento...`
      );
      let completedJob = fluxResponse;

      // Se retornou um job ID, aguardar conclusão
      if (fluxResponse.id && !fluxResponse.result) {
        const maxAttempts = 30; // 1 minuto (2s * 30)
        let attempts = 0;

        console.log(
          `[${uploadId}] Iniciando polling para job ${fluxResponse.id} (máximo ${maxAttempts} tentativas)`
        );

        while (attempts < maxAttempts) {
          try {
            console.log(
              `[${uploadId}] Verificando status do job (tentativa ${attempts + 1}/${maxAttempts})`
            );
            completedJob = await blackForestService.checkJobStatus(
              fluxResponse.id
            );

            console.log(`[${uploadId}] Status atual: ${completedJob.status}`);

            // Verificar se completou com sucesso
            if (completedJob.status === 'Ready' && completedJob.result) {
              console.log(`[${uploadId}] Job concluído com sucesso!`);
              break;
            }

            // Verificar se falhou
            if (
              completedJob.status === 'Error' ||
              completedJob.status === 'Task not found'
            ) {
              console.error(
                `[${uploadId}] Job falhou com status: ${completedJob.status}`
              );
              throw new Error(
                `Processamento falhou: ${completedJob.status} - ${completedJob.error || 'Job não encontrado'}`
              );
            }

            // Aguardar antes da próxima tentativa
            console.log(
              `[${uploadId}] Aguardando 2 segundos antes da próxima verificação...`
            );
            await new Promise(resolve => setTimeout(resolve, 2000));
            attempts++;
          } catch (error) {
            console.error(
              `[${uploadId}] Erro ao verificar status do job ${fluxResponse.id} (tentativa ${attempts + 1}):`,
              error
            );
            attempts++;

            // Se for erro 404, aguardar um pouco mais antes de tentar novamente
            if (error instanceof Error && error.message.includes('404')) {
              console.log(
                `[${uploadId}] Erro 404 detectado, aguardando 5 segundos extras...`
              );
              await new Promise(resolve => setTimeout(resolve, 5000));
            }
          }
        }

        // Se esgotou as tentativas
        if (attempts >= maxAttempts) {
          console.error(
            `[${uploadId}] Timeout: Esgotadas ${maxAttempts} tentativas de verificação`
          );
          throw new Error(
            'Timeout: Processamento não foi concluído no tempo esperado'
          );
        }
      }

      const imageUrl = completedJob.result?.sample || completedJob.result?.url;
      if (!imageUrl) {
        console.error(
          `[${uploadId}] Erro: Nenhuma imagem foi gerada no resultado`
        );
        throw new Error('Nenhuma imagem foi gerada');
      }

      console.log(`[${uploadId}] URL da imagem gerada: ${imageUrl}`);

      // Etapa 4: Salvar imagem processada
      console.log(`[${uploadId}] Etapa 4: Salvando imagem processada...`);
      const outputImageUrl = await this.saveProcessedImage(uploadId, imageUrl);
      console.log(`[${uploadId}] Imagem salva em: ${outputImageUrl}`);

      // Atualizar registro com resultado
      console.log(`[${uploadId}] Atualizando registro no banco de dados...`);
      await uploadRepository.updateOutputImage(uploadId, outputImageUrl);
      await uploadRepository.updateStatus(uploadId, 'completed');

      const processingTime = Date.now() - startTime;
      console.log(`[${uploadId}] Virtual staging concluído com sucesso!`, {
        uploadId,
        outputImageUrl,
        processingTimeMs: processingTime,
        processingTimeSeconds: Math.round(processingTime / 1000),
        timestamp: new Date().toISOString(),
      });
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
