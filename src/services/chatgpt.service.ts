// src/services/chatgpt.service.ts
import OpenAI from 'openai';
import { RoomType, FurnitureStyle } from '../interfaces/upload.interface';

class ChatGPTService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  /**
   * Preservation-first + style-rich prompt for flux-kontext-pro.
   * - Mantém o ambiente intacto (pixels preservados).
   * - Estilo guiado por "traits".
   * - Itens sugeridos (2–5) escolhidos pelo modelo conforme espaço REAL.
   */
  async generateVirtualStagingPrompt(
    roomType: RoomType,
    furnitureStyle: FurnitureStyle
  ): Promise<string> {
    const room = this.getRoomTypeLabel(roomType); // ex.: "living room"
    const style = this.getFurnitureStyleLabel(furnitureStyle); // ex.: "luxury"
    const traits = this.getFurnitureStyleTraits(furnitureStyle);
    const kit = this.getPackageCombination(roomType, furnitureStyle);
    const rugs = this.getRugOptions(furnitureStyle);

    const prompt = [
      // 1) Núcleo de preservação (curto e autoritário)
      `Add 2–5 pieces of ${style} furniture and decor to this ${room}. Only add new objects.`,
      `Keep every other aspect of the original photo EXACTLY the same — do not modify any existing pixel.`,
      `Do not change walls or paint, floor, ceiling, trims/baseboards, STAIRS, doors, windows, vents, outlets, switches, built-ins, or fixtures.`,
      `Preserve the exact camera angle, framing, perspective, and lighting.`,
      `Do not add curtains or built-in/ceiling fixtures. If something does not fit, skip it.`,
      `Never place items blocking door openings, the stairway, or clear passage paths.`,

      // 2) Intenção de estilo (curta)
      `Style intent: ${traits}`,

      // 3) Kit de sugestões (o modelo escolhe as que couberem)
      `From the list below, choose only items that physically fit in the visible floor area. These are suggestions — not requirements. Skip any item that would overlap doors/windows/vents/thermostats or require structural changes.`,
      this.renderBullets(kit),

      // 4) Opções de tapete: alternativas para enriquecer sem fixar 1 único look
      `Rug options (choose at most one if appropriate and only if it fits under the main grouping):`,
      this.renderBullets(rugs),

      // 5) Fecho
      `Use realistic scale and shadows consistent with the existing light. Produce a photoreal, professionally staged ${room} in a ${style} style.`,
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
   * Traços concisos para “forçar” o look sem encorajar mudanças estruturais.
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
   * “Kits” por cômodo + estilo: sugestões ricas porém seguras (aditivas).
   * Nunca mencionamos cortinas embutidas, sancas, pintura etc.
   */
  private getPackageCombination(
    roomType: RoomType,
    furnitureStyle: FurnitureStyle
  ): string[] {
    // Materiais por estilo para rechear descrições com consistência
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
        `sofa or compact sectional in ${s.textile} with ${s.metal} or ${s.wood} legs`,
        `one or two accent chairs coordinated with the sofa`,
        `coffee table (stone, wood, or glass) sized to the seating layout`,
        `side tables (single or pair) to support lamps or books`,
        `floor or table lamp with ${s.metal} base`,
        `media console or low credenza in ${s.wood}`,
        `decorative cushions/throw in ${s.accent} tones`,
        `large framed artwork or mirror on a free wall (never over windows/doors)`,
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
        `single framed culinary/botanical print for a free wall`,
      ],
      bathroom: [
        `coordinated towel set (bath/hand) in neutral palette with subtle ${s.accent}`,
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
        `subtle sheer/linen drape only if an existing rod is already present`,
      ],
      home_office: [
        `clean desk surface in ${s.wood} with simple ${s.metal} base`,
        `ergonomic upholstered chair (${s.textile})`,
        `task lamp with ${s.metal} arm`,
        `low credenza or open shelving in ${s.wood}`,
        `framed prints or pinboard on free wall space`,
        `plant (snake plant/zz) in matte planter`,
        `desk organizers (tray, bookends)`,
      ],
      kids_room: [
        `twin bed (or bunk) with playful ${s.textile} bedding`,
        `nightstand with soft-glow lamp`,
        `desk with rounded corners and a compact chair`,
        `bookshelf or cubby storage with labeled bins`,
        `fun wall prints (animals/letters) on free wall`,
        `toy baskets (woven)`,
        `reading nook with floor cushion/beanbag`,
      ],
      outdoor: [
        `outdoor lounge chairs or compact sofa with weatherproof ${s.textile}`,
        `coffee/side tables in powder-coated ${s.metal} or ${s.wood}`,
        `planters with layered greenery (olive tree/fern/ornamental grass)`,
        `lanterns for soft ambience (battery/LED)`,
        `outdoor cushions in ${s.accent} tones`,
        `serving tray with decorative objects`,
      ],
    };

    return ROOM[roomType];
  }

  /**
   * Opções de tapete por estilo — fornecidas como alternativas,
   * para variar look sem fixar um único “carpet”.
   */
  private getRugOptions(style: FurnitureStyle): string[] {
    const RUGS: Record<FurnitureStyle, string[]> = {
      standard: [
        'neutral low-pile rug with subtle border',
        'tone-on-tone geometric rug',
        'heathered wool blend rug in warm gray',
      ],
      modern: [
        'large low-pile rug in soft greige',
        'abstract rug with subtle large-scale pattern',
        'micro-pattern rug in warm gray/ivory',
      ],
      scandinavian: [
        'light wool rug with faint diamond pattern',
        'off-white flat-weave with subtle stripe',
        'pale gray shaggy rug (short pile) for coziness',
      ],
      industrial: [
        'charcoal flat-weave rug with distressed texture',
        'dark heathered rug that grounds the seating',
        'vintage-look gray rug with faded pattern',
      ],
      midcentury: [
        'warm neutral rug with simple geometric motif',
        'low-pile rug in ivory with thin contrasting border',
        'teal-accent rug with restrained pattern',
      ],
      luxury: [
        'silky low-pile rug in ivory or greige that reflects light softly',
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
