export type UploadStatus = 'pending' | 'processing' | 'completed' | 'failed';

export type RoomType = 
  | 'living_room'
  | 'bedroom' 
  | 'kitchen'
  | 'bathroom'
  | 'dining_room'
  | 'office'
  | 'balcony';

export type FurnitureStyle = 
  | 'modern'
  | 'japanese_minimalist'
  | 'scandinavian'
  | 'industrial'
  | 'classic'
  | 'contemporary'
  | 'rustic'
  | 'bohemian';

export interface Upload {
  id: string;
  userId: string;
  roomType: RoomType;
  furnitureStyle: FurnitureStyle;
  inputImageUrl: string;
  outputImageUrl?: string;
  status: UploadStatus;
  errorMessage?: string;
  blackForestJobId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateUploadRequest {
  roomType: RoomType;
  furnitureStyle: FurnitureStyle;
  plan?: 'free' | 'premium';
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
  status: 'pending' | 'running' | 'completed' | 'failed';
  result?: {
    url: string;
    width: number;
    height: number;
  };
  error?: string;
}

export interface LoraConfig {
  roomType: {
    [key in RoomType]: string;
  };
  furnitureStyle: {
    [key in FurnitureStyle]: string;
  };
}