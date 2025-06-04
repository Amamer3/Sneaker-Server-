import { pipeline } from 'stream/promises';
import { Transform } from 'stream';

export interface BatchProcessingOptions {
  batchSize?: number;
  timeout?: number;
}

export class BatchProcessor {
  constructor(private options: BatchProcessingOptions = {}) {
    this.options.batchSize = options.batchSize || 1000;
    this.options.timeout = options.timeout || 30000;
  }

  async processBatch<T, R>(
    query: FirebaseFirestore.Query,
    processor: (docs: FirebaseFirestore.QueryDocumentSnapshot[]) => Promise<R[]>
  ): Promise<R[]> {
    const results: R[] = [];
    let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
    const startTime = Date.now();

    while (true) {
      // Check timeout
      if (Date.now() - startTime > this.options.timeout!) {
        throw new Error('Batch processing timeout');
      }

      // Get next batch
      let currentQuery = query.limit(this.options.batchSize!);
      if (lastDoc) {
        currentQuery = currentQuery.startAfter(lastDoc);
      }

      const snapshot = await currentQuery.get();
      const docs = snapshot.docs;

      if (docs.length === 0) break;

      // Process batch
      const batchResults = await processor(docs);
      results.push(...batchResults);

      // Update last document for next iteration
      lastDoc = docs[docs.length - 1];

      // Optional: Add small delay to prevent memory spikes
      await new Promise(resolve => setTimeout(resolve, 10));
    }

    return results;
  }

  async streamProcess<T, R>(
    query: FirebaseFirestore.Query,
    processor: (doc: FirebaseFirestore.QueryDocumentSnapshot) => Promise<R | null>,
    options: { parallel?: number } = {}
  ): Promise<R[]> {
    const parallel = options.parallel || 5;
    const results: R[] = [];
    
    const processingStream = new Transform({
      objectMode: true,
      async transform(doc, encoding, callback) {        try {
          const result = await processor(doc);
          if (result !== null) {
            results.push(result);
          }
          callback();
        } catch (error) {
          callback(error instanceof Error ? error : new Error(String(error)));
        }
      },
      highWaterMark: parallel
    });

    await pipeline(
      // Create document stream
      async function* () {
        let lastDoc: FirebaseFirestore.QueryDocumentSnapshot | null = null;
        while (true) {
          let currentQuery = query.limit(1000);
          if (lastDoc) {
            currentQuery = currentQuery.startAfter(lastDoc);
          }

          const snapshot = await currentQuery.get();
          const docs = snapshot.docs;
          if (docs.length === 0) break;

          for (const doc of docs) {
            yield doc;
          }

          lastDoc = docs[docs.length - 1];
          await new Promise(resolve => setTimeout(resolve, 10));
        }
      },
      processingStream
    );

    return results;
  }
}
