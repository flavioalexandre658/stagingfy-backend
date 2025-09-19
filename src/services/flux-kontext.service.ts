import fetch from 'node-fetch';

export interface FluxKontextRequest {
  model: string;
  prompt: string;
  image: string; // Base64 encoded image
  mask?: string; // Base64 encoded mask (optional)
  width?: number;
  height?: number;
  steps?: number;
  guidance?: number;
  strength?: number; // For inpainting/outpainting
  output_format?: string;
}

export interface FluxKontextResponse {
  id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: {
    image_url?: string;
    images?: string[];
  };
  error?: string;
  progress?: number;
}

class FluxKontextService {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  constructor() {
    this.apiKey = process.env.FLUX_KONTEXT_API_KEY || '';
    this.baseUrl = process.env.FLUX_KONTEXT_BASE_URL || 'https://api.flux-kontext.com/v1';
    
    if (!this.apiKey) {
      console.warn('FLUX_KONTEXT_API_KEY não configurada');
    }
  }

  /**
   * Inicia o processamento de virtual staging com flux-kontext-pro
   */
  async processVirtualStaging(request: FluxKontextRequest): Promise<FluxKontextResponse> {
    try {
      console.log('Iniciando processamento com flux-kontext-pro:', {
        model: request.model,
        hasImage: !!request.image,
        hasMask: !!request.mask,
        dimensions: `${request.width}x${request.height}`
      });

      const response = await fetch(`${this.baseUrl}/generate`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: request.model || 'flux-kontext-pro',
          prompt: request.prompt,
          image: request.image,
          mask: request.mask,
          width: request.width || 1024,
          height: request.height || 1024,
          steps: request.steps || 20,
          guidance: request.guidance || 7.5,
          strength: request.strength || 0.8,
          output_format: request.output_format || 'jpeg',
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro na API flux-kontext: ${response.status} - ${errorText}`);
      }

      const result = await response.json() as FluxKontextResponse;
      
      console.log('Resposta da flux-kontext-pro:', {
        id: result.id,
        status: result.status
      });

      return result;
    } catch (error) {
      console.error('Erro ao processar com flux-kontext-pro:', error);
      throw new Error(`Falha no processamento: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  /**
   * Verifica o status de um job em processamento
   */
  async checkJobStatus(jobId: string): Promise<FluxKontextResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/jobs/${jobId}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Erro ao verificar status: ${response.status} - ${errorText}`);
      }

      const result = await response.json() as FluxKontextResponse;
      
      console.log('Status do job flux-kontext:', {
        id: jobId,
        status: result.status,
        progress: result.progress
      });

      return result;
    } catch (error) {
      console.error('Erro ao verificar status do job:', error);
      throw new Error(`Falha na verificação de status: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
    }
  }

  /**
   * Aguarda a conclusão de um job com polling
   */
  async waitForCompletion(jobId: string, maxAttempts: number = 60, intervalMs: number = 5000): Promise<FluxKontextResponse> {
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      try {
        const status = await this.checkJobStatus(jobId);
        
        if (status.status === 'completed') {
          console.log('Job flux-kontext concluído com sucesso:', jobId);
          return status;
        }
        
        if (status.status === 'failed') {
          throw new Error(`Job falhou: ${status.error || 'Erro desconhecido'}`);
        }
        
        console.log(`Aguardando conclusão do job ${jobId} (tentativa ${attempts + 1}/${maxAttempts})`);
        
        // Aguardar antes da próxima verificação
        await new Promise(resolve => setTimeout(resolve, intervalMs));
        attempts++;
        
      } catch (error) {
        console.error(`Erro na tentativa ${attempts + 1} de verificar status:`, error);
        attempts++;
        
        if (attempts >= maxAttempts) {
          throw new Error(`Timeout ao aguardar conclusão do job ${jobId}`);
        }
        
        // Aguardar antes de tentar novamente
        await new Promise(resolve => setTimeout(resolve, intervalMs));
      }
    }
    
    throw new Error(`Timeout ao aguardar conclusão do job ${jobId} após ${maxAttempts} tentativas`);
  }

  /**
   * Converte imagem para base64
   */
  async imageToBase64(imageBuffer: Buffer): Promise<string> {
    return imageBuffer.toString('base64');
  }

  /**
   * Valida se a API está configurada corretamente
   */
  isConfigured(): boolean {
    return !!this.apiKey && !!this.baseUrl;
  }

  /**
   * Testa a conectividade com a API
   */
  async testConnection(): Promise<boolean> {
    try {
      const response = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${this.apiKey}`,
        },
      });
      
      return response.ok;
    } catch (error) {
      console.error('Erro ao testar conexão com flux-kontext:', error);
      return false;
    }
  }
}

export const fluxKontextService = new FluxKontextService();