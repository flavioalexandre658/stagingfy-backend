import { ProviderConfig } from '../interfaces/virtual-staging-provider.interface';

/**
 * Configurações dos providers de virtual staging
 */
export class ProviderConfigManager {
  private static instance: ProviderConfigManager;
  private configs: Map<string, ProviderConfig> = new Map();

  private constructor() {
    this.loadConfigurations();
  }

  public static getInstance(): ProviderConfigManager {
    if (!ProviderConfigManager.instance) {
      ProviderConfigManager.instance = new ProviderConfigManager();
    }
    return ProviderConfigManager.instance;
  }

  /**
   * Carrega as configurações dos providers a partir das variáveis de ambiente
   */
  private loadConfigurations(): void {
    // Configuração do Black Forest
    this.configs.set('black-forest', {
      apiKey: process.env.BLACK_FOREST_API_KEY || '',
      baseUrl: process.env.BLACK_FOREST_BASE_URL || 'https://api.bfl.ml',
      timeout: parseInt(process.env.BLACK_FOREST_TIMEOUT || '120000'),
      retryAttempts: parseInt(process.env.BLACK_FOREST_RETRY_ATTEMPTS || '3'),
      webhookUrl: process.env.BLACK_FOREST_WEBHOOK_URL || '',
    });

    // Configuração do InstantDeco
    this.configs.set('instant-deco', {
      apiKey: process.env.INSTANT_DECO_API_KEY || '',
      baseUrl: process.env.INSTANT_DECO_BASE_URL || 'https://api.instantdeco.com',
      timeout: parseInt(process.env.INSTANT_DECO_TIMEOUT || '60000'),
      retryAttempts: parseInt(process.env.INSTANT_DECO_RETRY_ATTEMPTS || '2'),
      webhookUrl: process.env.INSTANT_DECO_WEBHOOK_URL || '',
    });
  }

  /**
   * Obtém a configuração de um provider específico
   */
  public getConfig(providerName: string): ProviderConfig | undefined {
    return this.configs.get(providerName);
  }

  /**
   * Obtém todas as configurações
   */
  public getAllConfigs(): Map<string, ProviderConfig> {
    return new Map(this.configs);
  }

  /**
   * Atualiza a configuração de um provider
   */
  public updateConfig(providerName: string, config: ProviderConfig): void {
    this.configs.set(providerName, config);
  }

  /**
   * Valida se todas as configurações necessárias estão presentes
   */
  public validateConfigurations(): { isValid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const [providerName, config] of this.configs) {
      if (!config.apiKey) {
        errors.push(`${providerName}: API key is missing`);
      }
      if (!config.baseUrl) {
        errors.push(`${providerName}: Base URL is missing`);
      }
      if (config.timeout !== undefined && config.timeout <= 0) {
        errors.push(`${providerName}: Invalid timeout value`);
      }
      if (config.retryAttempts !== undefined && config.retryAttempts < 0) {
        errors.push(`${providerName}: Invalid retry attempts value`);
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
    };
  }

  /**
   * Recarrega as configurações a partir das variáveis de ambiente
   */
  public reloadConfigurations(): void {
    this.configs.clear();
    this.loadConfigurations();
  }

  /**
   * Verifica se um provider está configurado e habilitado
   */
  public isProviderEnabled(providerName: string): boolean {
    const config = this.configs.get(providerName);
    return !!(config && config.apiKey && config.baseUrl);
  }

  /**
   * Lista todos os providers habilitados
   */
  public getEnabledProviders(): string[] {
    const enabledProviders: string[] = [];
    
    for (const [providerName] of this.configs) {
      if (this.isProviderEnabled(providerName)) {
        enabledProviders.push(providerName);
      }
    }

    return enabledProviders;
  }
}

// Exporta uma instância singleton
export const providerConfigManager = ProviderConfigManager.getInstance();