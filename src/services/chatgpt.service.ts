// src/services/chatgpt.service.ts
import OpenAI from 'openai';
import { RoomType, FurnitureStyle } from '../interfaces/upload.interface';

class ChatGPTService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  /**
   * Ultra-lean, preservation-first prompt for flux-kontext-pro.
   * - Mantém 100% da cena original (inclui ESCADA explicitamente).
   * - Sugestões de estilo são opcionais (soft), nunca mandatórias.
   * - O modelo escolhe 2–5 itens apenas se couberem no espaço visível.
   */
  async generateVirtualStagingPrompt(
    roomType: RoomType,
    furnitureStyle: FurnitureStyle
  ): Promise<string> {
    const room = this.getRoomTypeLabel(roomType);
    const style = this.getFurnitureStyleLabel(furnitureStyle);
    const traits = this.getFurnitureStyleTraits(furnitureStyle);
    const kit = this.getPackageCombination(roomType, furnitureStyle);
    const rugs = this.getRugOptions(furnitureStyle);

    const prompt = [
      // BLOCO DE PRESERVAÇÃO (curto e autoritário)
      `Add 2–5 pieces of ${style} furniture/decor to this ${room}.`,
      `Preserve the original photo EXACTLY: do not modify any existing pixel.`,
      `Do not change walls/paint, floor, ceiling, trims/baseboards, STAIRS (keep exactly as-is), doors, windows, vents, outlets, switches, or built-ins.`,
      `Preserve the exact camera angle, framing, perspective and lighting. No cropping, no relighting.`,
      `Do NOT add curtains, blinds, ceiling fixtures or any built-in elements.`,
      `Respect circulation: never block the stairway, door swings, or clear passage paths.`,
      `If an item does not physically fit in the visible space, SKIP it.`,

      // INTENÇÃO DE ESTILO (soft)
      `Style intent: ${traits}`,

      // SUGESTÕES (soft) — o modelo escolhe apenas se couber
      `Optional suggestions only if they fit without overlapping architecture:`,
      this.renderBullets(kit),

      // TAPETES (soft)
      `Optional rug (choose at most one if it fits under the main grouping):`,
      this.renderBullets(rugs),

      // FECHO
      `Render photorealistic materials and shadows consistent with the existing light.`,
    ].join(' ');

    return prompt;
  }

  // ---------------- helpers ----------------

  private renderBullets(items: string[]): string {
    return items.map(i => `• ${i}`).join(' ');
  }

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
   * Traços concisos para “forçar” o look sem induzir alterações estruturais.
   */
  private getFurnitureStyleTraits(furnitureStyle: FurnitureStyle): string {
    const traits: Record<FurnitureStyle, string> = {
      standard:
        'timeless silhouettes, neutral palette, balanced proportions, versatile wood and fabric finishes.',
      modern:
        'clean lines, neutral palette with one muted accent, matte finishes, slim metal/wood legs, low-profile silhouettes.',
      scandinavian:
        'light woods, airy fabrics, soft whites and beiges, organic curves, cozy layered textiles, minimal yet warm.',
      industrial:
        'raw wood with black steel, robust profiles, leather/canvas textures, urban loft vibe, restrained color.',
      midcentury:
        'tapered legs, warm walnut/teak, simple geometry, subtle patterns, functional elegance from the 50s–60s.',
      luxury:
        'velvet or silk-blend fabrics, marble or glass tops, brass/champagne accents, refined symmetry, statement yet tasteful.',
      coastal:
        'white and sand neutrals, rattan/jute textures, breezy linens, soft blues/greens, relaxed beach-house feel.',
      farmhouse:
        'warm wood tones, shaker profiles, linen/cotton, distressed accents, comfortable and lived-in charm.',
    };
    return traits[furnitureStyle];
  }

  /**
   * Kits por cômodo + estilo: sugestões ricas porém seguras (aditivas).
   * Tudo são “opções”, nunca ordens — reduz deriva estrutural.
   */
  private getPackageCombination(
    roomType: RoomType,
    furnitureStyle: FurnitureStyle
  ): string[] {
    const STYLE: Record<
      FurnitureStyle,
      { metal: string; wood: string; textile: string; accent: string }
    > = {
      standard: {
        metal: 'brushed nickel',
        wood: 'warm oak or walnut',
        textile: 'cotton/linen',
        accent: 'soft taupe',
      },
      modern: {
        metal: 'matte black or satin chrome',
        wood: 'light oak/ash',
        textile: 'matte weave or bouclé',
        accent: 'muted clay or sage',
      },
      scandinavian: {
        metal: 'white powder-coated steel',
        wood: 'pale oak or beech',
        textile: 'wool/cotton knit',
        accent: 'warm beige',
      },
      industrial: {
        metal: 'blackened steel',
        wood: 'reclaimed walnut',
        textile: 'leather or heavy canvas',
        accent: 'cognac',
      },
      midcentury: {
        metal: 'brass or black',
        wood: 'walnut or teak',
        textile: 'linen tweed/bouclé',
        accent: 'mustard or teal',
      },
      luxury: {
        metal: 'polished brass/champagne gold',
        wood: 'ebonized or dark walnut',
        textile: 'velvet or silk-blend',
        accent: 'deep emerald, merlot, or navy',
      },
      coastal: {
        metal: 'weathered brass',
        wood: 'whitewashed oak/rattan',
        textile: 'light linen/cotton',
        accent: 'sea-salt blue/green',
      },
      farmhouse: {
        metal: 'antique bronze/black',
        wood: 'knotty oak/reclaimed pine',
        textile: 'linen/canvas',
        accent: 'sage or terracotta',
      },
    };

    const s = STYLE[furnitureStyle];

    const ROOM: Record<RoomType, string[]> = {
      living_room: [
        `sofa or compact sectional in ${s.textile} with ${s.metal}/${s.wood} legs`,
        `one or two accent chairs coordinated with the sofa`,
        `coffee table (stone/wood/glass) sized to the seating layout`,
        `one or two side tables to support lighting or books`,
        `floor or table lamp with ${s.metal} base`,
        `media console or low credenza in ${s.wood}`,
        `decor cushions/throw in ${s.accent} tones`,
        `framed artwork or mirror on a free wall (never over windows/doors)`,
        `tall indoor plant in a neutral planter`,
      ],
      bedroom: [
        `bed (queen/king) with upholstered or wood headboard in ${s.textile}`,
        `two nightstands in ${s.wood} with simple hardware`,
        `pair of bedside lamps with ${s.metal} bases and fabric shades`,
        `dresser or wardrobe with clean fronts in ${s.wood}`,
        `bench or ottoman at the foot of the bed (${s.textile})`,
        `framed artwork above the headboard on free wall space only`,
        `compact accent chair with small side table (if space allows)`,
        `plant in a simple pot (peace lily/rubber plant)`,
      ],
      kitchen: [
        `counter/peninsula stools with ${s.metal} footrests and ${s.textile} seats`,
        `small bistro table with 2–4 chairs (only if space allows)`,
        `styled counter vignette (board + bowl + jar) matching ${s.wood}/${s.metal}`,
        `herb planter (basil/rosemary)`,
        `single framed culinary/botanical print on a free wall`,
      ],
      bathroom: [
        `coordinated towel set in neutral palette with a hint of ${s.accent}`,
        `accessory set (tray, soap dispenser) in ${s.metal}/${s.wood}`,
        `small stool or caddy for storage (if space allows)`,
        `framed art or mirror on an empty wall area`,
        `plant tolerant to humidity (fern/pothos)`,
      ],
      dining_room: [
        `dining table (oval/rectangular) with top in ${s.wood} or stone`,
        `4–6 dining chairs with ${s.textile} seats`,
        `sideboard/credenza in ${s.wood} for the main wall`,
        `decorative centerpiece (vase with branches/flowers)`,
        `pair of table lamps on the sideboard (if present)`,
        `one large framed artwork or mirror on a free wall`,
      ],
      home_office: [
        `desk in ${s.wood} with simple ${s.metal} base`,
        `ergonomic upholstered chair (${s.textile})`,
        `task lamp with ${s.metal} arm`,
        `low credenza or open shelving in ${s.wood}`,
        `framed prints or pinboard on free wall space`,
        `plant (snake plant/zz) in matte planter`,
      ],
      kids_room: [
        `twin bed (or bunk) with playful ${s.textile} bedding`,
        `nightstand with soft-glow lamp`,
        `desk with rounded corners and compact chair`,
        `bookshelf or cubby storage with labeled bins`,
        `fun wall prints (animals/letters) on free wall`,
        `toy baskets (woven)`,
      ],
      outdoor: [
        `outdoor lounge chairs or compact sofa with weatherproof ${s.textile}`,
        `coffee/side tables in powder-coated ${s.metal} or ${s.wood}`,
        `planters with layered greenery (olive tree/fern/ornamental grass)`,
        `lanterns for soft ambience (battery/LED)`,
        `outdoor cushions in ${s.accent} tones`,
      ],
    };

    return ROOM[roomType];
  }

  /**
   * Opções de tapete por estilo — alternativas (soft), não mandatório.
   */
  private getRugOptions(style: FurnitureStyle): string[] {
    const RUGS: Record<FurnitureStyle, string[]> = {
      standard: [
        'neutral low-pile rug with subtle border',
        'tone-on-tone geometric rug',
        'heathered wool-blend rug in warm gray',
      ],
      modern: [
        'large low-pile rug in soft greige',
        'abstract rug with subtle large-scale pattern',
        'micro-pattern rug in warm gray/ivory',
      ],
      scandinavian: [
        'light wool rug with faint diamond pattern',
        'off-white flat-weave with subtle stripe',
        'pale gray short-pile shag rug',
      ],
      industrial: [
        'charcoal flat-weave with distressed texture',
        'dark heathered rug that grounds the seating',
        'vintage-look gray rug with faded pattern',
      ],
      midcentury: [
        'warm neutral rug with simple geometric motif',
        'ivory low-pile rug with thin contrasting border',
        'teal-accent rug with restrained pattern',
      ],
      luxury: [
        'silky low-pile rug in ivory/greige with soft sheen',
        'fine abstract rug with marble-like veining',
        'bordered rug with subtle damask micro-pattern',
      ],
      coastal: [
        'natural jute/sisal blend rug with cotton border',
        'sand-tone flat-weave with faint stripes',
        'light blue/ivory rug with breezy pattern',
      ],
      farmhouse: [
        'woven jute or wool rug in oatmeal',
        'vintage-wash patterned rug in warm neutrals',
        'ticking-stripe flat-weave rug',
      ],
    };
    return RUGS[style];
  }
}

export const chatGPTService = new ChatGPTService();
