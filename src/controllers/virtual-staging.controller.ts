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
import { stagingPlanService } from '../services/staging-plan.service';
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
    fieldSize: 1024 * 1024, // 1MB para campos de texto
    fields: 10, // máximo 10 campos
    files: 4, // máximo 4 arquivos (1 principal + 3 referência)
  },
  fileFilter: (req, file, cb) => {
    console.log('File filter - fieldname:', file.fieldname);
    console.log('File filter - mimetype:', file.mimetype);
    console.log('File filter - originalname:', file.originalname);

    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    const allowedFields = [
      'image',
      'referenceImage2',
      'referenceImage3',
      'referenceImage4',
    ];

    if (
      allowedTypes.includes(file.mimetype) &&
      allowedFields.includes(file.fieldname)
    ) {
      cb(null, true);
    } else if (!allowedTypes.includes(file.mimetype)) {
      cb(new Error('Tipo de arquivo não permitido. Use JPEG, PNG ou WebP.'));
    } else {
      cb(
        new Error(
          `Campo não permitido: ${file.fieldname}. Use: image, referenceImage2, referenceImage3, referenceImage4`
        )
      );
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
   * Middleware de debug para verificar a requisição
   */
  public debugMiddleware = (req: Request, res: Response, next: Function) => {
    console.log('=== DEBUG MIDDLEWARE ===');
    console.log('Content-Type:', req.headers['content-type']);
    console.log('Method:', req.method);
    console.log('Body keys:', Object.keys(req.body || {}));
    console.log('Has file property:', 'file' in req);
    console.log('Has files property:', 'files' in req);
    console.log('========================');
    next();
  };

  /**
   * Middleware do Multer para upload de imagem com tratamento de erro
   */
  public uploadMiddleware = (
    req: Request,
    res: Response,
    next: Function
  ): void => {
    upload.single('image')(req, res, (err: any) => {
      if (err) {
        console.error('Multer error:', err);
        console.log('Request headers:', req.headers);
        console.log('Content-Type:', req.headers['content-type']);

        if (err.code === 'LIMIT_FILE_SIZE') {
          res.status(400).json({
            success: false,
            message: 'Arquivo muito grande. Tamanho máximo: 10MB',
          });
          return;
        }

        if (err.message === 'Field name missing') {
          res.status(400).json({
            success: false,
            message:
              'Campo "image" não encontrado. Certifique-se de enviar o arquivo com o nome "image" em multipart/form-data',
            debug: {
              contentType: req.headers['content-type'],
              hasBody: !!req.body,
              bodyKeys: Object.keys(req.body || {}),
            },
          });
          return;
        }

        res.status(400).json({
          success: false,
          message: err.message || 'Erro no upload do arquivo',
        });
        return;
      }
      next();
    });
  };

  /**
   * Middleware do Multer para upload de múltiplas imagens (1 principal + até 3 de referência)
   */
  public uploadMultipleMiddleware = (
    req: Request,
    res: Response,
    next: Function
  ): void => {
    const uploadFields = upload.fields([
      { name: 'image', maxCount: 1 }, // Imagem principal obrigatória
      { name: 'referenceImage2', maxCount: 1 }, // Imagem de referência opcional
      { name: 'referenceImage3', maxCount: 1 }, // Imagem de referência opcional
      { name: 'referenceImage4', maxCount: 1 }, // Imagem de referência opcional
    ]);

    uploadFields(req, res, (err: any) => {
      if (err) {
        console.error('Multer error:', err);
        console.log('Request headers:', req.headers);
        console.log('Content-Type:', req.headers['content-type']);

        if (err.code === 'LIMIT_FILE_SIZE') {
          res.status(400).json({
            success: false,
            message: 'Arquivo muito grande. Tamanho máximo: 10MB por arquivo',
          });
          return;
        }

        res.status(400).json({
          success: false,
          message: err.message || 'Erro no upload dos arquivos',
        });
        return;
      }

      // Verificar se a imagem principal foi enviada
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      if (!files || !files.image || files.image.length === 0) {
        res.status(400).json({
          success: false,
          message: 'Imagem principal é obrigatória. Envie com o campo "image"',
        });
        return;
      }

      console.log('=== UPLOAD MULTIPLE DEBUG ===');
      console.log('Files received:', Object.keys(files));
      console.log('Image count:', files.image?.length || 0);
      console.log('Reference images:', {
        referenceImage2: files.referenceImage2?.length || 0,
        referenceImage3: files.referenceImage3?.length || 0,
        referenceImage4: files.referenceImage4?.length || 0,
      });
      console.log('=============================');

      next();
    });
  };

  /**
   * Processa virtual staging em 3 etapas usando Black Forest provider
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
      if (!stagingPlanService) {
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

      // Iniciar processamento assíncrono em etapas
      this.processVirtualStagingInStagesAsync(
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
   * Processa virtual staging com imagens de referência opcionais
   */
  async processVirtualStagingWithReferences(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      // Validar se as imagens foram enviadas
      const files = req.files as { [fieldname: string]: Express.Multer.File[] };
      if (!files || !files.image || files.image.length === 0) {
        res.status(400).json({
          success: false,
          message: 'Imagem principal é obrigatória',
        });
        return;
      }

      const mainImage = files.image[0]!; // Já validamos que existe acima
      const referenceImage2 = files.referenceImage2?.[0];
      const referenceImage3 = files.referenceImage3?.[0];
      const referenceImage4 = files.referenceImage4?.[0];

      // Validar dados do corpo da requisição
      const {
        roomType,
        furnitureStyle,
        provider = 'black-forest',
        plan = 'free',
        seed,
        customPrompt,
      } = req.body as CreateUploadRequest & {
        plan: string;
        seed?: number;
        customPrompt?: string;
      };

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
      if (!stagingPlanService) {
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

      // Upload da imagem principal para S3
      const fileExtension = path.extname(mainImage.originalname);
      const fileName = `virtual-staging/input/${userId}/${uuidv4()}${fileExtension}`;

      const uploadCommand = new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: fileName,
        Body: mainImage.buffer,
        ContentType: mainImage.mimetype,
      });

      await s3Client.send(uploadCommand);
      const inputImageUrl = `https://${BUCKET_NAME}.s3.amazonaws.com/${fileName}`;

      // Upload das imagens de referência para S3 (se fornecidas)
      const referenceImageUrls: string[] = [];
      const referenceImages = [
        referenceImage2,
        referenceImage3,
        referenceImage4,
      ];

      for (let i = 0; i < referenceImages.length; i++) {
        const refImage = referenceImages[i];
        if (refImage) {
          const refFileExtension = path.extname(refImage.originalname);
          const refFileName = `virtual-staging/reference/${userId}/${uuidv4()}${refFileExtension}`;

          const refUploadCommand = new PutObjectCommand({
            Bucket: BUCKET_NAME,
            Key: refFileName,
            Body: refImage.buffer,
            ContentType: refImage.mimetype,
          });

          await s3Client.send(refUploadCommand);
          const refImageUrl = `https://${BUCKET_NAME}.s3.amazonaws.com/${refFileName}`;
          referenceImageUrls.push(refImageUrl);
        }
      }

      // Criar registro no banco de dados
      const uploadRecord = await uploadRepository.create({
        userId,
        roomType: roomType as RoomType,
        furnitureStyle: furnitureStyle as FurnitureStyle,
        provider: provider as Provider,
        inputImageUrl,
      });

      // Iniciar processamento assíncrono com imagens de referência
      this.processVirtualStagingInStagesWithReferencesAsync(
        uploadRecord.id,
        inputImageUrl,
        mainImage.buffer,
        roomType as RoomType,
        furnitureStyle as FurnitureStyle,
        provider as Provider,
        referenceImageUrls,
        seed ? parseInt(seed.toString()) : undefined,
        customPrompt
      );

      // Retornar resposta imediata
      res.status(200).json({
        success: true,
        data: {
          uploadId: uploadRecord.id,
          status: uploadRecord.status,
          inputImageUrl: uploadRecord.inputImageUrl,
          referenceImagesCount: referenceImageUrls.length,
          createdAt: uploadRecord.createdAt,
        },
      });
    } catch (error) {
      console.error(
        'Erro no processamento de virtual staging com referências:',
        error
      );
      res.status(500).json({
        success: false,
        message: 'Erro interno do servidor',
      });
    }
  }

  /**
   * Processa virtual staging em etapas de forma assíncrona
   */
  private async processVirtualStagingInStagesAsync(
    uploadId: string,
    inputImageUrl: string,
    imageBuffer: Buffer,
    roomType: RoomType,
    furnitureStyle: FurnitureStyle,
    provider: Provider
  ): Promise<void> {
    console.log(
      `[${uploadId}] 🚀 Iniciando processamento em etapas assíncrono de virtual staging`,
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
      // Atualizar status para 'processing'
      console.log(`[${uploadId}] Atualizando status para 'processing'`);
      await uploadRepository.updateStatus(uploadId, 'processing');

      // Verificar se é Black Forest provider
      if (provider !== 'black-forest') {
        console.log(
          `[${uploadId}] ❌ Provider ${provider} não suporta processamento em etapas`
        );
        await uploadRepository.updateStatus(
          uploadId,
          'failed',
          'Staging in stages is only available for Black Forest provider'
        );
        return;
      }

      // Converter imagem para base64
      const imageBase64 = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;

      // Configurar parâmetros
      const params = {
        uploadId: uploadId,
        imageBase64: imageBase64,
        roomType: roomType,
        furnitureStyle: furnitureStyle,
      };

      // Configurar callback de progresso
      const onProgress = (progress: any) => {
        console.log(`[${uploadId}] 📊 Progress:`, progress);
      };

      // Processar staging em etapas usando o provider diretamente
      const blackForestConfig = providerConfigManager.getConfig('black-forest');

      if (!blackForestConfig) {
        console.log(`[${uploadId}] ❌ Black Forest provider não configurado`);
        await uploadRepository.updateStatus(
          uploadId,
          'failed',
          'Black Forest provider not configured'
        );
        return;
      }

      // Importar e instanciar o provider diretamente
      const { BlackForestProvider } = await import(
        '../services/providers/black-forest.provider'
      );
      const provider_instance = new BlackForestProvider(blackForestConfig);

      console.log(
        `[${uploadId}] 🔄 Iniciando processamento em etapas com Black Forest`
      );
      const result = await provider_instance.processVirtualStagingInStages({
        uploadId,
        imageBase64,
        roomType,
        furnitureStyle,
      });

      // Se a primeira etapa foi enviada com sucesso, inicializar o staging
      if (result.success && result.requestId && result.metadata?.stagingPlan) {
        console.log(
          `[${uploadId}] ✅ Primeira etapa enviada. Inicializando staging...`
        );
        await uploadRepository.initializeStaging(
          uploadId,
          result.metadata.stagingPlan,
          result.requestId
        );
        console.log(
          `[${uploadId}] 📊 Staging inicializado. Aguardando webhook...`
        );
        return;
      }

      // Verificar se há sucesso parcial com imagem válida
      const metadata = result.metadata as any;
      const hasPartialSuccess =
        metadata?.partialSuccess && result.outputImageUrl;

      if (result.success || hasPartialSuccess) {
        if (hasPartialSuccess) {
          console.log(`[${uploadId}] ⚠️ Processamento com sucesso parcial!`, {
            uploadId,
            outputImageUrl: result.outputImageUrl,
            failedStage: metadata.failedStage,
            returnedFromStage: metadata.returnedFromStage,
            metadata: result.metadata,
            timestamp: new Date().toISOString(),
          });
        } else {
          console.log(
            `[${uploadId}] ✅ Processamento em etapas concluído com sucesso!`,
            {
              uploadId,
              outputImageUrl: result.outputImageUrl,
              metadata: result.metadata,
              timestamp: new Date().toISOString(),
            }
          );
        }

        // Atualizar registro no banco
        if (result.outputImageUrl) {
          await uploadRepository.updateOutputImage(
            uploadId,
            result.outputImageUrl,
            undefined,
            true
          );
        }
      } else {
        console.log(
          `[${uploadId}] ❌ Falha no processamento em etapas:`,
          result.errorMessage
        );

        // Verificar se há informações sobre sucesso parcial nos metadados
        const metadata = result.metadata as any;
        let errorMessage = result.errorMessage || 'Staging in stages failed';

        if (
          metadata?.partialSuccess &&
          metadata?.failedStage &&
          metadata?.returnedFromStage
        ) {
          errorMessage = `Falha na etapa ${metadata.failedStage}: ${result.errorMessage}. Retornando imagem da etapa ${metadata.returnedFromStage}.`;
          console.log(
            `[${uploadId}] 🔄 Sucesso parcial: Falhou na etapa ${metadata.failedStage}, mas retornou imagem da etapa ${metadata.returnedFromStage}`
          );
        }

        await uploadRepository.updateStatus(uploadId, 'failed', errorMessage);
      }
    } catch (error) {
      console.error(
        `[${uploadId}] 💥 Erro no processamento em etapas assíncrono:`,
        error
      );
      await uploadRepository.updateStatus(
        uploadId,
        'failed',
        'Internal server error during staging in stages'
      );
    }
  }

  /**
   * Processa virtual staging em etapas com imagens de referência de forma assíncrona
   */
  private async processVirtualStagingInStagesWithReferencesAsync(
    uploadId: string,
    inputImageUrl: string,
    imageBuffer: Buffer,
    roomType: RoomType,
    furnitureStyle: FurnitureStyle,
    provider: Provider,
    referenceImageUrls: string[],
    seed?: number,
    customPrompt?: string
  ): Promise<void> {
    console.log(
      `[${uploadId}] 🚀 Iniciando processamento em etapas com referências`,
      {
        uploadId,
        inputImageUrl,
        roomType,
        furnitureStyle,
        imageSize: imageBuffer.length,
        referenceImagesCount: referenceImageUrls.length,
        seed,
        customPrompt,
        timestamp: new Date().toISOString(),
      }
    );

    try {
      // Atualizar status para 'processing'
      console.log(`[${uploadId}] Atualizando status para 'processing'`);
      await uploadRepository.updateStatus(uploadId, 'processing');

      // Verificar se é Black Forest provider
      if (provider !== 'black-forest') {
        console.log(
          `[${uploadId}] ❌ Provider ${provider} não suporta processamento com referências`
        );
        await uploadRepository.updateStatus(
          uploadId,
          'failed',
          'Reference images are only available for Black Forest provider'
        );
        return;
      }

      // Converter imagem principal para base64
      const imageBase64 = `data:image/jpeg;base64,${imageBuffer.toString('base64')}`;

      // Converter imagens de referência para base64 (se fornecidas)
      const referenceImagesBase64: string[] = [];
      for (const refUrl of referenceImageUrls) {
        try {
          // Baixar imagem de referência do S3
          const key = refUrl.replace(
            `https://${BUCKET_NAME}.s3.amazonaws.com/`,
            ''
          );
          const getCommand = new GetObjectCommand({
            Bucket: BUCKET_NAME,
            Key: key,
          });

          const response = await s3Client.send(getCommand);
          const buffer = await response.Body?.transformToByteArray();

          if (buffer) {
            const base64 = `data:image/jpeg;base64,${Buffer.from(buffer).toString('base64')}`;
            referenceImagesBase64.push(base64);
          }
        } catch (error) {
          console.error(
            `[${uploadId}] Erro ao baixar imagem de referência ${refUrl}:`,
            error
          );
        }
      }

      // Configurar parâmetros com imagens de referência
      const params = {
        uploadId: uploadId,
        imageBase64: imageBase64,
        roomType: roomType,
        furnitureStyle: furnitureStyle,
        ...(referenceImagesBase64[0] && {
          referenceImage2: referenceImagesBase64[0],
        }),
        ...(referenceImagesBase64[1] && {
          referenceImage3: referenceImagesBase64[1],
        }),
        ...(referenceImagesBase64[2] && {
          referenceImage4: referenceImagesBase64[2],
        }),
        options: {
          ...(seed && { seed }),
          ...(customPrompt && { customPrompt }),
        },
      };

      // Configurar callback de progresso
      const onProgress = (progress: any) => {
        console.log(`[${uploadId}] 📊 Progress:`, progress);
      };

      // Processar staging em etapas usando o provider diretamente
      const blackForestConfig = providerConfigManager.getConfig('black-forest');

      if (!blackForestConfig) {
        console.log(`[${uploadId}] ❌ Black Forest provider não configurado`);
        await uploadRepository.updateStatus(
          uploadId,
          'failed',
          'Black Forest provider not configured'
        );
        return;
      }

      // Importar e instanciar o provider diretamente
      const { BlackForestProvider } = await import(
        '../services/providers/black-forest.provider'
      );
      const provider_instance = new BlackForestProvider(blackForestConfig);

      console.log(
        `[${uploadId}] 🔄 Iniciando processamento em etapas com Black Forest`
      );
      const result =
        await provider_instance.processVirtualStagingInStages(params);

      // Se a primeira etapa foi enviada com sucesso, inicializar o staging
      if (result.success && result.requestId && result.metadata?.stagingPlan) {
        console.log(
          `[${uploadId}] ✅ Primeira etapa enviada. Inicializando staging...`
        );
        await uploadRepository.initializeStaging(
          uploadId,
          result.metadata.stagingPlan,
          result.requestId
        );
        console.log(
          `[${uploadId}] 📊 Staging inicializado. Aguardando webhook...`
        );
        return;
      }

      // Verificar se há sucesso parcial com imagem válida
      const metadata = result.metadata as any;
      const hasPartialSuccess =
        metadata?.partialSuccess && result.outputImageUrl;

      if (result.success || hasPartialSuccess) {
        if (hasPartialSuccess) {
          console.log(`[${uploadId}] ⚠️ Processamento com sucesso parcial!`, {
            uploadId,
            outputImageUrl: result.outputImageUrl,
            referenceImagesUsed: referenceImagesBase64.length,
            timestamp: new Date().toISOString(),
          });
        } else {
          console.log(
            `[${uploadId}] ✅ Processamento com referências concluído com sucesso!`,
            {
              uploadId,
              outputImageUrl: result.outputImageUrl,
              referenceImagesUsed: referenceImagesBase64.length,
              timestamp: new Date().toISOString(),
            }
          );
        }

        // Atualizar registro no banco
        if (result.outputImageUrl) {
          await uploadRepository.updateOutputImage(
            uploadId,
            result.outputImageUrl,
            undefined,
            true
          );
        }
      } else {
        console.log(
          `[${uploadId}] ❌ Falha no processamento com referências:`,
          result.errorMessage
        );
        await uploadRepository.updateStatus(
          uploadId,
          'failed',
          result.errorMessage || 'Processing with references failed'
        );
      }
    } catch (error) {
      console.error(
        `[${uploadId}] 💥 Erro no processamento com referências:`,
        error
      );
      await uploadRepository.updateStatus(
        uploadId,
        'failed',
        'Internal server error during processing with references'
      );
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
      const { userId } = req.params;
      const { limit = 20 } = req.query;

      const limitNum = parseInt(limit as string, 10);

      const uploads = await uploadRepository.findByUserId(userId!, limitNum);

      res.json({
        success: true,
        data: uploads,
      });
    } catch (error) {
      console.error('Error getting user virtual stagings:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to get virtual stagings',
      });
    }
  }

  /**
   * Novo endpoint para staging em etapas
   */
  async processVirtualStagingInStages(
    req: Request,
    res: Response
  ): Promise<void> {
    try {
      const { uploadId } = req.params;

      if (!uploadId) {
        res.status(400).json({
          success: false,
          error: 'Upload ID is required',
        });
        return;
      }

      // Buscar upload existente
      const upload = await uploadRepository.findById(uploadId);
      if (!upload) {
        res.status(404).json({
          success: false,
          error: 'Upload not found',
        });
        return;
      }

      // Verificar se é Black Forest provider
      if (upload.provider !== 'black-forest') {
        res.status(400).json({
          success: false,
          error:
            'Staging in stages is only available for Black Forest provider',
        });
        return;
      }

      // Baixar imagem e converter para base64
      let imageBase64: string;
      try {
        const getObjectCommand = new GetObjectCommand({
          Bucket: BUCKET_NAME,
          Key: upload.inputImageUrl.split('/').pop()!,
        });

        const response = await s3Client.send(getObjectCommand);
        const imageBuffer = await response.Body!.transformToByteArray();
        imageBase64 = `data:image/jpeg;base64,${Buffer.from(imageBuffer).toString('base64')}`;
      } catch (error) {
        console.error(`[${uploadId}] Erro ao baixar imagem:`, error);
        res.status(500).json({
          success: false,
          error: 'Failed to download image for staging in stages',
        });
        return;
      }

      // Configurar parâmetros
      const params = {
        uploadId: upload.id,
        imageBase64: imageBase64,
        roomType: upload.roomType,
        furnitureStyle: upload.furnitureStyle,
        webhookUrl: req.body?.webhookUrl,
      };

      // Configurar callback de progresso (opcional)
      const onProgress = req.body?.enableProgress
        ? (progress: any) => {
            // Aqui você pode implementar WebSocket ou Server-Sent Events
            // para enviar atualizações de progresso em tempo real
            console.log(`[${uploadId}] Progress:`, progress);
          }
        : undefined;

      // Processar staging em etapas usando o provider diretamente
      const blackForestConfig = providerConfigManager.getConfig('black-forest');

      if (!blackForestConfig) {
        res.status(500).json({
          success: false,
          error: 'Black Forest provider not configured',
        });
        return;
      }

      // Importar e instanciar o provider diretamente
      const { BlackForestProvider } = await import(
        '../services/providers/black-forest.provider'
      );
      const provider = new BlackForestProvider(blackForestConfig);

      const result = await provider.processVirtualStagingInStages({
        uploadId,
        imageBase64,
        roomType: upload.roomType,
        furnitureStyle: upload.furnitureStyle,
      });

      if (result.success) {
        // Atualizar registro no banco
        if (result.outputImageUrl) {
          await uploadRepository.updateOutputImage(
            uploadId,
            result.outputImageUrl,
            undefined,
            true
          );
        }

        res.json({
          success: true,
          data: {
            uploadId,
            finalImageUrl: result.outputImageUrl,
            metadata: result.metadata,
          },
        });
      } else {
        await uploadRepository.updateStatus(
          uploadId,
          'failed',
          result.errorMessage || 'Staging in stages failed'
        );

        res.status(500).json({
          success: false,
          error: result.errorMessage || 'Staging in stages failed',
        });
      }
    } catch (error) {
      console.error('Error processing virtual staging in stages:', error);

      const { uploadId } = req.params;
      if (uploadId) {
        await uploadRepository.updateStatus(
          uploadId,
          'failed',
          'Internal server error during staging in stages'
        );
      }

      res.status(500).json({
        success: false,
        error: 'Failed to process virtual staging in stages',
      });
    }
  }
}

export const virtualStagingController = new VirtualStagingController();
