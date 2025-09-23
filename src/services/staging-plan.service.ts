import {
  RoomType,
  FurnitureStyle,
  StagingStage,
  StagingPlan,
  StagingStageConfig,
  StageSelectionConfig,
} from '../interfaces/upload.interface';

type Range = [number, number];

interface RoomStagingPlan {
  // How many items to add (by group)
  mainPiecesRange: Range; // e.g., sofa/bed/table/desk depending on room
  wallDecorRange: Range; // frames, mirrors (on free wall only)
  complementaryRange: Range; // plants, lamps, rugs, cushions, accessories
  windowsDecorRange: Range; // curtains, blinds, window treatments

  // Allowed item types for this room (semantic guardrails)
  allowedMainItems: string[]; // room-specific primary furniture
  allowedWallDecor: string[]; // safe wall decor
  allowedComplementary: string[]; // safe complementary items
  allowedWindowsDecor: string[]; // safe window treatments

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
        // Quantidades ajustadas (essenciais, sem sobrecarregar)
        mainPiecesRange: [2, 4],
        wallDecorRange: [0, 2], // pode ser 0 quando há muitas janelas
        complementaryRange: [3, 5],
        windowsDecorRange: [1, 4], // tratar janelas quando existirem

        allowedMainItems: [
          // Seating âncora — modernos e relevantes
          'modular sectional (low-profile, neutral tones)',
          'compact 2–3 seat sofa (straight arms, slim legs)',
          'accent swivel chair (bouclé or fabric, 1–2)',
          'barrel lounge chair (sculptural, upholstered)',
          'chaise lounge (slim, modern profile)',

          // Mesas de centro — vidro, pedra, metal
          'smoked-glass coffee table with slim metal base',
          'clear tempered-glass coffee table (rectangular or square)',
          'marble or travertine coffee table (pedestal or slab)',
          'nesting coffee tables (glass/stone top, metal frame)',
          'plinth-style coffee table (stone, lacquer, or glass base)',

          // Mesas laterais / apoio
          'cylinder side table (stone, glass, or lacquer finish)',
          'round glass side table with metal legs',
          'sculptural pedestal side table (minimal, modern)',
        ],

        allowedWallDecor: [
          // Arte e espelhos essenciais (superficiais, sem obra)
          'smalled framed artwork (abstract/botanical)',
          'smalled round or pill mirror',
          // Iluminação de parede plug-in (não embutida)
          'plug-in wall sconces (pair, no hardwiring)',
          'plug-in picture light over artwork',
        ],

        // SOMENTE complementos (detalhes) — nada de mini-móveis
        allowedComplementary: [
          // Tapetes (base da composição)
          'large area rug anchoring front legs of seating',
          'layered rug (smaller patterned rug on top of neutral base rug)',

          // Iluminação portátil/leve
          'arc floor lamp or slim linear floor lamp',
          'reading/task floor lamp (slim, matte black or brass)',
          'portable cordless table lamp (rechargeable, modern design)',
          'small sculptural table lamp (stone, ceramic or smoked glass)',

          // Têxteis de apoio
          'contrasting throw pillows (2–4) in complementary textures',
          'neutral bouclé or linen throw blanket casually draped on sofa',
          'pouf or small ottoman (fabric or leather)',
          'floor cushion (oversized, casual seating)',

          // Plantas (variar tamanhos e suportes)
          'indoor tree (olive, fiddle-leaf, bird of paradise) in matte planter',
          'medium plant (monstera, rubber plant, ZZ plant) in ceramic or stone planter',
          'tall snake plant (sansevieria) in slim pedestal planter',
          'tabletop plant (succulent, pothos) in small ceramic pot',
          'arrangement of dried pampas/grass in tall vase',

          // Objetos modernos (materiais honestos, 2024/25)
          'ceramic/stone vases in varied heights (cluster of 2–3)',
          'ribbed or smoked-glass vase with single branch or flower',
          'travertine or marble tray with candles/decor',
          'sculptural object for coffee table (metal, resin or stone)',
          'stack of coffee table books (2–3, neutral covers)',
          'minimal reed diffuser (glass bottle, slim sticks)',
          'set of decorative bowls or catchalls (stone/ceramic)',
          'pillar candles in glass or ceramic holders (grouped)',

          // Organização & lifestyle
          'woven basket for throws or magazines (floor corner)',
          'tray on ottoman or coffee table with drinks/books',
          'coasters set (stone, marble or leather)',
          'small decorative box (storage for remotes)',
        ],

