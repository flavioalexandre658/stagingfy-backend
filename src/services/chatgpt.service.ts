// src/services/chatgpt.service.ts
import OpenAI from 'openai';
import { RoomType, FurnitureStyle } from '../interfaces/upload.interface';

class ChatGPTService {
  private openai: OpenAI;

  constructor() {
    this.openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }

  /**
   * Prompt final para flux-kontext-pro.
   * - Adição somente (pixel-preserving)
   * - Respeito estrito ao roomType (whitelist/blacklist por cômodo)
   * - Regras de circulação (escadas/portas/passagens)
   * - Estilo forçado + pacote inspiracional
   */
  async generateVirtualStagingPrompt(
    roomType: RoomType,
    furnitureStyle: FurnitureStyle
  ): Promise<string> {
    const roomLabel = this.getRoomTypeLabel(roomType);
    const styleLabel = this.getFurnitureStyleLabel(furnitureStyle);
    const styleTraits = this.getFurnitureStyleTraits(furnitureStyle);
    const packageItems = this.getPackageCombination(roomType, furnitureStyle);
    const rugVariants = this.getRugVariants(furnitureStyle);
    const guard = this.getRoomGuard(roomType); // whitelist/blacklist

    const prompt = [
      // ---- HEADLINE LOCKS (curtas, enfáticas) ----
      `Additive virtual staging ONLY for this ${roomLabel} in ${styleLabel} style.`,
      `Everything else must remain EXACTLY the same, pixel-for-pixel. Do not transform the room.`,
      `Keep ALL other aspects of the original image unchanged.`,
      '',
      // ---- HARD PRESERVATION ----
      'HARD PRESERVATION (non-negotiable):',
      '• Do NOT modify or replace: walls, paint, trims, baseboards, ceilings, beams, floors, stairs/railings, windows, blinds/curtains, doors/frames, openings, vents, sockets/switches, radiators, built-ins, or any existing furniture.',
      '• Do NOT add new doors/windows/openings or any built-in/ceiling fixture. No repainting or retexturing. No relighting. No crop/expand. No perspective changes.',
      '• Preserve camera angle, framing, vanishing lines, scale, and the exact lighting direction, intensity, and color temperature.',
      '',
      // ---- CIRCULATION ----
      'CIRCULATION & SAFETY:',
      '• Keep all passage routes clear: never block door swings, hallways, or staircase starts/landings.',
      '• Do not place consoles/tables in front of stair runs or intruding into obvious walk paths.',
      '• Add items ONLY if they physically fit in visible space; partial crops at the image edge are acceptable.',
      '',
      // ---- ROOM GUARD ----
      `ROOM GUARD — This scene IS a "${roomLabel}" and must remain a "${roomLabel}".`,
      `Allowed item families: ${guard.allowed.join(', ')}.`,
      `Forbidden in this room: ${guard.forbidden.join(', ')}.`,
      'If any requested item conflicts with these rules, SKIP it instead of changing the room.',
      '',
      // ---- STYLE ENFORCEMENT ----
      'STYLE ENFORCEMENT:',
      `${styleTraits}`,
      'All added items must clearly read as this style and feel cohesive/high-end.',
      '',
      // ---- SCOPE ----
      'SCOPE & QUANTITY:',
      '• Add 2–5 primary furniture pieces appropriate to this room.',
      '• Add 1–2 wall decorations ONLY on available blank wall areas (never over windows/doors and never invent surfaces).',
      '• Add 1–2 complementary elements (plant, lamp, cushions/throws, curated accessories).',
      '• If fewer items fit without violating any rule, add fewer. Never alter the scene to force fit.',
      '',
      // ---- RUG CATALOG ----
      'RUG (choose ONE that fits; the floor finish itself must remain unchanged):',
      ...rugVariants.map(r => `• ${r}`),
      '',
      // ---- PACKAGE (inspiration) ----
      'INSPIRATION (flexible; use only if it fits without breaking constraints):',
      ...packageItems.map(i => `• ${i}`),
      '',
      // ---- COMPOSITION ----
      'COMPOSITION:',
      '• Correct scale/shadows matching the existing light; no glow.',
      '• Anchor seating/dining/bed zones to the rug; keep walk paths open.',
      '• Hide cable clutter; styling elegant and minimal.',
      '',
      // ---- OUTPUT ----
      `OUTPUT: a photo-real, professionally staged ${roomLabel} in ${styleLabel} style,`,
      'with the original architecture and lighting fully intact. Add furniture and décor ONLY.',
    ].join('\n');

    return prompt;
  }

  // -------------------- labels --------------------
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

