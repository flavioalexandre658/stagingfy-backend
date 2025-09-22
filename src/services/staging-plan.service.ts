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
        mainPiecesRange: [2, 4],
        wallDecorRange: [0, 1],
        complementaryRange: [2, 4],
        allowedMainItems: [
          'modular sectional or curved sofa (low-profile)',
          'compact 2–3 seat sofa',
          'accent barrel or bouclé swivel chair (1–2)',
          'lounge chair with ottoman',
          'nesting coffee tables (travertine/stone/smoked glass)',
          'plinth or pedestal coffee table',
          'low-profile media console (fluted wood or matte lacquer)',
          'storage ottoman or upholstered bench',
          'slim bookcase/etagere',
          'pedestal/cylinder side tables (single or nesting)',
        ],
        allowedWallDecor: [
          'large framed artwork (abstract/botanical)',
          'oversized round or pill mirror',
          'paired framed prints (diptych)',
          'picture ledge with framed art (surface-mounted)',
          'slim floating shelves (surface-mounted, shallow)',
          'plug-in wall sconces (pair, no hardwiring)',
        ],
        allowedComplementary: [
          'large area rug anchoring front legs of seating',
          'arc floor lamp or slim linear floor lamp',
          'table lamps (pair) on side tables/console',
          'textured pillows and throw blanket (bouclé/linen)',
          'indoor plant (olive tree/fiddle-leaf) in matte planter',
          'ceramic/stone vases, bowls, trays',
          'woven basket for throws or magazines',
          'pouf or small ottoman',
        ],
        roomSafetyNotes: [
          'Keep a clear seating circulation path (at least one side of the seating open)',
          'Do not block balcony/door thresholds with furniture',
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

  // ========== NOVO MÉTODO: orientação dinâmica de estilo ==========
  /**
   * Gera um bloco curto (2–4 linhas) com requisitos POSITIVOS/EVITAR
   * para o estilo selecionado, sem mudar a estrutura do prompt.
   * Ele é anexado ao final do prompt dos stages "foundation" e "complement".
   */
  private buildDynamicStyleGuidance(
    furnitureStyle: FurnitureStyle,
    roomType: RoomType,
    stage: StagingStage
  ): string {
    // perfis por estilo (positivos e evitar)
    const profile: Record<
      FurnitureStyle,
      {
        palette: string[];
        materials: string[];
        silhouettes: string[];
        accents: string[];
        avoid: string[];
        examplesMain?: string[];
        examplesComplementary?: string[];
      }
    > = {
      standard: {
        palette: ['warm greige', 'taupe', 'soft gray', 'cream'],
        materials: [
          'oak/walnut veneer',
          'linen/cotton weaves',
          'brushed nickel',
        ],
        silhouettes: ['soft rounded edges', 'balanced proportions'],
        accents: ['subtle tone-on-tone patterns'],
        avoid: ['high-gloss brass glam', 'neon colors', 'ornate carvings'],
        examplesMain: [
          'sofa with soft cushions',
          'rectangular wood/stone coffee table',
        ],
        examplesComplementary: [
          'neutral area rug',
          'linen pillows',
          'ceramic vases',
        ],
      },
      modern: {
        palette: ['neutral gray/black/white', 'earthy charcoal'],
        materials: [
          'matte lacquer',
          'powder-coated metal',
          'smoked glass',
          'stone',
        ],
        silhouettes: [
          'clean lines',
          'low-profile',
          'rectilinear with soft curves',
        ],
        accents: ['matte black', 'satin chrome', 'fluted wood'],
        avoid: [
          'rustic distressing',
          'farmhouse cross-bucks',
          'heavy ornament',
        ],
        examplesMain: ['low-profile sofa', 'smoked-glass coffee table'],
        examplesComplementary: [
          'lean floor lamp',
          'minimal rug',
          'black metal side table',
        ],
      },
      scandinavian: {
        palette: ['white/cream', 'light oak/beech', 'soft pastels'],
        materials: ['bouclé/wool', 'natural wood', 'stoneware'],
        silhouettes: ['organic curves', 'minimal ornament', 'airy forms'],
        accents: ['woven textures', 'ceramics'],
        avoid: ['dark heavy woods', 'mirrored glam', 'heavy tufting'],
        examplesMain: ['light-oak sofa legs', 'round pedestal coffee table'],
        examplesComplementary: ['jute rug', 'linen throw', 'potted olive tree'],
      },
      industrial: {
        palette: ['charcoal', 'ink', 'tobacco', 'warm gray'],
        materials: ['blackened steel', 'raw wood', 'concrete/stone'],
        silhouettes: ['robust forms', 'exposed joinery'],
        accents: ['iron details', 'leather/canvas'],
        avoid: ['delicate ornament', 'bright whites', 'romantic/glam cues'],
        examplesMain: ['steel-frame coffee table', 'leather lounge chair'],
        examplesComplementary: [
          'rug with muted pattern',
          'industrial floor lamp',
        ],
      },
      midcentury: {
        palette: ['walnut/teak', 'mustard', 'teal', 'olive'],
        materials: ['linen tweed', 'bouclé', 'wood veneers'],
        silhouettes: ['tapered legs', 'slim profiles', 'boxy cushions'],
        accents: ['brass or black hardware', 'geometric motifs'],
        avoid: ['overstuffed oversized sofas', 'glossy chrome futurism'],
        examplesMain: ['walnut coffee table', 'sofa with tapered legs'],
        examplesComplementary: ['geometric cushion', 'low-pile rug'],
      },
      luxury: {
        palette: [
          'rich neutrals',
          'jewel accents (emerald/sapphire)',
          'champagne gold',
        ],
        materials: ['velvet', 'silk-blend', 'marble', 'mirror'],
        silhouettes: ['sculptural', 'sumptuous'],
        accents: ['polished brass', 'ribbed/fluted glass'],
        avoid: [
          'rustic/raw woods',
          'distressed finishes',
          'matte-black minimalism excess',
        ],
        examplesMain: ['marble-top coffee table', 'velvet sofa'],
        examplesComplementary: ['brass floor lamp', 'plush high-pile rug'],
      },
      coastal: {
        palette: ['white', 'sand', 'driftwood', 'soft blue/seafoam'],
        materials: ['rattan', 'jute', 'light woods', 'linen'],
        silhouettes: ['breezy', 'casual', 'rounded edges'],
        accents: ['subtle stripes', 'botanical prints'],
        avoid: ['heavy black metal', 'dark jewel tones', 'velvet glam'],
        examplesMain: ['light-wood sofa frame', 'round rattan coffee table'],
        examplesComplementary: ['jute rug', 'striped linen pillows'],
      },
      farmhouse: {
        palette: ['warm whites', 'earth tones', 'natural wood'],
        materials: ['reclaimed/knotty wood', 'stoneware', 'textured fabrics'],
        silhouettes: ['shaker profiles', 'sturdy'],
        accents: ['black/antique bronze hardware'],
        avoid: [
          'high-gloss lacquer',
          'glass-heavy tables',
          'ultra-modern chrome',
        ],
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

    // Frases curtas para anexar, evitando “poluir” o prompt principal.
    const common =
      `\nStyle requirements — ${styleLabel}:\n` +
      `• Palette/Materials: ${[...s.palette, ...s.materials].slice(0, 6).join(', ')}.\n` +
      `• Silhouettes/Accents: ${[...s.silhouettes, ...s.accents].slice(0, 5).join(', ')}.\n` +
      `• Avoid: ${s.avoid.slice(0, 4).join(', ')}.\n`;

    return common;
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
            'Add only freestanding furniture based on the image references (second image),';
          break;
        case 'complement':
          stageSpecificText =
            'Add only freestanding decor based on the image references (third image),';
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
Add between ${minMain} and ${maxMain} essential main pieces.
Maintain ≥ 90 cm (36") of clear circulation; do not block or cover doors, windows, or stairs. 
No wall decor or window treatments (no frames, mirrors, curtains, or blinds).
If in doubt about fit or clearance, skip the item.
If the chosen furniture piece is too large and would require altering the structure, skip it and select a smaller one from the list of options.
`;

      case 'complement':
        return `${globalRulesText}
  Add permitted complementary items and accessories selected from: ${allowedCompShort}.
Add ${minComp}–${maxComp} complementary items to complete the scene.

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

Placement:
• Height: center of artwork at 145–152 cm (57–60") from floor; mirrors at eye level.
• Scale: piece ≈ 2/3 the width of the furniture below; keep even spacing.
• Balance across the room — do not cluster everything on one wall.

Safety & constraints:
• Keep ≥90 cm (36") clear circulation; do not obstruct doors, windows, or stairs.
• Never invent new openings, rods, or architectural features — use treatments only where a real structure exists.
• If unsure about space, clearance, or window presence, SKIP.

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
