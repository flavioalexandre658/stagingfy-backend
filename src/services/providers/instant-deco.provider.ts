import { IVirtualStagingProvider, VirtualStagingParams, VirtualStagingResult, ProviderConfig, ProviderCapabilities } from '../../interfaces/virtual-staging-provider.interface';
import { BaseService } from '../base.service';
import { Provider, RoomType, FurnitureStyle } from '../../interfaces/upload.interface';
import { 
  InstantDecoRequest, 
  InstantDecoInitialResponse, 
  InstantDecoWebhookResponse,
  InstantDecoError,
  InstantDecoDesign,
  InstantDecoRoomType,
  InstantDecoTransformationType,
  InstantDecoBlockElement
} from '../../interfaces/instant-deco.interface';

/**
 * Adapter para o InstantDeco que implementa a interface comum
 */
export class InstantDecoProvider extends BaseService implements IVirtualStagingProvider {
  readonly name: Provider = 'instant-deco';
  readonly version = '1.0.0';
  readonly isAsync = true;
  readonly supportsWebhooks = true;
  readonly config: ProviderConfig;
  private readonly baseUrl = 'https://app.instantdeco.ai/api/1.1/wf/request_v2';

  constructor(config: ProviderConfig) {
    super();
    this.config = config;
  }

  /**
   * Mapeia RoomType interno para InstantDecoRoomType
   */
  private mapRoomType(roomType: RoomType): InstantDecoRoomType {
    const roomTypeMapping: Record<RoomType, InstantDecoRoomType> = {
      bedroom: 'bedroom',
      living_room: 'living_room',
      kitchen: 'kitchen',
      bathroom: 'bathroom',
      home_office: 'home_office',
      dining_room: 'dining_room',
      kids_room: 'kid_bedroom',
      outdoor: 'terrace', // Assumindo que outdoor é mais próximo de terrace
    };

    return roomTypeMapping[roomType];
  }

  /**
   * Mapeia FurnitureStyle interno para InstantDecoDesign
   */
  private mapFurnitureStyle(furnitureStyle: FurnitureStyle): InstantDecoDesign {
    const styleMapping: Record<FurnitureStyle, InstantDecoDesign> = {
      standard: 'minimalist',
      modern: 'modern',
      scandinavian: 'scandinavian',
      industrial: 'industrial',
      midcentury: 'midcentury',
      luxury: 'french', // Luxury pode ser mapeado para french como estilo mais elegante
      coastal: 'coastal',
      farmhouse: 'rustic', // Farmhouse é próximo de rustic
    };

    return styleMapping[furnitureStyle];
  }

  /**
   * Retorna elementos padrão para bloquear baseado no tipo de transformação
   */
  private getDefaultBlockElements(transformationType: InstantDecoTransformationType): InstantDecoBlockElement[] {
    const basicElements: InstantDecoBlockElement[] = ['wall', 'floor', 'ceiling', 'windowpane', 'door'];
    
    switch (transformationType) {
      case 'furnish':
      case 'outdoor':
        return basicElements;
      case 'redesign':
        return [...basicElements, 'sink', 'countertop', 'toilet', 'tub', 'shower'];
      default:
        return basicElements;
    }
  }

  /**
   * Determina o tipo de transformação baseado no tipo de quarto e estilo
   */
  private getTransformationType(roomType: RoomType): InstantDecoTransformationType {
    switch (roomType) {
      case 'outdoor':
        return 'outdoor';
      case 'kitchen':
      case 'bathroom':
        return 'redesign'; // Para cozinhas e banheiros, usar redesign
      default:
        return 'furnish'; // Para outros quartos, usar furnish
    }
  }

