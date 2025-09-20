import { Provider } from '../interfaces/upload.interface';
import { 
  IVirtualStagingProvider, 
  ProviderConfig, 
  ProviderRegistration,
  VirtualStagingParams,
  VirtualStagingResult
} from '../interfaces/virtual-staging-provider.interface';
import { BaseService } from './base.service';

/**
 * Factory para gerenciar provedores de virtual staging
 * Implementa padrão Factory + Strategy para escalabilidade
 */
export class VirtualStagingProviderFactory extends BaseService {
  private static instance: VirtualStagingProviderFactory;
  private providers: Map<Provider, IVirtualStagingProvider> = new Map();
  private registrations: Map<Provider, ProviderRegistration> = new Map();

  private constructor() {
    super();
  }

  /**
   * Singleton instance
   */
  public static getInstance(): VirtualStagingProviderFactory {
    if (!VirtualStagingProviderFactory.instance) {
      VirtualStagingProviderFactory.instance = new VirtualStagingProviderFactory();
    }
    return VirtualStagingProviderFactory.instance;
  }

  /**
   * Registra um novo provedor
   */
  public registerProvider(registration: ProviderRegistration): void {
    try {
      this.logOperation('Registering provider', { provider: registration.provider });
      
      this.registrations.set(registration.provider, registration);
      
      // Inicializar provedor se estiver habilitado
      if (registration.isEnabled !== false) {
        this.initializeProvider(registration.provider);
      }
      
      this.logger.info(`Provider ${registration.provider} registered successfully`);
    } catch (error) {
      this.handleError(error, `Failed to register provider ${registration.provider}`);
    }
  }

  /**
   * Inicializa um provedor específico
   */
  private initializeProvider(providerName: Provider): void {
    const registration = this.registrations.get(providerName);
    if (!registration) {
      throw new Error(`Provider ${providerName} not registered`);
    }

    const config = this.buildProviderConfig(providerName, registration.defaultConfig);
    const provider = new registration.className(config);

    if (!provider.validateConfiguration()) {
      throw new Error(`Provider ${providerName} configuration is invalid`);
    }

    this.providers.set(providerName, provider);
    this.logger.info(`Provider ${providerName} initialized successfully`);
  }

  /**
   * Constrói configuração do provedor baseada em variáveis de ambiente
   */
  private buildProviderConfig(providerName: Provider, defaultConfig?: Partial<ProviderConfig>): ProviderConfig {
    const envPrefix = providerName.toUpperCase().replace('-', '_');
    
    const baseConfig = {
      apiKey: process.env[`${envPrefix}_API_KEY`] || '',
      baseUrl: process.env[`${envPrefix}_BASE_URL`] || '',
      timeout: parseInt(process.env[`${envPrefix}_TIMEOUT`] || '30000'),
      retryAttempts: parseInt(process.env[`${envPrefix}_RETRY_ATTEMPTS`] || '3'),
      ...(process.env.BASE_URL && { webhookUrl: `${process.env.BASE_URL}/api/v1/webhooks/${providerName}` }),
      ...defaultConfig,
    };

    return baseConfig as ProviderConfig;
  }

  /**
   * Obtém um provedor específico
   */
  public getProvider(providerName: Provider): IVirtualStagingProvider {
    const provider = this.providers.get(providerName);
    if (!provider) {
      throw new Error(`Provider ${providerName} not available. Make sure it's registered and configured.`);
    }
    return provider;
  }

  /**
   * Lista todos os provedores disponíveis
   */
  public getAvailableProviders(): Provider[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Verifica se um provedor está disponível
   */
  public isProviderAvailable(providerName: Provider): boolean {
    return this.providers.has(providerName);
  }

  /**
   * Processa virtual staging usando o provedor especificado
   */
  public async processVirtualStaging(
    providerName: Provider, 
    params: VirtualStagingParams
  ): Promise<VirtualStagingResult> {
    try {
      this.logOperation('Processing virtual staging', { 
        provider: providerName, 
        uploadId: params.uploadId,
        roomType: params.roomType,
        furnitureStyle: params.furnitureStyle
      });

      const provider = this.getProvider(providerName);
      
      // Validar parâmetros
      provider.validateParams(params);
      
      // Processar
      const result = await provider.processVirtualStaging(params);
      
      this.logOperation('Virtual staging processed', { 
        provider: providerName, 
        uploadId: params.uploadId,
        success: result.success,
        requestId: result.requestId
      });

      return result;
    } catch (error) {
      this.handleError(error, `Failed to process virtual staging with provider ${providerName}`);
    }
  }

  /**
   * Verifica status de job para provedores assíncronos
   */
  public async checkJobStatus(providerName: Provider, jobId: string): Promise<VirtualStagingResult> {
    try {
      const provider = this.getProvider(providerName);
      
      if (!provider.checkJobStatus) {
        throw new Error(`Provider ${providerName} does not support job status checking`);
      }

      return await provider.checkJobStatus(jobId);
    } catch (error) {
      this.handleError(error, `Failed to check job status for provider ${providerName}`);
    }
  }

  /**
   * Processa webhook de resposta
   */
  public async processWebhookResponse(providerName: Provider, payload: any): Promise<VirtualStagingResult> {
    try {
      const provider = this.getProvider(providerName);
      
      if (!provider.processWebhookResponse) {
        throw new Error(`Provider ${providerName} does not support webhook processing`);
      }

      return await provider.processWebhookResponse(payload);
    } catch (error) {
      this.handleError(error, `Failed to process webhook for provider ${providerName}`);
    }
  }

  /**
   * Obtém informações sobre capacidades de um provedor
   */
  public getProviderCapabilities(providerName: Provider) {
    const provider = this.getProvider(providerName);
    return provider.getCapabilities();
  }

  /**
   * Obtém o melhor provedor baseado em critérios
   */
  public getBestProvider(criteria?: {
    roomType?: string;
    furnitureStyle?: string;
    requiresSync?: boolean;
    requiresWebhooks?: boolean;
  }): Provider {
    const availableProviders = this.getAvailableProviders();
    
    if (availableProviders.length === 0) {
      throw new Error('No providers available');
    }

    // Se não há critérios específicos, retorna o primeiro disponível
    if (!criteria) {
      return availableProviders[0]!;
    }

    // Filtrar baseado nos critérios
    const suitableProviders = availableProviders.filter(providerName => {
      const provider = this.getProvider(providerName);
      const capabilities = provider.getCapabilities();

      if (criteria.requiresSync && provider.isAsync) return false;
      if (criteria.requiresWebhooks && !provider.supportsWebhooks) return false;
      
      return true;
    });

    if (suitableProviders.length === 0) {
      throw new Error('No suitable providers found for the given criteria');
    }

    return suitableProviders[0]!;
  }

  /**
   * Reinicializa todos os provedores
   */
  public reinitializeProviders(): void {
    this.providers.clear();
    
    for (const [providerName, registration] of this.registrations) {
      if (registration.isEnabled !== false) {
        try {
          this.initializeProvider(providerName);
        } catch (error) {
          this.logger.error(`Failed to reinitialize provider ${providerName}:`, error as Error);
        }
      }
    }
  }
}

// Export singleton instance
export const virtualStagingProviderFactory = VirtualStagingProviderFactory.getInstance();