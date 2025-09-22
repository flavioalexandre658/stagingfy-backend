import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../db/connection';
import { uploads } from '../db/schema/uploads';
import { 
  Upload, 
  CreateUploadRequest, 
  UploadStatus, 
  RoomType, 
  FurnitureStyle,
  Provider,
  StagingStage,
  StagingPlan,
  StagingStageResult
} from '../interfaces/upload.interface';

export class UploadRepository {
  /**
   * Converte dados do banco para interface Upload
   */
  private convertToUpload(dbUpload: any): Upload {
    return {
      ...dbUpload,
      outputImageUrls: dbUpload.outputImageUrls ? JSON.parse(dbUpload.outputImageUrls) : undefined,
      stagingPlan: dbUpload.stagingPlan ? JSON.parse(dbUpload.stagingPlan) : undefined,
      stageResults: dbUpload.stageResults ? JSON.parse(dbUpload.stageResults) : undefined,
      stageJobIds: dbUpload.stageJobIds ? JSON.parse(dbUpload.stageJobIds) : undefined
    };
  }

  /**
   * Cria um novo registro de upload
   */
  async create(data: {
    userId: string;
    roomType: RoomType;
    furnitureStyle: FurnitureStyle;
    provider: Provider;
    inputImageUrl: string;
  }): Promise<Upload> {
    const [upload] = await db
      .insert(uploads)
      .values({
        userId: data.userId,
        roomType: data.roomType,
        furnitureStyle: data.furnitureStyle,
        provider: data.provider,
        inputImageUrl: data.inputImageUrl,
        status: 'pending'
      })
      .returning();

    return this.convertToUpload(upload);
  }

  /**
   * Busca um upload por ID
   */
  async findById(id: string): Promise<Upload | null> {
    const [upload] = await db
      .select()
      .from(uploads)
      .where(eq(uploads.id, id))
      .limit(1);

    return upload ? this.convertToUpload(upload) : null;
  }

  /**
   * Busca uploads por usuário
   */
  async findByUserId(userId: string, limit: number = 20): Promise<Upload[]> {
    const userUploads = await db
      .select()
      .from(uploads)
      .where(eq(uploads.userId, userId))
      .orderBy(desc(uploads.createdAt))
      .limit(limit);

    return userUploads.map(upload => this.convertToUpload(upload));
  }

  /**
   * Atualiza o status de um upload
   */
  async updateStatus(
    id: string, 
    status: UploadStatus, 
    errorMessage?: string
  ): Promise<Upload | null> {
    const [updatedUpload] = await db
      .update(uploads)
      .set({ 
        status, 
        errorMessage,
        updatedAt: new Date()
      })
      .where(eq(uploads.id, id))
      .returning();

    return updatedUpload ? this.convertToUpload(updatedUpload) : null;
  }

  /**
   * Atualiza o job ID da Black Forest API
   */
  async updateBlackForestJobId(
    id: string, 
    blackForestJobId: string
  ): Promise<Upload | null> {
    const [updatedUpload] = await db
      .update(uploads)
      .set({ 
        blackForestJobId,
        status: 'processing',
        updatedAt: new Date()
      })
      .where(eq(uploads.id, id))
      .returning();

    return updatedUpload ? this.convertToUpload(updatedUpload) : null;
  }

  /**
   * Atualiza o request ID do InstantDeco
   */
  async updateInstantDecoRequestId(
    id: string, 
    instantDecoRequestId: string
  ): Promise<Upload | null> {
    const [updatedUpload] = await db
      .update(uploads)
      .set({ 
        instantDecoRequestId,
        status: 'processing',
        updatedAt: new Date()
      })
      .where(eq(uploads.id, id))
      .returning();

    return updatedUpload ? this.convertToUpload(updatedUpload) : null;
  }

