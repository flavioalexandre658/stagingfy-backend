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
   * Adds circulation rules, stronger style enforcement, and flexible package items.
   */
  async generateVirtualStagingPrompt(
    roomType: RoomType,
    furnitureStyle: FurnitureStyle
  ): Promise<string> {
    const roomLabel = this.getRoomTypeLabel(roomType); // e.g. "living room"
    const styleLabel = this.getFurnitureStyleLabel(furnitureStyle); // e.g. "modern"
    const styleTraits = this.getFurnitureStyleTraits(furnitureStyle); // descriptive traits
    const packageItems = this.getPackageCombination(roomType, furnitureStyle); // suggested items

    const packageList =
      packageItems.length > 0
        ? `Suggested furniture and décor for this style:\n${packageItems
            .map(i => `• ${i}`)
            .join('\n')}`
        : '';

    const prompt = `Add 2–5 pieces of ${styleLabel} furniture and one wall decoration to this ${roomLabel}. 
Keep the original room, lighting, and structure exactly as they are — do not modify them. 
Do not alter walls, doors, windows, ceiling, floor, trims, stairs, or any architectural elements. 
Preserve the exact perspective, framing, and lighting of the input photo. 

Important circulation rule: never place furniture blocking doors, stairways, or clear passage paths. 
Keep all circulation areas open and functional.

Style guidance: ${styleTraits} 
All added furniture and décor must reflect this ${styleLabel} interior design style consistently.

${packageList}

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

  /**
   * Suggested packages per roomType + furnitureStyle.
   * Flexible, NOT mandatory — model may use if fits circulation rules.
   */
  private getPackageCombination(
    roomType: RoomType,
    furnitureStyle: FurnitureStyle
  ): string[] {
    const P: Record<RoomType, Record<FurnitureStyle, string[]>> = {
      living_room: {
        modern: [
          'A low-profile sofa with neutral upholstery',
          'A minimalist coffee table with slim legs',
          'A soft area rug in muted tones',
          'One framed abstract artwork above sofa',
          'A floor lamp with a simple metallic finish',
        ],
        scandinavian: [
          'A light fabric sofa with wooden legs',
          'A round light-wood coffee table',
          'A pale wool rug',
          'Two small framed prints above the sofa',
          'A monstera plant in a ceramic pot',
        ],
        industrial: [
          'A leather sofa in cognac or charcoal',
          'A reclaimed-wood coffee table with metal legs',
          'A dark textured rug',
          'A black-framed poster or abstract artwork',
        ],
        standard: [
          'A neutral upholstered sofa',
          'A rectangular wooden coffee table',
          'A bordered rug',
          'A framed landscape print',
        ],
        midcentury: [
          'A sofa with tapered wooden legs',
          'A round wooden coffee table',
          'A patterned rug with geometric shapes',
          'A bold accent chair',
        ],
        luxury: [
          'A velvet or silk sofa with metallic legs',
          'A marble or glass coffee table',
          'A statement rug with elegant patterns',
          'A large framed modern artwork',
        ],
        coastal: [
          'A light fabric sofa in white or beige',
          'A rattan coffee table',
          'A striped cotton rug in blue/white',
          'A framed coastal or botanical print',
        ],
        farmhouse: [
          'A slipcovered sofa in neutral tones',
          'A solid-wood coffee table',
          'A jute rug',
          'A vintage-style framed artwork',
        ],
      },
      bedroom: {
        modern: [
          'A queen bed with a minimalist upholstered headboard',
          'Two sleek nightstands',
          'Matching bedside lamps',
          'A low-pile rug extending beyond the bed',
          'A framed abstract artwork above the headboard',
        ],
        scandinavian: [
          'A wooden bed with light fabric bedding',
          'Two light-wood nightstands',
          'Fabric-shade bedside lamps',
          'A soft wool rug under the bed',
        ],
        industrial: [
          'A metal or dark-wood bed',
          'Two reclaimed-wood nightstands',
          'Industrial lamps with exposed bulbs',
          'A dark woven rug',
        ],
        farmhouse: [
          'A rustic wooden bed frame',
          'Two distressed nightstands',
          'Linen lamps',
          'A jute rug',
        ],
        coastal: [
          'A bed with light wood frame',
          'Two wicker nightstands',
          'Blue or white ceramic lamps',
          'A striped rug',
        ],
        midcentury: [
          'A platform bed with tapered legs',
          'Two teak nightstands',
          'Retro-style lamps',
          'A patterned rug',
        ],
        luxury: [
          'A tufted velvet bed',
          'Two mirrored nightstands',
          'Crystal or brass lamps',
          'A silk rug',
        ],
        standard: [
          'A simple upholstered bed',
          'Two basic nightstands',
          'Neutral lamps',
        ],
      },
      // outros ambientes podem ser adicionados conforme necessário...
      // --------- KITCHEN ---------
      kitchen: {
        modern: [
          'A compact dining set with sleek chairs',
          'A slim pendant light above the table',
          'A low-profile runner rug',
          'Minimal counter styling (bowl of fruit, herb plant)',
        ],
        scandinavian: [
          'A light-wood dining table with spindle chairs',
          'A white dome pendant',
          'A cotton runner rug',
          'A framed botanical print',
        ],
        industrial: [
          'A bistro table with metal chairs',
          'An exposed-bulb pendant',
          'A dark-patterned runner',
          'A black-framed poster',
        ],
        midcentury: [
          'A teak dining table with retro chairs',
          'A bold geometric print on the wall',
          'A slim pendant lamp',
          'A patterned rug',
        ],
        luxury: [
          'A marble-top dining table',
          'Upholstered chairs with metallic legs',
          'A crystal chandelier',
          'A silk runner rug',
        ],
        coastal: [
          'A whitewashed wood dining table',
          'Rattan or wicker chairs',
          'A striped runner rug',
          'A framed coastal print',
        ],
        farmhouse: [
          'A rustic wooden table',
          'Mismatched wooden chairs',
          'A lantern pendant',
          'A jute runner',
        ],
        standard: [
          'A rectangular wooden dining table',
          'Neutral upholstered chairs',
          'A simple framed print',
        ],
      },

      // --------- BATHROOM ---------
      bathroom: {
        modern: [
          'A minimalist vanity stool or console (if space allows)',
          'Neutral folded towels',
          'A small framed abstract print',
          'A compact potted plant',
        ],
        scandinavian: [
          'A light-wood ladder towel rack',
          'White cotton towels',
          'A framed botanical print',
          'A woven bath mat',
        ],
        industrial: [
          'A metal shelf with wood accents',
          'Dark striped towels',
          'A concrete planter with snake plant',
          'A black-framed wall print',
        ],
        midcentury: [
          'A teak stool or vanity table',
          'Retro patterned towels',
          'A framed geometric print',
          'A textured rug',
        ],
        luxury: [
          'A marble-top vanity table or stool',
          'Rolled plush towels',
          'Crystal soap dispenser set',
          'A framed elegant artwork',
        ],
        coastal: [
          'A wicker storage basket',
          'Blue and white striped towels',
          'A framed seashell print',
          'A jute bath mat',
        ],
        farmhouse: [
          'A rustic wood stool or shelf',
          'Neutral earth-tone towels',
          'A ceramic planter with greenery',
          'A vintage framed print',
        ],
        standard: [
          'A simple towel rack',
          'Plain folded towels',
          'A small neutral wall print',
        ],
      },

      // --------- DINING ROOM ---------
      dining_room: {
        modern: [
          'A rectangular dining table with sleek legs',
          'Upholstered modern chairs',
          'A linear pendant above table',
          'A neutral rug',
          'A large framed abstract artwork',
        ],
        scandinavian: [
          'A light-wood table with spindle chairs',
          'A pale wool rug',
          'A white dome pendant',
          'Two framed prints',
        ],
        industrial: [
          'A slab wood table with metal legs',
          'Metal or leather chairs',
          'An industrial pendant',
          'A dark rug',
        ],
        midcentury: [
          'A teak oval dining table',
          'Retro chairs with tapered legs',
          'A patterned rug',
          'A bold geometric print',
        ],
        luxury: [
          'A glass or marble dining table',
          'Elegant upholstered chairs',
          'A chandelier',
          'A silk rug',
        ],
        coastal: [
          'A whitewashed table',
          'Rattan or wicker chairs',
          'A striped cotton rug',
          'A framed coastal landscape',
        ],
        farmhouse: [
          'A rustic wood table',
          'Bench + wooden chairs',
          'A lantern pendant',
          'A jute rug',
        ],
        standard: [
          'A wooden dining table',
          'Neutral upholstered chairs',
          'A framed still-life print',
        ],
      },

      // --------- HOME OFFICE ---------
      home_office: {
        modern: [
          'A minimalist desk',
          'An ergonomic chair',
          'A slim desk lamp',
          'Floating shelves with books',
        ],
        scandinavian: [
          'A light-wood desk',
          'A comfortable fabric chair',
          'A fabric-shade lamp',
          'A framed botanical print',
        ],
        industrial: [
          'A wood-and-metal desk',
          'A leather chair',
          'An exposed-bulb desk lamp',
          'A black-framed wall print',
        ],
        midcentury: [
          'A teak desk with tapered legs',
          'A retro upholstered chair',
          'A geometric desk lamp',
          'A bold print on wall',
        ],
        luxury: [
          'A marble or glass desk',
          'A velvet chair',
          'A brass desk lamp',
          'A framed elegant artwork',
        ],
        coastal: [
          'A whitewashed wood desk',
          'A wicker chair with cushion',
          'A striped rug',
          'A framed coastal print',
        ],
        farmhouse: [
          'A rustic wood desk',
          'A vintage upholstered chair',
          'A lantern-style desk lamp',
          'A framed country print',
        ],
        standard: [
          'A simple wooden desk',
          'A neutral chair',
          'A small wall print',
        ],
      },

      // --------- KIDS ROOM ---------
      kids_room: {
        modern: [
          'A low-profile twin bed',
          'A simple desk with chair',
          'A colorful rug',
          'A framed playful artwork',
        ],
        scandinavian: [
          'A light wood bed with soft bedding',
          'A toy storage bench',
          'A pale rug',
          'A framed animal print',
        ],
        industrial: [
          'A metal frame bed',
          'A wooden desk',
          'A dark rug',
          'A black-framed wall print',
        ],
        midcentury: [
          'A retro bed with tapered legs',
          'A small desk with geometric accents',
          'A patterned rug',
          'A playful retro print',
        ],
        luxury: [
          'A tufted upholstered bed',
          'A mirrored nightstand',
          'A velvet rug',
          'A framed elegant artwork',
        ],
        coastal: [
          'A whitewashed bed',
          'A wicker chair',
          'A striped rug',
          'A framed beach print',
        ],
        farmhouse: [
          'A rustic wooden bed',
          'A vintage toy chest',
          'A braided rug',
          'A framed country artwork',
        ],
        standard: ['A basic twin bed', 'A small desk', 'A colorful poster'],
      },

      // --------- OUTDOOR ---------
      outdoor: {
        modern: [
          'Low-profile lounge chairs',
          'A small metal side table',
          'A neutral outdoor rug',
          'Two structured planters',
        ],
        scandinavian: [
          'Light wood chairs with cushions',
          'A small round table',
          'A woven rug',
          'Planters with greenery',
        ],
        industrial: [
          'Metal-framed chairs',
          'A compact metal table',
          'A dark rug',
          'Concrete planters',
        ],
        midcentury: [
          'Retro patio chairs',
          'A low teak table',
          'A bold patterned outdoor rug',
          'A geometric wall art (if surface exists)',
        ],
        luxury: [
          'A cushioned outdoor sofa',
          'A marble or glass table',
          'A silk-textured outdoor rug',
          'Large planters with manicured greenery',
        ],
        coastal: [
          'White or rattan chairs',
          'A driftwood table',
          'A striped rug',
          'A nautical wall decor (if surface exists)',
        ],
        farmhouse: [
          'Wooden rocking chairs',
          'A rustic table',
          'A jute rug',
          'A vintage lantern décor',
        ],
        standard: [
          'A simple patio set',
          'A neutral rug',
          'A small potted plant',
        ],
      },
    };

    return P[roomType]?.[furnitureStyle] ?? [];
  }
}

export const chatGPTService = new ChatGPTService();
