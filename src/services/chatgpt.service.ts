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
      bedroom: 'bedroom',
      living_room: 'living room',
      kitchen: 'kitchen',
      bathroom: 'bathroom',
      home_office: 'home office',
      dining_room: 'dining room',
      kids_room: 'kids room',
      outdoor: 'outdoor space',
    };
    return labels[roomType];
  }

  private getFurnitureStyleLabel(furnitureStyle: FurnitureStyle): string {
    const labels: Record<FurnitureStyle, string> = {
      standard: 'standard',
      modern: 'modern',
      scandinavian: 'Scandinavian',
      industrial: 'industrial',
      midcentury: 'mid-century modern',
      luxury: 'luxury',
      coastal: 'coastal',
      farmhouse: 'farmhouse',
    };
    return labels[furnitureStyle];
  }

  /**
   * Descriptive traits for each style, to force consistency in furniture look.
   */
  private getFurnitureStyleTraits(furnitureStyle: FurnitureStyle): string {
    const traits: Record<FurnitureStyle, string> = {
      standard:
        'classic and timeless pieces, neutral colors, balanced proportions, versatile furniture that works in any setting.',
      modern:
        'clean lines, neutral palette, matte finishes, slim metal or wood legs, low-profile silhouettes, subtle texture layering.',
      scandinavian:
        'light woods, airy fabrics, organic shapes, whites and beiges, cozy layered textiles, minimal yet warm aesthetic.',
      industrial:
        'raw wood, black steel frames, exposed joints, robust shapes, dark leather or fabric, urban loft aesthetic.',
      midcentury:
        'tapered legs, warm wood tones, geometric patterns, bold accent colors, sleek and functional design from the 1950s-60s.',
      luxury:
        'high-end materials, rich fabrics like velvet and silk, gold or brass accents, sophisticated and elegant aesthetic.',
      coastal:
        'light and airy feel, natural textures like rattan and jute, blues and whites, weathered wood, nautical-inspired elements.',
      farmhouse:
        'rustic wood finishes, vintage and distressed elements, neutral earth tones, cozy and lived-in aesthetic, country charm.',
    };
    return traits[furnitureStyle];
  }
}

export const chatGPTService = new ChatGPTService();
