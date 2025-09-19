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
  negativePrompt: string;
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
   * Generate a refined virtual staging prompt using GPT-4o,
   * acting as an expert interior designer and architect.
   */
  async generateVirtualStagingPrompt(
    roomType: RoomType,
    furnitureStyle: FurnitureStyle,
    imageAnalysis: ImageAnalysis
  ): Promise<VirtualStagingPrompt> {
    try {
      const systemPrompt = `You are an expert architect and interior designer specializing in virtual staging.
Your task is to generate detailed prompts for generative AI (flux-kontext-pro) that add furniture and decor
to empty or partially furnished spaces while preserving the original architecture.`;

      const userPrompt = `Based on the following room analysis, generate a detailed staging prompt:

ROOM TYPE: ${this.getRoomTypeDescription(roomType)}
FURNITURE STYLE: ${this.getFurnitureStyleDescription(furnitureStyle)}

IMAGE ANALYSIS:
- Dimensions: ${imageAnalysis.dimensions.width}x${imageAnalysis.dimensions.height}
- Description: ${imageAnalysis.description}
- Lighting: ${imageAnalysis.lighting}
- Architecture: ${imageAnalysis.architecture}
- Existing Elements: ${imageAnalysis.existingElements.join(', ')}

Return ONLY valid JSON:
{
  "prompt": "highly detailed generative AI prompt for staging",
  "negativePrompt": "things to avoid (walls, floors, ceiling, structure)",
  "designPrinciples": ["applied principles"],
  "suggestedElements": ["list of furniture and decor suggestions"]
}`;

      const response = await this.openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: 1200,
        temperature: 0.6,
        response_format: { type: 'json_object' }, // ensures JSON
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
