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
          'queen, king-size or twin bed (according to available space)',
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
  // ========== NOVO MÉTODO: orientação dinâmica de estilo (parágrafo fluido) ==========
  // ========== MÉTODO AJUSTADO: estilo imperativo (todos os perfis) ==========
  private buildDynamicStyleGuidance(furnitureStyle: FurnitureStyle): string {
    const profile: Record<FurnitureStyle, string> = {
      standard: `Stylize only the existing furniture and decor items in a contemporary standard style with soft rounded edges, balanced proportions, and medium-firm box cushions. Favor oak or walnut veneers, linen or cotton weaves, and brushed nickel or matte black accents. Add subtle stitch details and tone-on-tone piping, keeping the look neutral and timeless. Avoid ornate carvings, glossy glam finishes, and heavy tufting.`,

      modern: `Stylize only the existing furniture and decor items in a modern style, giving them clean low-profile silhouettes, rectilinear forms softened by gentle curves, thin sled or blade legs, and flush-front detailing with shadow gaps. Reinterpret surfaces using matte lacquer, powder-coated metal, smoked glass, and stone such as travertine or basalt. Limited fluted wood accents are allowed, with matte black or satin chrome details. Avoid rustic distressing, farmhouse cross-braces, heavy ornament, and glossy mirror chrome.`,

      scandinavian: `Stylize only the existing furniture and decor items in a Scandinavian style with airy minimal silhouettes, organic curves, and tapered light-wood legs in oak or beech. Use bouclé, wool, cotton, and stoneware finishes, keeping visible grain and natural textures. Accent with light neutrals, subtle pastels, and matte black or white hardware. Avoid heavy dark woods, mirrored glam, or bulky tufted forms.`,

      industrial: `Stylize only the existing furniture and decor items in an industrial style with robust proportions, exposed joinery, and steel or square tube frames. Favor blackened steel, raw or reclaimed wood, concrete, and oiled leather finishes. Subtle details may include visible welds, bolted brackets, and antique brass accents. Avoid delicate ornament, glossy whites, and romantic or glam features.`,

      midcentury: `Stylize only the existing furniture and decor items in a midcentury modern style with slim boxy cushions, tapered wooden legs in walnut or teak, and rectilinear low profiles. Use linen tweed, bouclé, or fine woven fabrics with light button tufting or piping. Accents may include brass or matte black hardware and small-scale geometric motifs. Avoid oversized overstuffed seating or futuristic glossy chrome.`,

      luxury: `Stylize only the existing furniture and decor items in a luxury style with sculptural sumptuous silhouettes, deeply plush seating, and softly curved arms. Favor velvet, silk blends, marble, ribbed or fluted glass, and polished brass or champagne gold accents. Details may include mitered stone edges and polished reveals. Avoid rustic woods, distressed finishes, or raw industrial textures.`,

      coastal: `Stylize only the existing furniture and decor items in a coastal style with breezy casual silhouettes, rounded edges, and relaxed slipcovered forms. Favor rattan, jute, driftwood, bleached light woods, and linen or cotton upholstery. Accent with soft neutrals, light stripes, and open-weave details. Avoid jewel tones, heavy black metals, and glam velvets.`,

      farmhouse: `Stylize only the existing furniture and decor items in a farmhouse style with sturdy shaker-inspired frames, natural or greige woods, and lightly textured cotton or linen fabrics. Use reclaimed or knotty wood, stoneware details, and antique bronze or black hardware. Subtle soft distressing may be included, but avoid glass-heavy tables, ultra-modern chrome, or glossy lacquer.`,
    };

    const s = profile[furnitureStyle];
    return s ? `\n${s}\n` : '';
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
    const globalStyleGuidance = this.buildDynamicStyleGuidance(furnitureStyle);

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
        case 'customization':
          stageSpecificText =
            'Make only subtle final adjustments and refinements to existing elements, on top of the original photo; never modify, move, or substitute any existing structures, furniture or surfaces. Focus on color adjustments, style refinements, and small decorative touches.';
          break;
        default:
          stageSpecificText =
            'Add only furniture and decor items, on top of the original photo; never modify, move, or substitute any existing structures, furniture or surfaces.';
      }

      return [
        `${stageSpecificText} maintain the same composition, dimensions (width and height), perspective, and natural lighting.
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

      // Etapa 5: Customização - Ajustes finais e personalização
      {
        stage: 'customization',
        minItems: 0,
        maxItems: 3,
        allowedCategories: [
          'custom_adjustments',
          'final_touches',
          'personalization',
          'style_refinements',
          'color_adjustments',
        ],
        validationRules: [
          'customization_allowed',
          'circulation_clear',
          'style_consistency',
          'final_validation',
        ],
        prompt: this.generateStagePrompt(
          'customization',
          roomLabel,
          styleLabel,
          '',
          '',
          '',
          '',
          plan.mainPiecesRange,
          plan.complementaryRange,
          plan.wallDecorRange,
          plan.windowsDecorRange,
          getStageSpecificGlobalRules('customization'),
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
            case 'customization':
              return stageSelection.customization;
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

    switch (stage) {
      case 'foundation':
        return `${globalRulesText}

Add main furniture appropriate to this ${roomLabel} in ${styleLabel} style. 
Select only between ${minMain}-${maxMain} essential main pieces from the list: ${allowedMainShort}.
Maintain all doors, openings, windows, dimensions (width and height) and circulation paths exactly as in the original image. Do not block, move, resize, or alter them in any way.

 `;

      case 'complement':
        return `${globalRulesText}
Add appropriate complementary items to this ${roomLabel} in ${styleLabel} style.
Select only between ${minComp}–${maxComp} complementary items from the list bellow to complete the scene.
${allowedCompShort}

Maintain all doors, openings, windows, dimensions (width and height) and circulation paths exactly as in the original image. Do not block, move, resize, or alter them in any way.
`;

      case 'wall_decoration':
        return `${globalRulesText}
Add appropriate wall decoration items and accessories to this ${roomLabel} in ${styleLabel} style.
Select only between ${minWallDecor}–${maxWallDecor} wall decor items from the list bellow to complete the scene.
${allowedWallShort}
Maintain all doors, openings, windows,dimensions (width and height) and circulation paths exactly as in the original image. Do not block, move, resize, or alter them in any way.
`;

      case 'windows_decoration':
        return `${globalRulesText}
Add appropriate window decoration items and treatments to this ${roomLabel} in ${styleLabel} style.
Select only between ${minWindowsDecor}–${maxWindowsDecor} window treatments from the list bellow to complete the scene.
 ${allowedWindowsShort}

Maintain all doors, openings, windows, dimensions (width and height) and circulation paths exactly as in the original image. Do not block, move, resize, or alter them in any way.
`;
      case 'customization':
        return `
${stylesRules}
Maintain all doors, openings, windows, dimensions (width and height), walls, floors, ceilings, and circulation paths exactly as in the original image. Do not block, move, resize, recolor, or alter any architectural or material elements in any way.
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