        // Tratamento de janelas — só onde existir janela real, estética atual
        allowedWindowsDecor: [
          'linen curtains (floor-length, neutral tones)',
          'sheer curtains (white/cream, light filtering)',
          'double-layer curtains (sheer + blackout) on existing windows',
          'minimal curtain rod or ceiling track (existing windows only)',
        ],
      },

      bedroom: {
        // ranges ajustados — sempre cama + apoios
        mainPiecesRange: [1, 1], // cama + 1–3 itens de apoio
        wallDecorRange: [0, 1], // pode ser zero (quando sem parede livre)
        complementaryRange: [1, 2],
        windowsDecorRange: [1, 1],

        allowedMainItems: [
          // Âncora obrigatória
          'queen or king-size bed',
        ],

        allowedWallDecor: [
          'framed artwork above headboard (single large or pair)',
          'oversized round/arched mirror above dresser',
          'paired framed prints over nightstands',
          'picture ledge for photos/art (surface-mounted)',
          'plug-in sconces above nightstands (pair, no hardwiring)',
        ],

        allowedComplementary: [
          // Iluminação
          'bedside lamps (pair or single, proportional to nightstand)',
          'slim floor lamp in corner (if space)',

          // Têxteis
          'layered bedding with decorative pillows and throw',
          'area rug extending beyond bed sides/foot',

          // Espelhos & plantas
          'freestanding leaner floor mirror (corner placement)',
          'potted plant (olive, monstera, fiddle-leaf) in neutral planter',

          // Detalhes sobre superfícies
          'tray with small decorative objects on dresser',
          'stack of books or magazines on nightstand',
          'ceramic or glass vase with greenery/flowers',

          // Organização
          'woven basket for extra blankets or cushions',
          'compact lidded laundry hamper (neutral finish)',
        ],

        allowedWindowsDecor: [
          'blackout curtains (neutral fabric, floor length)',
        ],
      },

      kitchen: {
        mainPiecesRange: [1, 3],
        wallDecorRange: [0, 1],
        complementaryRange: [1, 3],
        windowsDecorRange: [0, 2],
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
        allowedWindowsDecor: [
          'cafe curtains (lower window only)',
          'kitchen valances (simple, washable)',
          'roman shades (moisture resistant)',
          'mini blinds (easy to clean)',
          'window herbs garden (small pots on sill)',
          'simple tie-up shades',
        ],
      },

      bathroom: {
        mainPiecesRange: [0, 1],
        wallDecorRange: [0, 1],
        complementaryRange: [2, 4],
        windowsDecorRange: [0, 1],
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
        allowedWindowsDecor: [
          'frosted window film (privacy)',
          'moisture-resistant roman shades',
          'bathroom cafe curtains (washable)',
          'simple roller shades (waterproof)',
          'venetian blinds (moisture resistant)',
        ],
      },

      dining_room: {
        mainPiecesRange: [1, 2],
        wallDecorRange: [1, 2],
        complementaryRange: [2, 4],
        windowsDecorRange: [1, 2],

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

        allowedWindowsDecor: [
          'formal dining curtains (floor-length, elegant)',
          'layered window treatments (sheer + drapes)',
          'roman shades (linen, sophisticated)',
          'wooden blinds (matching dining furniture)',
          'swag curtains (formal dining style)',
          'decorative curtain tiebacks (matching hardware)',
          'window cornices (architectural detail)',
        ],
      },

      home_office: {
        mainPiecesRange: [2, 3],
        wallDecorRange: [0, 2],
        complementaryRange: [2, 4],
        windowsDecorRange: [1, 2],
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
        allowedWindowsDecor: [
          'light-filtering blinds (reduce screen glare)',
          'adjustable roman shades',
          'vertical blinds (professional look)',
          'cordless cellular shades',
          'office curtains (neutral, professional)',
          'window film (glare reduction)',
        ],
      },

      kids_room: {
        mainPiecesRange: [2, 4],
        wallDecorRange: [1, 2],
        complementaryRange: [2, 4],
        windowsDecorRange: [1, 2],
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
        allowedWindowsDecor: [
          'blackout curtains (better sleep)',
          'fun patterned curtains (age-appropriate)',
          'cordless blinds (child safety)',
          'room darkening shades',
          'decorative valances (playful themes)',
          'window clings (removable, fun designs)',
        ],
      },

      outdoor: {
        mainPiecesRange: [2, 4],
        wallDecorRange: [0, 1],
        complementaryRange: [2, 4],
        windowsDecorRange: [0, 1],
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
        allowedWindowsDecor: [
          'outdoor curtains (weather-resistant)',
          'bamboo roll-up shades',
          'outdoor privacy screens',
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
   * Gera um plano completo de staging em 4 etapas para um cômodo específico
   */
  generateStagingPlan(
    roomType: RoomType,
    furnitureStyle: FurnitureStyle,
    stageSelection?: StageSelectionConfig
  ): StagingPlan {
    const plan = this.getRoomStagingPlan(roomType, furnitureStyle);
    const roomLabel = this.getRoomTypeLabel(roomType);
    const styleLabel = this.getFurnitureStyleLabel(furnitureStyle);

    // Gerar estilo global uma única vez para todas as etapas
    const globalStyleGuidance = this.buildDynamicStyleGuidance(
      furnitureStyle,
      roomType,
      'foundation'
    );

    // Função para gerar regras específicas por stage
    const getStageSpecificGlobalRules = (stage: StagingStage): string[] => {
      let stageSpecificText = '';

      switch (stage) {
        case 'foundation':
          stageSpecificText =
            'Add only furniture items, on top of the original photo; never modify, move, or substitute any existing structures or surfaces.';
          break;
        case 'complement':
          stageSpecificText =
            'Add only decor items, on top of the original photo; never modify, move, or substitute any existing structures or surfaces.';
          break;
        case 'wall_decoration':
          stageSpecificText =
            'Add only wall decoration items, on top of the original photo; never modify, move, or substitute any existing structures, furniture, decor or surfaces. ';
          break;
        case 'windows_decoration':
          stageSpecificText =
            'Add only window treatments and decorations items, on top of the original photo; never modify, move, or substitute any existing structures, furniture, decor or surfaces.';
          break;
        default:
          stageSpecificText =
            'Add only furniture and decor items, on top of the original photo; never modify, move, or substitute any existing structures, furniture or surfaces.';
      }

      return [
        `${stageSpecificText} maintain the same composition, perspective, and natural lighting.
Do not alter or replace any fixed architectural or material elements: keep the floor, walls, ceiling, doors, windows, countertops, cabinetry, stair parts, lighting fixtures, trims, and all existing colors identical.`,
      ];
    };

    // Versões curtas das categorias permitidas
    const allowedMainShort = this.sampleArray(plan.allowedMainItems, 3).join(
      ', '
    );
    const allowedCompShort = this.sampleArray(
      plan.allowedComplementary,
      10
    ).join(', ');
    const allowedWallShort = this.sampleArray(plan.allowedWallDecor, 2).join(
      ', '
    );
    const allowedWindowsShort = this.sampleArray(
      plan.allowedWindowsDecor,
      3
    ).join(', ');

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
          '',
          plan.mainPiecesRange,
          plan.complementaryRange,
          plan.wallDecorRange,
          plan.windowsDecorRange,
          getStageSpecificGlobalRules('foundation'),
          globalStyleGuidance
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
          '',
          plan.mainPiecesRange,
          plan.complementaryRange,
          plan.wallDecorRange,
          plan.windowsDecorRange,
          getStageSpecificGlobalRules('complement'),
          globalStyleGuidance
        ),
      },

      // Etapa 3: Decoração de janelas - Cortinas, persianas e tratamentos de janela
      {
        stage: 'windows_decoration',
        minItems: plan.windowsDecorRange[0],
        maxItems: plan.windowsDecorRange[1],
        allowedCategories: [
          'curtains',
          'blinds',
          'shades',
          'window_treatments',
          'window_decor',
        ],
        validationRules: [
          'windows_decoration_allowed',
          'no_wall_decor',
          'circulation_clear',
          'proper_window_coverage',
          'style_consistency',
        ],
        prompt: this.generateStagePrompt(
          'windows_decoration',
          roomLabel,
          styleLabel,
          '',
          '',
          '',
          allowedWindowsShort,
          plan.mainPiecesRange,
          plan.complementaryRange,
          plan.wallDecorRange,
          plan.windowsDecorRange,
          getStageSpecificGlobalRules('windows_decoration'),
          globalStyleGuidance
        ),
      },

      // Etapa 4: Decoração de parede - Quadros, espelhos e elementos decorativos
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
          '',
          plan.mainPiecesRange,
          plan.complementaryRange,
          plan.wallDecorRange,
          plan.windowsDecorRange,
          getStageSpecificGlobalRules('wall_decoration'),
          globalStyleGuidance
        ),
      },
    ];

    // Filtrar etapas baseado na seleção do usuário
    const filteredStages = stageSelection
      ? stages.filter(stage => {
          switch (stage.stage) {
            case 'foundation':
              return stageSelection.foundation;
            case 'complement':
              return stageSelection.complement;
            case 'wall_decoration':
              return stageSelection.wall_decoration;
            case 'windows_decoration':
              return stageSelection.windows_decoration;
            default:
              return true;
          }
        })
      : stages;

    return {
      roomType,
      furnitureStyle,
      stages: filteredStages,
      globalRules: getStageSpecificGlobalRules('foundation'),
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
    allowedWindowsShort: string,
    mainRange: Range,
    compRange: Range,
    wallDecorRange: Range,
    windowsDecorRange: Range,
    globalRules: string[],
    stylesRules: string
  ): string {
    const [minMain, maxMain] = mainRange;
    const [minComp, maxComp] = compRange;
    const [minWallDecor, maxWallDecor] = wallDecorRange;
    const [minWindowsDecor, maxWindowsDecor] = windowsDecorRange;

    const globalRulesText = globalRules.join('\n');

    // instruções específicas por tipo de cômodo
    const roomGuidance: Record<string, string> = {
      living_room: `
Copy sofa reference and styles from the second image
Copy tables reference and styles from the third image
Copy armchairs reference and styles from the fourth image`,

      bedroom: `
Copy bed reference and styles from the second image
Copy dresser/wardrobe reference and styles from the third image
Copy accent chairs or bench reference and styles from the fourth image`,

      dining_room: `
Copy dining table reference and styles from the second image
Copy dining chairs reference and styles from the third image
If space permits, copy sideboard or buffet reference from the fourth image`,

      home_office: `
Copy desk reference and styles from the second image
Copy ergonomic/task chair reference and styles from the third image
If space permits, copy bookshelf or storage unit reference from the fourth image`,

      kids_room: `
Copy kids bed or bunk bed reference and styles from the second image
Copy study desk or small dresser reference from the third image
If space permits, copy toy storage or seating reference from the fourth image`,

      kitchen: `
Copy kitchen island or main dining table reference from the second image
Copy counter stools or dining chairs reference from the third image
If space permits, copy additional shelving or storage unit reference from the fourth image`,

      bathroom: `
Copy vanity and sink reference from the second image
Copy storage cabinet or shelving reference from the third image
If space permits, copy seating or decorative stool reference from the fourth image`,
    };

    const ref = roomGuidance[roomLabel] ?? '';

    switch (stage) {
      case 'foundation':
        return `${globalRulesText}

Add main furniture appropriate to this ${roomLabel} in ${styleLabel} style. 
Select only between ${minMain}-${maxMain} essential main pieces from the list: ${allowedMainShort}.
${ref}
 `;

      case 'complement':
        return `${globalRulesText}
Add appropriate complementary items to this ${roomLabel} in ${styleLabel} style.
Select only between ${minComp}–${maxComp} complementary items from the list bellow to complete the scene.
${allowedCompShort}

Maintain ≥ 90 cm (36") of clear circulation. Rugs must anchor the zone and lie fully on the floor—do not cover stair treads or thresholds.

If in doubt about fit or clearance, skip the item. 
`;

      case 'wall_decoration':
        return `${globalRulesText}
Add appropriate wall decoration items and accessories to this ${roomLabel} in ${styleLabel} style.
Select only between ${minWallDecor}–${maxWallDecor} wall decor items from the list bellow to complete the scene.
${allowedWallShort}

If no free wall space exists (due to windows/doors), SKIP.
`;

      case 'windows_decoration':
        return `${globalRulesText}
Add appropriate window decoration items and treatments to this ${roomLabel} in ${styleLabel} style.
Select only between ${minWindowsDecor}–${maxWindowsDecor} window treatments from the list bellow to complete the scene.
 ${allowedWindowsShort}

Install window treatments only where windows actually exist in the image.
If unsure about window presence or clearance, SKIP.
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
    currentItemCount: number = 0,
    stageSelection?: StageSelectionConfig
  ): string {
    const plan = this.generateStagingPlan(
      roomType,
      furnitureStyle,
      stageSelection
    );
    const stageConfig = plan.stages.find(s => s.stage === stage);

    if (!stageConfig) {
      throw new Error(`Stage configuration not found for: ${stage}`);
    }

    return stageConfig.prompt;
  }
}

export const stagingPlanService = new StagingPlanService();
