// src/services/chatgpt.service.ts
import OpenAI from 'openai';
import { RoomType, FurnitureStyle } from '../interfaces/upload.interface';

class ChatGPTService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  /**
   * Returns a single, final English prompt ready for flux-kontext-pro.
   * The prompt is non-destructive: it ONLY adds furniture/decor.
   */
  async generateVirtualStagingPrompt(
    roomType: RoomType,
    furnitureStyle: FurnitureStyle
  ): Promise<string> {
    const packageItems = this.getPackageCombination(roomType, furnitureStyle);
    const roomLabel = this.getRoomTypeLabel(roomType);
    const styleLabel = this.getFurnitureStyleLabel(furnitureStyle);

    // Compose an explicit, surgical instruction for non-destructive staging.
    const basePrompt = [
      `Furnish the ${roomLabel} in the uploaded photo in a ${styleLabel} style while preserving the existing walls, floor, ceiling, beams, trims, sockets/outlets, doors, windows, and lighting exactly as they appear.`,
      'Perform a non-destructive virtual staging: do not change architecture, geometry, perspective, textures, paint colors, or the light direction.',
      'Add only furniture, lighting fixtures, artwork, rugs, plants, and small accessories.',
      'Respect proportions, circulation, and focal point composition. Keep the result photorealistic and coherent with the room’s scale.',
    ].join(' ');

    const mandatoryList = packageItems.map(i => `- ${i}`).join('\n');

    const finalInstruction =
      'Keep all additions realistic, appropriately scaled, and consistent with the style. Do not invent structural details. Do not remove or repaint anything. Output should look like a professionally staged real-estate photograph.';

    const finalPrompt = `${basePrompt}\n\nAdd the following mandatory package items:\n${mandatoryList}\n\n${finalInstruction}`;

    // (Optional) If you prefer to let GPT refine wording, uncomment below.
    // For now we just return the assembled prompt to avoid any drift.
    return finalPrompt;
  }

  /**
   * Interior-design “packages” for every RoomType + FurnitureStyle combination.
   * Each array item is a concise, production-ready requirement.
   */
  private getPackageCombination(
    roomType: RoomType,
    furnitureStyle: FurnitureStyle
  ): string[] {
    const P: Record<RoomType, Record<FurnitureStyle, string[]>> = {
      // ---------- LIVING ROOM ----------
      living_room: {
        modern: [
          'A sleek L-shaped or 3-seat sofa in neutral gray or taupe fabric, low profile',
          'A minimalist coffee table (rectangular or round) with metal or wood base and thin top',
          'A neutral area rug (subtle texture or geometric pattern) sized to anchor sofa + table',
          'A low-profile media console; keep lines clean; TV centered if a TV wall exists',
          'One or two modern floor lamps with metallic finish and drum or dome shades',
          'A pair of accent pillows in muted tones; optional single bold accent color',
          'A large abstract framed artwork centred above the sofa',
          'A medium indoor plant (fiddle-leaf fig, rubber plant, or snake plant) in a simple planter',
          'A small side table beside the sofa; matte metal or wood finish',
        ],
        japanese_minimalist: [
          'A low sofa or two-seat settee with light fabric and wooden base',
          'A low rectangular chabudai-inspired coffee table in natural oak/ash',
          'A flat-woven neutral rug (beige/ivory) with thin border',
          'A simple media bench in pale wood; no visible clutter',
          'A washi-style floor lamp or paper lantern with warm diffused light',
          'Two linen cushions in off-white/greige; no bold patterns',
          'A single large calligraphy or nature print in a thin wooden frame',
          'A bonsai or small ficus in a ceramic pot with gravel top',
          'A minimal shoji-like screen element if composition allows',
        ],
        scandinavian: [
          'A light-fabric sofa with slim wooden legs (oak or beech)',
          'A round coffee table in light wood; optional white top',
          'A soft wool or cotton rug in light gray, off-white, or pale pattern',
          'A simple media unit in white or light wood, cable clutter hidden',
          'A floor lamp with tripod or arc base; fabric shade',
          'Cozy throw blanket and cushions in muted pastels',
          'A gallery-style set of 2–3 framed prints with thin frames',
          'A medium monstera or pothos in a simple clay pot',
          'A small side table in light wood near the sofa',
        ],
        industrial: [
          'A cognac or charcoal leather sofa with robust silhouette',
          'A coffee table in reclaimed wood with black metal legs',
          'A darker textured rug (charcoal/graphite) with simple pattern',
          'A black metal media console with perforated or mesh doors',
          'An industrial floor lamp with exposed bulb or cage shade',
          'Two accent cushions in earthy tones (rust/olive) or herringbone',
          'A large black-framed poster or abstract piece; optional faux brick print frame feel',
          'A tall plant in a concrete or metal planter (rubber plant or dracaena)',
          'A side table in metal/wood mix',
        ],
        classic: [
          'A tufted or rolled-arm sofa in neutral fabric',
          'A wood coffee table with refined legs and bevelled top',
          'A patterned wool rug (Persian-inspired or subtle classic motif)',
          'A traditional media cabinet in wood with panel details',
          'A pair of table lamps on side tables with pleated or fabric shades',
          'Coordinated cushions with piping; add a thin throw',
          'A large framed oil-style landscape or classic artwork',
          'A potted ficus or peace lily in a ceramic planter',
          'A decorative side table with brass or antique details',
        ],
        contemporary: [
          'A modular sofa with clean geometry; neutral or soft color pop',
          'A sculptural coffee table (e.g., stone look or curved top)',
          'A large low-pile rug in neutral shade to ground the seating area',
          'A minimal floating or slab media console',
          'A slim arc or linear floor lamp; consider LED profile',
          'Cushions mixing textures (bouclé/linen) in coordinated palette',
          'One statement art piece or two asymmetric frames',
          'A structured plant (rubber plant) in matte cylindrical pot',
          'A sleek side table in lacquer or metal',
        ],
        rustic: [
          'A deep, comfortable fabric sofa in warm neutral tone',
          'A solid wood coffee table with visible grain and rounded corners',
          'A jute or wool rug in natural beige',
          'A wooden media console with farmhouse-style details',
          'A floor lamp with wooden stem and linen shade',
          'Cushions in warm earth tones; knitted throw',
          'A nature print or vintage landscape in wooden frame',
          'A large leafy plant in woven basket',
          'A side table in reclaimed wood',
        ],
        bohemian: [
          'A cozy fabric sofa layered with patterned cushions',
          'A round or Moroccan-inspired coffee table (carved wood or rattan)',
          'A patterned kilim or Berber-style rug',
          'A low media unit in eclectic wood tone',
          'A rattan or tripod floor lamp with warm light',
          'Layered textiles: throw, pillows with varied patterns',
          'A gallery of mixed-size art/prints above sofa',
          'A tall palm or monstera in woven planter',
          'A side table in rattan or carved wood with small décor',
        ],
      },

      // ---------- BEDROOM ----------
      bedroom: {
        modern: [
          'A queen-size bed with a minimalist upholstered headboard (gray or beige)',
          'Two sleek nightstands with clean lines',
          'Matching bedside lamps with metallic or ceramic bases',
          'A low-pile neutral rug extending beyond the bed sides',
          'A modern dresser or wardrobe with flat fronts',
          'A single large abstract art piece above the headboard',
          'A compact plant (peace lily or rubber plant) in a simple pot',
          'Two to four accent pillows and a folded throw at the foot of the bed',
        ],
        japanese_minimalist: [
          'A low platform bed with light wood frame',
          'Two compact wooden night trays or blocks',
          'Paper or linen bedside lamps with warm glow',
          'A flat-woven tatami-style rug or neutral mat',
          'A low wardrobe or chest with simple pulls',
          'A single nature print or calligraphy above the bed',
          'A small bonsai or zen plant arrangement',
          'Neutral bedding in off-white/greige, minimal layers',
        ],
        scandinavian: [
          'A wooden or upholstered bed with light legs',
          'Two small nightstands in light wood',
          'Fabric-shade bedside lamps',
          'A soft wool or cotton rug under the bed',
          'A simple dresser/wardrobe in white or light oak',
          'Two framed prints in light frames above the bed',
          'A small monstera or fern in ceramic pot',
          'Layered bedding in whites and light grays',
        ],
        industrial: [
          'A metal or dark-wood bed with simple headboard',
          'Two nightstands with metal frames or reclaimed tops',
          'Industrial-style lamps with exposed bulbs',
          'A dark woven rug with subtle texture',
          'A dresser in black metal/wood mix',
          'One large black-framed poster above the bed',
          'A plant in concrete planter (snake plant)',
          'Bedding in charcoal/white with leather accent pillow',
        ],
        classic: [
          'A bed with tufted or panel headboard',
          'Two traditional nightstands with knob pulls',
          'Bedside lamps with fabric shades and classic bases',
          'A patterned wool rug or bordered rug under the bed',
          'A dresser with framed mirror',
          'A framed landscape or classic artwork above headboard',
          'A peace lily in ceramic planter',
          'Crisp layered bedding with quilt and throw',
        ],
        contemporary: [
          'A platform or box bed with sleek headboard',
          'Floating or slab nightstands',
          'Minimalist dimmable lamps',
          'A low-pile rug sized to bed footprint',
          'A handle-less wardrobe or clean dresser',
          'One statement art piece or asymmetric diptych',
          'A structured plant in matte pot',
          'Monochrome bedding with one accent color',
        ],
        rustic: [
          'A solid wood bed with simple headboard',
          'Two wooden nightstands with visible grain',
          'Bedside lamps with linen shades and warm light',
          'A jute or wool rug under the bed',
          'A wooden dresser with rustic hardware',
          'A nature print or vintage painting above bed',
          'A leafy plant in woven basket',
          'Bedding in warm neutrals with knitted throw',
        ],
        bohemian: [
          'A rattan or upholstered bed layered with patterned textiles',
          'Two eclectic night tables (rattan/wood)',
          'Warm bedside lamps with woven or fabric shades',
          'A patterned kilim or shag rug',
          'A low dresser with mixed wood tones',
          'A cluster of boho prints or macramé above bed',
          'A palm or pothos in woven planter',
          'Plenty of pillows and a colorful throw',
        ],
      },

      // ---------- KITCHEN ----------
      kitchen: {
        modern: [
          'A compact dining set: round glass/wood table with 2–4 modern chairs',
          'A slim pendant or linear light above the table (if context allows)',
          'Two framed minimal prints on a free wall',
          'Countertop styling: a wooden board, bowl of fruit, and a small herb plant',
          'A low-profile runner rug with neutral pattern',
        ],
        japanese_minimalist: [
          'A small light-wood table with two simple chairs',
          'A washi-style pendant (if context allows)',
          'One delicate ink or botanical print',
          'Countertop: a ceramic tea set and wooden tray',
          'A small bonsai or herb pot; neutral mat under table',
        ],
        scandinavian: [
          'A light wood dining table with 2–4 spindle or shell chairs',
          'A simple dome pendant in white',
          'Two small framed prints; pale palette',
          'Counter styling: cutting board + vase with greenery',
          'A light cotton runner near sink or prep area',
        ],
        industrial: [
          'A wood-and-metal bistro table with 2–3 metal chairs',
          'An industrial pendant with cage detail (if context allows)',
          'A black-framed poster or typographic print',
          'Counter styling: metal canisters and wooden board',
          'A dark runner rug with simple pattern',
        ],
        classic: [
          'A small round pedestal table with 2–4 upholstered chairs',
          'A traditional pendant with fabric/glass shade',
          'Two classic framed prints',
          'Counter styling: ceramic jar set and fruit bowl',
          'A bordered rug near sink/prep zone',
        ],
        contemporary: [
          'A sleek table with molded chairs, neutral palette',
          'A minimal pendant or slim bar light',
          'One statement art print',
          'Counter styling: sculptural bowl + cookbook stand',
          'A low-pile runner rug in gray/ivory',
        ],
        rustic: [
          'A small farmhouse table with wooden chairs',
          'A simple lantern-style pendant',
          'A vintage or botanical print',
          'Counter styling: wooden bowl and stoneware jars',
          'A woven runner by the work area',
        ],
        bohemian: [
          'A round wood table with mismatched chairs',
          'A rattan or patterned pendant',
          'Gallery of small eclectic prints',
          'Counter styling: colorful ceramics and herb pots',
          'A patterned flat-weave runner',
        ],
      },

      // ---------- BATHROOM ----------
      bathroom: {
        modern: [
          'A slim console table or stool (if space allows)',
          'A framed abstract print above the toilet or on free wall',
          'A small plant (fern or pothos) in moisture-tolerant pot',
          'Coordinated towels (neutral palette) neatly folded',
          'A small rug or bath mat with subtle texture',
          'Dispenser set and tray on vanity (minimalist)',
        ],
        japanese_minimalist: [
          'A small wooden stool or caddy',
          'A single minimalist print or calligraphy',
          'A bamboo plant or small fern',
          'Neutral towels rolled or folded',
          'A simple mat in beige; wood or stone accessories',
        ],
        scandinavian: [
          'A ladder towel rack (light wood)',
          'Two small framed prints',
          'A pothos plant on a shelf',
          'Soft cotton towels in white/gray',
          'A light woven mat and simple accessory set',
        ],
        industrial: [
          'A metal shelf or caddy with wood accents',
          'A black-framed poster or typographic print',
          'A snake plant in concrete pot',
          'Dark or striped towels folded',
          'A textured mat and black accessory set',
        ],
        classic: [
          'A small wooden console or stool',
          'A classic framed print',
          'A peace lily or small ficus',
          'Monogram-style towels neatly folded',
          'A bordered bath mat and ceramic accessory set',
        ],
        contemporary: [
          'A floating shelf with organized accessories',
          'A single statement art print',
          'A sculptural plant in matte pot',
          'Neutral towels with one accent color',
          'A low-pile mat and sleek dispenser set',
        ],
        rustic: [
          'A reclaimed wood stool or shelf',
          'A nature-themed framed print',
          'A fern in woven basket or ceramic pot',
          'Warm-toned towels stacked',
          'A woven mat and stoneware accessories',
        ],
        bohemian: [
          'A rattan shelf or stool',
          'A colorful small print or macramé',
          'A trailing plant (pothos) on a shelf',
          'Patterned towels folded',
          'A patterned mat and eclectic accessory tray',
        ],
      },

      // ---------- DINING ROOM ----------
      dining_room: {
        modern: [
          'A rectangular or round dining table with sleek legs',
          '4–6 modern upholstered or molded chairs',
          'A linear or cluster pendant centered above table',
          'A neutral area rug sized to table + chairs footprint',
          'A large abstract artwork on the main wall',
          'A sideboard with minimal décor (vase, bowl)',
        ],
        japanese_minimalist: [
          'A light-wood table with simple chairs or bench seating',
          'A paper lantern pendant centered',
          'A neutral flat-weave rug',
          'A single nature print in thin wood frame',
          'A side console with ceramic vase and branch',
        ],
        scandinavian: [
          'A light wood table with 4–6 chairs (spindle or wishbone inspired)',
          'A dome pendant in white/soft color',
          'A pale wool rug under table',
          'Two simple framed prints',
          'A sideboard in light wood with greenery',
        ],
        industrial: [
          'A wood slab table with black metal base',
          '4–6 metal or leather chairs',
          'An industrial linear pendant',
          'A dark low-pile rug',
          'A black-framed large poster or graphic art',
          'A sideboard in metal/wood mix',
        ],
        classic: [
          'A wood table with turned legs',
          '6 upholstered dining chairs',
          'A chandelier or classic pendant centered',
          'A bordered wool rug',
          'A large framed painting or mirror',
          'A buffet/sideboard with classic décor',
        ],
        contemporary: [
          'A sleek table (oval/rectangular) with minimal base',
          '6 streamlined chairs',
          'A statement pendant (sculptural/LED)',
          'A neutral rug sized to dining area',
          'A single statement art piece',
          'A low-profile credenza with curated objects',
        ],
        rustic: [
          'A farmhouse table in solid wood',
          '6 wooden chairs or bench + chairs mix',
          'A lantern or iron pendant',
          'A jute or wool rug',
          'A nature print set or vintage poster',
          'A wooden sideboard with pottery',
        ],
        bohemian: [
          'A round/rectangular wood table with mixed chairs',
          'A woven or patterned pendant',
          'A patterned flat-weave rug',
          'Eclectic art gallery or tapestry',
          'A sideboard with plants and colorful ceramics',
        ],
      },

      // ---------- OFFICE ----------
      office: {
        modern: [
          'A minimalist desk with cable management',
          'An ergonomic chair with clean silhouette',
          'A slim desk lamp in metallic or matte finish',
          'Floating shelves with books and small décor',
          'A neutral rug under the desk area',
          'A framed abstract print on the wall',
          'A medium plant (snake plant) in matte pot',
        ],
        japanese_minimalist: [
          'A compact light-wood desk',
          'A simple upholstered chair',
          'A paper lantern or minimal desk lamp',
          'A single nature/calligraphy print',
          'A neutral mat and a bonsai or small plant',
        ],
        scandinavian: [
          'A light wood desk with tapered legs',
          'A comfortable upholstered task chair',
          'A fabric-shade desk lamp',
          'Two small framed prints',
          'A soft rug and a monstera or fern',
        ],
        industrial: [
          'A wood-and-metal desk',
          'A leather or metal-framed chair',
          'An industrial desk lamp with exposed bulb',
          'A black-framed poster',
          'A dark rug and a concrete-planter plant',
        ],
        classic: [
          'A paneled wood desk',
          'An upholstered classic chair',
          'A traditional brass desk lamp',
          'A framed landscape or map print',
          'A bordered rug and a ceramic-pot plant',
        ],
        contemporary: [
          'A slab or floating desk with clean lines',
          'A sleek ergonomic chair',
          'A minimal LED desk lamp',
          'One statement print',
          'A neutral rug and a structured plant',
        ],
        rustic: [
          'A solid wood desk with visible grain',
          'A fabric or leather chair',
          'A lamp with linen shade',
          'A nature print',
          'A jute rug and leafy plant in woven basket',
        ],
        bohemian: [
          'A wooden desk with warm tone',
          'An upholstered chair with texture',
          'A rattan or fabric desk lamp',
          'An eclectic art mix above the desk',
          'A patterned rug and trailing plant',
        ],
      },

      // ---------- BALCONY ----------
      balcony: {
        modern: [
          'A compact outdoor set: low lounge chair(s) with neutral cushions',
          'A small side table in metal or composite',
          'A durable outdoor rug in neutral tone',
          'Two planters with structured greenery',
          'A small lantern or outdoor lamp (if context allows)',
        ],
        japanese_minimalist: [
          'A low wood platform or simple bench',
          'A small tea table/tray',
          'A pebble or bamboo mat',
          'Two ceramic pots with bonsai or grasses',
          'A subtle lantern element',
        ],
        scandinavian: [
          'A light wood/metal chair set with cushions',
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
          'A cage-style outdoor lantern',
        ],
        classic: [
          'A wrought-iron bistro set',
          'A patterned outdoor rug',
          'Two ceramic planters with flowering plants',
          'A classic lantern',
          'Cushions in neutral stripe',
        ],
        contemporary: [
          'Boxy outdoor lounge chairs or loveseat',
          'A cubic side table',
          'A neutral outdoor rug',
          'Minimal planters with architectural plants',
          'Slim outdoor light (if allowed)',
        ],
        rustic: [
          'Wooden chairs or bench with natural cushions',
          'A small wooden side table',
          'A jute or woven outdoor rug',
          'Planters in terracotta',
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
}

export const chatGPTService = new ChatGPTService();
