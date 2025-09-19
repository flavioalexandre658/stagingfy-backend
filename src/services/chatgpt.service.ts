import OpenAI from 'openai';
import { RoomType, FurnitureStyle } from '../interfaces/upload.interface';

export interface ImageAnalysis {
  dimensions: { width: number; height: number };
  description: string;
  lighting: string;
  architecture: string;
  existingElements: string[];
}

class ChatGPTService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY,
    });
  }

  /**
   * Analyze an interior image using GPT-4o Vision
   */
  async analyzeImage(imageBase64: string): Promise<ImageAnalysis> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: `Analyze this interior image and return ONLY valid JSON with the following structure:
                {
                  "dimensions": {"width": estimated_width, "height": estimated_height},
                  "description": "detailed description of the room",
                  "lighting": "lighting type and quality",
                  "architecture": "architectural features (ceiling height, windows, doors, etc.)",
                  "existingElements": ["list of existing furniture or objects"]
                }`,
              },
              {
                type: 'image_url',
                image_url: { url: `data:image/jpeg;base64,${imageBase64}` },
              },
            ],
          },
        ],
        max_tokens: 800,
        temperature: 0.2,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('Empty response from GPT-4o');

      return JSON.parse(content);
    } catch (error) {
      console.error('Error analyzing image with GPT-4o:', error);
      throw new Error('Image analysis failed');
    }
  }

  /**
   * Generate a final staging prompt in English, ready for flux-kontext-pro
   */
  async generateVirtualStagingPrompt(
    roomType: RoomType,
    furnitureStyle: FurnitureStyle
  ): Promise<string> {
    try {
      const systemPrompt = `You are an expert interior designer specializing in virtual staging for AI image generation.
Your job is to write ONE clear, final prompt in English for flux-kontext-pro.

CRITICAL RULES:
- ONLY add furniture, decorative objects, lighting fixtures, and accessories
- NEVER modify walls, floors, ceilings, doors, windows, or lighting
- Preserve all existing architectural and lighting elements
- Keep descriptions realistic, detailed, and specific
- Focus on furniture placement, proportions, and harmony of style
- Output must be a single staging prompt in English, ready to send directly to flux-kontext-pro.`;

      const userPrompt = `Based on the following image analysis:

ROOM TYPE: ${this.getRoomTypeDescription(roomType)}
FURNITURE STYLE: ${this.getFurnitureStyleDescription(furnitureStyle)}

Write a final flux-kontext-pro prompt like this example:

"Furnish the empty bedroom in the uploaded image with modern furniture while preserving the existing walls, floor, ceiling, windows, and lighting. Add a queen-size bed featuring a sleek, minimalist headboard, positioned centrally against one wall. Include two contemporary nightstands on either side of the bed, each topped with stylish lamps. Incorporate a modern wardrobe or dresser aligned with the room’s proportions. Place a subtle area rug under the bed to enhance the cozy atmosphere. Maintain a cohesive modern interior design style throughout, without altering any architectural elements."

Now write the final prompt for this case:`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        max_tokens: 800,
        temperature: 0.7,
      });

      const content = response.choices[0]?.message?.content?.trim();
      if (!content) throw new Error('Empty response from GPT-4o');

      return content;
    } catch (error) {
      console.error('Error generating virtual staging prompt:', error);
      throw new Error('Prompt generation failed');
    }
  }

  private getRoomTypeDescription(roomType: RoomType): string {
    const descriptions: Record<RoomType, string> = {
      living_room:
        'Living Room — social space for relaxation and entertainment',
      bedroom: 'Bedroom — intimate space for rest and privacy',
      kitchen: 'Kitchen — functional area for food preparation',
      bathroom: 'Bathroom — hygiene and wellness space',
      dining_room: 'Dining Room — area for meals and gatherings',
      office: 'Office — workspace for productivity',
      balcony: 'Balcony — outdoor leisure and contemplation area',
    };
    return descriptions[roomType];
  }

  private getFurnitureStyleDescription(furnitureStyle: FurnitureStyle): string {
    const descriptions: Record<FurnitureStyle, string> = {
      modern: 'Modern — clean lines, minimalism, contemporary materials',
      japanese_minimalist:
        'Japanese Minimalist — simplicity, functionality, natural elements',
      scandinavian: 'Scandinavian — cozy, light colors, natural wood',
      industrial:
        'Industrial — raw materials, metal, concrete, urban aesthetic',
      classic: 'Classic — timeless elegance, symmetry, noble materials',
      contemporary: 'Contemporary — current trends, comfort, versatility',
      rustic: 'Rustic — natural materials, organic textures, rural coziness',
      bohemian:
        'Bohemian — eclecticism, vibrant colors, varied textures, artistic feel',
    };
    return descriptions[furnitureStyle];
  }
}

export const chatGPTService = new ChatGPTService();
