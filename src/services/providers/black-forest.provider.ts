import {
  IVirtualStagingProvider,
  VirtualStagingParams,
  VirtualStagingResult,
  ProviderConfig,
  ProviderCapabilities,
} from '../../interfaces/virtual-staging-provider.interface';
import { BaseService } from '../base.service';
import {
  Provider,
  RoomType,
  FurnitureStyle,
  BlackForestApiResponse,
  BlackForestWebhookResponse,
  LoraConfig,
  StagingPlan,
  StageSelectionConfig,
} from '../../interfaces/upload.interface';
import { stagingPlanService } from '../staging-plan.service';
import sharp from 'sharp';

type KontextRequest = {
  prompt: string;
  input_image: string; // base64: "data:image/jpeg;base64,..." - obrigatória
  input_image_2?: string; // base64: imagem de referência opcional
  input_image_3?: string; // base64: imagem de referência opcional
  input_image_4?: string; // base64: imagem de referência opcional
  width?: number; // manter tamanho original (múltiplo de 32)
  height?: number;
  aspect_ratio?: string; // "W:H" como fallback
  prompt_upsampling?: boolean; // evitar reescrever o prompt
  seed?: number; // opcional: reproduzibilidade
  output_format?: 'jpeg' | 'png' | 'webp';
  safety_tolerance?: number;
  guidance?: number; // se suportado pelo provedor
  webhook_url?: string; // URL para receber notificação quando processamento completar
  webhook_secret?: string; // segredo para validação do webhook
};

/**
 * Adapter para o Black Forest que implementa a interface comum
 */
