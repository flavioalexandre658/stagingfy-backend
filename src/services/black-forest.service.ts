import {
  BlackForestApiRequest,
  BlackForestApiResponse,
  RoomType,
  FurnitureStyle,
  LoraConfig,
} from '../interfaces/upload.interface';

class BlackForestService {
  private readonly apiKey: string;
  private readonly baseUrl: string;

  // Configuração dos LoRAs para cada tipo de ambiente e estilo
  private readonly loraConfig: LoraConfig = {
    roomType: {
      living_room: 'living_room_lora',
      bedroom: 'bedroom_lora',
      kitchen: 'kitchen_lora',
      bathroom: 'bathroom_lora',
      dining_room: 'dining_room_lora',
      office: 'office_lora',
      balcony: 'balcony_lora',
    },
    furnitureStyle: {
      modern: 'modern_furniture_lora',
      japanese_minimalist: 'japanese_minimalist_lora',
      scandinavian: 'scandinavian_lora',
      industrial: 'industrial_lora',
      classic: 'classic_lora',
      contemporary: 'contemporary_lora',
      rustic: 'rustic_lora',
      bohemian: 'bohemian_lora',
    },
  };

  constructor() {
    this.apiKey = process.env.BLACK_FOREST_API_KEY!;
    this.baseUrl = process.env.BLACK_FOREST_API_URL!;

    if (!this.apiKey) {
      throw new Error('BLACK_FOREST_API_KEY environment variable is required');
    }
  }

  /**
   * Gera o prompt baseado no tipo de ambiente e estilo de móveis
   */
  private generatePrompt(
    roomType: RoomType,
    furnitureStyle: FurnitureStyle
  ): string {
    const roomTypeMap: Record<RoomType, string> = {
      living_room: 'sala de estar',
      bedroom: 'quarto',
      kitchen: 'cozinha',
      bathroom: 'banheiro',
      dining_room: 'sala de jantar',
      office: 'escritório',
      balcony: 'varanda',
    };

    const styleMap: Record<FurnitureStyle, string> = {
      modern: 'moderno',
      japanese_minimalist: 'minimalista japonês',
      scandinavian: 'escandinavo',
      industrial: 'industrial',
      classic: 'clássico',
      contemporary: 'contemporâneo',
      rustic: 'rústico',
      bohemian: 'boêmio',
    };

    return `Virtual staging of an empty ${roomTypeMap[roomType]}, furnished in ${styleMap[furnitureStyle]} style. Realistic lighting, proportions, and high-quality furniture placement. Professional interior design photography style.`;
  }

  /**
   * Seleciona os LoRAs apropriados baseado nos parâmetros
   */
  private selectLoras(roomType: RoomType, furnitureStyle: FurnitureStyle) {
    return [
      {
        id: this.loraConfig.roomType[roomType],
        weight: 0.8,
      },
      {
        id: this.loraConfig.furnitureStyle[furnitureStyle],
        weight: 0.7,
      },
    ];
  }

  /**
   * Envia uma imagem para processamento na Black Forest API
   */
  async generateStagedImage(
    imageBase64: string,
    maskBase64: string,
    roomType: RoomType,
    furnitureStyle: FurnitureStyle
  ): Promise<BlackForestApiResponse> {
    try {
      const prompt = this.generatePrompt(roomType, furnitureStyle);

      const requestBody: BlackForestApiRequest = {
        model: 'flux-pro-1.0-fill',
        prompt,
        image: imageBase64,
        mask: maskBase64,
        steps: 50,
        guidance: 30,
        output_format: 'jpeg',
        safety_tolerance: 2,
      };

      const response = await fetch(`${this.baseUrl}/flux-pro-1.0-fill`, {
        method: 'POST',
        headers: {
          'x-key': this.apiKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(
          `Black Forest API error: ${response.status} - ${errorData}`
        );
      }

      const result = (await response.json()) as BlackForestApiResponse;
      return result;
    } catch (error) {
      console.error('Error calling Black Forest API:', error);
      throw new Error(
        `Failed to generate staged image: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Verifica o status de um job na Black Forest API
   */
  async checkJobStatus(jobId: string): Promise<BlackForestApiResponse> {
    try {
      const response = await fetch(`${this.baseUrl}/get_result?id=${jobId}`, {
        method: 'GET',
        headers: {
          'x-key': this.apiKey,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const errorData = await response.text();
        throw new Error(
          `Black Forest API error: ${response.status} - ${errorData}`
        );
      }

      const result = (await response.json()) as BlackForestApiResponse;
      return result;
    } catch (error) {
      console.error('Error checking job status:', error);
      throw new Error(
        `Failed to check job status: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Valida se os parâmetros de entrada são válidos
   */
  validateParameters(
    roomType: RoomType,
    furnitureStyle: FurnitureStyle
  ): boolean {
    const validRoomTypes = Object.keys(this.loraConfig.roomType) as RoomType[];
    const validStyles = Object.keys(
      this.loraConfig.furnitureStyle
    ) as FurnitureStyle[];

    return (
      validRoomTypes.includes(roomType) && validStyles.includes(furnitureStyle)
    );
  }
}

export const blackForestService = new BlackForestService();
