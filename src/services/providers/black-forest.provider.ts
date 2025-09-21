import { IVirtualStagingProvider, VirtualStagingParams, VirtualStagingResult, ProviderConfig, ProviderCapabilities } from '../../interfaces/virtual-staging-provider.interface';
import { BaseService } from '../base.service';
import { Provider, RoomType, FurnitureStyle, BlackForestApiResponse, BlackForestWebhookResponse, LoraConfig, StagingStage, StagingPlan, StagingStageResult, StagingProgressResult } from '../../interfaces/upload.interface';
import { chatGPTService } from '../chatgpt.service';
import { StagingValidationService } from '../staging-validation.service';
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
  webhook_url?: string; // URL para receber notificação quando processamento completar
};

/**
 * Adapter para o Black Forest que implementa a interface comum
 */
export class BlackForestProvider extends BaseService implements IVirtualStagingProvider {
  readonly name: Provider = 'black-forest';
  readonly version = '1.0.0';
  readonly isAsync = true;
  readonly supportsWebhooks = true;
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
        ...(this.config.webhookUrl && { webhook_url: this.config.webhookUrl }),
      };

      // Configurar timeout e retry
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 segundos timeout
      
      let lastError: Error | null = null;
      let resp: Response | null = null;
      
      // Retry logic - 3 tentativas
      for (let attempt = 1; attempt <= 3; attempt++) {
        try {
          console.log(`[Black Forest] Tentativa ${attempt}/3 para enviar requisição...`);
          
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
          console.error(`[Black Forest] Tentativa ${attempt}/3 falhou:`, error);
          
          if (attempt < 3) {
            const delay = attempt * 2000; // 2s, 4s
            console.log(`[Black Forest] Aguardando ${delay}ms antes da próxima tentativa...`);
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

    const resp = await fetch(`${this.config.baseUrl}/v1/flux-pro-1.0-fill`, {
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
    const resp = await fetch(`${this.config.baseUrl}/v1/get_result?id=${jobId}`, {
      method: 'GET',
      headers: { 'x-key': this.config.apiKey, 'Content-Type': 'application/json' },
    });
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

      // Usar o método correto do flux-kontext-pro
      const prompt = this.generatePrompt(params.roomType, params.furnitureStyle);
      const response = await this.generateVirtualStaging(
        params.imageBase64 || '',
        prompt
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
          outputImageUrl: response.result.sample.trim(),
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
      supportsWebhooks: this.supportsWebhooks,
      supportsPolling: true,
      asyncOnly: false,
    };
  }

  /**
   * Novo método de virtual staging em 3 etapas
   */
  async processVirtualStagingInStages(
    uploadId: string,
    inputImageBase64: string,
    roomType: RoomType,
    furnitureStyle: FurnitureStyle,
    progressCallback?: (progress: StagingProgressResult) => void
  ): Promise<VirtualStagingResult> {
    try {
      console.log(`[${uploadId}] 🚀 Iniciando processamento em etapas`);
      
      // Gerar plano de staging
      const plan = await this.generateStagingPlan(roomType, furnitureStyle);
      console.log(`[${uploadId}] 📋 Plano gerado:`, plan);

      // Executar apenas a primeira etapa
      const firstStage = plan.stages[0];
      if (!firstStage) {
        return {
          success: false,
          errorMessage: 'Plano de staging inválido - nenhuma etapa encontrada'
        };
      }
      
      console.log(`[${uploadId}] 🚀 INICIANDO ETAPA 1/${plan.stages.length}: ${firstStage.stage.toUpperCase()}`);
      console.log(`[${uploadId}] - Itens permitidos: ${firstStage.allowedCategories.join(', ')}`);
      console.log(`[${uploadId}] - Range de itens: ${firstStage.minItems}-${firstStage.maxItems}`);

      // Log da imagem de entrada
      console.log(`[${uploadId}] 🖼️  IMAGEM DE ENTRADA ETAPA 1:`);
      console.log(`[${uploadId}] - Tamanho base64: ${inputImageBase64.length} caracteres`);
      console.log(`[${uploadId}] - Hash da imagem: ${inputImageBase64.slice(-20)}`);

      // Notificar progresso
      if (progressCallback) {
        progressCallback({
          uploadId,
          currentStage: firstStage.stage,
          completedStages: [],
          stageResults: [],
          success: true,
          totalProgress: (1 / plan.stages.length) * 100
        });
      }

      // Executar primeira etapa
      console.log(`[${uploadId}] Executando etapa 1/${plan.stages.length}: ${firstStage.stage}`);
      
      const stageResult = await this.executeStage(
        uploadId,
        inputImageBase64,
        firstStage,
        roomType,
        furnitureStyle
      );

      if (stageResult.success && stageResult.jobId) {
        console.log(`[${uploadId}] ✅ Job ${stageResult.jobId} enviado para etapa ${firstStage.stage}. Aguardando webhook...`);
        
        return {
          success: true,
          requestId: stageResult.jobId,
          metadata: {
            status: 'processing',
            uploadId,
            stagingPlan: plan,
            currentStage: firstStage.stage,
            totalStages: plan.stages.length
          }
        };
      } else {
        console.log(`[${uploadId}] ❌ ERRO: Falha ao enviar primeira etapa`);
        return {
          success: false,
          errorMessage: stageResult.errorMessage || 'Falha ao enviar primeira etapa'
        };
      }
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Staging in stages error:', error as Error);
      return {
        success: false,
        errorMessage: `Staging em etapas falhou: ${errorMessage}`,
      };
    }
  }

  private async generateStagingPlan(roomType: RoomType, furnitureStyle: FurnitureStyle): Promise<StagingPlan> {
    return chatGPTService.generateStagingPlan(roomType, furnitureStyle);
  }

  async executeStage(
    uploadId: string,
    imageBase64: string,
    stageConfig: any,
    roomType: RoomType,
    furnitureStyle: FurnitureStyle
  ): Promise<{ success: boolean; jobId?: string; imageUrl?: string; errorMessage?: string }> {
    try {
      // Gerar prompt específico para a etapa
      const prompt = chatGPTService.generateStageSpecificPrompt(
        stageConfig.stage,
        roomType,
        furnitureStyle,
        0 // stageIndex não é usado no generateStageSpecificPrompt
      );
      
      console.log(`[${uploadId}] 🎯 Prompt gerado para ${stageConfig.stage}: ${prompt.substring(0, 100)}...`);
      
      // Executar staging para esta etapa
      console.log(`[${uploadId}] 📤 Enviando requisição para Black Forest...`);
      const response = await this.generateVirtualStaging(imageBase64, prompt);
      
      if (response.error) {
        console.log(`[${uploadId}] ❌ Erro na API: ${response.error}`);
        return {
          success: false,
          errorMessage: response.error
        };
      }
      
      if (response.id) {
        console.log(`[${uploadId}] ✅ Job criado com sucesso: ${response.id}`);
        return {
          success: true,
          jobId: response.id
        };
      }
      
      console.log(`[${uploadId}] ⚠️ Resposta inesperada da API:`, response);
      return {
        success: false,
        errorMessage: 'Resposta inesperada da API'
      };
      
    } catch (error) {
      console.log(`[${uploadId}] ❌ Erro ao executar etapa:`, error);
      return {
        success: false,
        errorMessage: error instanceof Error ? error.message : 'Erro desconhecido'
      };
    }
  }

  private countItemsInPreviousStages(stageResults: StagingStageResult[]): number {
    // Implementação simplificada - contar itens baseado nas etapas concluídas
    return stageResults.filter(r => r.success).length;
  }

  private addReinforcementToPrompt(prompt: string, stage: StagingStage): string {
    const reinforcements: Record<StagingStage, string> = {
      'foundation': 'No wall decor or window treatments. Stairs and doors are no-placement zones. Add essential main furniture only.',
      'complement': 'Only add if space is clearly available. No blocking of doors/windows. Add complementary items carefully.',
      'wall_decoration': 'Add wall decor items only. Focus on framed artwork, mirrors, and wall shelves. Ensure proper height and balanced distribution.'
    };
    
    return `${prompt}\n\nREINFORCEMENT: ${reinforcements[stage] || 'Follow all placement rules strictly.'}`;
  }

  private applyCorrectionToPrompt(prompt: string, issues: string[]): string {
    const corrections = issues.map(issue => {
      if (issue.includes('wall decor')) return 'Remove any wall decor (frames, mirrors, prints).';
      if (issue.includes('curtains')) return 'Remove any window treatments (curtains, blinds).';
      if (issue.includes('door')) return 'Ensure all doors remain fully visible and accessible.';
      if (issue.includes('circulation')) return 'Maintain 90cm clearance around all furniture.';
      return `Address: ${issue}`;
    }).join(' ');
    
    return `${prompt}\n\nCORRECTIONS NEEDED: ${corrections}`;
  }

  private async waitForCompletion(jobId: string): Promise<VirtualStagingResult> {
    const maxAttempts = 15; // 75 segundos máximo (15 tentativas de 5 segundos)
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      const result = await this.checkJobStatus(jobId);
      
      if (result.success && result.outputImageUrl) {
        return {
          success: true,
          outputImageUrl: result.outputImageUrl,
          metadata: {
            imageUrl: result.outputImageUrl,
            ...result.metadata
          }
        };
      }
      
      if (result.errorMessage) {
        return result;
      }
      
      // Se ainda está processando, aguardar
      if (result.success && result.metadata?.status && result.metadata.status !== 'completed') {
        console.log(`[${jobId}] Status: ${result.metadata.status}, aguardando... (tentativa ${attempts + 1}/${maxAttempts})`);
        await new Promise(resolve => setTimeout(resolve, 5000)); // 5 segundos por tentativa
        attempts++;
        continue;
      }
      
      // Aguardar 5 segundos antes da próxima verificação
      await new Promise(resolve => setTimeout(resolve, 5000));
      attempts++;
    }
    
    return {
      success: false,
      errorMessage: 'Timeout aguardando conclusão do job'
    };
  }

  async downloadAndConvertToBase64(imageUrl: string): Promise<string> {
    const maxRetries = 3;
    const timeoutMs = 30000; // 30 segundos para download de imagem
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[${new Date().toISOString()}] 📥 Tentativa ${attempt}/${maxRetries} - Baixando imagem: ${imageUrl}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        
        const response = await fetch(imageUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'Stagingfy/1.0'
          }
        });
        
        clearTimeout(timeoutId);
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        const base64 = buffer.toString('base64');
        
        // Detectar tipo de imagem baseado na URL ou headers
        const contentType = response.headers.get('content-type') || 'image/jpeg';
        
        console.log(`[${new Date().toISOString()}] ✅ Imagem baixada com sucesso (${buffer.length} bytes)`);
        return `data:${contentType};base64,${base64}`;
        
      } catch (error: any) {
        console.error(`[${new Date().toISOString()}] ❌ Tentativa ${attempt}/${maxRetries} falhou:`, error.message);
        
        if (attempt === maxRetries) {
          throw new Error(`Falha ao baixar imagem após ${maxRetries} tentativas: ${error.message}`);
        }
        
        // Aguardar antes da próxima tentativa (backoff exponencial)
        const delay = Math.min(1000 * Math.pow(2, attempt - 1), 5000);
        console.log(`[${new Date().toISOString()}] ⏳ Aguardando ${delay}ms antes da próxima tentativa...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    throw new Error('Falha inesperada no download da imagem');
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