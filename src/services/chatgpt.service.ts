// src/services/chatgpt.service.ts
import OpenAI from 'openai';
import { RoomType, FurnitureStyle } from '../interfaces/upload.interface';

class ChatGPTService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  /**
   * Minimal, preservation-first prompt for flux-kontext-pro.
   * Follows Black Forest guidance: be explicit that everything else must remain unchanged.
   * Dynamic furnishing (2–5 items) chosen by the model based on available space.
   */
  async generateVirtualStagingPrompt(
    roomType: RoomType,
    furnitureStyle: FurnitureStyle
  ): Promise<string> {
    const room = this.getRoomTypeLabel(roomType); // e.g., "living room"
    const style = this.getFurnitureStyleLabel(furnitureStyle); // e.g., "modern"

    const prompt = [
      `Add 2–5 pieces of ${style} furniture and decor to this ${room}.`,
      `Only add new objects. Do not modify any existing pixel of the scene.`,
      `Keep all other aspects of the original image EXACTLY the same: walls and paint, floor, ceiling, trims, STAIRS, doors, windows, vents, outlets, and fixtures.`,
      `Preserve the exact camera angle, framing, perspective, and lighting.`,
      `Do not add curtains or change wall colors/materials.`,
      `Do not place items that block stairways, door openings, or passage paths; if something does not fit in the visible floor area, skip it.`,
      `Use realistic scale and shadows consistent with the existing light.`,
    ].join(' ');

    return prompt;
  }

  // ---- helpers ----
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
}

export const chatGPTService = new ChatGPTService();
