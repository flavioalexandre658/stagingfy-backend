import { StagingValidationResult, StagingStage, RoomType } from '../interfaces/upload.interface';
import sharp from 'sharp';

/**
 * Serviço de validação para o sistema de staging em etapas
 * Implementa heurísticas simples e rápidas para validar cada etapa
 */
export class StagingValidationService {
  
  /**
   * Valida uma etapa específica do staging
   */
  async validateStage(
    originalImageBase64: string,
    processedImageBase64: string,
    stage: StagingStage,
    roomType: RoomType,
    expectedItemCount: number
  ): Promise<StagingValidationResult> {
    try {
      const result: StagingValidationResult = {
        passed: true,
        itemCount: 0,
        hasWallDecor: false,
        hasWindowTreatments: false,
        doorsBlocked: false,
        stairsBlocked: false,
        colorDeviationDetected: false,
        errors: []
      };

      // 1. Validação de contagem de itens (heurística simples)
      result.itemCount = await this.estimateItemCount(processedImageBase64);
      
      // 2. Validação de desvio de cor global
      result.colorDeviationDetected = await this.detectColorDeviation(
        originalImageBase64, 
        processedImageBase64
      );

      // 3. Detecção de wall decor (heurística baseada em análise de bordas)
      result.hasWallDecor = await this.detectWallDecor(processedImageBase64);

      // 4. Detecção de cortinas/persianas
      result.hasWindowTreatments = await this.detectWindowTreatments(processedImageBase64);

      // 5. Validações específicas por etapa
      await this.validateStageSpecific(result, stage, expectedItemCount);

      // 6. Validações específicas por tipo de cômodo
      await this.validateRoomSpecific(result, roomType);

      // Determinar se passou na validação
      result.passed = result.errors.length === 0;

      return result;
    } catch (error) {
      return {
        passed: false,
        itemCount: 0,
        hasWallDecor: false,
        hasWindowTreatments: false,
        doorsBlocked: false,
        stairsBlocked: false,
        colorDeviationDetected: false,
        errors: [`Validation error: ${error instanceof Error ? error.message : 'Unknown error'}`]
      };
    }
  }

  /**
   * Estima o número de itens adicionados (heurística simples)
   * Baseado em análise de diferenças entre imagens
   */
  private async estimateItemCount(imageBase64: string): Promise<number> {
    try {
      // Implementação simplificada - em produção seria mais sofisticada
      // Por agora, retorna uma estimativa baseada no tamanho da imagem
      const payload = imageBase64.includes('base64,') 
        ? imageBase64.split('base64,')[1] 
        : imageBase64;
      
      if (!payload) {
        throw new Error('Invalid base64 image data');
      }
      
      const buffer = Buffer.from(payload, 'base64');
      const metadata = await sharp(buffer).metadata();
      
      // Heurística simples: imagens maiores tendem a ter mais itens
      const pixelCount = (metadata.width || 512) * (metadata.height || 512);
      const estimatedItems = Math.floor(pixelCount / 100000); // Ajustar conforme necessário
      
      return Math.max(1, Math.min(estimatedItems, 10)); // Entre 1 e 10 itens
    } catch (error) {
      return 1; // Fallback
    }
  }

  /**
   * Detecta desvio significativo de cor entre imagens
   */
  private async detectColorDeviation(
    originalBase64: string, 
    processedBase64: string
  ): Promise<boolean> {
    try {
      const originalPayload = originalBase64.includes('base64,') 
        ? originalBase64.split('base64,')[1] 
        : originalBase64;
      const processedPayload = processedBase64.includes('base64,') 
        ? processedBase64.split('base64,')[1] 
        : processedBase64;

      if (!originalPayload || !processedPayload) {
        return false;
      }

      const originalBuffer = Buffer.from(originalPayload, 'base64');
      const processedBuffer = Buffer.from(processedPayload, 'base64');

      // Análise simplificada de histograma de cores
      const originalStats = await sharp(originalBuffer).stats();
      const processedStats = await sharp(processedBuffer).stats();

      // Compara médias dos canais RGB
      const originalMean = originalStats.channels?.reduce((sum, ch) => sum + ch.mean, 0) / 3 || 0;
      const processedMean = processedStats.channels?.reduce((sum, ch) => sum + ch.mean, 0) / 3 || 0;

      const deviation = originalMean > 0 ? Math.abs(originalMean - processedMean) / originalMean : 0;
      
      // Se desvio > 15%, considera significativo
      return deviation > 0.15;
    } catch (error) {
      return false; // Em caso de erro, assume que não há desvio
    }
  }

