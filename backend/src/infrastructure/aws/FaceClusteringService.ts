import { IFaceRecognitionService } from '../../core/interfaces/services/IFaceRecognitionService.js';

export interface FaceMatch {
  sourceFaceId: string;
  matchedFaceId: string;
  similarity: number;
}

export interface ClusterResult {
  clusters: FaceCluster[];
  unclusteredFaces: string[];
}

export interface FaceCluster {
  faceIds: string[];
  representativeFaceId: string;
  averageSimilarity: number;
  size: number;
}

/**
 * Face Clustering Service
 *
 * Since AWS Rekognition doesn't provide automatic grouping like Azure,
 * we implement a clustering algorithm using similarity search.
 *
 * Algorithm: Connected Components with Similarity Threshold
 * 1. For each face, search for similar faces in the collection
 * 2. Build a graph where edges represent similarity above threshold
 * 3. Find connected components (clusters) in the graph
 * 4. Assign each face to its cluster
 */
export class FaceClusteringService {
  constructor(private rekognitionService: IFaceRecognitionService) {}

  /**
   * Cluster faces in a collection using similarity search
   */
  async clusterFaces(
    collectionId: string,
    faceIds: string[],
    similarityThreshold: number = 85
  ): Promise<ClusterResult> {
    if (faceIds.length === 0) {
      return { clusters: [], unclusteredFaces: [] };
    }

    console.log(
      `Starting face clustering for ${faceIds.length} faces with threshold ${similarityThreshold}%`
    );

    // Step 1: Build similarity graph
    const similarityGraph = await this.buildSimilarityGraph(
      collectionId,
      faceIds,
      similarityThreshold
    );

    // Step 2: Find connected components (clusters)
    let clusters = this.findConnectedComponents(faceIds, similarityGraph);

    // Step 3: Merge similar clusters (Multi-pass for better results)
    clusters = await this.mergeSimilarClusters(
      collectionId,
      clusters,
      similarityThreshold
    );

    // Second pass with more aggressive threshold
    if (clusters.length > 1) {
      clusters = await this.mergeSimilarClusters(
        collectionId,
        clusters,
        similarityThreshold - 5
      );
    }

    // Step 4: Calculate cluster statistics
    const enrichedClusters = this.enrichClusters(clusters, similarityGraph);

    // Step 5: Identify unclustered faces (single-face clusters)
    const unclusteredFaces = enrichedClusters
      .filter((cluster) => cluster.size === 1)
      .flatMap((cluster) => cluster.faceIds);

    const meaningfulClusters = enrichedClusters.filter(
      (cluster) => cluster.size > 1
    );

    console.log(
      `Clustering complete: ${meaningfulClusters.length} clusters, ${unclusteredFaces.length} unclustered faces`
    );

    return {
      clusters: meaningfulClusters,
      unclusteredFaces,
    };
  }

  /**
   * Merge similar clusters to reduce duplicates
   */
  private async mergeSimilarClusters(
    collectionId: string,
    clusters: string[][],
    threshold: number
  ): Promise<string[][]> {
    if (clusters.length <= 1) {
      return clusters;
    }

    console.log(
      `Merging ${clusters.length} clusters with threshold ${threshold}%...`
    );

    const mergeGraph = new Map<number, Set<number>>();

    for (let i = 0; i < clusters.length; i++) {
      mergeGraph.set(i, new Set());
    }

    // Compare clusters
    for (let i = 0; i < clusters.length; i++) {
      const facesToCheck = clusters[i].slice(0, Math.min(3, clusters[i].length));

      for (const faceId of facesToCheck) {
        try {
          const matches = await this.rekognitionService.searchFaces(
            collectionId,
            faceId,
            100,
            threshold
          );

          for (const match of matches) {
            for (let j = 0; j < clusters.length; j++) {
              if (i !== j && clusters[j].includes(match.faceId)) {
                mergeGraph.get(i)!.add(j);
                mergeGraph.get(j)!.add(i);
              }
            }
          }
        } catch (error) {
          console.error(`Failed to search face ${faceId}:`, error);
        }

        await new Promise((resolve) => setTimeout(resolve, 150));
      }
    }

    // Union-Find for merging
    const parent = new Map<number, number>();
    const rank = new Map<number, number>();

    for (let i = 0; i < clusters.length; i++) {
      parent.set(i, i);
      rank.set(i, 0);
    }

    const find = (i: number): number => {
      if (parent.get(i) !== i) {
        parent.set(i, find(parent.get(i)!));
      }
      return parent.get(i)!;
    };

    const union = (i: number, j: number): void => {
      const rootI = find(i);
      const rootJ = find(j);

      if (rootI === rootJ) return;

      const rankI = rank.get(rootI) || 0;
      const rankJ = rank.get(rootJ) || 0;

      if (rankI < rankJ) {
        parent.set(rootI, rootJ);
      } else if (rankI > rankJ) {
        parent.set(rootJ, rootI);
      } else {
        parent.set(rootJ, rootI);
        rank.set(rootI, rankI + 1);
      }
    };

    for (const [i, similarClusters] of mergeGraph.entries()) {
      for (const j of similarClusters) {
        union(i, j);
      }
    }

    const mergedClusters = new Map<number, string[]>();
    for (let i = 0; i < clusters.length; i++) {
      const root = find(i);
      if (!mergedClusters.has(root)) {
        mergedClusters.set(root, []);
      }
      mergedClusters.get(root)!.push(...clusters[i]);
    }

    const result = Array.from(mergedClusters.values());
    console.log(`Merged to ${result.length} clusters`);

    return result;
  }

