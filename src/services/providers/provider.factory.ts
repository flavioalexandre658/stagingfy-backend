import { IVirtualStagingProvider, ProviderConfig } from '../../interfaces/virtual-staging-provider.interface';
import { Provider } from '../../interfaces/upload.interface';
import { BlackForestProvider } from './black-forest.provider';
import { InstantDecoProvider } from './instant-deco.provider';

/**
 * Factory para criar instâncias de providers de virtual staging
 */
export class VirtualStagingProviderFactory {
  private static providers = new Map<Provider, new (config: ProviderConfig) => IVirtualStagingProvider>([
    ['black-forest', BlackForestProvider],
    ['instant-deco', InstantDecoProvider],
  ]);

  /**
   * Cria uma instância do provider especificado
   */
  static createProvider(providerName: Provider, config: ProviderConfig): IVirtualStagingProvider {
    const ProviderClass = this.providers.get(providerName);
    
    if (!ProviderClass) {
      throw new Error(`Provider '${providerName}' not found. Available providers: ${Array.from(this.providers.keys()).join(', ')}`);
    }

    const provider = new ProviderClass(config);
    
    // Validar configuração do provider
    if (!provider.validateConfiguration()) {
      throw new Error(`Provider '${providerName}' configuration is invalid`);
    }

    return provider;
  }

  /**
   * Lista todos os providers disponíveis
   */
  static getAvailableProviders(): Provider[] {
    return Array.from(this.providers.keys());
  }

  /**
   * Verifica se um provider está disponível
   */
  static isProviderAvailable(providerName: Provider): boolean {
    return this.providers.has(providerName);
  }

  /**
   * Registra um novo provider
   */
  static registerProvider(
    providerName: Provider, 
    providerClass: new (config: ProviderConfig) => IVirtualStagingProvider
  ): void {
    this.providers.set(providerName, providerClass);
  }

  /**
   * Remove um provider do registro
   */
  static unregisterProvider(providerName: Provider): boolean {
    return this.providers.delete(providerName);
  }

  /**
   * Obtém informações sobre todos os providers disponíveis
   */
  static getProvidersInfo(configs: Record<Provider, ProviderConfig>) {
    const providersInfo: Record<string, any> = {};

    for (const [providerName, ProviderClass] of this.providers) {
      try {
        const config = configs[providerName];
        if (config) {
          const provider = new ProviderClass(config);
          providersInfo[providerName] = {
            ...provider.getProviderInfo(),
            isConfigured: provider.validateConfiguration(),
          };
        } else {
          providersInfo[providerName] = {
            name: providerName,
            isConfigured: false,
            error: 'No configuration provided',
          };
        }
      } catch (error) {
        providersInfo[providerName] = {
          name: providerName,
          isConfigured: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    }

    return providersInfo;
  }
}