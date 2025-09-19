import sharp from 'sharp';

/**
 * Gera uma máscara branca com as mesmas dimensões da imagem original
 * @param imageBuffer Buffer da imagem original
 * @returns Buffer da máscara branca em formato PNG
 */
export async function generateWhiteMask(imageBuffer: Buffer): Promise<Buffer> {
  try {
    // Obter metadados da imagem original
    const metadata = await sharp(imageBuffer).metadata();
    
    if (!metadata.width || !metadata.height) {
      throw new Error('Não foi possível obter as dimensões da imagem');
    }

    // Criar máscara branca com as mesmas dimensões
    const whiteMask = await sharp({
      create: {
        width: metadata.width,
        height: metadata.height,
        channels: 3,
        background: { r: 255, g: 255, b: 255 },
      },
    })
      .png()
      .toBuffer();

    return whiteMask;
  } catch (error) {
    console.error('Erro ao gerar máscara branca:', error);
    throw new Error('Falha ao gerar máscara branca');
  }
}

/**
 * Converte um buffer de imagem para base64
 * @param imageBuffer Buffer da imagem
 * @returns String base64 da imagem
 */
export function bufferToBase64(imageBuffer: Buffer): string {
  return imageBuffer.toString('base64');
}

/**
 * Gera máscara branca e retorna em base64
 * @param imageBuffer Buffer da imagem original
 * @returns String base64 da máscara branca
 */
export async function generateWhiteMaskBase64(imageBuffer: Buffer): Promise<string> {
  const maskBuffer = await generateWhiteMask(imageBuffer);
  return bufferToBase64(maskBuffer);
}