  // -------------------- style traits --------------------
  private getFurnitureStyleTraits(furnitureStyle: FurnitureStyle): string {
    const traits: Record<FurnitureStyle, string> = {
      standard:
        'Classic, timeless silhouettes; neutral palette (white, beige, warm gray); brushed nickel accents; balanced proportions; simple framed art.',
      modern:
        'Clean lines; neutral palette (greige, off-white, warm gray) with one muted accent; matte finishes; slim metal/wood legs; low-profile silhouettes; subtle texture layering.',
      scandinavian:
        'Light woods (oak/beech), airy fabrics, organic rounded forms; whites/ivories/beiges; cozy layered textiles; minimal yet warm; brushed steel/white accents.',
      industrial:
        'Raw wood + blackened steel; robust shapes; dark leather/fabric; exposed-joint vibe; charcoal/tobacco neutrals; cage/exposed-bulb lamps.',
      midcentury:
        'Tapered legs; warm walnut/teak; linen tweeds/bouclé; geometric patterns; bold accents (saffron/teal/olive); sleek functional forms.',
      luxury:
        'Plush velvets/silk-blends; tufted or sculptural seating; marble/glass tables; polished brass/champagne gold; statement lighting; curated art and objets.',
      coastal:
        'White/sand/driftwood; rattan and jute textures; soft blues/sea-glass greens; breezy linens; weathered wood; airy, sun-washed vibe.',
      farmhouse:
        'Warm whites and earthy browns; knotty/reclaimed woods; antique bronze/black metals; linen/canvas; gingham/simple stripes; cozy and lived-in.',
    };
    return traits[furnitureStyle];
  }

  // -------------------- rug variants --------------------
  private getRugVariants(style: FurnitureStyle): string[] {
    const scale =
      'size correctly: seating (front legs on rug), dining (all chair legs on when pulled back), bedroom (extend ~45–60cm beyond sides/foot).';

    const variants: Record<FurnitureStyle, string[]> = {
      luxury: [
        `hand-knotted silk/wool in soft ivory with subtle abstract veining — ${scale}`,
        `low-sheen viscose in warm greige with faint marble pattern — ${scale}`,
        `bordered wool in champagne with tone-on-tone damask — ${scale}`,
        `Persian-inspired fine weave in desaturated taupe/ivory — ${scale}`,
        `broadloom-cut rug with carved geometric relief in ivory — ${scale}`,
      ],
      modern: [
        `low-pile warm gray with oversized abstract geometry — ${scale}`,
        `flatweave greige with tone-on-tone stripe — ${scale}`,
        `micro-pattern off-white with soft shadow border — ${scale}`,
      ],
      scandinavian: [
        `wool Berber-style in ivory with light gray lattice — ${scale}`,
        `flatwoven cotton in pale beige with micro-check — ${scale}`,
        `hand-loomed oatmeal heather wool — ${scale}`,
      ],
      industrial: [
        `distressed charcoal with concrete-like texture — ${scale}`,
        `flatweave denim/charcoal with subtle herringbone — ${scale}`,
        `overdyed vintage in graphite — ${scale}`,
      ],
      midcentury: [
        `tufted warm beige with atomic/geom accents — ${scale}`,
        `cut-pile ivory with saffron border — ${scale}`,
        `low-pile with simple teal linework — ${scale}`,
      ],
      coastal: [
        `woven jute/sisal-look with cotton border (sand) — ${scale}`,
        `flatweave stripe in sea-salt blue and ivory — ${scale}`,
        `hand-loomed driftwood beige — ${scale}`,
      ],
      farmhouse: [
        `hand-loomed jute + wool blend in oatmeal — ${scale}`,
        `vintage-inspired floral in faded beige/olive — ${scale}`,
        `woven cotton with ticking-stripe — ${scale}`,
      ],
      standard: [
        `neutral low-pile warm gray with simple border — ${scale}`,
        `cut-pile beige with tone-on-tone pattern — ${scale}`,
        `flatwoven taupe with modest geometric motif — ${scale}`,
      ],
    };

    return variants[style];
  }