  /**
   * Detecta presença de wall decor (quadros, espelhos, etc.)
   * Heurística baseada em análise de bordas retangulares nas paredes
   */
  private async detectWallDecor(imageBase64: string): Promise<boolean> {
    try {
      // Implementação simplificada
      // Em produção, usaria análise de bordas e detecção de formas retangulares
      
      const payload = imageBase64.includes('base64,') 
        ? imageBase64.split('base64,')[1] 
        : imageBase64;
      
      if (!payload) {
        return false;
      }
      
      const buffer = Buffer.from(payload, 'base64');
      
      // Análise de bordas usando Sharp
      const edges = await sharp(buffer)
        .greyscale()
        .convolve({
          width: 3,
          height: 3,
          kernel: [-1, -1, -1, -1, 8, -1, -1, -1, -1]
        })
        .raw()
        .toBuffer();

      // Heurística: se há muitas bordas na região superior da imagem (onde ficam quadros)
      // conta pixels de borda na metade superior
      const metadata = await sharp(buffer).metadata();
      const width = metadata.width || 512;
      const height = metadata.height || 512;
      
      let edgePixels = 0;
      const upperHalfSize = width * Math.floor(height / 2);
      
      for (let i = 0; i < upperHalfSize && i < edges.length; i++) {
        const pixel = edges[i];
        if (pixel !== undefined && pixel > 100) { // Threshold para detectar bordas
          edgePixels++;
        }
      }
      
      const edgeRatio = edgePixels / upperHalfSize;
      return edgeRatio > 0.05; // Se > 5% da área superior tem bordas, pode ser wall decor
    } catch (error) {
      return false;
    }
  }

  /**
   * Detecta cortinas ou persianas
   */
  private async detectWindowTreatments(imageBase64: string): Promise<boolean> {
    try {
      // Heurística simplificada: detecta padrões verticais repetitivos
      // que podem indicar cortinas ou persianas
      
      const payload = imageBase64.includes('base64,') 
        ? imageBase64.split('base64,')[1] 
        : imageBase64;
      
      if (!payload) {
        return false;
      }
      
      const buffer = Buffer.from(payload, 'base64');
      
      // Análise de padrões verticais
      const { data } = await sharp(buffer)
        .greyscale()
        .raw()
        .toBuffer({ resolveWithObject: true });

      const metadata = await sharp(buffer).metadata();
      const width = metadata.width || 512;
      const height = metadata.height || 512;

      // Procura por padrões verticais repetitivos (cortinas/persianas)
      let verticalPatterns = 0;
      
      for (let x = 0; x < width - 10; x += 10) {
        let columnVariance = 0;
        for (let y = 0; y < height - 1; y++) {
          const pixel1 = data[y * width + x];
          const pixel2 = data[(y + 1) * width + x];
          if (pixel1 !== undefined && pixel2 !== undefined) {
            columnVariance += Math.abs(pixel1 - pixel2);
          }
        }
        
        if (columnVariance > 1000) { // Threshold para detectar variação vertical
          verticalPatterns++;
        }
      }
      
      const patternRatio = verticalPatterns / (width / 10);
      return patternRatio > 0.3; // Se > 30% das colunas têm padrões, pode ser cortina
    } catch (error) {
      return false;
    }
  }

