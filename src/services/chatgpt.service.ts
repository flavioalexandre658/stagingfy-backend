// src/services/chatgpt.service.ts
import OpenAI from 'openai';
import { RoomType, FurnitureStyle } from '../interfaces/upload.interface';

class ChatGPTService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  /**
   * Generates a refined prompt for flux-kontext-pro.
   * Adds circulation rules and stronger style enforcement.
   */
  async generateVirtualStagingPrompt(
    roomType: RoomType,
    furnitureStyle: FurnitureStyle
  ): Promise<string> {
    const roomLabel = this.getRoomTypeLabel(roomType); // e.g. "living room"
    const styleLabel = this.getFurnitureStyleLabel(furnitureStyle); // e.g. "modern"
    const styleTraits = this.getFurnitureStyleTraits(furnitureStyle); // detailed design traits

    const prompt = `Add 2–5 pieces of ${styleLabel} furniture and one wall decoration to this ${roomLabel}. 
Keep the original room, lighting, and structure exactly as they are — do not modify them. 
Do not alter walls, doors, windows, ceiling, floor, trims, stairs, or any architectural elements. 
Preserve the exact perspective, framing, and lighting of the input photo. 

Important circulation rule: never place furniture blocking doors, stairways, or clear passage paths. 
Keep all circulation areas open and functional.

Style guidance: ${styleTraits} 
All added furniture and décor must reflect this ${styleLabel} interior design style consistently.

Output: produce a photo-realistic result that looks like a professionally staged real-estate photograph. 
Never remove or replace existing elements; only add furniture and decor consistent with the described style.`;

    return prompt;
  }

  // ------- helpers -------
  private getRoomTypeLabel(roomType: RoomType): string {
    const labels: Record<RoomType, string> = {
      living_room: 'living room',
      bedroom: 'bedroom',
      kitchen: 'kitchen',
      bathroom: 'bathroom',
      dining_room: 'dining room',
      office: 'home office',
      balcony: 'balcony',
    };
    return labels[roomType];
  }

  private getFurnitureStyleLabel(furnitureStyle: FurnitureStyle): string {
    const labels: Record<FurnitureStyle, string> = {
      modern: 'modern',
      japanese_minimalist: 'Japanese minimalist',
      scandinavian: 'Scandinavian',
      industrial: 'industrial',
      classic: 'classic',
      contemporary: 'contemporary',
      rustic: 'rustic',
      bohemian: 'bohemian',
    };
    return labels[furnitureStyle];
  }

  /**
   * Descriptive traits for each style, to force consistency in furniture look.
   */
  private getFurnitureStyleTraits(furnitureStyle: FurnitureStyle): string {
    const traits: Record<FurnitureStyle, string> = {
      modern:
        'clean lines, neutral palette, matte finishes, slim metal or wood legs, low-profile silhouettes, subtle texture layering.',
      japanese_minimalist:
        'low wooden furniture, natural materials, tatami or flat rugs, paper lamps, light wood finishes, uncluttered and calm aesthetic.',
      scandinavian:
        'light woods, airy fabrics, organic shapes, whites and beiges, cozy layered textiles, minimal yet warm aesthetic.',
      industrial:
        'raw wood, black steel frames, exposed joints, robust shapes, dark leather or fabric, urban loft aesthetic.',
      classic:
        'tufted upholstery, dark or polished wood, symmetry, ornate frames, elegant textiles like velvet or damask.',
      contemporary:
        'geometric shapes, sleek finishes, glass or polished stone accents, neutral palettes with bold single accents.',
      rustic:
        'solid wood with visible grain, warm tones, linen and wool fabrics, handcrafted feel, natural textures like jute or rattan.',
      bohemian:
        'layered rugs, eclectic textiles, rattan or wicker, plants, mix of patterns and colors, casual artistic vibe.',
    };
    return traits[furnitureStyle];
  }
}

export const chatGPTService = new ChatGPTService();