export class BlackForestProvider
  extends BaseService
  implements IVirtualStagingProvider
{
  readonly name: Provider = 'black-forest';
  readonly version = '1.0.0';
  readonly isAsync = true;
  readonly supportsWebhooks = true;
  readonly config: ProviderConfig;

  // Cache temporário para jobIds recém-criados (para lidar com race conditions)
  private static jobIdCache = new Map<
    string,
    { uploadId: string; stage: string; timestamp: number }
  >();

  private readonly loraConfig: LoraConfig = {
    roomType: {
      bedroom: 'bedroom_lora',
      living_room: 'living_room_lora',
      kitchen: 'kitchen_lora',
      bathroom: 'bathroom_lora',
      home_office: 'home_office_lora',
      dining_room: 'dining_room_lora',
      kids_room: 'kids_room_lora',
      outdoor: 'outdoor_lora',
    },
    furnitureStyle: {
      standard: 'standard_furniture_lora',
      modern: 'modern_furniture_lora',
      scandinavian: 'scandinavian_lora',
      industrial: 'industrial_lora',
      midcentury: 'midcentury_lora',
      luxury: 'luxury_lora',
      coastal: 'coastal_lora',
      farmhouse: 'farmhouse_lora',
    },
  };

  constructor(config: ProviderConfig) {
    super();
    this.config = config;
  }

  // Métodos para gerenciar cache de jobIds
  private static addToCache(
    jobId: string,
    uploadId: string,
    stage: string
  ): void {
    console.log(
      `[CACHE] Adding jobId ${jobId} to cache for upload ${uploadId}, stage: ${stage}`
    );
    BlackForestProvider.jobIdCache.set(jobId, {
      uploadId,
      stage,
      timestamp: Date.now(),
    });

    // Limpar cache após 2 minutos para lidar com webhooks mais lentos
    setTimeout(() => {
      console.log(`[CACHE] Removing expired jobId ${jobId} from cache`);
      BlackForestProvider.jobIdCache.delete(jobId);
    }, 120000);
  }

  static getFromCache(
    jobId: string
  ): { uploadId: string; stage: string } | null {
    console.log(
      `[CACHE] Looking for jobId ${jobId} in cache. Cache size: ${BlackForestProvider.jobIdCache.size}`
    );
    const cached = BlackForestProvider.jobIdCache.get(jobId);
    if (cached) {
      const age = Date.now() - cached.timestamp;
      console.log(`[CACHE] Found jobId ${jobId} in cache, age: ${age}ms`);
      // Verificar se não expirou (máximo 2 minutos)
      if (age < 120000) {
        console.log(
          `[CACHE] Cache hit for jobId ${jobId}, returning upload ${cached.uploadId}`
        );
        return { uploadId: cached.uploadId, stage: cached.stage };
      } else {
        console.log(
          `[CACHE] Cache expired for jobId ${jobId}, removing from cache`
        );
        BlackForestProvider.jobIdCache.delete(jobId);
      }
    } else {
      console.log(`[CACHE] Cache miss for jobId ${jobId}`);
    }
    return null;
  }

  // ------------ helpers de tamanho ------------
  private roundToMultiple(value: number, step = 32) {
    return Math.max(step, Math.round(value / step) * step);
  }

  /**
   * Limita mantendo proporção dentro do intervalo aceito pelo provedor.
   * Ajuste os limites conforme sua conta/endpoint (ex.: 512–1536).
   */
  private clampToLimits(
    width: number,
    height: number,
    minSide = 512,
    maxSide = 1536
  ) {
    const ratio = width / height;

    // Se algum lado estourar, escala proporcionalmente
    const scaleDown = Math.max(width / maxSide, height / maxSide, 1); // >=1 reduz
    const scaledW = Math.round(width / scaleDown);
    const scaledH = Math.round(height / scaleDown);

    const scaleUp = Math.max(minSide / scaledW, minSide / scaledH, 1); // >=1 aumenta
    const finalW = Math.round(scaledW * scaleUp);
    const finalH = Math.round(scaledH * scaleUp);

    return { width: finalW, height: finalH, ratio };
  }

  private async getImageDimsFromBase64(imageBase64: string) {
    // aceita tanto "data:image/...;base64,XXXX" quanto só o payload
    const payload = imageBase64.includes('base64,')
      ? imageBase64.split('base64,')[1]
      : imageBase64;

    if (!payload) {
      throw new Error('Invalid base64 image data');
    }

    const buf = Buffer.from(payload, 'base64');
    const meta = await sharp(buf).metadata();
    if (!meta.width || !meta.height) {
      throw new Error('Unable to read image dimensions');
    }
    return { width: meta.width, height: meta.height };
  }

  // ------------ prompt básico (você pode manter/ajustar depois) ------------
  private generatePrompt(roomType: RoomType, furnitureStyle: FurnitureStyle) {
    const roomTypeMap: Record<RoomType, string> = {
      bedroom: 'bedroom',
      living_room: 'living room',
      kitchen: 'kitchen',
      bathroom: 'bathroom',
      home_office: 'home office',
      dining_room: 'dining room',
      kids_room: 'kids room',
      outdoor: 'outdoor space',
    };
    const styleMap: Record<FurnitureStyle, string> = {
      standard: 'standard',
      modern: 'modern',
      scandinavian: 'Scandinavian',
      industrial: 'industrial',
      midcentury: 'mid-century modern',
      luxury: 'luxury',
      coastal: 'coastal',
      farmhouse: 'farmhouse',
    };

    return `Virtual staging of an empty ${roomTypeMap[roomType]} in ${styleMap[furnitureStyle]} style. Add only furniture and decor; do not change walls, floors, ceilings, doors, windows, lighting or architecture. Keep existing geometry and perspective intact. Photorealistic interior photography.`;
  }

  /**
   * Virtual staging com FLUX.1 Kontext Pro,
   * preservando a dimensão da foto original.
   */
  async generateVirtualStaging(
    imageBase64: string,
    prompt?: string,
    opts?: {
      seed?: number;
      referenceImages?: {
        image2?: string;
        image3?: string;
        image4?: string;
      };
    }
  ): Promise<BlackForestApiResponse> {
    try {
      // 1) Descobre o tamanho original
      const { width: ow, height: oh } =
        await this.getImageDimsFromBase64(imageBase64);

      // 2) Limita a faixa suportada e arredonda a múltiplos de 32
      const { width: cw, height: ch } = this.clampToLimits(ow, oh, 512, 1536);
      const width = this.roundToMultiple(cw, 32);
      const height = this.roundToMultiple(ch, 32);

      // 3) Monta request body com W/H + aspect_ratio
      const body: KontextRequest = {
        prompt: prompt ?? 'Add modern furniture only; do not change structure.',
        input_image: imageBase64,
        width,
        height,
        aspect_ratio: `${width}:${height}`, // alguns provedores exigem; não faz mal incluir
        prompt_upsampling: false, // evita "enfeitar" o prompt e mexer na cena
        output_format: 'jpeg',
        safety_tolerance: 2,
        guidance: 3.5, // use somente se o provedor expõe este parâmetro para Kontext
        ...(opts?.seed !== undefined && { seed: opts.seed }),
        ...(this.config.webhookUrl && { webhook_url: this.config.webhookUrl }),
        // Adicionar imagens de referência opcionais
        ...(opts?.referenceImages?.image2 && {
          input_image_2: opts.referenceImages.image2,
        }),
        ...(opts?.referenceImages?.image3 && {
          input_image_3: opts.referenceImages.image3,
        }),
        ...(opts?.referenceImages?.image4 && {
          input_image_4: opts.referenceImages.image4,
        }),
      };

      // Configurar timeout e retry
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 segundos timeout

      let lastError: Error | null = null;
      let resp: Response | null = null;

      // Retry logic - 3 tentativas
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          resp = await fetch(`${this.config.baseUrl}/v1/flux-kontext-pro`, {
            method: 'POST',
            headers: {
              'x-key': this.config.apiKey,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(body),
            signal: controller.signal,
          });

          clearTimeout(timeoutId);
          break; // Sucesso, sair do loop
        } catch (error) {
          lastError = error as Error;

          if (attempt === 3) {
            this.logger.error(
              'Black Forest API request failed after all retries:',
              error as Error
            );
          }

          if (attempt < 3) {
            const delay = attempt * 2000; // 2s, 4s
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }
      }

      if (!resp) {
        clearTimeout(timeoutId);
        throw lastError || new Error('Todas as tentativas de conexão falharam');
      }

      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`Black Forest API error: ${resp.status} - ${txt}`);
      }

      const json = (await resp.json()) as BlackForestApiResponse;
      return json;
    } catch (error) {
      this.logger.error('Error calling FLUX.1 Kontext Pro:', error as Error);
      throw new Error(
        `Failed to generate virtual staging: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  async checkJobStatusInternal(jobId: string): Promise<BlackForestApiResponse> {
    const resp = await fetch(
      `${this.config.baseUrl}/v1/get_result?id=${jobId}`,
      {
        method: 'GET',
        headers: {
          'x-key': this.config.apiKey,
          'Content-Type': 'application/json',
        },
      }
    );
    if (!resp.ok) {
      // 404: geralmente ainda processando, não é um erro
      if (resp.status === 404) {
        return {
          id: jobId,
          status: 'Pending',
          progress: null,
          details: null,
          preview: null,
        };
      }
      // Outros erros HTTP são realmente erros
      return {
        id: jobId,
        status: 'Error',
        error: `HTTP ${resp.status}: ${await resp.text()}`,
      };
    }
    return (await resp.json()) as BlackForestApiResponse;
  }

  validateParametersInternal(
    roomType: RoomType,
    furnitureStyle: FurnitureStyle
  ) {
    const validRoomTypes = Object.keys(this.loraConfig.roomType) as RoomType[];
    const validStyles = Object.keys(
      this.loraConfig.furnitureStyle
    ) as FurnitureStyle[];
    return (
      validRoomTypes.includes(roomType) && validStyles.includes(furnitureStyle)
    );
  }

  /**
   * Processa virtual staging usando Black Forest
   */
  async processVirtualStaging(
    params: VirtualStagingParams
  ): Promise<VirtualStagingResult> {
    try {
      this.validateParams(params);

      this.logOperation('Processing virtual staging with Black Forest', {
        roomType: params.roomType,
        furnitureStyle: params.furnitureStyle,
        uploadId: params.uploadId,
      });

      // Usar o método correto do flux-kontext-pro
      const prompt = this.generatePrompt(
        params.roomType,
        params.furnitureStyle
      );

      // Preparar imagens de referência se fornecidas
      const referenceImages = {
        ...(params.referenceImage2 && { image2: params.referenceImage2 }),
        ...(params.referenceImage3 && { image3: params.referenceImage3 }),
        ...(params.referenceImage4 && { image4: params.referenceImage4 }),
      };

      const response = await this.generateVirtualStaging(
        params.imageBase64 || '',
        prompt,
        {
          ...(params.options?.seed !== undefined && {
            seed: params.options.seed,
          }),
          ...(Object.keys(referenceImages).length > 0 && { referenceImages }),
        }
      );

      if (response.error) {
        return {
          success: false,
          errorMessage: response.error,
        };
      }

      // Para Black Forest, sempre retorna um job ID para polling
      if (response.id) {
        return {
          success: true,
          requestId: response.id,
          metadata: {
            status: response.status,
            polling_url: response.polling_url,
            progress: response.progress,
          },
        };
      }

      throw new Error('Unexpected response format from Black Forest');
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Black Forest processing error:', error as Error);
      return {
        success: false,
        errorMessage: `Black Forest processing failed: ${errorMessage}`,
      };
    }
  }

  /**
   * Verifica status de job
   */
  async checkJobStatus(requestId: string): Promise<VirtualStagingResult> {
    try {
      const response = await this.checkJobStatusInternal(requestId);

      if (response.error) {
        return {
          success: false,
          errorMessage: response.error,
        };
      }

      const status = response.status;

      if (status === 'Ready' && response.result?.sample) {
        return {
          success: true,
          outputImageUrl: response.result.sample.trim(),
          metadata: {
            status: 'completed',
            progress: response.progress,
            width: response.result.width,
            height: response.result.height,
          },
        };
      } else if (status === 'Error') {
        return {
          success: false,
          errorMessage: response.error || 'Job failed',
        };
      } else {
        // Still processing
        return {
          success: true,
          requestId,
          metadata: {
            status: status.toLowerCase(),
            progress: response.progress,
          },
        };
      }
    } catch (error) {
      return {
        success: false,
        errorMessage: `Error checking job status: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Valida os parâmetros de entrada
   */
  validateParams(params: VirtualStagingParams): void {
    if (!params.imageBase64 && !params.imageUrl) {
      throw new Error('Either imageBase64 or imageUrl is required');
    }

    if (!params.roomType) {
      throw new Error('roomType is required');
    }

    if (!params.furnitureStyle) {
      throw new Error('furnitureStyle is required');
    }

    if (!params.uploadId) {
      throw new Error('uploadId is required');
    }

    const capabilities = this.getCapabilities();

    if (!capabilities.supportedRoomTypes.includes(params.roomType)) {
      throw new Error(`Unsupported room type: ${params.roomType}`);
    }

    if (
      !capabilities.supportedFurnitureStyles.includes(params.furnitureStyle)
    ) {
      throw new Error(`Unsupported furniture style: ${params.furnitureStyle}`);
    }
  }

  /**
   * Retorna as capacidades do provedor
   */
  getCapabilities(): ProviderCapabilities {
    return {
      maxImageSize: 10 * 1024 * 1024, // 10MB
      supportedFormats: ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'],
      supportedRoomTypes: [
        'bedroom',
        'living_room',
        'kitchen',
        'bathroom',
        'home_office',
        'dining_room',
        'kids_room',
        'outdoor',
      ] as RoomType[],
      supportedFurnitureStyles: [
        'standard',
        'modern',
        'scandinavian',
        'industrial',
        'midcentury',
        'luxury',
        'coastal',
        'farmhouse',
      ] as FurnitureStyle[],
      maxImagesPerRequest: 1,
      supportsCustomPrompts: true,
      supportsHighResolution: true,
      estimatedProcessingTime: 30, // 30 segundos
    };
  }

  /**
   * Valida se o provedor está configurado corretamente
   */
  validateConfiguration(): boolean {
    try {
      const required = ['apiKey', 'baseUrl'];
      const missing = required.filter(key => !this.config[key]);

      if (missing.length > 0) {
        this.logger.error(
          `Black Forest configuration missing: ${missing.join(', ')}`
        );
        return false;
      }

      return true;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        'Black Forest configuration validation error:',
        error as Error
      );
      return false;
    }
  }

  /**
   * Retorna informações sobre o provedor
   */
  getProviderInfo() {
    return {
      name: this.name,
      version: this.version,
      capabilities: this.getCapabilities(),
      supportsWebhooks: this.supportsWebhooks,
      supportsPolling: true,
      asyncOnly: false,
    };
  }

  /**
   * Novo método de virtual staging em 4 etapas
   */
  async processVirtualStagingInStages(
    params: VirtualStagingParams
  ): Promise<VirtualStagingResult> {
    const {
      uploadId,
      imageBase64: inputImageBase64,
      roomType,
      furnitureStyle,
    } = params;

    if (!inputImageBase64) {
      return {
        success: false,
        errorMessage: 'imageBase64 é obrigatório para processamento em etapas',
      };
    }

    try {
      this.logger.info(`Starting staged processing for upload ${uploadId}`, {
        roomType,
        furnitureStyle,
      });

      // Gerar plano de staging
      const plan = await this.generateStagingPlan(roomType, furnitureStyle, params.stageSelection);

      // Executar apenas a primeira etapa
      const firstStage = plan.stages[0];
      if (!firstStage) {
        return {
          success: false,
          errorMessage: 'Plano de staging inválido - nenhuma etapa encontrada',
        };
      }

      this.logger.info(
        `Starting stage 1/${plan.stages.length}: ${firstStage.stage}`,
        { uploadId }
      );

      // Executar primeira etapa
      const stageResult = await this.executeStage(
        uploadId,
        inputImageBase64,
        firstStage,
        roomType,
        furnitureStyle,
        params.stageSelection
      );

      if (stageResult.success && stageResult.jobId) {
        this.logger.info(`Stage job created successfully`, {
          uploadId,
          jobId: stageResult.jobId,
          stage: firstStage.stage,
        });

        return {
          success: true,
          requestId: stageResult.jobId,
          metadata: {
            status: 'processing',
            uploadId,
            stagingPlan: plan,
            currentStage: firstStage.stage,
            totalStages: plan.stages.length,
          },
        };
      } else {
        this.logger.error(`Failed to create stage job`, {
          uploadId,
          error: stageResult.errorMessage,
        });
        return {
          success: false,
          errorMessage:
            stageResult.errorMessage || 'Falha ao enviar primeira etapa',
        };
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Staging in stages error:', error as Error);
      return {
        success: false,
        errorMessage: `Staging em etapas falhou: ${errorMessage}`,
      };
    }
  }

  private async generateStagingPlan(
    roomType: RoomType,
    furnitureStyle: FurnitureStyle,
    stageSelection?: StageSelectionConfig
  ): Promise<StagingPlan> {
    return stagingPlanService.generateStagingPlan(roomType, furnitureStyle, stageSelection);
  }

  async executeStage(
    uploadId: string,
    imageBase64: string,
    stageConfig: any,
    roomType: RoomType,
    furnitureStyle: FurnitureStyle,
    stageSelection?: StageSelectionConfig
  ): Promise<{
    success: boolean;
    jobId?: string;
    imageUrl?: string;
    errorMessage?: string;
  }> {
    try {
      // Gerar prompt específico para a etapa
      const prompt = stagingPlanService.generateStageSpecificPrompt(
        stageConfig.stage,
        roomType,
        furnitureStyle,
        0, // stageIndex não é usado no generateStageSpecificPrompt
        stageSelection
      );

      // Executar staging para esta etapa
      const response = await this.generateVirtualStaging(imageBase64, prompt);

      if (response.error) {
        this.logger.error(`Stage execution failed for upload ${uploadId}:`, {
          error: response.error,
          stage: stageConfig.stage,
        });
        return {
          success: false,
          errorMessage: response.error,
        };
      }

      if (response.id) {
        // IMPORTANTE: Adicionar ao cache IMEDIATAMENTE para webhooks rápidos
        BlackForestProvider.addToCache(
          response.id,
          uploadId,
          stageConfig.stage
        );

        // Salvar jobId no banco para persistência
        try {
          const { uploadRepository } = await import(
            '../../repositories/upload.repository'
          );
          const upload = await uploadRepository.findById(uploadId);

          if (upload) {
            const updatedStageJobIds = {
              ...(upload.stageJobIds || {}),
              [stageConfig.stage]: response.id,
            };

            await uploadRepository.updateStageJobIds(
              uploadId,
              updatedStageJobIds
            );
            this.logger.info(
              `Stage job created and saved for upload ${uploadId}`,
              { jobId: response.id, stage: stageConfig.stage }
            );
          } else {
            this.logger.warn(
              `Upload not found when saving jobId for upload ${uploadId}`,
              { jobId: response.id, stage: stageConfig.stage }
            );
          }
        } catch (saveError) {
          this.logger.error(
            `Failed to save jobId immediately for upload ${uploadId}:`,
            saveError as Error
          );
          // Continuar mesmo se falhar ao salvar, pois o cache e processNextStage lidarão com isso
        }

        return {
          success: true,
          jobId: response.id,
        };
      }

      this.logger.warn(`Unexpected API response for upload ${uploadId}`, {
        stage: stageConfig.stage,
      });
      return {
        success: false,
        errorMessage: 'Resposta inesperada da API',
      };
    } catch (error) {
      this.logger.error(
        `Error executing stage for upload ${uploadId}:`,
        error as Error
      );
      return {
        success: false,
        errorMessage:
          error instanceof Error ? error.message : 'Erro desconhecido',
      };
    }
  }

  async downloadAndConvertToBase64(imageUrl: string): Promise<string> {
    const maxRetries = 3;
    const timeoutMs = 30000; // 30 segundos para download de imagem
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        const response = await fetch(imageUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Stagingfy/1.0',
          },
        });

        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64 = buffer.toString('base64');

        // Detectar tipo de imagem baseado na URL ou headers
        const contentType =
          response.headers.get('content-type') || 'image/jpeg';

        this.logger.info('Image downloaded and converted to base64', {
          imageUrl,
          size: buffer.length,
        });
        return `data:${contentType};base64,${base64}`;
      } catch (error: any) {
        lastError = error;

        if (attempt === maxRetries) {
          this.logger.error(
            `Failed to download image after ${maxRetries} attempts:`,
            { imageUrl, error: lastError }
          );
        }

        if (attempt < maxRetries) {
          // Aguardar antes da próxima tentativa (backoff exponencial)
          const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }

    throw new Error(
      `Falha ao baixar imagem após ${maxRetries} tentativas: ${lastError?.message}`
    );
  }

  /**
   * Processa webhook response do Black Forest
   */
  async processWebhookResponse(payload: any): Promise<VirtualStagingResult> {
    try {
      const webhookData = payload as BlackForestWebhookResponse;
      const { status, result, id, error } = webhookData;

      if (status === 'Ready' && result?.sample) {
        return {
          success: true,
          requestId: id,
          outputImageUrl: result.sample,
          metadata: {
            status: 'completed',
            provider: 'black-forest',
            width: result.width,
            height: result.height,
          },
        };
      }

      return {
        success: false,
        requestId: id,
        errorMessage: error || `Processing failed with status: ${status}`,
      };
    } catch (error) {
      return {
        success: false,
        errorMessage: `Error processing webhook: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }
}
