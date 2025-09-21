// src/services/chatgpt.service.ts
import OpenAI from 'openai';
import { RoomType, FurnitureStyle, StagingStage, StagingPlan, StagingStageConfig } from '../interfaces/upload.interface';

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

  // Helpers novas (dentro da classe)
  private normalizeText(s: string): string {
    return (s || '')
      .toLowerCase()
      .replace(/[^a-z0-9\s\-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }
  private matchesAny(text: string, needles: string[]): boolean {
    const h = this.normalizeText(text);
    return needles.some(n => h.includes(this.normalizeText(n)));
  }

  // Substitua o generateVirtualStagingPrompt inteiro por este
  async generateVirtualStagingPrompt(
    roomType: RoomType,
    furnitureStyle: FurnitureStyle
  ): Promise<string> {
    const roomLabel = this.getRoomTypeLabel(roomType);
    const styleLabel = this.getFurnitureStyleLabel(furnitureStyle);
    const styleTraits = this.getFurnitureStyleTraits(furnitureStyle);
    const plan = this.getRoomStagingPlan(roomType, furnitureStyle);

    // ----- ranges dinâmicos (ignorando wall decor) -----
    const [minMain, maxMain] = plan.mainPiecesRange;
    const [minComp, maxComp] = plan.complementaryRange;
    const totalMin = minMain + minComp;
    const totalMax = maxMain + maxComp;

    // ----- base de itens sugeridos pelo pacote (já evita peças muito grandes) -----
    const baseItems = this.getPackageCombination(
      roomType,
      furnitureStyle
    ).filter(
      i =>
        !/sideboard|credenza|large wardrobe|tall cabinet|wall unit|console table/i.test(
          i
        )
    );

    // ----- excluir wall decor de vez -----
    const isWallDecor = (t: string) =>
      /\b(frames?|framed|mirror|wall\s*art|print|pinboard|gallery)\b/i.test(t);
    const noWall = baseItems.filter(i => !isWallDecor(i));

    // ----- filtrar por categorias permitidas (apenas main + complementary) -----
    const allowedMain = plan.allowedMainItems ?? [];
    const allowedComp = plan.allowedComplementary ?? [];
    const mainCandidates = noWall.filter(i => this.matchesAny(i, allowedMain));
    const compCandidates = noWall
      .filter(i => this.matchesAny(i, allowedComp))
      .filter(i => !this.matchesAny(i, allowedMain)); // evita duplicar

    // Fallbacks defensivos caso alguma lista venha vazia
    const safeMain = mainCandidates.length
      ? mainCandidates
      : noWall.slice(0, 6);
    const safeComp = compCandidates.length
      ? compCandidates
      : noWall.slice(6, 12);

    // limitar número de sugestões listadas no prompt (não o que o modelo irá de fato colocar)
    const mainPicks = safeMain.slice(0, Math.max(3, Math.min(6, maxMain + 2)));
    const compPicks = safeComp.slice(0, Math.max(2, Math.min(6, maxComp + 2)));

    const mainBullets = mainPicks.map(i => `• ${i}`).join('\n');
    const compBullets = compPicks.map(i => `• ${i}`).join('\n');

    // Compose room-aware guidance lines
    const roomSafety = plan.roomSafetyNotes.length
      ? `\nROOM-SPECIFIC SAFETY:\n• ${plan.roomSafetyNotes.join('\n• ')}\n`
      : '';

    const styleEmphasis =
      (plan.styleEmphasis?.length ?? 0) > 0
        ? `\nStyle emphasis for ${styleLabel}: ${plan.styleEmphasis!.join('; ')}.\n`
        : '';

    const prompt = `Only add a few ${styleLabel} furniture and decor items to this ${roomLabel}. Maintain all other aspects of the original image.
Add approximately **${totalMin}–${totalMax} pieces total** based on the visible free floor area; pick fewer items if space is limited. This is STRICTLY additive virtual staging.

* If a kitchen island or counter with an overhang is visible, add **2–4 style-matched bar stools** with proper legroom and foot clearance; **skip** if space is tight. This is **STRICTLY additive**—do not modify counters or cabinetry.
* If the photo shows **multiple connected rooms/zones**, **furnish each zone appropriately** within its existing boundaries while preserving circulation; **do not** shift walls, openings, or camera framing.
* **Add one indoor plant** in a complementary planter to soften the composition; place only where it won’t block doors, windows, or stairs. This is **STRICTLY additive**—do not alter finishes or architectural elements.

PRESERVE PIXEL-FOR-PIXEL:
• Keep walls, paint color, trims, baseboards, floor, ceiling, pendant fixtures, STAIRS (newel, handrail, balusters, treads, risers), doors, windows, vents, outlets and switches IDENTICAL.
• Maintain the exact camera angle, framing, perspective lines and original lighting (direction, intensity, color temperature).
• No repainting, retexturing, relighting, cropping, expanding, cloning or geometry changes. No new curtains/blinds or window treatments.
• Do not add curtains or blinds unless an existing window is clearly visible; never create new windows or mounting hardware.

STAIR & CIRCULATION SAFETY:
• Treat the staircase and its landing as a PROTECTED NO-PLACEMENT ZONE — do not cover, occlude or replace any stair part.
• Keep clear passage around doors, along the stair run and landings; maintain at least 90 cm (36") of free circulation.
• Only place items where they physically fit in the visible floor area. If an item would overlap the stair, door swing, or a passage path, SKIP it.${roomSafety}

STYLE GUARDRAILS — ${styleLabel}:
${styleTraits}${styleEmphasis}

FURNISHING GUIDANCE — choose only from the allowed categories for this ${roomLabel} (no wall decor):
Main pieces (**add ${minMain}–${maxMain}**; prioritize fit and circulation):
${mainBullets}

Complementary accents (**add ${minComp}–${maxComp}**; keep subtle and functional):
${compBullets}

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
        mainPiecesRange: [3, 6],
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
        mainPiecesRange: [3, 6],
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
        mainPiecesRange: [3, 6], // table + 2–6 chairs (count as 1–3 main groups)
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
        mainPiecesRange: [3, 6],
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
        mainPiecesRange: [3, 6],
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

  // ========== NOVOS MÉTODOS PARA STAGING EM ETAPAS ==========

  /**
   * Gera um plano completo de staging em 5 etapas para um cômodo específico
   */
  generateStagingPlan(roomType: RoomType, furnitureStyle: FurnitureStyle): StagingPlan {
    const plan = this.getRoomStagingPlan(roomType, furnitureStyle);
    const roomLabel = this.getRoomTypeLabel(roomType);
    const styleLabel = this.getFurnitureStyleLabel(furnitureStyle);
    
    // Constantes globais que vão em TODAS as etapas
    const globalRules = [
      "HARD LOCK — mantenha piso, paredes, rodapés/guarnições, portas, janelas, bancadas/móveis fixos, teto e todas as cores idênticos; sem relighting/white-balance/hue/saturation/exposure changes.",
      "Sem wall decor (quadros, espelhos, prints) e sem cortinas/persianas em qualquer etapa."
    ];

    const roomSpecificRules = plan.roomSafetyNotes;

    // Versões curtas das categorias permitidas
    const allowedMainShort = plan.allowedMainItems.slice(0, 4).join(', ');
    const allowedCompShort = plan.allowedComplementary.slice(0, 4).join(', ');

    const stages: StagingStageConfig[] = [
      // Etapa 1: Âncora do ambiente (1 peça principal)
      {
        stage: 'anchor',
        minItems: 1,
        maxItems: 1,
        allowedCategories: plan.allowedMainItems,
        validationRules: ['count_main_items', 'no_wall_decor', 'no_window_treatments', 'circulation_clear'],
        prompt: this.generateStagePrompt('anchor', roomLabel, styleLabel, allowedMainShort, '', plan.mainPiecesRange, plan.complementaryRange, globalRules, roomSpecificRules)
      },
      
      // Etapa 2: Completar "main" até o mínimo
      {
        stage: 'complete_main',
        minItems: plan.mainPiecesRange[0],
        maxItems: plan.mainPiecesRange[1],
        allowedCategories: plan.allowedMainItems,
        validationRules: ['count_main_items', 'no_wall_decor', 'no_window_treatments', 'circulation_clear'],
        prompt: this.generateStagePrompt('complete_main', roomLabel, styleLabel, allowedMainShort, '', plan.mainPiecesRange, plan.complementaryRange, globalRules, roomSpecificRules)
      },
      
      // Etapa 3: Complementos mínimos (funcionais)
      {
        stage: 'minimal_complements',
        minItems: plan.complementaryRange[0],
        maxItems: plan.complementaryRange[0],
        allowedCategories: plan.allowedComplementary,
        validationRules: ['count_comp_items', 'no_wall_decor', 'no_window_treatments', 'circulation_clear', 'plant_placement'],
        prompt: this.generateStagePrompt('minimal_complements', roomLabel, styleLabel, '', allowedCompShort, plan.mainPiecesRange, plan.complementaryRange, globalRules, roomSpecificRules)
      },
      
      // Etapa 4: Expansão opcional (até o máximo)
      {
        stage: 'optional_expansion',
        minItems: 0,
        maxItems: plan.mainPiecesRange[1] + plan.complementaryRange[1],
        allowedCategories: [...plan.allowedMainItems, ...plan.allowedComplementary],
        validationRules: ['total_items_limit', 'no_wall_decor', 'no_window_treatments', 'circulation_clear', 'kitchen_stools'],
        prompt: this.generateStagePrompt('optional_expansion', roomLabel, styleLabel, allowedMainShort, allowedCompShort, plan.mainPiecesRange, plan.complementaryRange, globalRules, roomSpecificRules)
      },
      
      // Etapa 5: Polimento (sem adicionar nada)
      {
        stage: 'polish',
        minItems: 0,
        maxItems: 0,
        allowedCategories: [],
        validationRules: ['no_new_items', 'circulation_clear', 'positioning_refined'],
        prompt: this.generateStagePrompt('polish', roomLabel, styleLabel, '', '', plan.mainPiecesRange, plan.complementaryRange, globalRules, roomSpecificRules)
      }
    ];

    return {
      roomType,
      furnitureStyle,
      stages,
      globalRules,
      roomSpecificRules
    };
  }

  /**
   * Gera prompt específico para cada etapa
   */
  private generateStagePrompt(
    stage: StagingStage,
    roomLabel: string,
    styleLabel: string,
    allowedMainShort: string,
    allowedCompShort: string,
    mainRange: Range,
    compRange: Range,
    globalRules: string[],
    roomSpecificRules: string[]
  ): string {
    const [minMain, maxMain] = mainRange;
    const [minComp, maxComp] = compRange;
    const totalMax = maxMain + maxComp;

    const globalRulesText = globalRules.join('\n');
    const roomRulesText = roomSpecificRules.length > 0 ? `\nROOM-SPECIFIC SAFETY:\n• ${roomSpecificRules.join('\n• ')}` : '';

    switch (stage) {
      case 'anchor':
        return `${globalRulesText}

Adicione exatamente 1 peça principal permitida para este ${roomLabel} no estilo ${styleLabel}: ${allowedMainShort}.
Mantenha ≥90 cm de circulação; não cubra portas/escadas; sem wall decor e sem cortinas/persianas.
Se houver qualquer dúvida de espaço, não adicione.${roomRulesText}`;

      case 'complete_main':
        return `${globalRulesText}

Adicione peças principais uma a uma até ${minMain} main no total (incluindo as existentes). Itens elegíveis: ${allowedMainShort}.
HARD LOCK e circulação como antes; sem wall decor/cortinas; se houver dúvida, pare.${roomRulesText}`;

      case 'minimal_complements':
        return `${globalRulesText}

Adicione até ${minComp} complementos permitidos: ${allowedCompShort}.
Planta não deve bloquear portas/janelas/escadas; tapete deve ancorar a área sem invadir degraus.
HARD LOCK; sem wall decor/cortinas; pare se ficar denso.${roomRulesText}`;

      case 'optional_expansion':
        return `${globalRulesText}

Opcional: adicione itens um a um até ${totalMax} peças (máx. ${maxMain} main, ${maxComp} comp), somente se o espaço continuar claramente livre.
Regra da cozinha: se houver ilha com overhang, pode adicionar 2–4 bancos com folga; caso contrário, não adicione.
Zonas conectadas: mobiliar cada zona sem mover paredes/câmera.
HARD LOCK; sem wall decor/cortinas; pare ao primeiro sinal de densidade.${roomRulesText}`;

      case 'polish':
        return `${globalRulesText}

Não adicione novos itens. Refine sutilmente posição e escala das peças já inseridas para melhorar realismo e circulação.
HARD LOCK — arquitetura, câmera, iluminação e todas as cores idênticas.
Garanta: portas/escadas livres; tapete na proporção correta; planta bem posicionada; bancos com folga.${roomRulesText}`;

      default:
        throw new Error(`Unknown staging stage: ${stage}`);
    }
  }

  /**
   * Gera prompt para uma etapa específica com contexto atual
   */
  generateStageSpecificPrompt(
    stage: StagingStage,
    roomType: RoomType,
    furnitureStyle: FurnitureStyle,
    currentItemCount: number = 0
  ): string {
    const plan = this.generateStagingPlan(roomType, furnitureStyle);
    const stageConfig = plan.stages.find(s => s.stage === stage);
    
    if (!stageConfig) {
      throw new Error(`Stage configuration not found for: ${stage}`);
    }

    return stageConfig.prompt;
  }
}

export const chatGPTService = new ChatGPTService();
