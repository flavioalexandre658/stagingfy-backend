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
   * Enforces circulation rules, richness of style, and balanced staging.
   */
  async generateVirtualStagingPrompt(
    roomType: RoomType,
    furnitureStyle: FurnitureStyle
  ): Promise<string> {
    const roomLabel = this.getRoomTypeLabel(roomType);
    const styleLabel = this.getFurnitureStyleLabel(furnitureStyle);
    const styleTraits = this.getFurnitureStyleTraits(furnitureStyle);
    const packageItems = this.getPackageCombination(roomType, furnitureStyle);

    const prompt = `Virtually stage this ${roomLabel} with a complete ${styleLabel} interior design set.

Rules:
• Add 2–5 main furniture pieces (e.g., sofa, armchairs, dining table, bed, or desk depending on the room).
• Add 1–2 wall decorations (artwork, framed prints, or mirrors) only on available walls — never replace or alter doors or windows.
• Add 1–2 complementary elements (plants, lamps, rugs, curtains, cushions, small accessories).
• Ensure the result looks fully furnished and balanced, not sparse.

Preservation rules:
• Keep the room architecture, layout, lighting, windows, doors, stairs, and finishes exactly as they are.
• Preserve the exact perspective, framing, and light direction of the input photo.
• Do not crop, expand, repaint, or re-texture existing elements.
• Maintain clear circulation: never block doors, stairways, or passage paths with furniture.

Style guidance:
${styleTraits}

Mandatory inspirations for this combination:
${packageItems.map(i => `• ${i}`).join('\n')}

Output:
A photo-realistic, professionally staged ${roomLabel} in a ${styleLabel} style. 
The space must look complete, cohesive, and high-end — similar to luxury real-estate photography. 
Never remove existing elements; only add furniture and décor according to these rules.`;

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
        'plush fabrics like velvet and silk, tufted or sculptural seating, marble or glass tables, gold/brass accents, statement lighting, elegant accessories.',
      coastal:
        'light and airy feel, natural textures like rattan and jute, blues and whites, weathered wood, nautical-inspired elements.',
      farmhouse:
        'rustic wood finishes, vintage and distressed elements, neutral earth tones, cozy and lived-in aesthetic, country charm.',
    };
    return traits[furnitureStyle];
  }

  /**
   * Example package combos to enrich staging while keeping flexibility.
   */
  private getPackageCombination(
    roomType: RoomType,
    furnitureStyle: FurnitureStyle
  ): string[] {
    // 1) Paletas/acabamentos por ESTILO (2025)
    const STYLE: Record<
      FurnitureStyle,
      {
        palette: string;
        metal: string;
        wood: string;
        textile: string;
        accent: string;
        pattern: string;
        extras?: string[];
      }
    > = {
      standard: {
        palette: 'neutral palette (white, beige, warm gray)',
        metal: 'brushed nickel hardware',
        wood: 'warm oak or walnut veneers',
        textile: 'cotton/linen blends',
        accent: 'soft taupe accents',
        pattern: 'subtle herringbone or chevron',
        extras: ['classic framed prints', 'balanced proportions'],
      },
      modern: {
        palette:
          'neutral palette (warm gray, greige, off-white) with a single muted accent',
        metal: 'matte black or satin chrome',
        wood: 'straight-grain oak/ash in light to medium tones',
        textile: 'matte weaves and bouclé',
        accent: 'clay, sand, or muted sage',
        pattern: 'large-scale abstract or tone-on-tone geometry',
        extras: ['clean lines', 'low-profile silhouettes'],
      },
      scandinavian: {
        palette:
          'light, airy palette (white, ivory, pale gray) with soft pastels',
        metal: 'brushed steel or white powder-coat',
        wood: 'pale oak/beech with natural oil',
        textile: 'cotton/wool, chunky knit throws',
        accent: 'warm beige and muted green',
        pattern: 'small-scale geometric or micro-checks',
        extras: ['cozy layered textiles', 'light sheer curtains'],
      },
      industrial: {
        palette: 'charcoal, ink, tobacco, and concrete neutrals',
        metal: 'blackened steel and iron',
        wood: 'reclaimed or rustic walnut',
        textile: 'leather, denim-weave, heavy canvas',
        accent: 'cognac or rust',
        pattern: 'distressed or raw textures',
        extras: ['exposed-bulb lighting', 'metal mesh or angle-iron details'],
      },
      midcentury: {
        palette: 'warm neutrals with saffron/teal/olive accents',
        metal: 'brass or black',
        wood: 'teak or warm walnut',
        textile: 'linen tweed, boucle',
        accent: 'mustard or teal',
        pattern: 'geometrics and atomic motifs',
        extras: ['tapered legs', 'low credenzas'],
      },
      luxury: {
        palette: 'rich neutrals (ivory, greige) with jewel accents',
        metal: 'polished brass and champagne gold',
        wood: 'dark stained walnut/ebony',
        textile: 'velvet, silk-blend, high-pile',
        accent: 'merlot, deep emerald, or navy',
        pattern: 'subtle damask or fine abstract',
        extras: ['mitered details', 'marble and mirror surfaces'],
      },
      coastal: {
        palette: 'white, sand, driftwood with soft blues',
        metal: 'brushed brass or weathered nickel',
        wood: 'whitewashed oak/rattan',
        textile: 'linen, cotton, light sheers',
        accent: 'sea-salt blue and sea-grass green',
        pattern: 'stripes and airy botanicals',
        extras: ['natural fibers (jute, sisal)', 'light curtains'],
      },
      farmhouse: {
        palette: 'warm whites, oatmeal, and earthy browns',
        metal: 'antique bronze/black',
        wood: 'knotty oak, reclaimed pine',
        textile: 'linen/canvas, plaid knits',
        accent: 'sage and terracotta',
        pattern: 'gingham, simple florals, ticking stripes',
        extras: ['shaker profiles', 'hand-thrown ceramics'],
      },
    };

    // 2) Blueprints por CÔMODO (essenciais)
    const ROOM: Record<
      RoomType,
      (s: (typeof STYLE)[typeof furnitureStyle]) => string[]
    > = {
      living_room: s => [
        `sofa or sectional with ${s.textile} upholstery in the ${s.palette}`,
        `one–two accent armchairs with ${s.metal} details`,
        `coffee table (stone/wood/glass) — top to echo ${s.wood} or marble`,
        `large area rug (${s.pattern}) sized to anchor all front legs of seating`,
        `media console or low credenza in ${s.wood} with ${s.metal} pulls`,
        `floor lamp and/or table lamp matching ${s.metal}`,
        `side tables (pair) — profiles aligned with ${s.extras?.[0] ?? 'the style'}`,
        `decorative cushions/throw in ${s.accent} accent`,
        `big indoor plant (fiddle-leaf fig/ficus) in matte planter`,
        `framed wall art (abstract/botanical) sized to sofa width × 2/3`,
      ],
      bedroom: s => [
        `queen/king bed with upholstered or wood headboard in ${s.textile}`,
        `layered bedding (duvet + quilt) with pillows in ${s.accent} accents`,
        `two nightstands in ${s.wood} with ${s.metal} hardware`,
        `pair of bedside lamps (${s.metal} bases with fabric shades)`,
        `low dresser/wardrobe in ${s.wood} with clean fronts`,
        `bench or ottoman at foot of bed (${s.textile} upholstery)`,
        `area rug (${s.pattern}) extending beyond bed sides`,
        `large art or mirror centered above headboard`,
        `accent chair or compact reading nook with small side table`,
        `plant (rubber plant/peace lily) in neutral pot`,
      ],
      kitchen: s => [
        `counter or island stools with ${s.metal} footrests and ${s.textile} seats`,
        `pendant lighting above island in ${s.metal} (no ceiling changes implied)`,
        `compact bistro/dining set echoing ${s.wood}/${s.metal}`,
        `runner rug (${s.pattern}) along prep/circulation zone`,
        `styled counter vignette: cutting board + bowl in ${s.wood} + ceramic jar`,
        `herb planters (basil/rosemary) on sill or counter`,
        `simple framed print (culinary or botanical)`,
        `discreet tray with oils/salt-pepper in ${s.metal}`,
      ],
      bathroom: s => [
        `coordinated towel set (bath/hand) in ${s.palette} with ${s.accent} trim`,
        `vanity accessories: soap dispenser + tray in ${s.metal}/${s.wood}`,
        `floor bath mat (low-pile, ${s.pattern})`,
        `framed art or mirror with ${s.metal} frame`,
        `plant tolerant to humidity (fern/pothos) in ceramic pot`,
        `stool or small caddy in ${s.wood} if space allows`,
        `laundry basket or woven hamper (tone-on-tone)`,
      ],
      dining_room: s => [
        `dining table (oval/rectangular) — top in ${s.wood} or stone`,
        `4–6 dining chairs with ${s.textile} seats and ${s.metal} accents`,
        `linear or drum pendant centered above table in ${s.metal}`,
        `area rug (${s.pattern}) sized to chairs pulled back`,
        `sideboard/credenza in ${s.wood} with styled decor`,
        `wall art or large mirror (proportional to table width)`,
        `centerpiece: vase with stems/branches in palette ${s.accent}`,
        `subtle window treatment (sheer/linen) if context allows`,
      ],
      home_office: s => [
        `desk with cable management; top in ${s.wood} with ${s.metal} base`,
        `ergonomic chair upholstered in ${s.textile}`,
        `task lamp in ${s.metal} with soft white bulb`,
        `open shelving or low credenza in ${s.wood}`,
        `area rug (${s.pattern}) under chair/desk zone`,
        `framed art or pinboard aligned to ${s.palette}`,
        `plant (snake plant/zz plant) in matte pot`,
        `organizers: trays, bookends, and storage boxes`,
      ],
      kids_room: s => [
        `twin bed (or bunk) with playful ${s.textile} bedding`,
        `nightstand with soft-glow lamp in ${s.metal}`,
        `desk + chair — rounded edges in ${s.wood}`,
        `bookshelf or cubby storage with labeled bins`,
        `area rug (${s.pattern}) soft underfoot`,
        `wall prints (animals/letters) in ${s.accent} tones`,
        `toy storage baskets (woven)`,
        `cozy reading nook with floor cushion/beanbag`,
        `small plant (pothos) out of reach`,
      ],
      outdoor: s => [
        `outdoor sofa/lounge chairs with weatherproof ${s.textile}`,
        `coffee/side tables in powder-coated ${s.metal} or ${s.wood}`,
        `outdoor rug in ${s.pattern} (UV-resistant)`,
        `planters with layered greenery (olive tree/fern/grass)`,
        `lanterns or string lights in ${s.metal}`,
        `outdoor cushions/pillows in ${s.accent} tones`,
        `tray with decor (ceramic/teak)`,
        `umbrella or shade element if composition allows`,
      ],
    };

    // 3) Pequenos ajustes por estilo + cômodo (adiciona riqueza)
    const ADJUST: Partial<
      Record<RoomType, Partial<Record<FurnitureStyle, string[]>>>
    > = {
      living_room: {
        luxury: [
          'marble side tables with brass edge',
          'velvet drapery with blackout lining',
        ],
        modern: ['low media wall styling with books and sculptural vase'],
        scandinavian: ['sheer curtains and woven basket for throws'],
        industrial: ['vintage leather ottoman and metal wall shelf'],
        midcentury: ['teak credenza and sputnik-inspired lamp'],
        coastal: ['rattan accent chair and linen drapes'],
        farmhouse: ['distressed wood console and ceramic jugs'],
        standard: ['paired table lamps and classic framed prints'],
      },
      bedroom: {
        luxury: ['channel-tufted headboard and mirrored nightstands'],
        modern: ['floating nightstands and linear sconces (surface-mounted)'],
        scandinavian: ['light oak slat bench and knitted throw'],
        industrial: ['metal bedside lamps and trunk bench'],
        midcentury: ['spindle-leg nightstands and sunburst mirror'],
        coastal: ['linen bed skirt and woven pendant (if feasible)'],
        farmhouse: ['shaker dresser and quilted throw'],
        standard: ['classic framed landscape above bed'],
      },
      dining_room: {
        luxury: ['crystal chandelier and velvet chairs with piping'],
        modern: ['minimal LED linear pendant and slab-front sideboard'],
        scandinavian: ['wishbone-style chairs and pale wool rug'],
        industrial: ['metal cage pendant and reclaimed wood buffet'],
        midcentury: ['oval table with tulip-base and starburst art'],
        coastal: ['rattan chairs and driftwood centerpiece'],
        farmhouse: ['cross-back chairs and lantern pendant'],
        standard: ['beveled mirror above sideboard'],
      },
    };

    // 4) Montagem final (blueprint + ajustes + extras de estilo)
    const s = STYLE[furnitureStyle];
    const base = ROOM[roomType](s);
    const tweaks = ADJUST[roomType]?.[furnitureStyle] ?? [];
    const extras = s.extras ?? [];
    const pack = [...base, ...tweaks, ...extras];

    // Limita a um pacote robusto (10–14 itens) sem perder riqueza
    return pack.slice(0, 14);
  }
}

export const chatGPTService = new ChatGPTService();
