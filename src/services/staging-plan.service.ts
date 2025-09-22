import {
  RoomType,
  FurnitureStyle,
  StagingStage,
  StagingPlan,
  StagingStageConfig,
} from '../interfaces/upload.interface';

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

class StagingPlanService {
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
        // ↑ Ajustei ranges para compor melhor cenários pequenos a grandes
        // (mantém margem para o seu sampler escolher 5 e ainda ficar coerente)
        mainPiecesRange: [3, 5],
        wallDecorRange: [1, 2],
        complementaryRange: [3, 6],

        allowedMainItems: [
          // Seating (âncora)
          'modular sectional or curved sofa (low-profile)',
          'compact 2–3 seat sofa',
          'loveseat (1.5–2 seat, low-profile)',
          'daybed (low-profile, freestanding)',
          'chaise lounge (freestanding)',
          'accent barrel or bouclé swivel chair (1–2)',
          'pair of lounge chairs',
          'lounge chair with ottoman',

          // Mesas e apoio
          'nesting coffee tables (travertine/stone/smoked glass)',
          'plinth or pedestal coffee table',
          'waterfall coffee table (stone or wood)',
          'pedestal/cylinder side tables (single or nesting)',
          'C-shaped side table (sofa arm)',

          // Armazenagem/linha baixa
          'low-profile media console (fluted wood or matte lacquer)',
          'slim credenza (low, flush-front)',
          'slim bookcase/etagere',
          'corner bookcase (slim)',
          'console table behind sofa (≤ 35 cm deep)',
          'open shelving room divider (low, freestanding)',

          // Extra funcional
          'storage ottoman or upholstered bench',
          'bar cart (freestanding, with casters)',
          'record console / slim media cabinet',
        ],

        allowedWallDecor: [
          // Art & mirrors
          'large framed artwork (abstract/botanical)',
          'oversized round or pill mirror',
          'paired framed prints (diptych)',
          'triptych framed set',
          'balanced gallery wall set (3–5 small frames)',
          'picture ledge with framed art (surface-mounted)',
          'slim floating shelves (surface-mounted, shallow)',
          'sculptural wall relief (lightweight, surface-mounted)',
          'textile/tapestry wall hanging (lightweight)',

          // Lighting (não hardwired)
          'plug-in wall sconces (pair, no hardwiring)',
          'plug-in picture light over artwork',

          // Window treatments — SOMENTE onde houver janela existente
          'sheer or linen curtains on rod or ceiling track (existing windows only)',
          'double-layer curtains (sheer + blackout) on existing windows',
          'roman shade on existing window (inside or outside mount)',
          'roller shade on existing window (inside or outside mount)',
          'curtain rod or track hardware mounted above existing window (no new openings)',
        ],

        allowedComplementary: [
          // Tapetes e camadas
          'large area rug anchoring front legs of seating',
          'layering rug (smaller rug layered over base rug)',

          // Iluminação
          'arc floor lamp or slim linear floor lamp',
          'reading/task floor lamp (slim)',
          'table lamps (pair) on side tables/console',

          // Têxteis e conforto
          'textured pillows and throw blanket (bouclé/linen)',
          'pouf or small ottoman',

          // Plantas e objetos
          'indoor plant (olive tree/fiddle-leaf) in matte planter',
          'small tabletop plant in ceramic pot',
          'ceramic/stone vases, bowls, trays',
          'decorative object/sculpture on coffee table',
          'coffee table books stack',
          'woven basket for throws or magazines',
          'tray on ottoman or coffee table (drinks/books)',
          'blanket ladder (freestanding, leaning)',
          'LED candle holders/lanterns (freestanding)',
          'speaker on stand / vinyl holder (freestanding)',
        ],