  /**
   * Build a similarity graph by searching for similar faces
   */
  private async buildSimilarityGraph(
    collectionId: string,
    faceIds: string[],
    threshold: number
  ): Promise<Map<string, FaceMatch[]>> {
    const graph = new Map<string, FaceMatch[]>();

    const batchSize = 5;
    for (let i = 0; i < faceIds.length; i += batchSize) {
      const batch = faceIds.slice(i, i + batchSize);

      await Promise.all(
        batch.map(async (faceId) => {
          try {
            const matches = await this.rekognitionService.searchFaces(
              collectionId,
              faceId,
              100,
              threshold
            );

            const faceMatches: FaceMatch[] = matches.map((match) => ({
              sourceFaceId: faceId,
              matchedFaceId: match.faceId,
              similarity: match.similarity,
            }));

            graph.set(faceId, faceMatches);
          } catch (error) {
            console.error(`Failed to search for face ${faceId}:`, error);
            graph.set(faceId, []);
          }
        })
      );

      if (i + batchSize < faceIds.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }

    return graph;
  }

  /**
   * Find connected components using Union-Find
   */
  private findConnectedComponents(
    faceIds: string[],
    graph: Map<string, FaceMatch[]>
  ): string[][] {
    const parent = new Map<string, string>();
    const rank = new Map<string, number>();

    for (const faceId of faceIds) {
      parent.set(faceId, faceId);
      rank.set(faceId, 0);
    }

    const find = (faceId: string): string => {
      if (parent.get(faceId) !== faceId) {
        parent.set(faceId, find(parent.get(faceId)!));
      }
      return parent.get(faceId)!;
    };

    const union = (face1: string, face2: string): void => {
      const root1 = find(face1);
      const root2 = find(face2);

      if (root1 === root2) return;

      const rank1 = rank.get(root1) || 0;
      const rank2 = rank.get(root2) || 0;

      if (rank1 < rank2) {
        parent.set(root1, root2);
      } else if (rank1 > rank2) {
        parent.set(root2, root1);
      } else {
        parent.set(root2, root1);
        rank.set(root1, rank1 + 1);
      }
    };

    for (const [faceId, matches] of graph.entries()) {
      for (const match of matches) {
        union(faceId, match.matchedFaceId);
      }
    }

    const clusters = new Map<string, string[]>();
    for (const faceId of faceIds) {
      const root = find(faceId);
      if (!clusters.has(root)) {
        clusters.set(root, []);
      }
      clusters.get(root)!.push(faceId);
    }

    return Array.from(clusters.values());
  }

  /**
   * Enrich clusters with statistics
   */
  private enrichClusters(
    clusters: string[][],
    graph: Map<string, FaceMatch[]>
  ): FaceCluster[] {
    return clusters.map((faceIds) => {
      let totalSimilarity = 0;
      let connectionCount = 0;

      for (const faceId of faceIds) {
        const matches = graph.get(faceId) || [];
        const clusterMatches = matches.filter((match) =>
          faceIds.includes(match.matchedFaceId)
        );

        for (const match of clusterMatches) {
          totalSimilarity += match.similarity;
          connectionCount++;
        }
      }

      const averageSimilarity =
        connectionCount > 0 ? totalSimilarity / connectionCount : 0;

      let maxConnections = 0;
      let representativeFaceId = faceIds[0];

      for (const faceId of faceIds) {
        const matches = graph.get(faceId) || [];
        const clusterMatches = matches.filter((match) =>
          faceIds.includes(match.matchedFaceId)
        );

        if (clusterMatches.length > maxConnections) {
          maxConnections = clusterMatches.length;
          representativeFaceId = faceId;
        }
      }

      return {
        faceIds,
        representativeFaceId,
        averageSimilarity,
        size: faceIds.length,
      };
    });
  }
}
