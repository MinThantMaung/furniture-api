import { Worker } from "bullmq";
import { redis } from "../../../config/redisClient";

const cacheWorker = new Worker(
  "cache-invalidation",
  async (job) => {
    const { pattern } = job.data;
    await invalidateCache(pattern);
    console.log(`Cache with key ${pattern} has been invalidated`);
  },
  { connection: redis, concurrency: 5 } // Process up to 5 jobs concurrently
);

cacheWorker.on("completed", (job) => {
  console.log(`Job with id ${job.id} has been completed`);
});

cacheWorker.on("failed", (job: any, err) => {
  console.log(`Job with id ${job.id} has failed with error ${err.message}`);
});

const invalidateCache = async (pattern: string) => {
  try {
    const stream = await redis.scanStream({
      match: pattern,
      count: 100, // Adjust the count as needed for performance
    });

    const pipeline = redis.pipeline();
    let totalKeys = 0;

    stream.on("data", (keys: string[]) => {
      if (keys.length > 0) {
        keys.forEach((key) => {
          pipeline.del(key);
          totalKeys++;
        });
      }
    });

    await new Promise<void>((resolve, reject) => {
      stream.on("end", async () => {
        try {
          if (totalKeys > 0) {
            await pipeline.exec();
            console.log(
              `Invalidated ${totalKeys} cache keys matching pattern: ${pattern}`
            );
          }
          resolve();
        } catch (execErr) {
          reject(execErr);
        }
      });

      stream.on("error", (streamErr) => {
        reject(streamErr);
      });
    });
  } catch (err) {
    console.error("Redis Error ", err);
    throw err;
  }
};
