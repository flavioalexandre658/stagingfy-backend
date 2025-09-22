import {
  IVirtualStagingProvider,
  VirtualStagingParams,
  VirtualStagingResult,
  ProviderConfig,
} from '../interfaces/virtual-staging-provider.interface';
import { Provider } from '../interfaces/upload.interface';
import { VirtualStagingProviderFactory } from './providers/provider.factory';
import { BaseService } from './base.service';

/**
 * Service unificado para virtual staging que gerencia múltiplos providers
 */
export class VirtualStagingService extends BaseService {
  private providers: Map<Provider, IVirtualStagingProvider> = new Map();
  private defaultProvider: Provider = 'black-forest';

  constructor(private configs: Record<Provider, ProviderConfig>) {
    super();
    this.initializeProviders();
  }

  /**
   * Inicializa todos os providers configurados
   */
  private initializeProviders(): void {
    const availableProviders =
      VirtualStagingProviderFactory.getAvailableProviders();

    for (const providerName of availableProviders) {
      try {
        const config = this.configs[providerName];
        if (config) {
          const provider = VirtualStagingProviderFactory.createProvider(
            providerName,
            config
          );
          this.providers.set(providerName, provider);
          this.logger.info(`Provider ${providerName} initialized successfully`);
        } else {
          this.logger.warn(
            `No configuration found for provider: ${providerName}`
          );
        }
      } catch (error) {
        this.logger.error(
          `Failed to initialize provider ${providerName}:`,
          error as Error
        );
      }
    }

    if (this.providers.size === 0) {
      throw new Error('No virtual staging providers could be initialized');
    }

    // Definir provider padrão como o primeiro disponível se o padrão não estiver disponível
    if (!this.providers.has(this.defaultProvider)) {
      const firstProvider = Array.from(this.providers.keys())[0];
      if (!firstProvider) {
        throw new Error('No providers configured');
      }
      this.defaultProvider = firstProvider;
      this.logger.info(`Default provider set to: ${this.defaultProvider}`);
    }
  }

  /**
   * Processa virtual staging usando o provider especificado ou padrão
   */
  async processVirtualStaging(
    params: VirtualStagingParams,
    providerName?: Provider
  ): Promise<VirtualStagingResult> {
    const provider = this.getProvider(providerName);

    this.logOperation('Processing virtual staging', {
      provider: provider.name,
      uploadId: params.uploadId,
      roomType: params.roomType,
      furnitureStyle: params.furnitureStyle,
    });

    try {
      // Validar parâmetros
      provider.validateParams(params);

      // Processar virtual staging
      const result = await provider.processVirtualStaging(params);

      this.logOperation('Virtual staging completed', {
        provider: provider.name,
        success: result.success,
        requestId: result.requestId,
      });

      return result;
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Virtual staging failed with ${provider.name}:`,
        error as Error
      );

      return {
        success: false,
        errorMessage: `Processing failed: ${errorMessage}`,
      };
    }
  }

  /**
   * Verifica status de job
   */
  async checkJobStatus(
    requestId: string,
    providerName?: Provider
  ): Promise<VirtualStagingResult> {
    const provider = this.getProvider(providerName);

    if (!provider.checkJobStatus) {
      return {
        success: false,
        errorMessage: `Provider ${provider.name} does not support job status checking`,
      };
    }

    try {
      return await provider.checkJobStatus(requestId);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Job status check failed with ${provider.name}:`,
        error as Error
      );

      return {
        success: false,
        errorMessage: `Status check failed: ${errorMessage}`,
      };
    }
  }

  /**
   * Processa webhook response
   */
  async processWebhookResponse(
    payload: any,
    providerName?: Provider
  ): Promise<VirtualStagingResult> {
    const provider = this.getProvider(providerName);

    if (!provider.processWebhookResponse) {
      return {
        success: false,
        errorMessage: `Provider ${provider.name} does not support webhook processing`,
      };
    }

    try {
      return await provider.processWebhookResponse(payload);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        `Webhook processing failed with ${provider.name}:`,
        error as Error
      );

      return {
        success: false,
        errorMessage: `Webhook processing failed: ${errorMessage}`,
      };
    }
  }

  /**
   * Obtém provider específico ou padrão
   */
  private getProvider(providerName?: Provider): IVirtualStagingProvider {
    const targetProvider: Provider = providerName || this.defaultProvider;
    const provider = this.providers.get(targetProvider);

    if (!provider) {
      throw new Error(
        `Provider '${targetProvider}' is not available. Available providers: ${Array.from(this.providers.keys()).join(', ')}`
      );
    }

    return provider;
  }

  /**
   * Lista providers disponíveis
   */
  getAvailableProviders(): Provider[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Obtém informações sobre todos os providers
   */
  getProvidersInfo() {
    const providersInfo: Record<string, any> = {};

    for (const [providerName, provider] of this.providers) {
      try {
        providersInfo[providerName] = {
          ...provider.getProviderInfo(),
          isConfigured: provider.validateConfiguration(),
          isInitialized: true,
        };
      } catch (error) {
        providersInfo[providerName] = {
          name: providerName,
          isConfigured: false,
          isInitialized: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }

    return providersInfo;
  }

  /**
   * Obtém capacidades de um provider específico
   */
  getProviderCapabilities(providerName?: Provider) {
    const provider = this.getProvider(providerName);
    return provider.getCapabilities();
  }

  /**
   * Define o provider padrão
   */
  setDefaultProvider(providerName: Provider): void {
    if (!this.providers.has(providerName)) {
      throw new Error(`Provider '${providerName}' is not available`);
    }

    this.defaultProvider = providerName;
    this.logger.info(`Default provider changed to: ${providerName}`);
  }

  /**
   * Obtém o provider padrão atual
   */
  getDefaultProvider(): Provider {
    return this.defaultProvider;
  }

  /**
   * Verifica se um provider está disponível
   */
  isProviderAvailable(providerName: Provider): boolean {
    return this.providers.has(providerName);
  }

  /**
   * Recarrega configuração de um provider
   */
  async reloadProvider(
    providerName: Provider,
    config: ProviderConfig
  ): Promise<void> {
    try {
      const provider = VirtualStagingProviderFactory.createProvider(
        providerName,
        config
      );
      this.providers.set(providerName, provider);
      this.configs[providerName] = config;
      this.logger.info(`Provider ${providerName} reloaded successfully`);
    } catch (error) {
      this.logger.error(
        `Failed to reload provider ${providerName}:`,
        error as Error
      );
      throw error;
    }
  }
}
