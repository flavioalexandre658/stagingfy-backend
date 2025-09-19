// src/services/chatgpt.service.ts
import OpenAI from 'openai';
import { RoomType, FurnitureStyle } from '../interfaces/upload.interface';

class ChatGPTService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  /**
   * Generates ONE final prompt (English) for flux-kontext-pro.
   * Non-destructive, additive-only, pixel-preserving.
   * Follows BFL Kontext i2i prompting guidance:
   * - Be explicit about what to keep unchanged
   * - Use precise action verbs (add/place/keep), avoid “transform”
   * - Control composition: keep camera/framing/scale identical
   */
  async generateVirtualStagingPrompt(
    roomType: RoomType,
    furnitureStyle: FurnitureStyle
  ): Promise<string> {
    const roomLabel = this.getRoomTypeLabel(roomType);
    const styleLabel = this.getFurnitureStyleLabel(furnitureStyle);
    const packageItems = this.getPackageCombination(roomType, furnitureStyle);

    const basePrompt = `Add ${styleLabel} furniture to this ${roomLabel} while keeping the original room, lighting, and structure unchanged. 
Do not modify walls, doors, windows, ceiling, floor, trims, or any architectural elements. 
Preserve the exact lighting and perspective. 
Only add furniture and décor items consistent with a ${styleLabel} interior style.`;

    const enrichedDetails =
      packageItems.length > 0
        ? ` Include the following key items if they fit naturally in the scene:\n${packageItems
            .map(i => `- ${i}`)
            .join('\n')}`
        : '';

    return `${basePrompt}${enrichedDetails}`;
  }

  // --------- Non-destructive policy helpers ---------

  private getNonDestructiveConstraints(): string[] {
    // Lista concisa do que pode ser adicionado. Mantém a linguagem precisa (“Add/Place”),
    // alinhada às boas práticas do guia.
    return [
      'Furniture: sofas, sectionals, armchairs, coffee tables, side tables, consoles, media units, beds, nightstands, desks, dining tables and chairs, wardrobes/dressers (freestanding only).',
      'Lighting: floor lamps and table lamps only (no new ceiling fixtures).',
      'Decor: framed artwork, mirrors, rugs, cushions, throws, books, bowls, vases, trays, minimal accessories.',
      'Plants: realistic indoor species in planters appropriate to the style.',
    ];
  }

  private getAbsoluteProhibitions(): string[] {
    return [
      'No deletion, movement, resizing, or repainting of door, door frame, or door opening.',
      'No changes to walls, floor, ceiling, beams, trims, baseboards, or window geometry.',
      'No perspective/lens changes; no room enlargement/shrinkage; no cropping/reframing.',
      'No relighting, no added light sources on the ceiling; keep native light behavior.',
    ];
  }

  // ------- labels -------
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
  private getPackageCombination(
    roomType: RoomType,
    furnitureStyle: FurnitureStyle
  ): string[] {
    const P: Record<RoomType, Record<FurnitureStyle, string[]>> = {
      // LIVING ROOM
      living_room: {
        modern: [
          'A sleek 3-seat or L-shaped sofa in neutral gray/taupe fabric, low profile',
          'A minimalist coffee table (round or rectangular) with slim metal or wood base',
          'A neutral area rug (subtle texture or geometric pattern) sized to anchor sofa and table',
          'A low media console aligned to the TV wall (keep TV centered if present)',
          'One tall floor lamp with metallic finish and fabric drum shade',
          'A large abstract framed artwork above the sofa',
          'A medium indoor plant (fiddle-leaf fig or rubber plant) in a matte planter',
          'Two accent pillows in muted tones; optional single color accent',
          'One small side table next to the sofa',
        ],
        japanese_minimalist: [
          'A low sofa or two-seat settee with light fabric and wooden base',
          'A low rectangular coffee table in natural oak/ash (chabudai-inspired)',
          'A flat-woven neutral rug in beige/ivory',
          'A simple media bench in pale wood with hidden clutter',
          'A washi-style floor lamp or paper lantern with warm diffused light',
          'One large calligraphy or nature print in a thin wood frame above the sofa',
          'A bonsai or small ficus in a ceramic pot with gravel top',
        ],
        scandinavian: [
          'A light-fabric sofa with slim wooden legs (oak or beech)',
          'A round light-wood coffee table; optional white top',
          'A soft wool/cotton rug in off-white or pale pattern',
          'A light-wood or white media unit; cable management hidden',
          'A tripod or arc floor lamp with fabric shade',
          'Two or three framed prints in light frames above sofa',
          'A monstera or pothos in a simple pot',
        ],
        industrial: [
          'A cognac/charcoal leather sofa with robust silhouette',
          'A reclaimed-wood coffee table with black metal legs',
          'A dark textured rug (charcoal/graphite)',
          'A black metal media console with wood accents',
          'An industrial floor lamp with exposed bulb/cage shade',
          'A tall plant in a concrete or metal planter',
          'A large black-framed poster or abstract art',
        ],
        classic: [
          'A tufted or rolled-arm sofa in neutral fabric',
          'A wood coffee table with elegant legs and bevelled top',
          'A bordered or Persian-inspired wool rug',
          'A traditional media cabinet in wood',
          'Two table lamps on side tables with pleated/fabric shades',
          'A framed classic landscape above sofa',
          'A ficus or peace lily in a ceramic planter',
        ],
        contemporary: [
          'A modular sofa with clean geometry; neutral palette with soft accent',
          'A sculptural coffee table (stone-look or curved top)',
          'A large low-pile rug grounding the seating area',
          'A minimal floating/slab media console',
          'A slim arc or linear floor lamp',
          'One statement art piece or asymmetric pair',
          'A structured plant in a matte cylindrical pot',
        ],
        rustic: [
          'A deep, comfortable fabric sofa in warm neutral',
          'A solid-wood coffee table with visible grain and rounded corners',
          'A jute or wool rug in natural beige',
          'A wooden media console with farmhouse details',
          'A floor lamp with wooden stem and linen shade',
          'A leafy plant in a woven basket',
          'A nature print or vintage landscape in wood frame',
        ],
        bohemian: [
          'A cozy fabric sofa layered with patterned cushions',
          'A round or carved-wood/rattan coffee table',
          'A patterned kilim or Berber-style rug',
          'A low media unit in eclectic wood tone',
          'A rattan or tripod floor lamp with warm light',
          'A gallery of mixed-size art/prints above sofa',
          'A tall palm or monstera in woven planter',
        ],
      },

      // BEDROOM
      bedroom: {
        modern: [
          'A queen bed with a minimalist upholstered headboard (gray/beige)',
          'Two sleek nightstands with clean lines',
          'Matching bedside lamps (metallic or ceramic bases, fabric shades)',
          'A neutral low-pile rug extending beyond bed sides',
          'A modern dresser or wardrobe with flat fronts',
          'One large abstract artwork centered above headboard',
          'A compact plant (peace lily or rubber plant) in a matte pot',
          'Layered bedding (crisp duvet, two accent pillows, folded throw)',
        ],
        japanese_minimalist: [
          'A low platform bed in light wood',
          'Two compact wooden night trays or blocks',
          'Paper/linen bedside lamps with warm glow',
          'A flat-woven tatami-style rug or neutral mat',
          'A low wardrobe/chest with simple pulls',
          'A single nature print or calligraphy above the bed',
          'A small bonsai or zen plant arrangement',
          'Neutral bedding in off-white/greige, minimal layers',
        ],
        scandinavian: [
          'A wooden or upholstered bed with light legs',
          'Two light-wood nightstands',
          'Fabric-shade bedside lamps',
          'A soft wool/cotton rug under the bed',
          'A dresser/wardrobe in white or light oak',
          'Two framed prints in light frames above bed',
          'A small monstera or fern',
          'Layered bedding in whites and light grays',
        ],
        industrial: [
          'A metal or dark-wood bed with simple headboard',
          'Two nightstands with metal frames/reclaimed tops',
          'Industrial bedside lamps with exposed bulbs',
          'A dark woven rug with texture',
          'A dresser in black metal/wood mix',
          'One large black-framed poster above bed',
          'A snake plant in a concrete planter',
        ],
        classic: [
          'A bed with tufted or panel headboard',
          'Two traditional nightstands with knob pulls',
          'Bedside lamps with fabric shades and classic bases',
          'A bordered or patterned wool rug under the bed',
          'A dresser with framed mirror',
          'A framed landscape or classic artwork above headboard',
          'A peace lily in ceramic planter',
        ],
        contemporary: [
          'A platform/box bed with sleek headboard',
          'Floating/slab nightstands',
          'Minimalist dimmable lamps',
          'A low-pile rug sized to bed footprint',
          'A handle-less wardrobe or clean dresser',
          'One statement art piece or asymmetric diptych',
          'A structured plant in a matte pot',
        ],
        rustic: [
          'A solid-wood bed with simple headboard',
          'Two wooden nightstands with visible grain',
          'Linen-shade bedside lamps with warm light',
          'A jute/wool rug under the bed',
          'A wooden dresser with rustic hardware',
          'A nature print or vintage painting above bed',
          'A leafy plant in woven basket',
        ],
        bohemian: [
          'A rattan or upholstered bed with patterned textiles',
          'Two eclectic night tables (rattan/wood mix)',
          'Warm bedside lamps with woven/fabric shades',
          'A patterned kilim or shag rug',
          'A low dresser with mixed wood tones',
          'A cluster of boho prints or macramé above bed',
          'A palm or pothos in woven planter',
        ],
      },

      // KITCHEN
      kitchen: {
        modern: [
          'A compact dining set: round glass/wood table with 2–4 modern chairs',
          'A slim pendant or linear light above the table (only if feasible without changing ceiling)',
          'Two minimal framed prints on a free wall',
          'Counter styling: wooden board, bowl of fruit, small herb plant',
          'A low-profile runner rug with neutral pattern',
        ],
        japanese_minimalist: [
          'A small light-wood table with two simple chairs',
          'A washi-style pendant if composition allows',
          'One delicate ink/botanical print',
          'Counter: ceramic tea set and wooden tray',
          'A small bonsai or herb pot; neutral mat under table',
        ],
        scandinavian: [
          'A light-wood table with 2–4 spindle or shell chairs',
          'A simple dome pendant in white',
          'Two small framed prints',
          'Counter: cutting board + vase with greenery',
          'A light cotton runner near sink/prep zone',
        ],
        industrial: [
          'A wood-and-metal bistro table with 2–3 metal chairs',
          'An industrial pendant with cage detail (if feasible)',
          'A black-framed poster/typographic print',
          'Counter: metal canisters and wooden board',
          'A dark runner rug with simple pattern',
        ],
        classic: [
          'A small round pedestal table with 2–4 upholstered chairs',
          'A traditional pendant with fabric/glass shade',
          'Two classic framed prints',
          'Counter: ceramic jar set and fruit bowl',
          'A bordered rug near sink/prep zone',
        ],
        contemporary: [
          'A sleek table with molded chairs, neutral palette',
          'A minimal pendant or slim bar light',
          'One statement art print',
          'Counter: sculptural bowl + cookbook stand',
          'A low-pile runner in gray/ivory',
        ],
        rustic: [
          'A small farmhouse table with wooden chairs',
          'A simple lantern-style pendant',
          'A vintage/botanical print',
          'Counter: wooden bowl and stoneware jars',
          'A woven runner by the work area',
        ],
        bohemian: [
          'A round wood table with mismatched chairs',
          'A rattan/patterned pendant',
          'Eclectic small prints gallery',
          'Counter: colorful ceramics and herb pots',
          'A patterned flat-weave runner',
        ],
      },

      // BATHROOM
      bathroom: {
        modern: [
          'A slim console table or stool (only if space allows without blocking circulation)',
          'A framed abstract print on a free wall',
          'A small plant (fern/pothos) in moisture-tolerant pot',
          'Coordinated neutral towels neatly folded',
          'A subtle bath mat and a minimalist dispenser set on vanity',
        ],
        japanese_minimalist: [
          'A small wooden stool or caddy',
          'A single minimalist print or calligraphy',
          'A bamboo/fern plant',
          'Neutral towels rolled/folded',
          'A simple mat and wood/stone accessories',
        ],
        scandinavian: [
          'A light-wood ladder towel rack',
          'Two small framed prints',
          'A pothos plant on a shelf',
          'White/gray cotton towels',
          'A woven mat and simple accessory set',
        ],
        industrial: [
          'A metal shelf/caddy with wood accents',
          'A black-framed poster or typographic print',
          'A snake plant in concrete pot',
          'Dark/striped towels folded',
          'A textured mat and black accessory set',
        ],
        classic: [
          'A small wooden console or stool',
          'A classic framed print',
          'A peace lily or small ficus',
          'Monogram-style towels',
          'A bordered bath mat and ceramic accessory set',
        ],
        contemporary: [
          'A floating shelf with organized accessories',
          'One statement art print',
          'A sculptural plant in matte pot',
          'Neutral towels with one accent color',
          'A low-pile mat and sleek dispensers',
        ],
        rustic: [
          'A reclaimed-wood stool or shelf',
          'A nature-themed framed print',
          'A fern in woven basket',
          'Warm-toned towels',
          'A woven mat and stoneware accessories',
        ],
        bohemian: [
          'A rattan stool/shelf',
          'A colorful small print or macramé',
          'A trailing plant (pothos) on a shelf',
          'Patterned towels',
          'A patterned mat and eclectic accessory tray',
        ],
      },

      // DINING ROOM
      dining_room: {
        modern: [
          'A rectangular/round dining table with sleek legs',
          '4–6 modern upholstered/molded chairs',
          'A linear or cluster pendant centered above table',
          'A neutral rug sized to table + chairs footprint',
          'A large abstract artwork on the main wall',
          'A minimal sideboard with a vase/bowl',
        ],
        japanese_minimalist: [
          'A light-wood table with simple chairs or bench',
          'A paper lantern pendant centered',
          'A neutral flat-weave rug',
          'One nature print in thin wood frame',
          'A side console with ceramic vase and branch',
        ],
        scandinavian: [
          'A light-wood table with 4–6 chairs (spindle/wishbone-inspired)',
          'A white dome pendant centered',
          'A pale wool rug under table',
          'Two simple framed prints',
          'A sideboard in light wood with greenery',
        ],
        industrial: [
          'A wood slab table with black metal base',
          '4–6 metal or leather chairs',
          'An industrial linear pendant',
          'A dark low-pile rug',
          'A black-framed graphic art',
          'A sideboard in metal/wood mix',
        ],
        classic: [
          'A wood table with turned legs',
          '6 upholstered chairs',
          'A chandelier or classic pendant',
          'A bordered wool rug',
          'A large framed painting or mirror',
          'A buffet/sideboard with classic décor',
        ],
        contemporary: [
          'A sleek oval/rectangular table with minimal base',
          '6 streamlined chairs',
          'A sculptural/LED pendant centered',
          'A neutral rug for the dining area',
          'A single statement art piece',
          'A low-profile credenza with curated objects',
        ],
        rustic: [
          'A farmhouse table in solid wood',
          '6 wooden chairs or bench + chairs',
          'A lantern/iron pendant',
          'A jute/wool rug',
          'A nature print set or vintage poster',
          'A wooden sideboard with pottery',
        ],
        bohemian: [
          'A round/rectangular wood table with mixed chairs',
          'A woven/patterned pendant',
          'A patterned flat-weave rug',
          'Eclectic art gallery or tapestry',
          'A sideboard with plants and colorful ceramics',
        ],
      },

      // HOME OFFICE
      office: {
        modern: [
          'A minimalist desk with cable management',
          'An ergonomic chair with clean silhouette',
          'A slim desk lamp (metallic/matte finish)',
          'Floating shelves with books and small décor',
          'A neutral rug under the desk zone',
          'A framed abstract print on the wall',
          'A medium snake plant in a matte pot',
        ],
        japanese_minimalist: [
          'A compact light-wood desk',
          'A simple upholstered chair',
          'A paper lantern or minimal desk lamp',
          'A single nature/calligraphy print',
          'A neutral mat and a bonsai or small plant',
        ],
        scandinavian: [
          'A light-wood desk with tapered legs',
          'A comfortable upholstered task chair',
          'A fabric-shade desk lamp',
          'Two small framed prints',
          'A soft rug and a monstera or fern',
        ],
        industrial: [
          'A wood-and-metal desk',
          'A leather or metal-framed chair',
          'An industrial lamp with exposed bulb',
          'A black-framed poster',
          'A dark rug and a concrete-planter plant',
        ],
        classic: [
          'A paneled wood desk',
          'An upholstered classic chair',
          'A brass desk lamp',
          'A framed landscape or map print',
          'A bordered rug and a ceramic-pot plant',
        ],
        contemporary: [
          'A slab/floating desk with clean lines',
          'A sleek ergonomic chair',
          'A minimal LED desk lamp',
          'One statement print',
          'A neutral rug and a structured plant',
        ],
        rustic: [
          'A solid-wood desk with visible grain',
          'A fabric/leather chair',
          'A lamp with linen shade',
          'A nature print',
          'A jute rug and leafy plant in woven basket',
        ],
        bohemian: [
          'A warm-tone wooden desk',
          'An upholstered chair with texture',
          'A rattan/fabric desk lamp',
          'An eclectic art mix above desk',
          'A patterned rug and trailing plant',
        ],
      },

      // BALCONY
      balcony: {
        modern: [
          'Low outdoor lounge chair(s) with neutral cushions',
          'A small metal/composite side table',
          'A durable neutral outdoor rug',
          'Two planters with structured greenery',
          'A compact outdoor lantern (only if feasible)',
        ],
        japanese_minimalist: [
          'A low wood platform or simple bench',
          'A small tea table/tray',
          'A pebble or bamboo mat',
          'Two ceramic pots with bonsai or grasses',
          'A subtle lantern element',
        ],
        scandinavian: [
          'Light wood/metal chair set with cushions',
          'A small round table',
          'A woven outdoor rug',
          'Planters with soft greenery',
          'A throw blanket and small lantern',
        ],
        industrial: [
          'Metal-framed chairs with neutral cushions',
          'A compact metal table',
          'A dark outdoor rug',
          'Concrete planters with hardy plants',
          'A cage-style lantern',
        ],
        classic: [
          'A wrought-iron bistro set',
          'A patterned outdoor rug',
          'Two ceramic planters with flowers',
          'A classic lantern',
          'Neutral striped cushions',
        ],
        contemporary: [
          'Boxy outdoor lounge chairs or loveseat',
          'A cubic side table',
          'A neutral outdoor rug',
          'Minimal planters with architectural plants',
          'A slim outdoor light (if feasible)',
        ],
        rustic: [
          'Wooden chairs or bench with natural cushions',
          'A small wooden side table',
          'A jute/woven outdoor rug',
          'Terracotta planters',
          'A lantern with warm light',
        ],
        bohemian: [
          'A rattan chair or hammock-style seat',
          'A round side table',
          'A patterned outdoor rug',
          'Layered planters with palms and vines',
          'String lights or a boho lantern',
        ],
      },
    };

    return P[roomType]?.[furnitureStyle] ?? [];
  }
}

export const chatGPTService = new ChatGPTService();
