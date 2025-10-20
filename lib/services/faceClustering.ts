import { searchFaces } from "./rekognition";

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
  representativeFaceId: string; // The face with most connections
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

/**
 * Cluster faces in a collection using similarity search
 */
export async function clusterFaces(
  collectionId: string,
  faceIds: string[],
  similarityThreshold: number = 85 // Aggressive threshold for better grouping (was 85, then 80)
): Promise<ClusterResult> {
  if (faceIds.length === 0) {
    return { clusters: [], unclusteredFaces: [] };
  }

  console.log(
    `Starting face clustering for ${faceIds.length} faces with threshold ${similarityThreshold}%`
  );

  // Step 1: Build similarity graph
  const similarityGraph = await buildSimilarityGraph(
    collectionId,
    faceIds,
    similarityThreshold
  );

  // Step 2: Find connected components (clusters)
  let clusters = findConnectedComponents(faceIds, similarityGraph);

  // Step 3: Merge similar clusters (Multi-pass for better results)
  // First pass with normal threshold
  clusters = await mergeSimilarClusters(
    collectionId,
    clusters,
    similarityThreshold
  );

  // Second pass with even more aggressive threshold
  // This catches cases where the representative face isn't the best match
  if (clusters.length > 1) {
    clusters = await mergeSimilarClusters(
      collectionId,
      clusters,
      similarityThreshold - 5 // Even more aggressive (e.g., 70%)
    );
  }

  // Step 4: Calculate cluster statistics
  const enrichedClusters = enrichClusters(clusters, similarityGraph);

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
 * Compares multiple faces from each cluster for better accuracy
 */
async function mergeSimilarClusters(
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

  // Build similarity graph between clusters
  const mergeGraph = new Map<number, Set<number>>();

  for (let i = 0; i < clusters.length; i++) {
    mergeGraph.set(i, new Set());
  }

  // Compare clusters by checking if ANY face from cluster i matches ANY face in cluster j
  // This is more thorough than just comparing representatives
  for (let i = 0; i < clusters.length; i++) {
    // Pick up to 3 faces from this cluster for comparison (more thorough)
    const facesToCheck = clusters[i].slice(0, Math.min(3, clusters[i].length));

    for (const faceId of facesToCheck) {
      try {
        const matches = await searchFaces(collectionId, faceId, 100, threshold);

        // Find which OTHER clusters these matches belong to
        for (const match of matches) {
          for (let j = 0; j < clusters.length; j++) {
            if (i !== j && clusters[j].includes(match.faceId)) {
              // Found a match between cluster i and cluster j
              mergeGraph.get(i)!.add(j);
              mergeGraph.get(j)!.add(i);
            }
          }
        }
      } catch (error) {
        console.error(`Failed to search face ${faceId}:`, error);
      }

      // Rate limiting
      await new Promise((resolve) => setTimeout(resolve, 150));
    }
  }

  // Find connected components among clusters
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

  // Merge clusters that are similar
  for (const [i, similarClusters] of mergeGraph.entries()) {
    for (const j of similarClusters) {
      union(i, j);
    }
  }

  // Group merged clusters
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
async function buildSimilarityGraph(
  collectionId: string,
  faceIds: string[],
  threshold: number
): Promise<Map<string, FaceMatch[]>> {
  const graph = new Map<string, FaceMatch[]>();

  // Process faces in batches to avoid rate limiting
  const batchSize = 5;
  for (let i = 0; i < faceIds.length; i += batchSize) {
    const batch = faceIds.slice(i, i + batchSize);

    await Promise.all(
      batch.map(async (faceId) => {
        try {
          // Search for similar faces
          const matches = await searchFaces(
            collectionId,
            faceId,
            100, // Max faces to return
            threshold // Similarity threshold
          );

          // Store matches as graph edges
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

    // Rate limiting: wait 1 second between batches
    if (i + batchSize < faceIds.length) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }
  }

  return graph;
}

/**
 * Find connected components in the similarity graph using Union-Find
 */
function findConnectedComponents(
  faceIds: string[],
  graph: Map<string, FaceMatch[]>
): string[][] {
  // Union-Find data structure
  const parent = new Map<string, string>();
  const rank = new Map<string, number>();

  // Initialize each face as its own parent
  for (const faceId of faceIds) {
    parent.set(faceId, faceId);
    rank.set(faceId, 0);
  }

  // Find with path compression
  const find = (faceId: string): string => {
    if (parent.get(faceId) !== faceId) {
      parent.set(faceId, find(parent.get(faceId)!));
    }
    return parent.get(faceId)!;
  };

  // Union by rank
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

  // Build connected components by unioning similar faces
  for (const [faceId, matches] of graph.entries()) {
    for (const match of matches) {
      union(faceId, match.matchedFaceId);
    }
  }

  // Group faces by their root parent (cluster)
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
function enrichClusters(
  clusters: string[][],
  graph: Map<string, FaceMatch[]>
): FaceCluster[] {
  return clusters.map((faceIds) => {
    // Calculate average similarity within the cluster
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

    // Find representative face (most connected)
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

/**
 * Incremental clustering: Add new faces to existing clusters
 */
export async function addFacesToClusters(
  collectionId: string,
  newFaceIds: string[],
  existingClusters: FaceCluster[],
  similarityThreshold: number = 85
): Promise<{
  updatedClusters: FaceCluster[];
  newClusters: FaceCluster[];
  unclusteredFaces: string[];
}> {
  const updatedClusters: FaceCluster[] = [...existingClusters];
  const newClusters: FaceCluster[] = [];
  const unclusteredFaces: string[] = [];

  for (const newFaceId of newFaceIds) {
    try {
      // Search for similar faces in the collection
      const matches = await searchFaces(
        collectionId,
        newFaceId,
        100,
        similarityThreshold
      );

      if (matches.length === 0) {
        // No similar faces found, mark as unclustered
        unclusteredFaces.push(newFaceId);
        continue;
      }

      // Find which cluster(s) the matches belong to
      let addedToCluster = false;

      for (const cluster of updatedClusters) {
        const hasMatch = matches.some((match) =>
          cluster.faceIds.includes(match.faceId)
        );

        if (hasMatch) {
          // Add to this cluster
          cluster.faceIds.push(newFaceId);
          cluster.size = cluster.faceIds.length;
          addedToCluster = true;
          break; // Add to first matching cluster only
        }
      }

      if (!addedToCluster) {
        // Create new cluster with the matched faces
        const clusterFaceIds = [newFaceId, ...matches.map((m) => m.faceId)];
        newClusters.push({
          faceIds: clusterFaceIds,
          representativeFaceId: newFaceId,
          averageSimilarity:
            matches.reduce((sum, m) => sum + m.similarity, 0) / matches.length,
          size: clusterFaceIds.length,
        });
      }
    } catch (error) {
      console.error(`Failed to cluster new face ${newFaceId}:`, error);
      unclusteredFaces.push(newFaceId);
    }

    // Rate limiting
    await new Promise((resolve) => setTimeout(resolve, 200));
  }

  return {
    updatedClusters,
    newClusters,
    unclusteredFaces,
  };
}
