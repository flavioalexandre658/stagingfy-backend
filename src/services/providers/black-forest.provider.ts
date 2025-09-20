import { IVirtualStagingProvider, VirtualStagingParams, VirtualStagingResult, ProviderConfig, ProviderCapabilities } from '../../interfaces/virtual-staging-provider.interface';
import { BaseService } from '../base.service';
import { Provider, RoomType, FurnitureStyle, BlackForestApiResponse, LoraConfig } from '../../interfaces/upload.interface';
import sharp from 'sharp';

type KontextRequest = {
  prompt: string;
  input_image: string; // base64: "data:image/jpeg;base64,..."
  width?: number; // manter tamanho original (múltiplo de 32)
  height?: number;
  aspect_ratio?: string; // "W:H" como fallback
  prompt_upsampling?: boolean; // evitar reescrever o prompt
  seed?: number; // opcional: reproduzibilidade
  output_format?: 'jpeg' | 'png' | 'webp';
  safety_tolerance?: number;
  guidance?: number; // se suportado pelo provedor
};

/**
 * Adapter para o Black Forest que implementa a interface comum
 */
export class BlackForestProvider extends BaseService implements IVirtualStagingProvider {
  readonly name: Provider = 'black-forest';
  readonly version = '1.0.0';
  readonly isAsync = true;
  readonly supportsWebhooks = false;
  readonly config: ProviderConfig;

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

  private selectLoras(roomType: RoomType, furnitureStyle: FurnitureStyle) {
    return [
      { id: this.loraConfig.roomType[roomType], weight: 0.8 },
      { id: this.loraConfig.furnitureStyle[furnitureStyle], weight: 0.7 },
    ];
  }

  /**
   * Virtual staging com FLUX.1 Kontext Pro,
   * preservando a dimensão da foto original.
   */
  async generateVirtualStaging(
    imageBase64: string,
    prompt?: string,
    opts?: { seed?: number }
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
      };

      const resp = await fetch(`${this.config.baseUrl}/flux-kontext-pro`, {
        method: 'POST',
        headers: {
          'x-key': this.config.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
      });

      if (!resp.ok) {
        const txt = await resp.text();
        throw new Error(`Black Forest API error: ${resp.status} - ${txt}`);
      }

      const json = (await resp.json()) as BlackForestApiResponse;
      return json;
    } catch (error) {
      console.error('Error calling FLUX.1 Kontext Pro:', error);
      throw new Error(
        `Failed to generate virtual staging: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`
      );
    }
  }

  // Mantive aqui seu método de inpainting como estava (se quiser, também envie W/H).
  async generateStagedImage(
    imageBase64: string,
    maskBase64: string,
    roomType: RoomType,
    furnitureStyle: FurnitureStyle
  ): Promise<BlackForestApiResponse> {
    const prompt = this.generatePrompt(roomType, furnitureStyle);

    // (Opcional) igualar W/H no fill também
    const { width: ow, height: oh } =
      await this.getImageDimsFromBase64(imageBase64);
    const { width: cw, height: ch } = this.clampToLimits(ow, oh, 512, 1536);
    const width = this.roundToMultiple(cw, 32);
    const height = this.roundToMultiple(ch, 32);

    const requestBody = {
      model: 'flux-pro-1.0-fill',
      prompt,
      image: imageBase64,
      mask: maskBase64,
      steps: 40,
      guidance: 7,
      width,
      height,
      output_format: 'jpeg',
      safety_tolerance: 2,
    };

    const resp = await fetch(`${this.config.baseUrl}/flux-pro-1.0-fill`, {
      method: 'POST',
      headers: {
        'x-key': this.config.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(requestBody),
    });

    if (!resp.ok) {
      const err = await resp.text();
      throw new Error(`Black Forest API error: ${resp.status} - ${err}`);
    }
    return (await resp.json()) as BlackForestApiResponse;
  }

  async checkJobStatusInternal(jobId: string): Promise<BlackForestApiResponse> {
    const resp = await fetch(`${this.config.baseUrl}/get_result?id=${jobId}`, {
      method: 'GET',
      headers: { 'x-key': this.config.apiKey, 'Content-Type': 'application/json' },
    });
    if (!resp.ok) {
      // 404: geralmente ainda processando
      return {
        id: jobId,
        status: 'Task not found',
        error: await resp.text(),
      };
    }
    return (await resp.json()) as BlackForestApiResponse;
  }

  validateParametersInternal(roomType: RoomType, furnitureStyle: FurnitureStyle) {
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
  async processVirtualStaging(params: VirtualStagingParams): Promise<VirtualStagingResult> {
    try {
      this.validateParams(params);

      this.logOperation('Processing virtual staging with Black Forest', {
        roomType: params.roomType,
        furnitureStyle: params.furnitureStyle,
        uploadId: params.uploadId,
      });

      // Usar os métodos internos do provider
      const response = await this.generateStagedImage(
        params.imageBase64 || '',
        '', // mask não é usado no fluxo atual
        params.roomType,
        params.furnitureStyle
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
          }
        };
      }

      throw new Error('Unexpected response format from Black Forest');
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
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
          outputImageUrl: response.result.sample,
          metadata: {
            status: 'completed',
            progress: response.progress,
            width: response.result.width,
            height: response.result.height,
          }
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
          }
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

    if (!capabilities.supportedFurnitureStyles.includes(params.furnitureStyle)) {
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
        'outdoor'
      ] as RoomType[],
      supportedFurnitureStyles: [
        'standard',
        'modern',
        'scandinavian',
        'industrial',
        'midcentury',
        'luxury',
        'coastal',
        'farmhouse'
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
        this.logger.error(`Black Forest configuration missing: ${missing.join(', ')}`);
        return false;
      }

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Black Forest configuration validation error:', error as Error);
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
      supportsWebhooks: false,
      supportsPolling: true,
      asyncOnly: false,
    };
  }
}