import OpenAI from 'openai';
import { RoomType, FurnitureStyle } from '../interfaces/upload.interface';

export interface ImageAnalysis {
  dimensions: {
    width: number;
    height: number;
  };
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
   * Analisa a imagem usando GPT Vision para extrair informações arquitetônicas
   */
  async analyzeImage(imageBase64: string): Promise<ImageAnalysis> {
    try {
      const response = await this.openai.chat.completions.create({
        model: "gpt-4-vision-preview",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: `Analise esta imagem de interior e forneça as seguintes informações em formato JSON:
                {
                  "dimensions": {"width": estimativa_largura, "height": estimativa_altura},
                  "description": "descrição detalhada do ambiente",
                  "lighting": "tipo e qualidade da iluminação",
                  "architecture": "características arquitetônicas (pé direito, janelas, portas, etc)",
                  "existingElements": ["lista", "de", "elementos", "já", "presentes"]
                }
                
                Seja preciso e técnico na análise, focando em aspectos que influenciam o design de interiores.`
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`
                }
              }
            ]
          }
        ],
        max_tokens: 1000,
        temperature: 0.3
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Resposta vazia do ChatGPT');
      }

      // Extrair JSON da resposta
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Formato de resposta inválido do ChatGPT');
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('Erro ao analisar imagem com ChatGPT:', error);
      throw new Error('Falha na análise da imagem');
    }
  }

  /**
   * Gera prompt refinado para virtual staging usando ChatGPT como arquiteto/designer
   */
  async generateVirtualStagingPrompt(
    roomType: RoomType,
    furnitureStyle: FurnitureStyle,
    imageAnalysis: ImageAnalysis
  ): Promise<VirtualStagingPrompt> {
    try {
      const systemPrompt = `Você é um arquiteto e designer de interiores especialista em virtual staging. 
      Sua função é criar prompts detalhados para IA generativa (flux-kontext-pro) que adicionem móveis e elementos decorativos 
      a ambientes vazios ou parcialmente mobiliados, mantendo o ambiente real sem alterações estruturais.

      Princípios que você deve seguir:
      - Fluxo de circulação adequado
      - Proporção e escala corretas
      - Balanceamento visual
      - Harmonia de cores e texturas
      - Funcionalidade do espaço
      - Respeitar a arquitetura existente
      - Manter iluminação natural
      - Adicionar apenas móveis e decoração (virtual staging)`;

      const userPrompt = `Com base na análise da imagem:
      
      AMBIENTE: ${this.getRoomTypeDescription(roomType)}
      ESTILO: ${this.getFurnitureStyleDescription(furnitureStyle)}
      
      ANÁLISE DA IMAGEM:
      - Dimensões estimadas: ${imageAnalysis.dimensions.width}x${imageAnalysis.dimensions.height}
      - Descrição: ${imageAnalysis.description}
      - Iluminação: ${imageAnalysis.lighting}
      - Arquitetura: ${imageAnalysis.architecture}
      - Elementos existentes: ${imageAnalysis.existingElements.join(', ')}
      
      Gere um prompt detalhado para adicionar móveis e decoração adequados, seguindo os princípios de design de interiores.
      
      Responda em formato JSON:
      {
        "prompt": "prompt detalhado para a IA generativa",
        "negativePrompt": "elementos a evitar",
        "designPrinciples": ["princípios", "aplicados"],
        "suggestedElements": ["móveis", "e", "elementos", "sugeridos"]
      }`;

      const response = await this.openai.chat.completions.create({
        model: "gpt-4-turbo-preview",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt }
        ],
        max_tokens: 1500,
        temperature: 0.7
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('Resposta vazia do ChatGPT');
      }

      // Extrair JSON da resposta
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('Formato de resposta inválido do ChatGPT');
      }

      return JSON.parse(jsonMatch[0]);
    } catch (error) {
      console.error('Erro ao gerar prompt com ChatGPT:', error);
      throw new Error('Falha na geração do prompt');
    }
  }

  private getRoomTypeDescription(roomType: RoomType): string {
    const descriptions = {
      living_room: 'Sala de estar - espaço social para relaxamento e entretenimento',
      bedroom: 'Quarto - ambiente íntimo para descanso e privacidade',
      kitchen: 'Cozinha - área funcional para preparo de alimentos',
      bathroom: 'Banheiro - espaço de higiene e bem-estar',
      dining_room: 'Sala de jantar - ambiente para refeições e convívio',
      office: 'Escritório - espaço de trabalho e produtividade',
      balcony: 'Varanda - área externa de lazer e contemplação'
    };
    return descriptions[roomType];
  }

  private getFurnitureStyleDescription(furnitureStyle: FurnitureStyle): string {
    const descriptions = {
      modern: 'Moderno - linhas limpas, minimalismo, materiais contemporâneos',
      japanese_minimalist: 'Minimalismo japonês - simplicidade, funcionalidade, elementos naturais',
      scandinavian: 'Escandinavo - aconchego, cores claras, madeira natural',
      industrial: 'Industrial - materiais brutos, metal, concreto, estética urbana',
      classic: 'Clássico - elegância atemporal, simetria, materiais nobres',
      contemporary: 'Contemporâneo - tendências atuais, conforto, versatilidade',
      rustic: 'Rústico - materiais naturais, texturas orgânicas, aconchego rural',
      bohemian: 'Boêmio - ecletismo, cores vibrantes, texturas variadas, arte'
    };
    return descriptions[furnitureStyle];
  }
}

export const chatGPTService = new ChatGPTService();