// src/services/black-forest.service.ts
import sharp from 'sharp';
import {
  BlackForestApiResponse,
  RoomType,
  FurnitureStyle,
  LoraConfig,
} from '../interfaces/upload.interface';

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

class BlackForestService {
  private readonly apiKey: string;
  private readonly baseUrl: string;

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
    if (!this.apiKey) throw new Error('BLACK_FOREST_API_KEY is required');
    if (!this.baseUrl) throw new Error('BLACK_FOREST_API_URL is required');
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
      living_room: 'living room',
      bedroom: 'bedroom',
      kitchen: 'kitchen',
      bathroom: 'bathroom',
      dining_room: 'dining room',
      office: 'home office',
      balcony: 'balcony',
    };
    const styleMap: Record<FurnitureStyle, string> = {
      modern: 'modern',
      japanese_minimalist: 'Japanese minimalist',
      scandinavian: 'Scandinavian',
      industrial: 'industrial',
      classic: 'classic',
      contemporary: 'contemporary',
      rustic: 'rustic',
      bohemian: 'bohemian',
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
        // guidance: 5.0, // use somente se o provedor expõe este parâmetro para Kontext
        ...(opts?.seed !== undefined && { seed: opts.seed }),
      };

      const resp = await fetch(`${this.baseUrl}/flux-kontext-max`, {
        method: 'POST',
        headers: {
          'x-key': this.apiKey,
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
      model: 'flux-max-1.0-fill',
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

    const resp = await fetch(`${this.baseUrl}/flux-max-1.0-fill`, {
      method: 'POST',
      headers: {
        'x-key': this.apiKey,
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

  async checkJobStatus(jobId: string): Promise<BlackForestApiResponse> {
    const resp = await fetch(`${this.baseUrl}/get_result?id=${jobId}`, {
      method: 'GET',
      headers: { 'x-key': this.apiKey, 'Content-Type': 'application/json' },
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

  validateParameters(roomType: RoomType, furnitureStyle: FurnitureStyle) {
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