  // -------------------- room guard (whitelist/blacklist) --------------------
  private getRoomGuard(roomType: RoomType): {
    allowed: string[];
    forbidden: string[];
  } {
    const guardMap: Record<
      RoomType,
      { allowed: string[]; forbidden: string[] }
    > = {
      living_room: {
        allowed: [
          'sofas/sectionals',
          'armchairs/occasional chairs',
          'coffee tables',
          'side tables',
          'media consoles/credenzas (freestanding)',
          'floor/table lamps',
          'rugs',
          'plants',
          'framed artwork/mirrors',
          'decorative cushions/throws',
        ],
        forbidden: [
          'beds/headboards',
          'wardrobes/dressers',
          'dining tables and dining chair sets',
          'kitchen islands/appliances',
          'bathtubs/showers/toilets/vanities',
          'built-in ceiling fixtures or new windows/doors',
        ],
      },
      bedroom: {
        allowed: [
          'beds/headboards',
          'nightstands',
          'bedside lamps',
          'dressers/wardrobes (freestanding)',
          'benches/ottomans',
          'rugs',
          'plants',
          'framed artwork/mirrors',
          'one small accent chair with side table',
        ],
        forbidden: [
          'sofas/sectionals',
          'media consoles/TV walls',
          'dining tables/sets',
          'kitchen islands/appliances',
          'bathtubs/showers/toilets/vanities',
          'built-in ceiling fixtures or new windows/doors',
        ],
      },
      dining_room: {
        allowed: [
          'dining table',
          'dining chairs (4–8)',
          'sideboard/credenza',
          'rugs',
          'centerpiece vases',
          'framed art/mirrors',
          'plants',
          'floor/table lamps',
        ],
        forbidden: [
          'beds',
          'sofas/sectionals',
          'media consoles/TV walls',
          'kitchen/bath fixtures',
          'office desks',
          'built-in ceiling fixtures or new windows/doors',
        ],
      },
      home_office: {
        allowed: [
          'desk',
          'task/office chair',
          'bookcase/shelving',
          'low credenza',
          'task lamp',
          'rugs',
          'plants',
          'framed art/pinboard',
          'organizers (trays/boxes/bookends)',
        ],
        forbidden: [
          'beds',
          'sofas/sectionals',
          'dining sets',
          'kitchen/bath fixtures',
          'built-in ceiling fixtures or new windows/doors',
        ],
      },
      kitchen: {
        allowed: [
          'counter/island stools (if counter exists)',
          'small bistro/dinette set (only if space allows)',
          'countertop styling (trays, boards, bowls, herbs)',
          'runner rugs (overlay only)',
          'small framed prints',
          'plants/herbs',
        ],
        forbidden: [
          'sofas/sectionals',
          'beds',
          'dining tables for 6+ (use dining room instead)',
          'bath fixtures',
          'altering cabinetry/counters/backsplash or adding built-ins',
          'new ceiling fixtures or new windows/doors',
        ],
      },
      bathroom: {
        allowed: [
          'towel sets',
          'vanity accessories (soap dispenser/trays)',
          'small freestanding stool/caddy (only if space allows)',
          'small plants (fern/pothos)',
          'bath mat/rug overlay',
          'framed print or mirror (on existing free wall)',
          'laundry basket/hamper',
        ],
        forbidden: [
          'beds/sofas/dining/office furniture',
          'new sanitary ware (bathtub/vanity/shower/toilet)',
          'cabinetry changes',
          'new windows/doors/ceiling fixtures',
        ],
      },
      kids_room: {
        allowed: [
          'twin/bunk bed',
          'nightstand + small lamp',
          'desk + chair (rounded edges)',
          'bookcase/cubbies',
          'soft rug',
          'play baskets',
          'playful wall prints',
          'beanbag/floor cushion',
          'small plant (out of reach)',
        ],
        forbidden: [
          'sectionals/sofas',
          'dining sets',
          'kitchen/bath fixtures',
          'massive wardrobes that block circulation',
          'new windows/doors/ceiling fixtures',
        ],
      },
      outdoor: {
        allowed: [
          'outdoor lounge seating',
          'outdoor coffee/side tables',
          'outdoor rugs',
          'planters',
          'lanterns/string lights (freestanding)',
          'outdoor cushions/throws',
          'decor trays',
        ],
        forbidden: [
          'indoor beds/dining sets meant for interior',
          'kitchen/bath fixtures',
          'built-in pergolas/roofs',
          'new windows/doors/walls',
        ],
      },
    };

    return guardMap[roomType];
  }
  /**
   * Rich, contemporary furniture/decor packages for every RoomType + FurnitureStyle.
   * These are inspirations (flexible) and never override non-destructive rules.
   */
  private getPackageCombination(
    roomType: RoomType,
    furnitureStyle: FurnitureStyle
  ): string[] {
    // --- style materials library used inside lists ---
    const STYLE: Record<
      FurnitureStyle,
      { metal: string; wood: string; textile: string; accent: string }
    > = {
      standard: {
        metal: 'brushed nickel',
        wood: 'warm oak or walnut',
        textile: 'linen/cotton',
        accent: 'soft taupe',
      },
      modern: {
        metal: 'matte black or satin chrome',
        wood: 'light oak/ash',
        textile: 'matte weaves and bouclé',
        accent: 'muted clay/sand/sage',
      },
      scandinavian: {
        metal: 'brushed steel or white powder-coat',
        wood: 'pale oak/beech',
        textile: 'cotton/wool',
        accent: 'warm beige/muted green',
      },
      industrial: {
        metal: 'blackened steel/iron',
        wood: 'reclaimed walnut/pine',
        textile: 'leather, denim-weave, canvas',
        accent: 'cognac/rust',
      },
      midcentury: {
        metal: 'brass or black',
        wood: 'walnut/teak',
        textile: 'linen tweed, bouclé',
        accent: 'saffron/teal/olive',
      },
      luxury: {
        metal: 'polished brass/champagne gold',
        wood: 'dark walnut/ebony',
        textile: 'velvet and silk-blends',
        accent: 'merlot/deep emerald/navy',
      },
      coastal: {
        metal: 'weathered nickel/brushed brass',
        wood: 'whitewashed oak/rattan',
        textile: 'breezy linen/cotton',
        accent: 'sea-glass blue/green',
      },
      farmhouse: {
        metal: 'antique bronze/black',
        wood: 'knotty oak/reclaimed pine',
        textile: 'linen/canvas, soft knits',
        accent: 'sage/terracotta',
      },
    };

    const s = STYLE[furnitureStyle];

    const PACK: Record<RoomType, Record<FurnitureStyle, string[]>> = {
      // ---------------- LIVING ROOM ----------------
      living_room: {
        modern: [
          `3-seat or L-shaped sofa in ${s.textile} (greige) with slim ${s.metal} or wood legs`,
          `pair of accent armchairs with ${s.metal} details`,
          `stone or tempered-glass coffee table with minimal base`,
          `low media console in ${s.wood} with handle-less fronts; hide cables`,
          `arc or tripod floor lamp, fabric shade, dimmable`,
          `large abstract print above sofa (thin black/oak frame)`,
          `tall fiddle-leaf fig/ficus in matte cylinder planter`,
          `assorted cushions tone-on-tone plus ${s.accent} accent`,
          `slim side tables flanking sofa`,
        ],
        scandinavian: [
          `light-fabric sofa with tapered ${s.wood} legs`,
          `wishbone or shell accent chair in pale tone`,
          `round light-wood coffee table`,
          `${s.wood} media bench; minimal styling; hide cables`,
          `tripod floor lamp with fabric shade`,
          `2–3 minimalist prints in light frames above sofa`,
          `monstera/pothos in simple planter`,
          `soft knit throw and neutral cushions`,
        ],
        industrial: [
          `charcoal leather sofa with substantial arms`,
          `metal-frame sling chair in canvas`,
          `reclaimed-wood coffee table with ${s.metal} base`,
          `low metal console with wood shelves`,
          `industrial floor lamp with cage shade`,
          `large black-framed abstract/poster`,
          `concrete planter with hardy plant`,
          `leather ottoman for extra seating`,
        ],
        midcentury: [
          `walnut sofa with bench cushion + bolster pillows`,
          `pair of sculptural lounge chairs with tapered legs`,
          `round marble or walnut coffee table`,
          `low walnut credenza (sliding doors)`,
          `sputnik-inspired or tripod lamp (floor/table)`,
          `diptych geometric art in brass frames`,
          `rubber plant in ceramic pot`,
          `patterned cushions in ${s.accent} accents`,
        ],
        luxury: [
          `velvet tuxedo sofa or chaise sectional with piping`,
          `two channel-tufted armchairs with brass-capped legs`,
          `round/oval marble coffee table with ${s.metal} base`,
          `dark ${s.wood} credenza with brass hardware`,
          `pair of sculptural table lamps on side tables`,
          `large statement artwork with gold floater frame`,
          `silk/linen drapery if an existing rod is present (otherwise skip)`,
          `large ceramic planter with olive tree or ficus lyrata`,
          `curated coffee-table books, bowl, and small sculpture`,
        ],
        coastal: [
          `slipcovered sofa in performance linen (white/sand)`,
          `rattan or whitewashed accent chair`,
          `whitewashed wood coffee table`,
          `${s.wood} media console with airy styling`,
          `ceramic table lamps with linen shades`,
          `seascape/botanical print set in light frames`,
          `woven seagrass basket with throw`,
          `palm/olive tree in woven planter`,
        ],
        farmhouse: [
          `deep fabric sofa in warm neutral`,
          `cross-back or tufted club chair`,
          `solid-wood coffee table with rounded corners`,
          `shaker-style media cabinet in ${s.wood}`,
          `linen-shade floor lamp (antique bronze)`,
          `vintage landscape print in wood frame`,
          `woven basket with knitted throw`,
          `peace lily in ceramic pot`,
        ],
        standard: [
          `classic 3-seat sofa in neutral fabric`,
          `one accent chair with timeless silhouette`,
          `rectangular wood coffee table (${s.wood})`,
          `media cabinet with paneled fronts`,
          `pair of table lamps with pleated/fabric shades`,
          `large framed print above sofa`,
          `ficus/fern in simple planter`,
        ],
      },

      // ---------------- BEDROOM ----------------
      bedroom: {
        modern: [
          `queen/king bed with minimalist upholstered headboard in ${s.textile}`,
          `layered bedding (crisp duvet + quilt) with pillows in ${s.accent} accent`,
          `two floating or slab nightstands in ${s.wood}`,
          `pair of bedside lamps with ${s.metal} bases and fabric shades`,
          `low dresser/wardrobe in ${s.wood} with clean fronts`,
          `bench or ottoman at foot of bed (${s.textile} upholstery)`,
          `area rug sized to extend 45–60cm beyond bed sides`,
          `large abstract art centered above headboard`,
          `compact plant (rubber plant/peace lily) in matte pot`,
        ],
        scandinavian: [
          `light-wood bed frame with simple headboard`,
          `soft white/ivory bedding with textured knit throw`,
          `two light-wood nightstands`,
          `fabric bedside lamps in white`,
          `slim dresser in white or pale oak`,
          `sheer curtains if rod exists (otherwise skip)`,
          `wool/cotton rug in off-white`,
          `two small framed prints above bed`,
          `small monstera or fern`,
        ],
        industrial: [
          `metal or dark-wood bed with simple headboard`,
          `two nightstands with metal frames + reclaimed tops`,
          `industrial bedside lamps with exposed bulbs`,
          `dark woven rug with texture`,
          `dresser in black metal/wood mix`,
          `large black-framed poster above bed`,
          `snake plant in concrete planter`,
          `leather bench at foot of bed`,
        ],
        midcentury: [
          `walnut bed with panel headboard`,
          `tapered-leg nightstands in ${s.wood}`,
          `pair of cone or globe bedside lamps (brass/black)`,
          `linen tweed bedding with ${s.accent} cushions`,
          `low walnut dresser with round pulls`,
          `tufted bench at foot of bed`,
          `geom/art print set above headboard`,
          `rug with subtle geometric pattern`,
        ],
        luxury: [
          `upholstered king bed with channel-tufted headboard (velvet/silk-blend)`,
          `mirrored or brass-accent nightstands`,
          `sculptural bedside lamps (crystal/brass)`,
          `plush layered bedding with decorative pillows`,
          `dark ${s.wood} dresser with brass hardware`,
          `elegant bench at the foot of the bed`,
          `statement art or large framed mirror above headboard`,
          `silk/linen drapery if existing rod is present`,
          `fine wool/silk rug extending around bed`,
        ],
        coastal: [
          `white or driftwood bed with panel or rattan headboard`,
          `light linen bedding with sea-glass blue accents`,
          `two whitewashed nightstands`,
          `ceramic bedside lamps with linen shades`,
          `simple dresser in whitewashed ${s.wood}`,
          `woven bench or storage trunk at foot`,
          `botanical/seascape prints`,
          `jute or flatwoven rug`,
          `palm or olive in woven planter`,
        ],
        farmhouse: [
          `solid-wood bed with simple shaker headboard`,
          `linen/cotton bedding with quilted throw in ${s.accent}`,
          `two wooden nightstands with knob pulls`,
          `table lamps with linen shades (antique bronze)`,
          `wooden dresser with rustic hardware`,
          `upholstered bench at foot`,
          `vintage landscape print above bed`,
          `jute/wool rug`,
          `leafy plant in ceramic pot`,
        ],
        standard: [
          `upholstered or wood bed in neutral finish`,
          `two classic nightstands + matching lamps`,
          `neutral bedding with a couple of accent pillows`,
          `paneled dresser with framed mirror`,
          `simple framed artwork above bed`,
          `low-pile neutral rug`,
          `small plant or vase on dresser`,
        ],
      },

      // ---------------- KITCHEN (decor + stools/dinette only) ----------------
      kitchen: {
        modern: [
          `counter/island stools with ${s.metal} footrests and ${s.textile} seats (only if island/counter exists)`,
          `compact bistro/dinette set in ${s.wood}/${s.metal} if open space allows`,
          `styled counter vignette: wooden board + ceramic bowl + small vase`,
          `discreet tray with oils and salt-pepper set (${s.metal})`,
          `runner rug along prep/circulation zone (low-pile)`,
          `herb planters (basil/rosemary) near window/sill`,
          `single minimalist framed print (culinary/botanical)`,
        ],
        scandinavian: [
          `light-wood stools with simple seats (if counter exists)`,
          `small round light-wood table with two chairs if space allows`,
          `cutting boards leaned as styling + ceramic utensil jar`,
          `cotton runner in pale gray/beige`,
          `small potted herb in white pot`,
          `delicate line-art print`,
        ],
        industrial: [
          `metal stools with wood seats (counter present)`,
          `small bistro table with metal base if space allows`,
          `metal canisters + reclaimed wood board on counter`,
          `dark runner with subtle herringbone pattern`,
          `black-framed graphic print`,
        ],
        midcentury: [
          `moulded-seat stools with tapered legs (counter present)`,
          `compact round pedestal table with two chairs (if space)`,
          `wood/ceramic serving set in warm tones`,
          `low-pile rug with simple geometric border`,
          `abstract print with brass frame`,
        ],
        luxury: [
          `upholstered stools with ${s.metal} footrests (counter present)`,
          `small stone-top dinette with elegant chairs if space allows`,
          `marble tray with decanter + objets on counter`,
          `low-sheen runner in greige`,
          `fine framed artwork (culinary still life)`,
          `fresh flowers in glass vase`,
        ],
        coastal: [
          `rattan or white stools (counter present)`,
          `light wood dinette with slip seat chairs if space allows`,
          `woven tray with ceramics and fruit bowl`,
          `flatweave runner (sand/sea-salt stripe)`,
          `botanical print in light frame`,
          `small herb pots in whitewashed tray`,
        ],
        farmhouse: [
          `wood stools with cross-back or metal brace (counter present)`,
          `farmhouse table for breakfast nook if space allows`,
          `stoneware jars + wooden boards + wire basket`,
          `woven runner in oatmeal`,
          `vintage sign or produce print`,
        ],
        standard: [
          `simple stools with upholstered seats (counter present)`,
          `small round dinette if space allows`,
          `neutral runner, easy to clean`,
          `fruit bowl + utensil holder`,
          `one classic framed print`,
        ],
      },

      // ---------------- BATHROOM (add-on décor only) ----------------
      bathroom: {
        modern: [
          `coordinated towel set (bath/hand) in warm gray/white`,
          `vanity accessories: soap dispenser + tray (${s.metal}/${s.wood})`,
          `low-pile bath mat in tone-on-tone pattern`,
          `framed abstract print or mirror with thin black frame`,
          `fern/pothos in ceramic pot`,
          `small wooden stool or caddy if space allows`,
        ],
        scandinavian: [
          `white/ivory towel stack with knitted texture`,
          `light-wood tray with ceramics`,
          `flatwoven mat in pale beige`,
          `two small line-art prints in light frames`,
          `pothos plant`,
          `lean ladder rack in pale wood (freestanding)`,
        ],
        industrial: [
          `dark/striped towels neatly folded`,
          `black metal tray with amber bottles`,
          `textured mat in charcoal`,
          `black-framed typographic print`,
          `snake plant in concrete pot`,
        ],
        midcentury: [
          `neutral towels with color-edge in ${s.accent}`,
          `walnut accessory set and tray`,
          `low-pile rug with small geometric motif`,
          `sunburst or rounded mirror (freestanding lean if possible)`,
          `compact plant in ceramic pot`,
        ],
        luxury: [
          `plush towel stack + robes`,
          `marble tray with diffuser and crystal jar`,
          `fine wool-look mat in champagne/ivory`,
          `framed art or beveled mirror with ${s.metal} frame`,
          `orchid/fern in elegant pot`,
        ],
        coastal: [
          `white towels with sea-glass trim`,
          `woven tray with shells/ceramic jars`,
          `flatweave mat (sand)`,
          `botanical print in light frame`,
          `small palm/fern`,
        ],
        farmhouse: [
          `oatmeal towels with stripe`,
          `galvanized tray with mason jars`,
          `woven mat in natural jute look`,
          `vintage-style print`,
          `small plant in ceramic crock`,
        ],
        standard: [
          `neutral towel set neatly folded`,
          `simple soap dispenser and tray`,
          `low-pile mat in beige/gray`,
          `one framed print`,
          `small fern/pothos`,
        ],
      },

      // ---------------- DINING ROOM ----------------
      dining_room: {
        modern: [
          `rectangular/oval dining table with ${s.wood} or stone top`,
          `4–6 streamlined upholstered chairs with ${s.metal} accents`,
          `area rug sized for chairs to pull back while fully on rug`,
          `low-profile sideboard in ${s.wood}; styled with sculptural bowl/books`,
          `wall art or large mirror proportional to table width`,
          `centerpiece: glass or ceramic vase with branches`,
          `subtle window treatment (sheer/linen) only if rod exists`,
        ],
        scandinavian: [
          `light-wood table with rounded corners`,
          `4–6 spindle or wishbone-style chairs`,
          `pale wool rug under table`,
          `sideboard in pale oak with simple styling`,
          `two minimalist prints in light frames`,
          `clear glass vase with greenery`,
        ],
        industrial: [
          `wood slab table with black metal base`,
          `metal or leather chairs`,
          `dark low-pile rug`,
          `metal/wood buffet`,
          `black-framed graphic art`,
          `centerpiece with metal bowl and branches`,
        ],
        midcentury: [
          `oval table with walnut top`,
          `tapered-leg upholstered chairs`,
          `rug with subtle geometric border`,
          `low walnut credenza`,
          `starburst or geom art set`,
          `ceramic centerpiece in ${s.accent}`,
        ],
        luxury: [
          `stone or high-gloss dark wood table`,
          `velvet dining chairs with piping and brass caps`,
          `fine wool/silk rug sized for full chair movement`,
          `elegant sideboard in dark ${s.wood} with ${s.metal} hardware`,
          `large framed artwork or beveled mirror`,
          `crystal vase centerpiece with florals`,
          `silk/linen drapery if rod exists`,
        ],
        coastal: [
          `whitewashed or driftwood dining table`,
          `rattan/linen chairs`,
          `flatweave rug (sand/sea-salt)`,
          `light sideboard with woven baskets`,
          `botanical prints in light frames`,
          `clear vase with beach grass`,
        ],
        farmhouse: [
          `farmhouse table with plank top`,
          `cross-back or slip seat chairs`,
          `jute/wool rug`,
          `wooden sideboard with pottery`,
          `vintage landscape print or simple mirror`,
          `stoneware pitcher centerpiece`,
        ],
        standard: [
          `classic rectangular dining table (${s.wood})`,
          `4–6 upholstered chairs`,
          `neutral bordered rug`,
          `paneled sideboard`,
          `large framed print`,
          `simple vase centerpiece`,
        ],
      },

      // ---------------- HOME OFFICE ----------------
      home_office: {
        modern: [
          `slab/floating desk with cable management, top in ${s.wood}`,
          `ergonomic chair with clean silhouette (${s.textile})`,
          `sleek task lamp in ${s.metal}`,
          `open shelving or low credenza in ${s.wood}`,
          `low-pile rug defining desk zone`,
          `abstract print or pinboard`,
          `snake plant/zz plant in matte pot`,
          `organizers: trays, bookends, storage boxes`,
        ],
        scandinavian: [
          `light-wood desk with tapered legs`,
          `comfortable upholstered task chair`,
          `fabric-shade lamp in white`,
          `pale oak open shelving`,
          `soft rug and knitted throw on chair`,
          `two small prints in light frames`,
          `monstera/fern in light pot`,
        ],
        industrial: [
          `wood-and-metal desk with robust base`,
          `leather or metal-frame chair`,
          `industrial task lamp with cage detail`,
          `black metal shelf`,
          `dark rug with subtle texture`,
          `black-framed poster`,
          `concrete planter plant`,
        ],
        midcentury: [
          `walnut writing desk with drawer`,
          `iconic task chair with tapered legs`,
          `cone/globe desk lamp (brass/black)`,
          `low walnut credenza`,
          `rug with simple geometric border`,
          `geom art pair`,
          `rubber plant in ceramic pot`,
        ],
        luxury: [
          `executive desk with ${s.metal} accents`,
          `leather executive chair`,
          `sculptural desk lamp in ${s.metal}`,
          `dark ${s.wood} bookcase/credenza`,
          `fine wool rug`,
          `large framed artwork`,
          `decor: crystal/metal accessories and books`,
          `orchid/olive in elegant planter`,
        ],
        coastal: [
          `white/light-wood desk`,
          `linen-upholstered chair`,
          `simple lamp with linen shade`,
          `rattan shelf or light bookcase`,
          `flatweave rug (sand/ivory)`,
          `botanical print`,
          `palm/fern in woven basket`,
        ],
        farmhouse: [
          `solid-wood desk with visible grain`,
          `fabric/leather task chair`,
          `lamp with linen shade (antique bronze)`,
          `shaker bookshelf`,
          `jute rug`,
          `nature print`,
          `ceramic crock with greenery`,
        ],
        standard: [
          `clean-lined desk in ${s.wood}`,
          `ergonomic chair in neutral fabric`,
          `simple task lamp`,
          `bookcase or low cabinet`,
          `neutral rug`,
          `framed print`,
          `small plant`,
        ],
      },

      // ---------------- KIDS ROOM ----------------
      kids_room: {
        modern: [
          `twin bed with neutral bedding and playful ${s.accent} cushion`,
          `nightstand with soft-glow lamp in ${s.metal}`,
          `rounded-edge desk + chair in ${s.wood}`,
          `bookshelf or cubby storage with labeled bins`,
          `soft area rug (low-pile) with simple pattern`,
          `wall prints (animals/letters)`,
          `toy storage baskets (woven)`,
          `cozy reading nook with floor cushion`,
          `small plant in safe spot (pothos out of reach)`,
        ],
        scandinavian: [
          `light-wood bed with white bedding and pastel throw`,
          `small night table, white or pale wood`,
          `compact desk with tapered legs`,
          `open cubbies with fabric bins`,
          `ivory cotton rug, soft underfoot`,
          `simple line-art prints`,
          `wicker basket for toys`,
        ],
        industrial: [
          `metal bed frame with durable bedding`,
          `locker-style nightstand`,
          `desk with metal legs and wood top`,
          `industrial shelf with bins`,
          `flatweave rug in charcoal with stripe`,
          `poster-style wall art`,
        ],
        midcentury: [
          `walnut bed with playful colored pillow in ${s.accent}`,
          `tapered-leg nightstand`,
          `desk with rounded corners`,
          `bookcase with sliding doors`,
          `rug with simple geometric motif`,
          `retro-inspired prints`,
        ],
        luxury: [
          `upholstered bed or small canopy with elegant trim`,
          `mirrored/nightstand with brass knob`,
          `plush bedding with decorative cushions`,
          `tufted bench or accent chair`,
          `fine soft rug in ivory`,
          `framed whimsical art`,
          `decorative storage boxes`,
        ],
        coastal: [
          `white panel or rattan bed`,
          `night table with beadboard detail`,
          `small desk in whitewashed wood`,
          `woven baskets`,
          `flatweave rug (sand/blue stripe)`,
          `seaside-themed prints`,
        ],
        farmhouse: [
          `shaker-style bed in warm white`,
          `wood nightstand with knob`,
          `desk with cross braces`,
          `cubby storage with wicker bins`,
          `jute/cotton rug`,
          `vintage animal/letter prints`,
        ],
        standard: [
          `twin bed with neutral bedding`,
          `simple nightstand + lamp`,
          `small desk + chair`,
          `bookcase/cubbies`,
          `neutral rug`,
          `two framed prints`,
        ],
      },

      // ---------------- OUTDOOR ----------------
      outdoor: {
        modern: [
          `outdoor sofa/lounge chairs with weatherproof ${s.textile} cushions`,
          `powder-coated ${s.metal} or ${s.wood} coffee/side tables`,
          `outdoor rug (UV-resistant) in subtle geometry`,
          `planters with structured greenery (olive tree/fern/grass)`,
          `lanterns (battery/LED) in ${s.metal}`,
          `outdoor cushions in ${s.accent}`,
          `tray with decor (ceramic/teak)`,
        ],
        scandinavian: [
          `light-wood/metal chair set with pale cushions`,
          `small round table`,
          `woven outdoor rug in ivory/beige`,
          `planters with soft greenery`,
          `throw blanket and small lantern`,
        ],
        industrial: [
          `metal-framed lounge set with neutral cushions`,
          `compact metal table`,
          `dark outdoor rug`,
          `concrete planters with hardy plants`,
          `cage-style lantern`,
        ],
        midcentury: [
          `low lounge chairs with tapered legs`,
          `round table with slim base`,
          `rug with simple geometric border`,
          `planters in ceramic with olive/ficus`,
          `retro lantern or table light`,
        ],
        luxury: [
          `woven rattan sectional with plush cushions`,
          `marble/composite-top coffee table with ${s.metal} base`,
          `elegant outdoor rug in greige`,
          `large planters with layered greenery`,
          `metal/glass lantern set`,
          `accent cushions in ${s.accent}`,
        ],
        coastal: [
          `whitewashed or rattan lounge chairs`,
          `round side table`,
          `striped outdoor rug (sand/blue)`,
          `palms and grasses in woven planters`,
          `string lights/lanterns`,
        ],
        farmhouse: [
          `wooden bench or rockers with natural cushions`,
          `small wooden side table`,
          `jute-look outdoor rug`,
          `terracotta planters`,
          `lantern with warm light`,
        ],
        standard: [
          `simple outdoor bistro/lounge set`,
          `neutral outdoor rug`,
          `two planters with greenery`,
          `small lantern`,
        ],
      },
    };

    return PACK[roomType]?.[furnitureStyle] ?? [];
  }
}

export const chatGPTService = new ChatGPTService();
