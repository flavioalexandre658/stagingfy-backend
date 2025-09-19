import { Request, Response } from 'express';
import multer from 'multer';
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { uploadRepository } from '../repositories/upload.repository';
import { blackForestService } from '../services/black-forest.service';
import { 
  CreateUploadRequest, 
  RoomType, 
  FurnitureStyle 
} from '../interfaces/upload.interface';
import { generateWhiteMaskBase64 } from '../utils/image-mask.util';

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

export class UploadController {
  /**
   * Middleware do Multer para upload de arquivo único
   */
  public uploadMiddleware = upload.single('image');

  /**
   * Upload de imagem e início do processamento
   */
  async uploadImage(req: Request, res: Response): Promise<void> {
    try {
      // Validar se o arquivo foi enviado
      if (!req.file) {
        res.status(400).json({
          success: false,
          message: 'Nenhuma imagem foi enviada'
        });
        return;
      }

      // Validar dados do corpo da requisição
      const { roomType, furnitureStyle, plan = 'free', saveMask = false } = req.body as CreateUploadRequest & { plan: string };
      
      if (!roomType || !furnitureStyle) {
        res.status(400).json({
          success: false,
          message: 'roomType e furnitureStyle são obrigatórios'
        });
        return;
      }

      // Validar parâmetros com o service da Black Forest
      if (!blackForestService.validateParameters(roomType as RoomType, furnitureStyle as FurnitureStyle)) {
        res.status(400).json({
          success: false,
          message: 'Parâmetros de roomType ou furnitureStyle inválidos'
        });
        return;
      }

      // Obter ID do usuário (assumindo que vem do middleware de autenticação)
      const userId = (req as any).user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Usuário não autenticado'
        });
        return;
      }

      // Gerar nome único para o arquivo
      const fileExtension = path.extname(req.file.originalname);
      const fileName = `input/${userId}/${uuidv4()}${fileExtension}`;

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
      const upload = await uploadRepository.create({
        userId,
        roomType: roomType as RoomType,
        furnitureStyle: furnitureStyle as FurnitureStyle,
        inputImageUrl,
      });

      // Salvar máscara no S3 se solicitado
      let maskUrl: string | undefined;
      if (saveMask) {
        try {
          // Gerar máscara branca
          const maskBase64 = await generateWhiteMaskBase64(req.file.buffer);
          
          // Remover o prefixo data:image/png;base64, para obter apenas o base64
          const base64Data = maskBase64.replace(/^data:image\/png;base64,/, '');
          const maskBuffer = Buffer.from(base64Data, 'base64');
          
          // Gerar nome único para a máscara
          const maskFileName = `masks/${userId}/${uuidv4()}.png`;
          
          // Upload da máscara para S3
          const maskUploadCommand = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: maskFileName,
            Body: maskBuffer,
            ContentType: 'image/png',
          });
          
          await s3Client.send(maskUploadCommand);
          
          // Gerar URL da máscara no S3
          maskUrl = `https://${BUCKET_NAME}.s3.amazonaws.com/${maskFileName}`;
          
          // Atualizar o registro no banco com a URL da máscara
          await uploadRepository.updateMaskUrl(upload.id, maskUrl);
          
        } catch (maskError) {
          console.error('Erro ao salvar máscara:', maskError);
          // Não falhar o upload principal se houver erro na máscara
        }
      }

      // Iniciar processamento assíncrono
      this.processImageAsync(upload.id, inputImageUrl, roomType as RoomType, furnitureStyle as FurnitureStyle);

      // Retornar resposta imediata
      const responseData: any = {
        uploadId: upload.id,
        status: upload.status,
        inputImageUrl: upload.inputImageUrl,
        createdAt: upload.createdAt
      };

      // Incluir URL da máscara na resposta se foi salva
      if (maskUrl) {
        responseData.maskUrl = maskUrl;
      }

      res.status(201).json({
        success: true,
        message: 'Upload realizado com sucesso. Processamento iniciado.',
        data: responseData
      });

    } catch (error) {
      console.error('Erro no upload:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
        error: error instanceof Error ? error.message : 'Erro desconhecido'
      });
    }
  }

  /**
   * Processamento assíncrono da imagem
   */
  private async processImageAsync(
    uploadId: string,
    inputImageUrl: string,
    roomType: RoomType,
    furnitureStyle: FurnitureStyle
  ): Promise<void> {
    try {
      // Atualizar status para processing
      await uploadRepository.updateStatus(uploadId, 'processing');

      // Baixar a imagem do S3 para obter o buffer
      const imageResponse = await fetch(inputImageUrl);
      if (!imageResponse.ok) {
        throw new Error(`Erro ao baixar imagem: ${imageResponse.statusText}`);
      }
      const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

      // Converter imagem para base64
      const imageBase64 = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;

      // Gerar máscara branca com as mesmas dimensões da imagem
      const maskBase64 = await generateWhiteMaskBase64(imageBuffer);

      // Chamar Black Forest API com imagem e máscara em base64
      const blackForestResponse = await blackForestService.generateStagedImage(
        imageBase64,
        maskBase64,
        roomType,
        furnitureStyle
      );

      // Salvar job ID da Black Forest
      if (blackForestResponse.id) {
        await uploadRepository.updateBlackForestJobId(uploadId, blackForestResponse.id);

        // Aguardar conclusão do processamento (polling)
        await this.waitForCompletion(uploadId, blackForestResponse.id);
      } else {
        throw new Error('Black Forest API não retornou um job ID válido');
      }

    } catch (error) {
      console.error(`Erro no processamento do upload ${uploadId}:`, error);
      await uploadRepository.updateStatus(
        uploadId, 
        'failed', 
        error instanceof Error ? error.message : 'Erro desconhecido'
      );
    }
  }

  /**
   * Aguarda a conclusão do processamento na Black Forest API
   */
  private async waitForCompletion(uploadId: string, jobId: string): Promise<void> {
    const maxAttempts = 30; // 5 minutos (10s * 30)
    let attempts = 0;

    while (attempts < maxAttempts) {
      try {
        const jobStatus = await blackForestService.checkJobStatus(jobId);

        if (jobStatus.status === 'completed' && jobStatus.result?.url) {
          // Download da imagem processada e upload para S3
          const outputImageUrl = await this.saveProcessedImage(uploadId, jobStatus.result.url);
          
          // Atualizar registro com a URL final
          await uploadRepository.updateOutputImage(uploadId, outputImageUrl);
          return;

        } else if (jobStatus.status === 'failed') {
          await uploadRepository.updateStatus(uploadId, 'failed', jobStatus.error || 'Processamento falhou na Black Forest API');
          return;
        }

        // Aguardar 10 segundos antes da próxima verificação
        await new Promise(resolve => setTimeout(resolve, 10000));
        attempts++;

      } catch (error) {
        console.error(`Erro ao verificar status do job ${jobId}:`, error);
        attempts++;
      }
    }

    // Timeout
    await uploadRepository.updateStatus(uploadId, 'failed', 'Timeout no processamento');
  }

  /**
   * Salva a imagem processada no S3
   */
  private async saveProcessedImage(uploadId: string, imageUrl: string): Promise<string> {
    try {
      // Download da imagem da Black Forest
      const response = await fetch(imageUrl);
      if (!response.ok) {
        throw new Error(`Erro ao baixar imagem: ${response.statusText}`);
      }

      const imageBuffer = await response.arrayBuffer();
      
      // Upload para S3
      const fileName = `output/${uploadId}.png`;
      const uploadCommand = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileName,
        Body: Buffer.from(imageBuffer),
        ContentType: 'image/png',
      });

      await s3Client.send(uploadCommand);

      return `https://${BUCKET_NAME}.s3.amazonaws.com/${fileName}`;

    } catch (error) {
      console.error('Erro ao salvar imagem processada:', error);
      throw error;
    }
  }

  /**
   * Busca o status de um upload
   */
  async getUploadStatus(req: Request, res: Response): Promise<void> {
    try {
      const { uploadId } = req.params;
      const userId = (req as any).user?.id;

      if (!uploadId) {
        res.status(400).json({
          success: false,
          message: 'ID do upload é obrigatório'
        });
        return;
      }

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Usuário não autenticado'
        });
        return;
      }

      const upload = await uploadRepository.findById(uploadId);

      if (!upload) {
        res.status(404).json({
          success: false,
          message: 'Upload não encontrado'
        });
        return;
      }

      // Verificar se o upload pertence ao usuário
      if (upload.userId !== userId!) {
        res.status(403).json({
          success: false,
          message: 'Acesso negado'
        });
        return;
      }

      res.json({
        success: true,
        data: upload
      });

    } catch (error) {
      console.error('Erro ao buscar status do upload:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }

  /**
   * Lista uploads do usuário
   */
  async getUserUploads(req: Request, res: Response): Promise<void> {
    try {
      const userId = (req as any).user?.id;
      const limit = parseInt(req.query.limit as string) || 20;

      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Usuário não autenticado'
        });
        return;
      }

      const uploads = await uploadRepository.findByUserId(userId, limit);

      res.json({
        success: true,
        data: uploads
      });

    } catch (error) {
      console.error('Erro ao buscar uploads do usuário:', error);
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor'
      });
    }
  }
}

export const uploadController = new UploadController();