  /**
   * Busca um upload pelo request ID do InstantDeco
   */
  async findByInstantDecoRequestId(requestId: string): Promise<Upload | null> {
    const [upload] = await db
      .select()
      .from(uploads)
      .where(eq(uploads.instantDecoRequestId, requestId))
      .limit(1);

    return upload ? this.convertToUpload(upload) : null;
  }

  /**
   * Busca um upload pelo job ID do Black Forest
   */
  async findByBlackForestJobId(jobId: string): Promise<Upload | null> {
    const [upload] = await db
      .select()
      .from(uploads)
      .where(eq(uploads.blackForestJobId, jobId))
      .limit(1);

    return upload ? this.convertToUpload(upload) : null;
  }

  /**
   * Atualiza a URL da imagem de saída quando o processamento é concluído
   */
  async updateOutputImage(
    id: string, 
    outputImageUrl: string,
    outputImageUrls?: string[],
    markAsCompleted: boolean = true
  ): Promise<Upload | null> {
    const updateData: any = { 
      outputImageUrl,
      updatedAt: new Date()
    };

    // Só marcar como completed se explicitamente solicitado
    if (markAsCompleted) {
      updateData.status = 'completed';
    }

    // Se múltiplas URLs foram fornecidas, salvar como JSON string
    if (outputImageUrls && outputImageUrls.length > 0) {
      updateData.outputImageUrls = JSON.stringify(outputImageUrls);
    }

    const [updatedUpload] = await db
      .update(uploads)
      .set(updateData)
      .where(eq(uploads.id, id))
      .returning();

    return updatedUpload ? this.convertToUpload(updatedUpload) : null;
  }

  /**
   * Atualiza a URL da máscara salva no S3
   */
  async updateMaskUrl(
    id: string, 
    maskUrl: string
  ): Promise<Upload | null> {
    const [updatedUpload] = await db
      .update(uploads)
      .set({ 
        maskUrl,
        updatedAt: new Date()
      })
      .where(eq(uploads.id, id))
      .returning();

    return updatedUpload ? this.convertToUpload(updatedUpload) : null;
  }

  /**
   * Busca uploads pendentes de processamento
   */
  async findPendingUploads(): Promise<Upload[]> {
    const pendingUploads = await db
      .select()
      .from(uploads)
      .where(eq(uploads.status, 'pending'))
      .orderBy(uploads.createdAt);

    return pendingUploads.map(upload => this.convertToUpload(upload));
  }

  /**
   * Busca uploads em processamento
   */
  async findProcessingUploads(): Promise<Upload[]> {
    const processingUploads = await db
      .select()
      .from(uploads)
      .where(eq(uploads.status, 'processing'))
      .orderBy(uploads.createdAt);

    return processingUploads.map(upload => this.convertToUpload(upload));
  }

  /**
   * Busca uploads por status e usuário
   */
  async findByUserIdAndStatus(
    userId: string, 
    status: UploadStatus
  ): Promise<Upload[]> {
    const userUploads = await db
      .select()
      .from(uploads)
      .where(and(
        eq(uploads.userId, userId),
        eq(uploads.status, status)
      ))
      .orderBy(desc(uploads.createdAt));

    return userUploads.map(upload => this.convertToUpload(upload));
  }

  /**
   * Deleta um upload
   */
  async delete(id: string): Promise<boolean> {
    const result = await db
      .delete(uploads)
      .where(eq(uploads.id, id));

    return result.rowCount > 0;
  }

  /**
   * Conta uploads por usuário e status
   */
  async countByUserIdAndStatus(
    userId: string, 
    status?: UploadStatus
  ): Promise<number> {
    const conditions = [eq(uploads.userId, userId)];
    
    if (status) {
      conditions.push(eq(uploads.status, status));
    }

    const [result] = await db
      .select({ count: uploads.id })
      .from(uploads)
      .where(and(...conditions));

    return result?.count ? 1 : 0; // Drizzle count retorna o número de registros
  }

