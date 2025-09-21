export type UploadStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type RoomType = 
  | 'bedroom'
  | 'living_room'
  | 'kitchen'
  | 'bathroom'
  | 'home_office'
  | 'dining_room'
  | 'kids_room'
  | 'outdoor';

export type FurnitureStyle = 
  | 'standard'
  | 'modern'
  | 'scandinavian'
  | 'industrial'
  | 'midcentury'
  | 'luxury'
  | 'coastal'
  | 'farmhouse';

export type Provider = 'black-forest' | 'instant-deco';

export interface Upload {
  id: string;
  userId: string;
  roomType: RoomType;
  furnitureStyle: FurnitureStyle;
  provider: Provider;
  inputImageUrl: string;
  outputImageUrl?: string;
  outputImageUrls?: string[]; // Suporte para múltiplas imagens de saída
  maskUrl?: string;
  status: UploadStatus;
  errorMessage?: string;
  blackForestJobId?: string;
  instantDecoRequestId?: string;
  // Campos para controle de etapas sequenciais
  currentStage?: StagingStage;
  stagingPlan?: StagingPlan;
  stageResults?: StagingStageResult[];
  stageJobIds?: Record<StagingStage, string>; // Mapeamento etapa -> jobId
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUploadRequest {
  roomType: RoomType;
  furnitureStyle: FurnitureStyle;
  provider?: Provider; // Default será 'black-forest' para compatibilidade
  plan?: 'free' | 'premium';
  saveMask?: boolean;
  hasMask?: boolean; // Indica se o usuário está enviando uma máscara personalizada
}

export interface BlackForestApiRequest {
  model: string;
  prompt: string;
  image: string;
  mask?: string; // Base64 encoded mask for inpainting
  loras?: Array<{
    id: string;
    weight: number;
  }>;
  size?: string;
  steps?: number;
  guidance?: number;
  output_format: string;
  safety_tolerance?: number;
}

export interface BlackForestApiResponse {
  id: string;
  status: 'Task not found' | 'Pending' | 'Request Moderated' | 'Content Moderated' | 'Ready' | 'Error';
  polling_url?: string; // Retornado na resposta inicial
  result?: {
    sample?: string; // URL da imagem gerada
    url?: string; // Para compatibilidade
    width?: number;
    height?: number;
  };
  progress?: number | null;
  details?: object | null;
  preview?: object | null;
  error?: string;
}

export interface BlackForestWebhookResponse {
  id: string;
  status: 'Ready' | 'Error' | 'Content Moderated';
  result?: {
    sample?: string; // URL da imagem gerada
    url?: string; // Para compatibilidade
    width?: number;
    height?: number;
  };
  error?: string;
  timestamp?: string;
}

export interface LoraConfig {
  roomType: {
    [key in RoomType]: string;
  };
  furnitureStyle: {
    [key in FurnitureStyle]: string;
  };
}

// Novas interfaces para o sistema de staging em etapas
export type StagingStage = 'foundation' | 'complement' | 'wall_decoration';

export interface StagingStageConfig {
  stage: StagingStage;
  minItems: number;
  maxItems: number;
  allowedCategories: string[];
  validationRules: string[];
  prompt: string;
}

export interface StagingPlan {
  roomType: RoomType;
  furnitureStyle: FurnitureStyle;
  stages: StagingStageConfig[];
  globalRules: string[];
  roomSpecificRules: string[];
}

export interface StagingStageResult {
  stage: StagingStage;
  success: boolean;
  imageUrl?: string;
  jobId?: string;
  itemsAdded: number;
  validationPassed: boolean;
  validationErrors?: string[];
  retryCount: number;
  errorMessage?: string;
}

export interface StagingProgressResult {
  uploadId: string;
  currentStage: StagingStage;
  completedStages: StagingStage[];
  stageResults: StagingStageResult[];
  finalImageUrl?: string;
  success: boolean;
  errorMessage?: string;
  totalProgress: number; // 0-100
}

export interface StagingValidationResult {
  passed: boolean;
  itemCount: number;
  hasWallDecor: boolean;
  hasWindowTreatments: boolean;
  doorsBlocked: boolean;
  stairsBlocked: boolean;
  colorDeviationDetected: boolean;
  errors: string[];
}