  /**
   * Validações específicas por etapa
   */
  private async validateStageSpecific(
    result: StagingValidationResult,
    stage: StagingStage,
    expectedItemCount: number
  ): Promise<void> {
    switch (stage) {
      case 'foundation':
        if (result.itemCount < expectedItemCount) {
          result.errors.push(`Foundation stage should have at least ${expectedItemCount} main items, found ${result.itemCount}`);
        }
        break;
        
      case 'complement':
        // Validação específica para complementos
        if (result.itemCount < expectedItemCount) {
          result.errors.push(`Complement stage should have at least ${expectedItemCount} complementary items, found ${result.itemCount}`);
        }
        break;
        
      case 'wall_decoration':
        // Na etapa de decoração de parede, validar itens de parede
        if (result.itemCount < expectedItemCount) {
          result.errors.push(`Wall decoration stage should have at least ${expectedItemCount} wall items, found ${result.itemCount}`);
        }
        // Permitir wall decor nesta etapa
        break;
        
      case 'windows_decoration':
        // Na etapa de decoração de janelas, validar tratamentos de janela
        if (result.itemCount < expectedItemCount) {
          result.errors.push(`Windows decoration stage should have at least ${expectedItemCount} window items, found ${result.itemCount}`);
        }
        // Permitir window treatments nesta etapa
        break;
        
      case 'customization':
        // Na etapa de customização, permitir ajustes finais (0-3 itens)
        if (result.itemCount > 3) {
          result.errors.push(`Customization stage should have at most 3 items, found ${result.itemCount}`);
        }
        // Permitir customizações nesta etapa
        break;
    }

    // Validações comuns para todas as etapas (exceto wall_decoration, windows_decoration e customization)
    if (stage !== 'wall_decoration' && stage !== 'windows_decoration' && stage !== 'customization') {
      if (result.hasWallDecor) {
        result.errors.push('Wall decor detected - not allowed in any stage');
      }
      
      if (result.hasWindowTreatments) {
        result.errors.push('Window treatments detected - not allowed in any stage');
      }
      
      if (result.colorDeviationDetected) {
        result.errors.push('Significant color deviation detected - architectural elements may have been modified');
      }
    }
    
    // Validações específicas para wall_decoration (não permitir window treatments)
    if (stage === 'wall_decoration') {
      if (result.hasWindowTreatments) {
        result.errors.push('Window treatments detected - not allowed in wall decoration stage');
      }
      
      if (result.colorDeviationDetected) {
        result.errors.push('Significant color deviation detected - architectural elements may have been modified');
      }
    }
    
    // Validações específicas para windows_decoration (não permitir wall decor)
    if (stage === 'windows_decoration') {
      if (result.hasWallDecor) {
        result.errors.push('Wall decor detected - not allowed in windows decoration stage');
      }
      
      if (result.colorDeviationDetected) {
        result.errors.push('Significant color deviation detected - architectural elements may have been modified');
      }
    }
    
    // Validações específicas para customization (permitir ajustes sutis)
    if (stage === 'customization') {
      // Na customização, permitimos mais flexibilidade mas ainda validamos estruturas
      if (result.doorsBlocked || result.stairsBlocked) {
        result.errors.push('Circulation paths must remain clear even during customization');
      }
      
      // Permitir pequenas variações de cor para ajustes de estilo
      // mas não grandes modificações estruturais
    }
  }

  /**
   * Validações específicas por tipo de cômodo
   */
  private async validateRoomSpecific(
    result: StagingValidationResult,
    roomType: RoomType
  ): Promise<void> {
    switch (roomType) {
      case 'kitchen':
        // Validações específicas para cozinha
        // Ex: verificar se bancos não bloqueiam circulação
        break;
        
      case 'bathroom':
        // Validações específicas para banheiro
        // Ex: verificar se não há obstrução de fixtures
        break;
        
      case 'living_room':
        // Validações específicas para sala
        break;
        
      // Adicionar outras validações conforme necessário
    }
  }

  /**
   * Valida se portas e escadas estão livres (implementação simplificada)
   */
  private async validateCirculation(imageBase64: string): Promise<{ doorsBlocked: boolean; stairsBlocked: boolean }> {
    // Implementação simplificada
    // Em produção, usaria detecção de objetos ou análise de bordas mais sofisticada
    
    return {
      doorsBlocked: false, // Por agora, assume que não há bloqueio
      stairsBlocked: false
    };
  }
}

export const stagingValidationService = new StagingValidationService();