  /**
   * Inicializa o staging em etapas
   */
  async initializeStaging(
    uploadId: string,
    stagingPlan: StagingPlan,
    firstStageJobId: string
  ): Promise<Upload | null> {
    if (!stagingPlan.stages || stagingPlan.stages.length === 0) {
      return null;
    }
    
    const firstStage = stagingPlan.stages[0];
    if (!firstStage) {
      return null;
    }
    
    const stageJobIds = { [firstStage.stage]: firstStageJobId };
    
    const [updatedUpload] = await db
      .update(uploads)
      .set({
        currentStage: firstStage.stage,
        stagingPlan: JSON.stringify(stagingPlan),
        stageResults: JSON.stringify([]),
        stageJobIds: JSON.stringify(stageJobIds),
        updatedAt: new Date()
      })
      .where(eq(uploads.id, uploadId))
      .returning();

    return updatedUpload ? this.convertToUpload(updatedUpload) : null;
  }

  /**
   * Atualiza resultado de uma etapa e avança para a próxima
   */
  async updateStageResult(
    uploadId: string,
    stageResult: StagingStageResult,
    nextStageJobId?: string
  ): Promise<Upload | null> {
    const upload = await this.findById(uploadId);
    if (!upload || !upload.stagingPlan || !upload.stageResults || !upload.stageJobIds) {
      return null;
    }

    // Atualizar resultados da etapa
    const updatedStageResults = [...upload.stageResults, stageResult];
    
    // Encontrar próxima etapa
    const currentStageIndex = upload.stagingPlan.stages.findIndex(
      s => s.stage === upload.currentStage
    );
    const nextStage = upload.stagingPlan.stages[currentStageIndex + 1];
    
    let updateData: any = {
      stageResults: JSON.stringify(updatedStageResults),
      updatedAt: new Date()
    };

    if (nextStage && nextStageJobId) {
      // Há próxima etapa
      const updatedStageJobIds = {
        ...upload.stageJobIds,
        [nextStage.stage]: nextStageJobId
      };
      
      updateData.currentStage = nextStage.stage;
      updateData.stageJobIds = JSON.stringify(updatedStageJobIds);
    } else {
      // Última etapa concluída
      updateData.currentStage = null;
      updateData.status = stageResult.success ? 'completed' : 'failed';
      
      if (stageResult.success && stageResult.imageUrl) {
        updateData.outputImageUrl = stageResult.imageUrl;
      }
      
      if (!stageResult.success && stageResult.errorMessage) {
        updateData.errorMessage = stageResult.errorMessage;
      }
    }

    const [updatedUpload] = await db
      .update(uploads)
      .set(updateData)
      .where(eq(uploads.id, uploadId))
      .returning();

    return updatedUpload ? this.convertToUpload(updatedUpload) : null;
  }

  /**
   * Busca upload por jobId de qualquer etapa
   */
  async findByStageJobId(jobId: string): Promise<Upload | null> {
    // Usar LIKE para buscar o jobId no JSON string de forma mais eficiente
    const [upload] = await db
      .select()
      .from(uploads)
      .where(
        and(
          eq(uploads.status, 'processing'),
          // Buscar o jobId dentro do JSON string
          sql`${uploads.stageJobIds} LIKE ${`%"${jobId}"%`}`
        )
      )
      .limit(1);

    return upload ? this.convertToUpload(upload) : null;
  }

  /**
   * Atualiza o estágio atual de um upload
   */
  async updateCurrentStage(uploadId: string, currentStage: string): Promise<void> {
    await db.update(uploads)
      .set({ 
        currentStage: currentStage as 'foundation' | 'complement' | 'wall_decoration' | 'windows_decoration',
        updatedAt: new Date() 
      })
      .where(eq(uploads.id, uploadId));
  }

  async updateStageJobIds(uploadId: string, stageJobIds: Record<string, string>): Promise<void> {
    await db.update(uploads)
      .set({ 
        stageJobIds: JSON.stringify(stageJobIds),
        updatedAt: new Date() 
      })
      .where(eq(uploads.id, uploadId));
  }
}

export const uploadRepository = new UploadRepository();