        roomSafetyNotes: [
          'Keep a clear seating circulation path (at least one side of the seating open)',
          'Do not block balcony/door thresholds with furniture',
          'Maintain ≥ 90 cm (36") of clear passage around primary seating and door swings',
          'Keep lighting cords managed; do not span cords across walk paths',
        ],
      },

      bedroom: {
        mainPiecesRange: [2, 4],
        wallDecorRange: [1, 2],
        complementaryRange: [2, 4],
        allowedMainItems: [
          'platform bed (upholstered/wood, channel-tufted optional)',
          'nightstands (pair or single)',
          'low dresser (6–8 drawers) or slim wardrobe',
          'bench or storage bench at foot of bed',
          'accent chair or chaise (if space)',
          'vanity/desk with stool (if space)',
        ],
        allowedWallDecor: [
          'framed artwork above headboard (single or pair)',
          'oversized round/arched mirror above dresser',
          'paired framed prints over nightstands',
          'picture ledge for art/photos (surface-mounted)',
          'plug-in sconces above nightstands (pair)',
        ],
        allowedComplementary: [
          'bedside lamps (pair)',
          'area rug extending beyond bed sides/foot',
          'freestanding leaner floor mirror',
          'layered bedding + decorative pillows/throw',
          'plant in neutral pot',
          'tray + small decorative objects on dresser',
          'lidded laundry hamper (compact)',
        ],
        roomSafetyNotes: [
          'Keep door swings and closet access fully clear',
          'Do not cover power outlets or switches with furniture fronts',
        ],
      },

      kitchen: {
        mainPiecesRange: [1, 3],
        wallDecorRange: [0, 1],
        complementaryRange: [1, 3],
        allowedMainItems: [
          'counter or island stools (2–4; backless/low-back)',
          'compact bistro/café set (small round table + 2 chairs)',
          'narrow bar table with 2 stools (freestanding)',
          'bar cart on casters (freestanding)',
        ],
        allowedWallDecor: [
          'small framed print on free wall surface',
          'modern wall clock',
          'slim picture ledge (surface-mounted, shallow)',
        ],
        allowedComplementary: [
          'low-pile runner rug along prep/circulation zone',
          'floor plant in corner (compact, away from work zones)',
          'tabletop bowl/vase on bistro/bar table (not on countertops)',
          'seat cushions for stools',
        ],
        roomSafetyNotes: [
          'Do not place items that obstruct cabinet/appliance doors or walking lanes',
          'Keep cooktop and sink areas unobstructed',
        ],
      },

      bathroom: {
        mainPiecesRange: [0, 1],
        wallDecorRange: [0, 1],
        complementaryRange: [2, 4],
        allowedMainItems: [
          'small stool (wood/stone)',
          'slim console table (narrow, freestanding)',
          'freestanding ladder towel rack',
          'slim freestanding shelving tower',
        ],
        allowedWallDecor: [
          'small framed print on free wall',
          'auxiliary mirror (if free wall)',
          'slim wall shelf above toilet (surface-mounted)',
        ],
        allowedComplementary: [
          'coordinated towels (bath/hand/face)',
          'vanity tray with soap dispenser and jar',
          'low-pile bath mat',
          'small humidity-tolerant plant',
          'compact lidded hamper',
          'reed diffuser or LED candle',
        ],
        roomSafetyNotes: [
          'Keep fixtures (toilet, vanity, shower) fully visible and unobstructed',
          'Do not place items that could block door swing or shower entry',
        ],
      },

      dining_room: {
        mainPiecesRange: [1, 2],
        wallDecorRange: [1, 2],
        complementaryRange: [2, 4],

        allowedMainItems: [
          // Mesas
          'extendable dining table (light oak or walnut top, slim legs)',
          'rectangular dining table with matte ceramic top',
          'round pedestal dining table (white oak or marble top)',

          // Assentos
          'set of dining chairs (4–8; upholstered fabric or cane back in neutral tones)',
          'bench with cushion for one side (oak or walnut base)',
          'counter stools for nearby dining bar (wood frame, fabric seat)',

          // Armazenagem e apoio
          'slim sideboard in matching wood tone',
          'wine cabinet or slim bar console (glass doors, wood frame)',
        ],

        allowedWallDecor: [
          'large framed abstract artwork in muted tones',
          'round oak-framed mirror proportional to table width',
          'minimal floating shelf (oak, max 20cm deep)',
          'pair of slim wall sconces in matte black or brushed brass',
        ],

        allowedComplementary: [
          'area rug sized to cover table + chairs pulled back (neutral wool or jute)',
          'ceramic vase centerpiece with seasonal greenery',
          'linen table runner in muted color',
          'pair of buffet lamps with fabric shades',
          'corner plant in tall ceramic planter',
          'compact bar cart in matching wood/metal finish',
        ],

        roomSafetyNotes: [
          'Keep chairs fully usable; do not push table too close to walls/doors',
          'Maintain clear path around table perimeter',
        ],
      },

      home_office: {
        mainPiecesRange: [2, 3],
        wallDecorRange: [0, 2],
        complementaryRange: [2, 4],
        allowedMainItems: [
          'sit-stand desk (freestanding)',
          'ergonomic task chair',
          'guest chair or lounge chair',
          'low credenza',
          'bookcase or shelving unit',
          'slim filing cabinet',
        ],
        allowedWallDecor: [
          'framed artwork/photography',
          'whiteboard or cork board',
          'pegboard organizer',
          'floating shelves (surface-mounted, shallow)',
          'decorative acoustic panels',
        ],
        allowedComplementary: [
          'task desk lamp',
          'floor lamp',
          'area rug under chair/desk zone',
          'plant (snake plant/ZZ)',
          'desktop organizers (trays/risers/boxes)',
          'monitor stand',
          'cable management box',
        ],
        roomSafetyNotes: [
          'Keep cable management tidy; do not block outlets',
          'Do not place furniture obstructing door or window opening',
        ],
      },

      kids_room: {
        mainPiecesRange: [2, 4],
        wallDecorRange: [1, 2],
        complementaryRange: [2, 4],
        allowedMainItems: [
          'twin/full bed or bunk bed (if space)',
          'nightstand',
          'small desk + chair',
          'bookshelf or cubby storage',
          'toy organizer/shelf',
          'storage bench or reading bench',
        ],
        allowedWallDecor: [
          'playful framed prints (animals/letters)',
          'name/initial framed art',
          'shatterproof mirror at safe height',
          'picture ledge for books (shallow)',
          'peg rail with hooks (surface-mounted)',
        ],
        allowedComplementary: [
          'soft area rug',
          'toy baskets/bins',
          'beanbag or floor cushion',
          'reading teepee or freestanding canopy',
          'table lamp or night light',
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
        complementaryRange: [2, 4],
        allowedMainItems: [
          'modular outdoor sectional',
          'pair of lounge chairs',
          'outdoor coffee table',
          'bistro set (2-seat) or small dining set',
          'chaise lounge (single or pair)',
          'freestanding cantilever umbrella',
        ],
        allowedWallDecor: [
          'outdoor-safe wall art',
          'shatterproof outdoor mirror (if suitable)',
          'wall planter rack (surface-mounted)',
        ],
        allowedComplementary: [
          'UV-resistant outdoor rug',
          'planters with greenery (varied heights)',
          'lanterns or string lights on freestanding posts',
          'outdoor cushions and throws',
          'small side tables',
          'decor tray for table',
        ],
        roomSafetyNotes: [
          'Keep door thresholds and balcony edges unobstructed',
          'Do not place items near unsafe edges or blocking emergency egress',
        ],
      },
    };

    // Style emphasis (light touch, avoids forcing structure)
    const styleEmphasisByStyle: Record<FurnitureStyle, string[]> = {
      standard: [
        'balanced proportions',
        'warm neutral palette (greige/warm gray)',
        'oak/walnut veneers',
        'brushed nickel hardware',
        'cotton/linen weaves',
        'tone-on-tone patterns (subtle herringbone/chevron)',
        'soft rounded edges',
      ],
      modern: [
        'clean lines, low-profile silhouettes',
        'matte finishes (lacquer/powder-coat)',
        'matte black or satin chrome accents',
        'smoked glass or stone tops',
        'fluted wood details',
        'integrated soft curves (2025 trend)',
      ],
      scandinavian: [
        'light woods (oak/beech)',
        'airy whites/creams with soft pastels',
        'bouclé/wool knits, cozy layers',
        'organic curves, minimal ornament',
        'stoneware/ceramic accents',
        'light, natural textures',
      ],
      industrial: [
        'blackened steel/iron',
        'raw or reclaimed wood',
        'concrete/stone textures',
        'charcoal/ink/tobacco neutrals',
        'exposed joinery, robust forms',
        'leather/canvas accents',
      ],
      midcentury: [
        'tapered legs, slim profiles',
        'walnut/teak wood tones',
        'mustard/teal/olive accents',
        'linen tweed/bouclé textiles',
        'geometric/atomic motifs',
        'brass or black hardware',
      ],
      luxury: [
        'velvet/silk-blend, high-pile textiles',
        'polished brass/champagne gold',
        'marble or mirrored surfaces',
        'rich neutrals with jewel accents',
        'sculptural silhouettes',
        'fine ribbed glass/fluted details',
      ],
      coastal: [
        'white/sand/driftwood palette',
        'soft blue/seafoam accents',
        'rattan/jute textures',
        'weathered/whitewashed woods',
        'linen/cotton textiles',
        'subtle stripes, airy botanicals',
      ],
      farmhouse: [
        'warm whites and earth tones',
        'reclaimed/knotty woods',
        'shaker profiles',
        'black/antique bronze hardware',
        'hand-thrown ceramics/stoneware',
        'gingham/ticking stripes',
      ],
    };

    const plan = baseByRoom[roomType];

    return {
      ...plan,
      styleEmphasis: styleEmphasisByStyle[furnitureStyle],
    };
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

  // ========== NOVO MÉTODO (refinado): orientação dinâmica de estilo ==========
  /**
   * Bloco detalhado de estilo (paleta, materiais, silhueta, hardware, evitar, exemplos).
   * É anexado ao final do prompt dos stages "foundation" e "complement".
   * Foco: alta precisão de estilização + bloqueio de cores indesejadas (ex. azul/navy).
   */
  private buildDynamicStyleGuidance(
    furnitureStyle: FurnitureStyle,
    roomType: RoomType,
    stage: StagingStage
  ): string {
    type StyleDetail = {
      palette: string[]; // cores preferidas
      paletteAccents?: string[]; // acentos permitidos
      blockedColors?: string[]; // cores proibidas explícitas
      materials: string[]; // materiais/acabamentos
      silhouettes: string[]; // forma/perfil
      details?: string[]; // detalhes de construção/acabamento
      hardware?: string[]; // metal/ferragem
      patterns?: string[]; // padrões têxteis
      avoid: string[]; // elementos a evitar (inclui cores indesejadas)
      examplesMain?: string[]; // exemplos para foundation
      examplesComplementary?: string[]; // exemplos para complement
    };

    const profile: Record<FurnitureStyle, StyleDetail> = {
      standard: {
        palette: ['warm greige', 'taupe', 'soft warm gray', 'cream', 'ecru'],
        paletteAccents: ['muted olive', 'warm beige'],
        blockedColors: ['navy', 'cobalt blue', 'electric blue', 'icy blue'],
        materials: [
          'oak/walnut veneer',
          'solid oak legs',
          'linen/cotton weaves',
          'brushed nickel',
        ],
        silhouettes: [
          'soft rounded edges',
          'balanced proportions',
          'box cushions (medium firmness)',
        ],
        details: [
          'edge radius 10–25 mm',
          'top-stitch seams',
          'tone-on-tone piping',
        ],
        hardware: ['brushed nickel', 'matte black (limited)'],
        patterns: ['subtle herringbone', 'micro-chevron', 'tone-on-tone weave'],
        avoid: [
          'high-gloss brass glam',
          'neon colors',
          'ornate carvings',
          'heavy tufting',
        ],
        examplesMain: [
          'sofa in greige linen',
          'rectangular wood/stone coffee table',
        ],
        examplesComplementary: [
          'neutral area rug',
          'linen pillows',
          'ceramic vases',
        ],
      },
      modern: {
        palette: ['greige', 'taupe', 'warm gray', 'cream', 'earthy charcoal'],
        paletteAccents: ['desaturated olive', 'warm sand'],
        blockedColors: [
          'blue upholstery',
          'navy',
          'steel-blue',
          'cold gray fabric',
        ],
        materials: [
          'matte lacquer',
          'powder-coated metal',
          'smoked glass',
          'stone (travertine/basalt)',
        ],
        silhouettes: [
          'clean lines',
          'low-profile',
          'rectilinear with soft curves',
          'thin sled or blade legs',
        ],
        details: [
          'flush fronts',
          'shadow gaps',
          'fluted wood panels (limited)',
        ],
        hardware: ['matte black', 'satin chrome'],
        patterns: ['plain weave', 'micro-texture (no bold prints)'],
        avoid: [
          'rustic distressing',
          'farmhouse cross-bucks',
          'heavy ornament',
          'chromed mirror-finish overload',
        ],
        examplesMain: [
          'low-profile sofa in taupe',
          'smoked-glass coffee table',
        ],
        examplesComplementary: [
          'lean floor lamp',
          'minimal low-pile rug',
          'black metal side table',
        ],
      },
      scandinavian: {
        palette: [
          'white',
          'cream',
          'light oak',
          'beech',
          'warm gray',
          'soft pastel accents',
        ],
        paletteAccents: ['sage', 'dusty pink (very subtle)'],
        blockedColors: ['navy', 'cobalt', 'high-saturation jewel tones'],
        materials: [
          'bouclé/wool',
          'oiled light wood',
          'stoneware',
          'cotton-linen',
        ],
        silhouettes: [
          'organic curves',
          'minimal ornament',
          ' airy forms',
          'tapered round legs',
        ],
        details: ['visible wood grain', 'softly rounded corners'],
        hardware: ['light wood pulls', 'matte white/black minimal'],
        patterns: ['fine stripes', 'subtle checks', 'knit textures'],
        avoid: ['dark heavy woods', 'mirrored glam', 'heavy tufting'],
        examplesMain: [
          'sofa with light-oak legs',
          'round pedestal coffee table in light wood',
        ],
        examplesComplementary: ['jute rug', 'linen throw', 'potted olive tree'],
      },
      industrial: {
        palette: ['charcoal', 'ink', 'tobacco', 'warm gray', 'rust brown'],
        paletteAccents: ['aged brass (subtle)'],
        blockedColors: ['bright white glossy', 'pastels', 'navy velvet'],
        materials: [
          'blackened steel',
          'raw/reclaimed wood',
          'concrete/stone',
          'oiled leather',
        ],
        silhouettes: ['robust forms', 'exposed joinery', 'square tube frames'],
        details: ['visible welds (clean)', 'bolted brackets'],
        hardware: ['blackened steel', 'antique brass'],
        patterns: ['distressed leather grain', 'muted geometric weaves'],
        avoid: ['delicate ornament', 'bright whites', 'romantic/glam cues'],
        examplesMain: ['steel-frame coffee table', 'leather lounge chair'],
        examplesComplementary: ['muted-pattern rug', 'industrial floor lamp'],
      },
      midcentury: {
        palette: [
          'walnut',
          'teak',
          'cream',
          'warm white',
          'olive',
          'mustard',
          'teal (muted)',
        ],
        paletteAccents: ['burnt orange (small doses)'],
        blockedColors: ['navy velvet', 'chrome mirror-finish'],
        materials: [
          'walnut/teak veneer',
          'solid wood tapered legs',
          'linen tweed',
          'bouclé',
        ],
        silhouettes: [
          'tapered legs',
          'slim profiles',
          'boxy cushions',
          'loose back cushions',
        ],
        details: ['button tuft (light)', 'piping', 'finger joints (visible)'],
        hardware: ['brass', 'matte black'],
        patterns: ['geometric/atomic', 'fine houndstooth (small scale)'],
        avoid: ['overstuffed oversized sofas', 'glossy chrome futurism'],
        examplesMain: ['walnut coffee table', 'sofa with tapered legs'],
        examplesComplementary: ['geometric cushion', 'low-pile rug'],
      },
      luxury: {
        palette: [
          'rich neutrals',
          'cream',
          'taupe',
          'jewel accents (emerald/sapphire)',
        ],
        paletteAccents: ['champagne gold'],
        blockedColors: [
          'rustic orange',
          'distressed wood tones',
          'matte-black overload',
        ],
        materials: [
          'velvet',
          'silk-blend',
          'marble',
          'mirror',
          'ribbed/fluted glass',
        ],
        silhouettes: ['sculptural', 'sumptuous', 'softly curved arms'],
        details: [
          'deep plush seats',
          'mitered stone edges',
          'polished reveals',
        ],
        hardware: ['polished brass', 'champagne gold'],
        patterns: ['subtle sheen weaves', 'fine ribbing'],
        avoid: [
          'rustic/raw woods',
          'distressed finishes',
          'industrial roughness',
        ],
        examplesMain: ['marble-top coffee table', 'velvet sofa'],
        examplesComplementary: ['brass floor lamp', 'plush high-pile rug'],
      },
      coastal: {
        palette: ['white', 'sand', 'driftwood', 'warm gray', 'soft seafoam'],
        paletteAccents: ['powder blue (very light)'],
        blockedColors: ['navy lacquer', 'heavy black metal'],
        materials: [
          'rattan',
          'jute',
          'light woods',
          'linen/cotton',
          'washed finishes',
        ],
        silhouettes: ['breezy', 'casual', 'rounded edges'],
        details: ['loose linen slipcovers', 'open-weave panels'],
        hardware: ['brushed nickel', 'light bronze'],
        patterns: ['subtle stripes', 'botanical prints (muted)'],
        avoid: ['dark jewel tones', 'velvet glam'],
        examplesMain: ['light-wood sofa frame', 'round rattan coffee table'],
        examplesComplementary: ['jute rug', 'striped linen pillows'],
      },
      farmhouse: {
        palette: ['warm whites', 'earth tones', 'natural wood', 'greige'],
        paletteAccents: ['sage', 'muted clay'],
        blockedColors: ['high-gloss lacquer', 'mirror-chrome'],
        materials: [
          'reclaimed/knotty wood',
          'stoneware',
          'textured cotton',
          'linen',
        ],
        silhouettes: [
          'shaker profiles',
          'sturdy frames',
          'X-brace (limited, neat)',
        ],
        details: ['visible grain', 'soft distress (light)'],
        hardware: ['black/antique bronze'],
        patterns: ['gingham', 'ticking stripes', 'basket weaves'],
        avoid: ['glass-heavy tables', 'ultra-modern chrome'],
        examplesMain: ['solid wood coffee table', 'shaker-style seating'],
        examplesComplementary: [
          'woven baskets',
          'stoneware vases',
          'cotton throws',
        ],
      },
    };

    const s = profile[furnitureStyle];
    const styleLabel = this.getFurnitureStyleLabel(furnitureStyle);

    // Se não houver perfil, retorna vazio para não quebrar
    if (!s) return '';

    // Helpers para montar listas curtas (evitar prompt gigante)
    const take = (arr?: string[], n = 6) =>
      (arr ?? []).filter(Boolean).slice(0, n).join(', ');

    // Construção do bloco textual
    let out = `\nStyle requirements — ${styleLabel}:\n`;

    // Paleta e controle de cores
    if (s.palette.length || s.paletteAccents?.length) {
      out += `• Color/Palette — prefer: ${take(s.palette, 6)}`;
      if (s.paletteAccents?.length)
        out += `; subtle accents: ${take(s.paletteAccents, 3)}`;
      out += `.\n`;
    }
    if (s.blockedColors?.length) {
      out += `• Color control — avoid strictly: ${take(s.blockedColors, 6)}.\n`;
    }

    // Materiais / acabamentos
    if (s.materials.length) {
      out += `• Materials/Finishes — use: ${take(s.materials, 6)}.\n`;
    }

    // Silhuetas / proporções
    if (s.silhouettes.length) {
      out += `• Silhouettes/Proportions — target: ${take(s.silhouettes, 6)}.\n`;
    }

    // Hardware / detalhes / padrões
    if (s.hardware?.length) {
      out += `• Hardware/Accents — ${take(s.hardware, 5)}.\n`;
    }
    if (s.details?.length) {
      out += `• Construction details — ${take(s.details, 5)}.\n`;
    }
    if (s.patterns?.length) {
      out += `• Textiles/Patterns — ${take(s.patterns, 5)}.\n`;
    }

    return out;
  }

  // ========== NOVOS MÉTODOS PARA STAGING EM ETAPAS ==========
  sampleArray<T>(arr: T[] | undefined, n = 4): T[] {
    if (!arr) {
      return [];
    }
    const copy = [...arr];
    for (let i = copy.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      if (copy[i] !== undefined && copy[j] !== undefined) {
        const temp = copy[i];
        copy[i] = copy[j];
        if (temp !== undefined) {
          copy[j] = temp;
        }
      }
    }
    return copy.slice(0, Math.min(n, copy.length));
  }

  /**
   * Gera um plano completo de staging em 3 etapas para um cômodo específico
   */
  generateStagingPlan(
    roomType: RoomType,
    furnitureStyle: FurnitureStyle
  ): StagingPlan {
    const plan = this.getRoomStagingPlan(roomType, furnitureStyle);
    const roomLabel = this.getRoomTypeLabel(roomType);
    const styleLabel = this.getFurnitureStyleLabel(furnitureStyle);

    // Função para gerar regras específicas por stage
    const getStageSpecificGlobalRules = (stage: StagingStage): string[] => {
      let stageSpecificText = '';

      switch (stage) {
        case 'foundation':
          stageSpecificText =
            'Add only freestanding furniture copy styles from the image references (second image),';
          break;
        case 'complement':
          stageSpecificText =
            'Add only freestanding decor copy styles from the image references (third image),';
          break;
        case 'wall_decoration':
          stageSpecificText = 'Add only freestanding wall decoration';
          break;
        default:
          stageSpecificText = 'Add only freestanding furniture and decor';
      }

      return [
        `${stageSpecificText} items on top of the original photo; never modify, move, or substitute any existing structures or surfaces. maintain the same composition, perspective, and natural lighting.
Do not alter or replace any fixed architectural or material elements: keep the floor, walls, ceiling, doors, windows, countertops, cabinetry, stair parts, lighting fixtures, trims, and all existing colors identical.`,
      ];
    };

    const roomSpecificRules = plan.roomSafetyNotes;

    // Versões curtas das categorias permitidas
    const allowedMainShort = this.sampleArray(plan.allowedMainItems, 4).join(
      ', '
    );
    const allowedCompShort = this.sampleArray(
      plan.allowedComplementary,
      4
    ).join(', ');
    const allowedWallShort = this.sampleArray(plan.allowedWallDecor, 4).join(
      ', '
    );

    const stages: StagingStageConfig[] = [
      // Etapa 1: Base/Fundação - Móveis principais
      {
        stage: 'foundation',
        minItems: plan.mainPiecesRange[0],
        maxItems: plan.mainPiecesRange[1],
        allowedCategories: plan.allowedMainItems,
        validationRules: [
          'count_main_items',
          'no_wall_decor',
          'no_window_treatments',
          'circulation_clear',
        ],
        prompt: this.generateStagePrompt(
          'foundation',
          roomLabel,
          styleLabel,
          allowedMainShort,
          '',
          '',
          plan.mainPiecesRange,
          plan.complementaryRange,
          plan.wallDecorRange,
          getStageSpecificGlobalRules('foundation'),
          this.buildDynamicStyleGuidance(furnitureStyle, roomType, 'foundation')
        ),
      },

      // Etapa 2: Complementos - Acessórios e itens funcionais
      {
        stage: 'complement',
        minItems: plan.complementaryRange[0],
        maxItems: plan.complementaryRange[1],
        allowedCategories: plan.allowedComplementary,
        validationRules: [
          'count_comp_items',
          'no_wall_decor',
          'no_window_treatments',
          'circulation_clear',
          'plant_placement',
        ],
        prompt: this.generateStagePrompt(
          'complement',
          roomLabel,
          styleLabel,
          '',
          allowedCompShort,
          '',
          plan.mainPiecesRange,
          plan.complementaryRange,
          plan.wallDecorRange,
          getStageSpecificGlobalRules('complement'),
          this.buildDynamicStyleGuidance(furnitureStyle, roomType, 'complement')
        ),
      },

      // Etapa 3: Decoração de parede - Quadros, espelhos e elementos decorativos
      {
        stage: 'wall_decoration',
        minItems: plan.wallDecorRange[0],
        maxItems: plan.wallDecorRange[1],
        allowedCategories: [
          'wall_art',
          'mirrors',
          'wall_shelves',
          'wall_lighting',
          'wall_decor',
        ],
        validationRules: [
          'wall_decoration_allowed',
          'circulation_clear',
          'proper_height_placement',
          'balanced_distribution',
        ],
        prompt: this.generateStagePrompt(
          'wall_decoration',
          roomLabel,
          styleLabel,
          '',
          '',
          allowedWallShort,
          plan.mainPiecesRange,
          plan.complementaryRange,
          plan.wallDecorRange,
          getStageSpecificGlobalRules('wall_decoration'),
          ''
        ),
      },
    ];

    return {
      roomType,
      furnitureStyle,
      stages,
      globalRules: getStageSpecificGlobalRules('foundation'), // Default para compatibilidade
      roomSpecificRules,
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
    allowedWallShort: string,
    mainRange: Range,
    compRange: Range,
    wallDecorRange: Range,
    globalRules: string[],
    stylesRules: string
  ): string {
    const [minMain, maxMain] = mainRange;
    const [minComp, maxComp] = compRange;
    const [minWallDecor, maxWallDecor] = wallDecorRange;

    const globalRulesText = globalRules.join('\n');

    switch (stage) {
      case 'foundation':
        return `${globalRulesText}

Add main furniture appropriate to this ${roomLabel} in ${styleLabel} style. Select only from: ${allowedMainShort}.
Add between ${minMain} and ${maxMain} essential main pieces. ${stylesRules}
Maintain ≥ 90 cm (36") of clear circulation; do not block or cover doors, windows, or stairs. 
No wall decor or window treatments (no frames, mirrors, curtains, or blinds).
If in doubt about fit or clearance, skip the item.
If the chosen furniture piece is too large and would require altering the structure, skip it and select a smaller one from the list of options.
`;

      case 'complement':
        return `${globalRulesText}
  Add permitted complementary items and accessories selected from: ${allowedCompShort}.
Add ${minComp}–${maxComp} complementary items to complete the scene. ${stylesRules}

Placement rule — plants & vases:
• Place floor plants, planters, and decorative floor vases only in wall corners or snug wall-adjacent positions.
• Keep them fully out of circulation lanes and clearances for doors, windows, and stairs; never center them in the room or in front of openings.

Maintain ≥ 90 cm (36") of clear circulation. Rugs must anchor the zone and lie fully on the floor—do not cover stair treads or thresholds.

If in doubt about fit or clearance, skip the item. 

`;

      case 'wall_decoration':
        return `${globalRulesText}
Add permitted wall decoration items and accessories selected from: ${allowedWallShort}.
Add ${minWallDecor}–${maxWallDecor} wall decor items to complete the scene.

Wall availability check (mandatory):
• First, detect unobstructed wall segments (no doors/windows/closets). A valid segment must be ≥ 80 cm wide and ≥ 60 cm tall with clear surrounding space.
• If no valid free segment exists on a wall, SKIP artwork, mirrors, picture ledges, and floating shelves on that wall.
• Never overlap frames/shelves with windows, door casings, radiators, or switches.

Windows & treatments (existing windows only):
• If windows are present, you may add window treatments ONLY on those real windows: sheer/linen curtains on rod or ceiling track, double-layer curtains (sheer + blackout), roman shades, or roller shades.
• Mount curtain rods/tracks above the real window (≈10–15 cm above frame; extend 10–20 cm beyond each side). Do NOT invent new openings or hardware where no window exists.
• Curtain length should skim the floor; shades must fit the window (inside or outside mount) without covering adjacent trims or outlets.
• Keep window hardware clear of door swings and circulation; do not block handles or latches.

Placement for artwork/mirrors (only where a valid free segment exists):
• Height: center of artwork at 145–152 cm (57–60") from floor; mirrors at eye level.
• Scale: piece ≈ 2/3 the width of the furniture below; keep even spacing.
• Balance across the room — do not cluster everything on one wall.

Safety & constraints:
• Keep ≥90 cm (36") clear circulation; do not obstruct doors, windows, or stairs.
• Never invent new openings, rods, or architectural features — use treatments only where a real structure exists.
• If unsure about free wall availability or window presence, SKIP.

`;

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

export const stagingPlanService = new StagingPlanService();
