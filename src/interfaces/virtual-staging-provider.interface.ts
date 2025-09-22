import { RoomType, FurnitureStyle, Provider, StageSelectionConfig } from './upload.interface';

/**
 * Resultado do processamento de virtual staging
 */
export interface VirtualStagingResult {
  success: boolean;
  requestId?: string;
  outputImageUrl?: string;
  outputImageUrls?: string[]; // Suporte para múltiplas imagens
  errorMessage?: string;
  metadata?: Record<string, any>;
}

/**
 * Configurações específicas do provedor
 */
export interface ProviderConfig {
  apiKey: string;
  baseUrl: string;
  timeout?: number;
  retryAttempts?: number;
  webhookUrl?: string;
  [key: string]: unknown;
}

/**
 * Parâmetros para processamento de virtual staging
 */
export interface VirtualStagingParams {
  imageBase64?: string;
  imageUrl?: string;
  roomType: RoomType;
  furnitureStyle: FurnitureStyle;
  uploadId: string;
  webhookUrl?: string;
  stageSelection?: StageSelectionConfig;
  // Imagens de referência opcionais (até 3 adicionais)
  referenceImage2?: string; // base64
  referenceImage3?: string; // base64
  referenceImage4?: string; // base64
  options?: {
    seed?: number;
    numImages?: number;
    highResolution?: boolean;
    customPrompt?: string;
    [key: string]: any;
  };
}

/**
 * Interface base que todos os provedores de virtual staging devem implementar
 */
export interface IVirtualStagingProvider {
  /**
   * Nome identificador do provedor
   */
  readonly name: Provider;

  /**
   * Indica se o provedor processa de forma síncrona ou assíncrona
   */
  readonly isAsync: boolean;

  /**
   * Indica se o provedor suporta webhooks
   */
  readonly supportsWebhooks: boolean;

  /**
   * Configuração do provedor
   */
  readonly config: ProviderConfig;

  /**
   * Processa virtual staging
   */
  processVirtualStaging(params: VirtualStagingParams): Promise<VirtualStagingResult>;

  /**
   * Processa virtual staging em etapas (opcional)
   */
  processVirtualStagingInStages?(params: VirtualStagingParams): Promise<VirtualStagingResult>;

  /**
   * Verifica o status de um job (para provedores assíncronos)
   */
  checkJobStatus?(jobId: string): Promise<VirtualStagingResult>;

  /**
   * Processa webhook de resposta (para provedores que suportam webhooks)
   */
  processWebhookResponse?(payload: any): Promise<VirtualStagingResult>;

  /**
   * Valida se o provedor está configurado corretamente
   */
  validateConfiguration(): boolean;

  /**
   * Valida parâmetros de entrada
   */
  validateParams(params: VirtualStagingParams): void;

  /**
   * Retorna informações sobre capacidades do provedor
   */
  getCapabilities(): ProviderCapabilities;

  /**
   * Retorna informações gerais sobre o provedor
   */
  getProviderInfo(): {
    name: Provider;
    version: string;
    capabilities: ProviderCapabilities;
    supportsWebhooks: boolean;
    supportsPolling: boolean;
    asyncOnly: boolean;
  };
}

/**
 * Capacidades do provedor
 */
export interface ProviderCapabilities {
  maxImageSize: number;
  supportedFormats: string[];
  supportedRoomTypes: RoomType[];
  supportedFurnitureStyles: FurnitureStyle[];
  maxImagesPerRequest: number;
  supportsCustomPrompts: boolean;
  supportsHighResolution: boolean;
  estimatedProcessingTime: number; // em segundos
}

/**
 * Configuração de registro de provedor
 */
export interface ProviderRegistration {
  provider: Provider;
  className: new (config: ProviderConfig) => IVirtualStagingProvider;
  defaultConfig?: Partial<ProviderConfig>;
  isEnabled?: boolean;
}