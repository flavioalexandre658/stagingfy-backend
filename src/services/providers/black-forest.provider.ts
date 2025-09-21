import { IVirtualStagingProvider, VirtualStagingParams, VirtualStagingResult, ProviderConfig, ProviderCapabilities } from '../../interfaces/virtual-staging-provider.interface';
import { BaseService } from '../base.service';
import { Provider, RoomType, FurnitureStyle, BlackForestApiResponse, LoraConfig, StagingStage, StagingPlan, StagingStageResult, StagingProgressResult } from '../../interfaces/upload.interface';
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

      const resp = await fetch(`${this.config.baseUrl}/v1/flux-kontext-pro`, {
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
      supportsWebhooks: this.supportsWebhooks,
      supportsPolling: true,
      asyncOnly: false,
    };
  }

  /**
   * Novo método de virtual staging em 5 etapas
   */
  async processVirtualStagingInStages(
    uploadId: string,
    params: VirtualStagingParams,
    onProgress?: (progress: StagingProgressResult) => void
  ): Promise<VirtualStagingResult> {
    try {
      this.validateParams(params);
      
      const validationService = new StagingValidationService();
      
      // Gerar plano de staging
      const plan = chatGPTService.generateStagingPlan(
        params.roomType!,
        params.furnitureStyle!
      );
      
      let currentImage = params.imageBase64!;
      const stageResults: StagingStageResult[] = [];
      const completedStages: StagingStage[] = [];
      
      // Executar cada etapa
      for (let stageIndex = 0; stageIndex < plan.stages.length; stageIndex++) {
        const stageConfig = plan.stages[stageIndex];
        if (!stageConfig) continue;
        
        // Notificar progresso
        if (onProgress) {
          onProgress({
            uploadId: uploadId,
            currentStage: stageConfig.stage,
            completedStages: completedStages,
            stageResults: stageResults,
            success: true,
            totalProgress: ((stageIndex + 1) / plan.stages.length) * 100
          });
        }
        
        // Gerar prompt específico para a etapa
        const prompt = chatGPTService.generateStageSpecificPrompt(
          stageConfig.stage,
          params.roomType!,
          params.furnitureStyle!,
          this.countItemsInPreviousStages(stageResults)
        );
        
        // Executar staging para esta etapa
        const response = await this.generateVirtualStaging(currentImage, prompt);
        
        if (response.error) {
          // Se falhar, tentar uma vez com prompt reforçado
          const reinforcedPrompt = this.addReinforcementToPrompt(prompt, stageConfig.stage);
          const retryResponse = await this.generateVirtualStaging(currentImage, reinforcedPrompt);
          
          if (retryResponse.error) {
            return {
              success: false,
              errorMessage: `Falha na ${stageConfig.stage}: ${retryResponse.error}`,
            };
          }
          
          // Usar resultado da tentativa
          if (retryResponse.id) {
            const finalResult = await this.waitForCompletion(retryResponse.id);
            if (finalResult.success && finalResult.metadata?.imageUrl) {
              currentImage = finalResult.metadata.imageUrl;
            }
          }
        } else if (response.id) {
          // Aguardar conclusão
          const stageResult = await this.waitForCompletion(response.id);
          
          if (stageResult.success && stageResult.metadata?.imageUrl) {
            // Validar resultado da etapa
            const validation = await validationService.validateStage(
              params.imageBase64!,
              stageResult.metadata.imageUrl,
              stageConfig.stage,
              params.roomType!,
              stageConfig.maxItems
            );
            
            if (validation.passed) {
              currentImage = stageResult.metadata.imageUrl;
              completedStages.push(stageConfig.stage);
              stageResults.push({
                stage: stageConfig.stage,
                success: true,
                imageUrl: stageResult.metadata.imageUrl,
                jobId: response.id,
                itemsAdded: validation.itemCount,
                validationPassed: true,
                retryCount: 0
              });
            } else {
              // Se validação falhar, tentar uma vez com correções
              const correctedPrompt = this.applyCorrectionToPrompt(prompt, validation.errors);
              const correctionResponse = await this.generateVirtualStaging(currentImage, correctedPrompt);
              
              if (correctionResponse.id) {
                const correctedResult = await this.waitForCompletion(correctionResponse.id);
                if (correctedResult.success && correctedResult.metadata?.imageUrl) {
                  currentImage = correctedResult.metadata.imageUrl;
                  completedStages.push(stageConfig.stage);
                  stageResults.push({
                    stage: stageConfig.stage,
                    success: true,
                    imageUrl: correctedResult.metadata.imageUrl,
                    jobId: correctionResponse.id,
                    itemsAdded: 1, // Estimativa
                    validationPassed: true,
                    retryCount: 1
                  });
                } else {
                  // Se ainda falhar, usar resultado anterior (menos itens, mas correto)
                  stageResults.push({
                    stage: stageConfig.stage,
                    success: false,
                    itemsAdded: 0,
                    validationPassed: false,
                    validationErrors: validation.errors,
                    retryCount: 1
                  });
                }
              }
            }
          } else {
            stageResults.push({
              stage: stageConfig.stage,
              success: false,
              itemsAdded: 0,
              validationPassed: false,
              validationErrors: [stageResult.errorMessage || 'Falha na geração da imagem'],
              retryCount: 0
            });
          }
        }
      }
      
      // Resultado final
      return {
        success: true,
        metadata: {
          imageUrl: currentImage,
          plan: plan,
          stageResults: stageResults,
          totalStages: plan.stages.length,
          completedStages: completedStages.length
        }
      };
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error('Staging in stages error:', error as Error);
      return {
        success: false,
        errorMessage: `Staging em etapas falhou: ${errorMessage}`,
      };
    }
  }

  private countItemsInPreviousStages(stageResults: StagingStageResult[]): number {
    // Implementação simplificada - contar itens baseado nas etapas concluídas
    return stageResults.filter(r => r.success).length;
  }

  private addReinforcementToPrompt(prompt: string, stage: StagingStage): string {
    const reinforcements: Record<StagingStage, string> = {
      'anchor': 'No wall decor or window treatments. Stairs and doors are no-placement zones.',
      'complete_main': 'Prefer fewer items; stop early if space becomes tight.',
      'minimal_complements': 'Only add if space is clearly available. No blocking of doors/windows.',
      'optional_expansion': 'Stop at first sign of density. Better fewer items than overcrowded.',
      'polish': 'No new items. Only subtle position/scale adjustments.'
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
    const maxAttempts = 30; // 5 minutos máximo
    let attempts = 0;
    
    while (attempts < maxAttempts) {
      const result = await this.checkJobStatus(jobId);
      
      if (result.success && result.outputImageUrl) {
        return result;
      }
      
      if (result.errorMessage) {
        return result;
      }
      
      // Aguardar 10 segundos antes da próxima verificação
      await new Promise(resolve => setTimeout(resolve, 10000));
      attempts++;
    }
    
    return {
      success: false,
      errorMessage: 'Timeout aguardando conclusão do job'
    };
  }
}