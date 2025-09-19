import OpenAI from 'openai';
import { RoomType, FurnitureStyle } from '../interfaces/upload.interface';

export interface ImageAnalysis {
  dimensions: { width: number; height: number };
  description: string;
  lighting: string;
  architecture: string;
  existingElements: string[];
}

export interface VirtualStagingPrompt {
  prompt: string;
  designPrinciples: string[];
  suggestedElements: string[];
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
   * to extract architectural and environmental details.
   */
  async analyzeImage(imageBase64: string): Promise<ImageAnalysis> {
    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o', // Best multimodal model
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
        response_format: { type: 'json_object' }, // force valid JSON
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
   * Generate an optimized virtual staging prompt using GPT-4o,
   * specifically designed for flux-kontext-pro to add furniture and interior decoration.
   */
  async generateVirtualStagingPrompt(
    roomType: RoomType,
    furnitureStyle: FurnitureStyle,
    imageAnalysis: ImageAnalysis
  ): Promise<VirtualStagingPrompt> {
    try {
      const systemPrompt = `You are an expert interior designer specializing in virtual staging for AI image generation.
Your task is to create optimized prompts for flux-kontext-pro that add furniture and interior decoration to empty spaces.

CRITICAL REQUIREMENTS:
- ONLY add furniture, decorative objects, lighting fixtures, and interior accessories
- NEVER modify walls, floors, ceilings, doors, windows, or architectural structure
- Preserve the original lighting and architectural features
- Focus on realistic furniture placement and interior decoration
- Use specific, detailed descriptions for better AI generation results`;

      const userPrompt = `Create an optimized flux-kontext-pro prompt for virtual staging:

ROOM TYPE: ${this.getRoomTypeDescription(roomType)}
FURNITURE STYLE: ${this.getFurnitureStyleDescription(furnitureStyle)}

ROOM ANALYSIS:
- Dimensions: ${imageAnalysis.dimensions.width}x${imageAnalysis.dimensions.height}
- Current state: ${imageAnalysis.description}
- Lighting conditions: ${imageAnalysis.lighting}
- Architecture: ${imageAnalysis.architecture}
- Existing elements: ${imageAnalysis.existingElements.join(', ')}

Generate a detailed prompt that will add appropriate furniture and decoration while preserving all architectural elements.

Return ONLY valid JSON:
{
  "prompt": "detailed flux-kontext-pro prompt for adding furniture and interior decoration",
  "designPrinciples": ["key design principles applied"],
  "suggestedElements": ["specific furniture and decor items to be added"]
}`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 1000,
        temperature: 0.7,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content;
      if (!content) throw new Error('Empty response from GPT-4o');

      return JSON.parse(content);
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
