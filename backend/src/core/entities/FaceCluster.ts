export class FaceCluster {
  constructor(
    public readonly id: string,
    public readonly groupId: string,
    public readonly appearanceCount: number,
    public readonly confidence: number,
    public readonly clusterName?: string,
    public readonly createdAt: Date = new Date(),
    public readonly updatedAt: Date = new Date()
  ) {}

  static create(data: {
    groupId: string;
    appearanceCount: number;
    confidence: number;
    clusterName?: string;
  }): FaceCluster {
    return new FaceCluster(
      '', // ID will be assigned by repository
      data.groupId,
      data.appearanceCount,
      data.confidence,
      data.clusterName
    );
  }

  setName(name: string): FaceCluster {
    return new FaceCluster(
      this.id,
      this.groupId,
      this.appearanceCount,
      this.confidence,
      name,
      this.createdAt,
      new Date()
    );
  }

  updateStats(appearanceCount: number, confidence: number): FaceCluster {
    return new FaceCluster(
      this.id,
      this.groupId,
      appearanceCount,
      confidence,
      this.clusterName,
      this.createdAt,
      new Date()
    );
  }

  incrementAppearances(): FaceCluster {
    return new FaceCluster(
      this.id,
      this.groupId,
      this.appearanceCount + 1,
      this.confidence,
      this.clusterName,
      this.createdAt,
      new Date()
    );
  }
}

export class FaceClusterMember {
  constructor(
    public readonly id: string,
    public readonly clusterId: string,
    public readonly faceDetectionId: string,
    public readonly confidence: number,
    public readonly createdAt: Date = new Date()
  ) {}

  static create(data: {
    clusterId: string;
    faceDetectionId: string;
    confidence: number;
  }): FaceClusterMember {
    return new FaceClusterMember(
      '', // ID will be assigned by repository
      data.clusterId,
      data.faceDetectionId,
      data.confidence
    );
  }
}
