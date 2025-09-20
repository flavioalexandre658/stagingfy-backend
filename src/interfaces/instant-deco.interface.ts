// InstantDeco API Types
export type InstantDecoDesign = 
  | 'modern'
  | 'scandinavian'
  | 'industrial'
  | 'bohemian'
  | 'french'
  | 'midcentury'
  | 'coastal'
  | 'rustic'
  | 'artdeco'
  | 'minimalist';

export type InstantDecoRoomType = 
  | 'bathroom'
  | 'bedroom'
  | 'dining_room'
  | 'home_office'
  | 'kid_bedroom'
  | 'kitchen'
  | 'living_room'
  | 'shower'
  | 'pool'
  | 'terrace'
  | 'pergola';

export type InstantDecoTransformationType = 
  | 'furnish'
  | 'renovate'
  | 'redesign'
  | 'outdoor'
  | 'blue_sky'
  | 'day_to_dusk'
  | 'empty'
  | 'enhance';

export type InstantDecoSwimmingPool = 
  | 'rectangular'
  | 'oval'
  | 'circular'
  | 'natural'
  | 'greek'
  | 'mediterranean'
  | 'modern'
  | 'tropical';

export type InstantDecoBlockElement = 
  // Basic elements
  | 'wall'
  | 'ceiling'
  | 'windowpane'
  | 'door'
  | 'floor'
  // Furniture
  | 'chair'
  | 'table'
  | 'sofa'
  | 'bed'
  | 'bookshelf'
  | 'desk'
  | 'wardrobe'
  | 'drawer'
  | 'cushion'
  | 'pillow'
  | 'coffee table'
  | 'basket'
  | 'vase'
  | 'plant'
  | 'armchair'
  | 'chest of drawers'
  // Kitchen/Bathroom
  | 'sink'
  | 'countertop'
  | 'counter'
  | 'stove'
  | 'kitchen island'
  | 'shelf'
  | 'refrigerator'
  | 'icebox'
  | 'microwave'
  | 'oven'
  | 'dishwasher'
  | 'toilet'
  | 'can'
  | 'commode'
  | 'crapper'
  | 'pot'
  | 'potty'
  | 'stool'
  | 'throne'
  | 'tub'
  | 'shower'
  | 'hood'
  | 'exhaust hood'
  | 'cabinet'
  | 'mirror'
  | 'screen door'
  // Outdoor
  | 'sky'
  | 'house'
  | 'building'
  | 'tree'
  | 'car';

export interface InstantDecoRequest {
  design: InstantDecoDesign;
  room_type: InstantDecoRoomType;
  transformation_type: InstantDecoTransformationType;
  block_element?: string; // comma-separated list of InstantDecoBlockElement
  high_details_resolution?: boolean;
  img_url: string;
  webhook_url: string;
  num_images?: number; // max 4
  swimming_pool?: InstantDecoSwimmingPool; // only for pool room_type
}

export interface InstantDecoInitialResponse {
  status: string;
  response: {
    status: string;
    message: string;
    request_id: string;
  };
}

export interface InstantDecoWebhookResponse {
  output: string; // URL of the processed image
  status: 'succeeded' | 'failed';
  request_id: string;
}

export interface InstantDecoError {
  status: 'error';
  message: string;
  error_code?: string;
}