  /**
   * Gera prompt para virtual staging usando InstantDeco
   */
  async generateVirtualStagingInternal(
    roomType: RoomType,
    furnitureStyle: FurnitureStyle,
    imageUrl: string,
    webhookUrl: string,
    options?: {
      transformationType?: InstantDecoTransformationType;
      blockElements?: InstantDecoBlockElement[];
      highDetailsResolution?: boolean;
      numImages?: number;
    }
  ): Promise<InstantDecoInitialResponse> {
    try {
      const mappedRoomType = this.mapRoomType(roomType);
      const mappedDesign = this.mapFurnitureStyle(furnitureStyle);
      const transformationType = options?.transformationType || this.getTransformationType(roomType);
      const blockElements = options?.blockElements || this.getDefaultBlockElements(transformationType);

      const requestBody: InstantDecoRequest = {
        design: mappedDesign,
        room_type: mappedRoomType,
        transformation_type: transformationType,
        block_element: blockElements.join(','),
        high_details_resolution: options?.highDetailsResolution ?? true,
        img_url: imageUrl,
        webhook_url: webhookUrl,
        num_images: Math.min(options?.numImages || 1, 4), // Max 4 images
      };

      // Log detalhado do payload
      this.logOperation('Sending request to InstantDeco', {
        url: this.baseUrl,
        payload: requestBody,
        hasApiKey: !!this.config.apiKey,
        apiKeyLength: this.config.apiKey?.length || 0
      });

      const response = await fetch(this.baseUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.config.apiKey}`,
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.json() as InstantDecoError;
        throw new Error(`InstantDeco API Error: ${errorData?.message || response.statusText}`);
      }

      const data = await response.json() as InstantDecoInitialResponse;
      return data;
    } catch (error) {
      if (error instanceof Error) {
        throw new Error(`InstantDeco API Error: ${error.message}`);
      }
      throw new Error('Unknown error occurred while calling InstantDeco API');
    }
  }

  /**
   * Processa webhook response do InstantDeco
   */
  async processWebhookResponse(payload: any): Promise<VirtualStagingResult> {
    try {
      const webhookData = payload as InstantDecoWebhookResponse;
      const { status, output, request_id } = webhookData;

      if (status === 'succeeded') {
        // Suporte para múltiplas imagens
        const outputUrls = Array.isArray(output) ? output : [output];
        
        const result: VirtualStagingResult = {
          success: true,
          requestId: request_id,
          outputImageUrls: outputUrls, // Novo campo para múltiplas imagens
          metadata: {
            status: 'completed',
            provider: 'instant-deco',
            numImages: outputUrls.length,
          }
        };

        // Adicionar outputImageUrl apenas se houver URLs válidas
        if (outputUrls.length > 0 && outputUrls[0]) {
          result.outputImageUrl = outputUrls[0];
        }

        return result;
      }

      return {
        success: false,
        requestId: request_id,
        errorMessage: `Processing failed with status: ${status}`,
      };
    } catch (error) {
      return {
        success: false,
        errorMessage: `Error processing webhook: ${error instanceof Error ? error.message : 'Unknown error'}`,
      };
    }
  }

  /**
   * Valida se uma URL de imagem é válida
   */
  private isValidImageUrl(url: string): boolean {
    try {
      const urlObj = new URL(url);
      return urlObj.protocol === 'http:' || urlObj.protocol === 'https:';
    } catch {
      return false;
    }
  }

  /**
   * Valida parâmetros antes de fazer a requisição
   */
  validateRequestInternal(
    roomType: RoomType,
    furnitureStyle: FurnitureStyle,
    imageUrl: string,
    webhookUrl: string
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (!this.isValidImageUrl(imageUrl)) {
      errors.push('Invalid image URL provided');
    }

    if (!this.isValidImageUrl(webhookUrl)) {
      errors.push('Invalid webhook URL provided');
    }

    // Validar se o mapeamento existe
    try {
      this.mapRoomType(roomType);
      this.mapFurnitureStyle(furnitureStyle);
    } catch (error) {
      errors.push('Invalid room type or furniture style');
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Retorna informações sobre os tipos suportados
   */
  getSupportedTypesInternal(): {
    roomTypes: RoomType[];
    furnitureStyles: FurnitureStyle[];
    transformationTypes: InstantDecoTransformationType[];
  } {
    return {
      roomTypes: ['bedroom', 'living_room', 'kitchen', 'bathroom', 'home_office', 'dining_room', 'kids_room', 'outdoor'],
      furnitureStyles: ['standard', 'modern', 'scandinavian', 'industrial', 'midcentury', 'luxury', 'coastal', 'farmhouse'],
      transformationTypes: ['furnish', 'renovate', 'redesign', 'outdoor', 'blue_sky', 'day_to_dusk', 'empty', 'enhance'],
    };
  }

  /**
   * Processa virtual staging usando InstantDeco
   */
  async processVirtualStaging(params: VirtualStagingParams): Promise<VirtualStagingResult> {
    try {
      this.logOperation('Processing virtual staging with InstantDeco', {
        roomType: params.roomType,
        furnitureStyle: params.furnitureStyle,
        hasWebhook: !!params.webhookUrl,
        numImages: params.options?.numImages ?? 3,
      });

      // Validar parâmetros
      this.validateParams(params);

      const imageUrl = params.imageUrl || params.imageBase64;
      if (!imageUrl) {
        throw new Error('Image URL or base64 is required');
      }

      // Se não há webhook, processar de forma síncrona (não recomendado para InstantDeco)
      if (!params.webhookUrl) {
        throw new Error('InstantDeco requires webhook URL for async processing');
      }

      // Gerar virtual staging com 3 imagens por padrão
      const response = await this.generateVirtualStagingInternal(
        params.roomType,
        params.furnitureStyle,
        imageUrl,
        params.webhookUrl,
        {
          highDetailsResolution: params.options?.highResolution ?? true,
          numImages: params.options?.numImages ?? 3, // Padrão de 3 imagens
        }
      );

      return {
        success: true,
        requestId: response.response.request_id,
        metadata: {
          status: 'processing',
          provider: 'instant-deco',
          message: response.response.message,
          numImages: params.options?.numImages ?? 3,
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('InstantDeco processing failed:', error as Error);
      
      return {
        success: false,
        errorMessage: `InstantDeco processing failed: ${errorMessage}`,
      };
    }
  }

  /**
   * Verifica status de job (InstantDeco usa webhooks, mas pode ter polling como fallback)
   */
  async checkJobStatus(requestId: string): Promise<VirtualStagingResult> {
    try {
      this.logOperation('Checking InstantDeco job status', { requestId });

      // InstantDeco normalmente usa webhooks, mas podemos implementar polling como fallback
      // Por enquanto, retornamos que está processando
      return {
        success: true,
        requestId,
        metadata: {
          status: 'processing',
          provider: 'instant-deco',
          note: 'InstantDeco uses webhooks for status updates. Check webhook endpoint for completion.',
        }
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('InstantDeco status check error:', error as Error);
      return {
        success: false,
        errorMessage: `Error checking InstantDeco status: ${errorMessage}`,
      };
    }
  }

  /**
   * Valida se o provedor está configurado corretamente
   */
  validateConfiguration(): boolean {
    try {
      // Verificar se as configurações necessárias estão presentes
      const requiredConfigs = ['apiKey', 'baseUrl'];
      
      for (const config of requiredConfigs) {
        if (!this.config[config]) {
          this.logger.error(`InstantDeco missing required config: ${config}`);
          return false;
        }
      }

      return true;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('InstantDeco configuration validation error:', error as Error);
      return false;
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
  }

  /**
   * Retorna as capacidades do provedor
   */
  getCapabilities(): ProviderCapabilities {
    return {
      maxImageSize: 10 * 1024 * 1024, // 10MB
      supportedFormats: ['jpg', 'jpeg', 'png'],
      supportedRoomTypes: ['bedroom', 'living_room', 'kitchen', 'bathroom', 'home_office', 'dining_room', 'kids_room', 'outdoor'],
      supportedFurnitureStyles: ['modern', 'scandinavian', 'industrial', 'midcentury', 'coastal', 'standard', 'luxury', 'farmhouse'],
      maxImagesPerRequest: 4,
      supportsCustomPrompts: false,
      supportsHighResolution: true,
      estimatedProcessingTime: 120, // 2 minutos
    };
  }

  /**
   * Retorna informações sobre o provedor
   */
  getProviderInfo() {
    return {
      name: this.name,
      version: this.version,
      capabilities: this.getCapabilities(),
      supportsWebhooks: true,
      supportsPolling: false,
      asyncOnly: true,
    };
  }
}