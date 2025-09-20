// src/services/chatgpt.service.ts
import OpenAI from 'openai';
import { RoomType, FurnitureStyle } from '../interfaces/upload.interface';

type Range = [number, number];

interface RoomStagingPlan {
  // How many items to add (by group)
  mainPiecesRange: Range; // e.g., sofa/bed/table/desk depending on room
  wallDecorRange: Range; // frames, mirrors (on free wall only)
  complementaryRange: Range; // plants, lamps, rugs, cushions, accessories

  // Allowed item types for this room (semantic guardrails)
  allowedMainItems: string[]; // room-specific primary furniture
  allowedWallDecor: string[]; // safe wall decor
  allowedComplementary: string[]; // safe complementary items

  // Extra, room-specific safety notes (e.g., island clearances, stair lanes)
  roomSafetyNotes: string[]; // appended into prompt

  // Optional style emphasis (short, to steer material/finish without forcing structure)
  styleEmphasis?: string[];
}

class ChatGPTService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  /**
   * Generates a refined prompt for flux-kontext-pro.
   * Dynamic furniture count (2–5), strict scene preservation, and rich style guidance.
   */
  /**
   * Generates a refined prompt for flux-kontext-pro.
   * Dynamic furnishing (2–5 items), pixel-preserving, with a protected stair zone.
   */
  async generateVirtualStagingPrompt(
    roomType: RoomType,
    furnitureStyle: FurnitureStyle
  ): Promise<string> {
    const roomLabel = this.getRoomTypeLabel(roomType);
    const styleLabel = this.getFurnitureStyleLabel(furnitureStyle);
    const styleTraits = this.getFurnitureStyleTraits(furnitureStyle);
    const packageItems = this.getPackageCombination(roomType, furnitureStyle)
      // favorece peças de baixo volume primeiro
      .filter(
        i =>
          !/sideboard|credenza|large wardrobe|tall cabinet|wall unit|console table/i.test(
            i
          )
      );
    const plan = this.getRoomStagingPlan(roomType, furnitureStyle); // << NEW

    // Compose room-aware guidance lines
    const mainPiecesLine =
      `Add ${plan.mainPiecesRange[0]}–${plan.mainPiecesRange[1]} main ${roomLabel} piece(s): ` +
      `${this.joinHuman(plan.allowedMainItems)}.`;

    const wallDecorLine =
      `Add ${plan.wallDecorRange[0]}–${plan.wallDecorRange[1]} wall decoration(s) on free wall surfaces only: ` +
      `${this.joinHuman(plan.allowedWallDecor)}. Do not place over doors/windows.`;

    const complementaryLine =
      `Add ${plan.complementaryRange[0]}–${plan.complementaryRange[1]} complementary element(s): ` +
      `${this.joinHuman(plan.allowedComplementary)}.`;

    const roomSafety = plan.roomSafetyNotes.length
      ? `\nROOM-SPECIFIC SAFETY:\n• ${plan.roomSafetyNotes.join('\n• ')}\n`
      : '';

    const styleEmphasis =
      (plan.styleEmphasis?.length ?? 0) > 0
        ? `\nStyle emphasis for ${styleLabel}: ${plan.styleEmphasis!.join('; ')}.\n`
        : '';

    const topPicks = packageItems
      .slice(0, 6)
      .map(i => `• ${i}`)
      .join('\n');

    const prompt = `Only add a few ${styleLabel} furniture and decor items to this ${roomLabel}. Do not modify any existing pixel of the scene.
• ${mainPiecesLine}
• ${complementaryLine}

PRESERVE PIXEL-FOR-PIXEL:
• Keep walls, paint color, trims, baseboards, floor, ceiling, pendant fixtures, STAIRS (newel, handrail, balusters, treads, risers), doors, windows, vents, outlets and switches IDENTICAL.
• Maintain the exact camera angle, framing, perspective lines and original lighting (direction, intensity, color temperature).
• No repainting, retexturing, relighting, cropping, expanding, cloning or geometry changes. No new curtains/blinds or window treatments.

STAIR & CIRCULATION SAFETY:
• Treat the staircase and its landing as a PROTECTED NO-PLACEMENT ZONE — do not cover, occlude or replace any stair part.
• Keep clear passage around doors, along the stair run and landings; maintain at least 90 cm (36") of free circulation.
• Only place items where they physically fit in the visible floor area. If an item would overlap the stair, door swing, or a passage path, SKIP it.${roomSafety}

STYLE GUARDRAILS — ${styleLabel}:
${styleTraits}${styleEmphasis}

FURNISHING GUIDANCE (flexible; apply only if they fit without breaking rules):
${topPicks}

Output: a photo-real, professionally staged ${roomLabel} in a ${styleLabel} style. Add furniture and decor ONLY; leave every architectural element and finish exactly as in the input.`;

    return prompt;
  }

  // ---------- NEW: room-aware, style-aware plan ----------
  private getRoomStagingPlan(
    roomType: RoomType,
    furnitureStyle: FurnitureStyle
  ): RoomStagingPlan {
    // Base library per room
    const baseByRoom: Record<
      RoomType,
      Omit<RoomStagingPlan, 'styleEmphasis'>
    > = {
      living_room: {
        mainPiecesRange: [2, 4],
        wallDecorRange: [1, 2],
        complementaryRange: [1, 3],
        allowedMainItems: [
          'sofa or sectional',
          'one or two accent armchairs',
          'coffee table',
          'media console or low credenza',
          'side tables',
        ],
        allowedWallDecor: ['framed artwork', 'framed photography', 'mirror'],
        allowedComplementary: [
          'area rug sized to anchor seating',
          'floor lamp or table lamp',
          'indoor plant',
          'decorative cushions and throw',
          'books, bowls, vases',
        ],
        roomSafetyNotes: [
          'Keep a clear seating circulation path (at least one side of the seating open)',
          'Do not block balcony/door thresholds with furniture',
        ],
      },

      bedroom: {
        mainPiecesRange: [2, 4],
        wallDecorRange: [1, 2],
        complementaryRange: [1, 3],
        allowedMainItems: [
          'bed (queen/king depending on space)',
          'nightstands (pair or single)',
          'dresser or wardrobe',
          'bench or ottoman at the foot of the bed',
        ],
        allowedWallDecor: ['framed artwork above headboard', 'mirror'],
        allowedComplementary: [
          'bedside lamps',
          'area rug extending beyond bed sides',
          'accent chair (if space allows)',
          'plant in neutral pot',
        ],
        roomSafetyNotes: [
          'Keep door swings and closet access fully clear',
          'Do not cover power outlets or switches with furniture fronts',
        ],
      },

      kitchen: {
        mainPiecesRange: [1, 3],
        wallDecorRange: [0, 1],
        complementaryRange: [1, 2],
        allowedMainItems: [
          'counter or island stools',
          'compact bistro/dining set (small table + 2 chairs)',
        ],
        allowedWallDecor: ['small framed print on free wall surface'],
        allowedComplementary: [
          'runner rug along prep zone',
          'herb planters on sill/counter',
          'counter vignette (board + bowl + ceramic jar)',
        ],
        roomSafetyNotes: [
          'Do not place items that obstruct cabinet doors, appliance doors or walking lanes',
          'Keep cooktop and sink areas unobstructed',
        ],
      },

      bathroom: {
        mainPiecesRange: [0, 1],
        wallDecorRange: [0, 1],
        complementaryRange: [1, 3],
        allowedMainItems: [
          'small stool or slim console (only if space clearly allows)',
        ],
        allowedWallDecor: ['small framed print', 'mirror (if free wall)'],
        allowedComplementary: [
          'coordinated towels (bath/hand)',
          'vanity accessories (soap dispenser, tray)',
          'low-pile bath mat',
          'small plant tolerant to humidity',
        ],
        roomSafetyNotes: [
          'Keep fixtures (toilet, vanity, shower) fully visible and unobstructed',
          'Do not place items that could block door swing or shower entry',
        ],
      },

      dining_room: {
        mainPiecesRange: [2, 4], // table + 2–6 chairs (count as 1–3 main groups)
        wallDecorRange: [1, 2],
        complementaryRange: [1, 3],
        allowedMainItems: [
          'dining table (oval/rectangular)',
          'set of dining chairs (4–6)',
          'sideboard or credenza',
        ],
        allowedWallDecor: [
          'large framed artwork',
          'mirror proportional to table',
        ],
        allowedComplementary: [
          'area rug sized to chairs pulled back',
          'centerpiece (vase with stems/branches)',
          'subtle window treatment if context allows',
        ],
        roomSafetyNotes: [
          'Keep chairs fully usable; do not push table too close to walls/doors',
          'Maintain clear path around table perimeter',
        ],
      },

      home_office: {
        mainPiecesRange: [2, 3],
        wallDecorRange: [0, 2],
        complementaryRange: [1, 3],
        allowedMainItems: [
          'desk',
          'ergonomic chair',
          'low credenza or bookshelf',
        ],
        allowedWallDecor: [
          'framed artwork',
          'pinboard or simple wall organizer on free wall',
        ],
        allowedComplementary: [
          'task lamp',
          'area rug under chair/desk zone',
          'plant',
          'organizers (trays, bookends, storage boxes)',
        ],
        roomSafetyNotes: [
          'Keep cable management tidy; do not block outlets',
          'Do not place furniture obstructing door or window opening',
        ],
      },

      kids_room: {
        mainPiecesRange: [2, 4],
        wallDecorRange: [1, 2],
        complementaryRange: [1, 3],
        allowedMainItems: [
          'bed (twin/full)',
          'nightstand',
          'small desk + chair',
          'bookshelf or cubby storage',
        ],
        allowedWallDecor: [
          'playful framed prints (animals/letters)',
          'mirror (safe height)',
        ],
        allowedComplementary: [
          'soft area rug',
          'toy storage baskets',
          'reading nook cushion or beanbag',
          'small plant out of reach',
        ],
        roomSafetyNotes: [
          'Do not place furniture blocking closet/door',
          'Keep walking paths free of tripping hazards',
        ],
      },

      outdoor: {
        mainPiecesRange: [2, 4],
        wallDecorRange: [0, 1],
        complementaryRange: [1, 3],
        allowedMainItems: [
          'outdoor sofa or lounge chairs',
          'outdoor table (coffee/side)',
        ],
        allowedWallDecor: ['outdoor-safe wall decor (if applicable)'],
        allowedComplementary: [
          'outdoor rug (UV-resistant)',
          'planters with greenery',
          'lanterns or string lights',
          'outdoor cushions',
        ],
        roomSafetyNotes: [
          'Keep door thresholds and balcony edges unobstructed',
          'Do not place items near unsafe edges or blocking emergency egress',
        ],
      },
    };

    // Style emphasis (light touch, avoids forcing structure)
    const styleEmphasisByStyle: Record<FurnitureStyle, string[]> = {
      standard: ['balanced proportions', 'neutral palette'],
      modern: ['clean lines', 'matte finishes', 'low-profile silhouettes'],
      scandinavian: ['light woods', 'airy fabrics', 'cozy layered textiles'],
      industrial: ['black steel details', 'raw wood surfaces', 'robust shapes'],
      midcentury: ['tapered legs', 'warm wood tones', 'geometric accents'],
      luxury: [
        'velvet/silk accents',
        'brass or gold details',
        'marble or glass highlights',
      ],
      coastal: [
        'rattan/jute textures',
        'white/sand/blue palette',
        'weathered woods',
      ],
      farmhouse: ['rustic woods', 'earthy tones', 'handcrafted details'],
    };

    const plan = baseByRoom[roomType];

    return {
      ...plan,
      styleEmphasis: styleEmphasisByStyle[furnitureStyle],
    };
  }

  private joinHuman(items: string[]): string {
    if (items.length === 0) return '';
    if (items.length === 1) return items[0] || '';
    const last = items[items.length - 1];
    return `${items.slice(0, -1).join(', ')} and ${last}`;
  }

  // ------- labels -------
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

  /** Descriptive traits to anchor visual style (2025 market expectations). */
  private getFurnitureStyleTraits(furnitureStyle: FurnitureStyle): string {
    const traits: Record<FurnitureStyle, string> = {
      standard:
        'classic, timeless silhouettes; neutral palette (white, beige, warm gray); brushed nickel hardware; oak/walnut veneers; cotton/linen textiles; subtle patterns; balanced proportions.',
      modern:
        'clean lines and low profiles; neutral palette (greige/off-white/warm gray) with one muted accent; matte finishes; slim metal or light-toned wood legs; bouclé or tight weaves; subtle geometric or abstract patterns.',
      scandinavian:
        'light woods (oak/beech), airy whites and beiges with soft pastels; organic curves; cozy layered textiles (wool/cotton/knit); minimal yet warm; brushed steel/white hardware.',
      industrial:
        'blackened steel, raw wood, exposed joinery; robust shapes; dark leather or heavy canvas; charcoal/concrete neutrals with rust/cognac accents; cage/exposed-bulb lighting (floor/table only).',
      midcentury:
        'tapered legs; teak/warm walnut; linen tweed/bouclé; mustard/teal/olive accents; slim credenzas; geometric/atomic motifs; brass or black hardware.',
      luxury:
        'velvet/silk-blend and high-pile textiles; tufted or sculptural seating; marble or mirrored tables; polished brass/champagne gold accents; statement floor/table lamps; layered accessories; rich neutrals with jewel-tone accents.',
      coastal:
        'white/sand/driftwood palette with soft blues; rattan and jute textures; linen/cotton sheers; weathered wood; airy botanicals and stripes; brushed brass/weathered nickel.',
      farmhouse:
        'warm whites and earth tones; reclaimed/knotty woods; linen/canvas, plaid knits; shaker profiles; antique bronze/black hardware; hand-thrown ceramics; cozy, lived-in feel.',
    };
    return traits[furnitureStyle];
  }

  /**
   * Rich “inspiration” packages by RoomType + Style.
   * The model should pick only what fits (subset), never forcing structure changes.
   */
  private getPackageCombination(
    roomType: RoomType,
    furnitureStyle: FurnitureStyle
  ): string[] {
    // Style primitives (palette/materials) to compose item texts
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
        metal: 'brushed nickel',
        wood: 'warm oak or walnut',
        textile: 'cotton/linen blends',
        accent: 'soft taupe',
        pattern: 'subtle herringbone or chevron',
        extras: ['classic framed prints', 'balanced proportions'],
      },
      modern: {
        palette: 'neutral palette (greige, warm gray, off-white)',
        metal: 'matte black or satin chrome',
        wood: 'light straight-grain oak/ash',
        textile: 'matte weaves and bouclé',
        accent: 'muted clay/sand/sage',
        pattern: 'tone-on-tone large-scale geometry',
        extras: ['clean lines', 'low-profile silhouettes'],
      },
      scandinavian: {
        palette: 'light, airy whites and beiges with soft pastels',
        metal: 'brushed steel or white powder-coat',
        wood: 'pale oak/beech',
        textile: 'wool/cotton, chunky knit throws',
        accent: 'warm beige and muted green',
        pattern: 'micro-checks and small geometrics',
        extras: ['sheer curtains', 'cozy layers'],
      },
      industrial: {
        palette: 'charcoal, ink, tobacco, concrete neutrals',
        metal: 'blackened steel/iron',
        wood: 'reclaimed/rustic walnut',
        textile: 'leather or heavy canvas',
        accent: 'cognac or rust',
        pattern: 'distressed/raw textures',
        extras: ['exposed-bulb look (floor/table)', 'metal details'],
      },
      midcentury: {
        palette: 'warm neutrals with saffron/teal/olive accents',
        metal: 'brass or black',
        wood: 'teak or warm walnut',
        textile: 'linen tweed/bouclé',
        accent: 'mustard or teal',
        pattern: 'geometrics/atomic',
        extras: ['tapered legs', 'low credenzas'],
      },
      luxury: {
        palette: 'rich neutrals (ivory/greige) with jewel accents',
        metal: 'polished brass/champagne gold',
        wood: 'dark walnut/ebony',
        textile: 'velvet and silk-blend, high-pile',
        accent: 'deep emerald, merlot, or navy',
        pattern: 'fine abstract or subtle damask',
        extras: ['marble/mirror surfaces', 'mitered details'],
      },
      coastal: {
        palette: 'white/sand/driftwood with soft blues',
        metal: 'brushed brass or weathered nickel',
        wood: 'whitewashed oak and rattan',
        textile: 'linen/cotton, airy sheers',
        accent: 'sea-salt blue and seagrass green',
        pattern: 'stripes and airy botanicals',
        extras: ['natural fibers (jute/sisal)'],
      },
      farmhouse: {
        palette: 'warm whites, oatmeal, earthy browns',
        metal: 'antique bronze/black',
        wood: 'reclaimed pine/knotty oak',
        textile: 'linen/canvas, plaid knits',
        accent: 'sage and terracotta',
        pattern: 'gingham/ticking stripes',
        extras: ['shaker profiles', 'hand-thrown ceramics'],
      },
    };

    // Room blueprints (base items)
    const ROOM: Record<
      RoomType,
      (s: (typeof STYLE)[typeof furnitureStyle]) => string[]
    > = {
      living_room: s => [
        `sofa or compact sectional in ${s.textile} within the ${s.palette}`,
        `one–two accent armchairs with ${s.metal} details`,
        `coffee table (stone/wood/glass) echoing ${s.wood} or marble`,
        `area rug (${s.pattern}) sized to anchor front legs of seating`,
        `low media console/credenza in ${s.wood} with ${s.metal} pulls`,
        `floor/table lamp(s) matching ${s.metal}`,
        `side table(s) aligned to ${s.extras?.[0] ?? 'style principles'}`,
        `accent cushions/throw in ${s.accent}`,
        `indoor plant (fiddle-leaf fig/ficus) in matte planter`,
        `framed wall art (abstract/botanical) ~ 2/3 sofa width`,
      ],
      bedroom: s => [
        `queen/king bed with upholstered or wood headboard in ${s.textile}`,
        `layered bedding (duvet + quilt) with ${s.accent} accents`,
        `two nightstands in ${s.wood} with ${s.metal} hardware`,
        `pair of bedside lamps with ${s.metal} bases, fabric shades`,
        `dresser/wardrobe in ${s.wood} with clean fronts`,
        `bench/ottoman at foot of bed in ${s.textile}`,
        `area rug (${s.pattern}) extending beyond bed sides`,
        `large art or mirror centered above headboard`,
        `reading chair with small side table`,
        `plant (rubber plant/peace lily) in neutral pot`,
      ],
      kitchen: s => [
        `counter/island stools with ${s.metal} footrests and ${s.textile} seats`,
        `compact dining/bistro set echoing ${s.wood}/${s.metal}`,
        `runner rug (${s.pattern}) along prep/circulation zone`,
        `styled counter vignette: ${s.wood} board + ceramic bowl`,
        `herb planters (basil/rosemary)`,
        `small framed print (culinary/botanical)`,
      ],
      bathroom: s => [
        `coordinated towel set in the ${s.palette} with ${s.accent} trim`,
        `vanity accessories: soap dispenser + tray in ${s.metal}/${s.wood}`,
        `low-pile bath mat (${s.pattern})`,
        `framed art or mirror with ${s.metal} frame`,
        `humidity-tolerant plant (fern/pothos)`,
        `wood stool/caddy in ${s.wood} if space allows`,
      ],
      dining_room: s => [
        `dining table (oval/rectangular) — top in ${s.wood} or stone`,
        `4–8 dining chairs with ${s.textile} seats and ${s.metal} accents`,
        `area rug (${s.pattern}) sized to chairs pulled back`,
        `sideboard/credenza in ${s.wood} with styled decor`,
        `wall art or large mirror proportional to table width`,
        `centerpiece: vase with stems/branches in ${s.accent}`,
        `subtle window treatment (sheer/linen) only if a rod exists`,
      ],
      home_office: s => [
        `desk with cable management — top in ${s.wood}, ${s.metal} base`,
        `ergonomic task chair upholstered in ${s.textile}`,
        `task lamp in ${s.metal} with soft white bulb`,
        `open shelving/low credenza in ${s.wood}`,
        `area rug (${s.pattern}) under desk zone`,
        `framed art or pinboard aligned to ${s.palette}`,
        `plant (snake plant/zz) in matte pot`,
        `desktop organizers (trays/bookends/boxes)`,
      ],
      kids_room: s => [
        `twin/bunk bed with playful ${s.textile} bedding`,
        `nightstand with soft-glow lamp in ${s.metal}`,
        `rounded-edge desk + chair in ${s.wood}`,
        `cubby storage with labeled bins`,
        `area rug (${s.pattern}) soft underfoot`,
        `wall prints (animals/letters) in ${s.accent} tones`,
        `reading nook with floor cushion/beanbag`,
      ],
      outdoor: s => [
        `outdoor sofa/lounge chairs with weatherproof ${s.textile}`,
        `coffee/side tables in powder-coated ${s.metal} or ${s.wood}`,
        `UV-resistant outdoor rug in ${s.pattern}`,
        `planters with layered greenery (olive tree/fern/grass)`,
        `lanterns or string lights in ${s.metal}`,
        `outdoor cushions in ${s.accent} tones`,
        `decor tray (ceramic/teak)`,
      ],
    };

    // Style+room tweaks for extra richness
    const ADJUST: Partial<
      Record<RoomType, Partial<Record<FurnitureStyle, string[]>>>
    > = {
      living_room: {
        luxury: [
          'marble side tables with brass edge',
          'velvet accent pillows with contrast piping',
          'mirror with thin brass frame (only on free wall)',
        ],
        modern: ['low media styling with sculptural vase and books'],
        scandinavian: [
          'sheer curtains (only if rod exists) and woven throw basket',
        ],
        industrial: [
          'vintage leather ottoman; slim metal wall shelf (surface-mounted)',
        ],
        midcentury: ['teak credenza; sputnik-inspired table lamp'],
        coastal: ['rattan accent chair; linen drapes (rod required)'],
        farmhouse: ['distressed wood console; ceramic jugs on tray'],
        standard: ['paired table lamps; classic framed print set'],
      },
      bedroom: {
        luxury: ['channel-tufted headboard; mirrored nightstands'],
        modern: ['floating nightstands; linear table lamps'],
        scandinavian: ['light-oak slat bench; knitted throw'],
        industrial: ['metal bedside lamps; trunk bench'],
        midcentury: ['spindle-leg nightstands; sunburst mirror'],
        coastal: ['woven bench; airy linen throw'],
        farmhouse: ['shaker dresser; quilted throw'],
        standard: ['classic landscape above headboard'],
      },
      dining_room: {
        luxury: [
          'velvet dining chairs with nailhead detail; crystal table lamp pair on sideboard',
        ],
        modern: ['slab-front sideboard; minimalist LED table lamp on buffet'],
        scandinavian: ['wishbone-style chairs; pale wool rug'],
        industrial: ['reclaimed wood buffet; metal accessories'],
        midcentury: ['oval table with tulip-base; graphic art print'],
        coastal: ['rattan chairs; driftwood centerpiece'],
        farmhouse: [
          'cross-back chairs; lantern-style table lamps on sideboard',
        ],
        standard: ['beveled mirror centered above sideboard'],
      },
    };

    const s = STYLE[furnitureStyle];
    const base = ROOM[roomType](s);
    const tweaks = ADJUST[roomType]?.[furnitureStyle] ?? [];
    const extras = s.extras ?? [];
    const pack = [...base, ...tweaks, ...extras];

    // Return a rich list; the model will select a subset (2–5 + decor) that fits.
    return pack.slice(0, 16);
  }
}

export const chatGPTService = new ChatGPTService();
