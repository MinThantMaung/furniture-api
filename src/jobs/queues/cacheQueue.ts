import { Queue } from 'bullmq';
import 'dotenv/config';


import { redis } from "../../../config/redisClient";

const cacheQueue = new Queue('cache-invalidation', { 
    connection: redis,
    defaultJobOptions: {
        attempts: 3, // Retry up to 3 times if the job fails
        backoff: {
            type: 'exponential',
            delay: 1000, // Initial delay of 1 second before retrying
        },
        removeOnComplete: true, // Automatically remove the job from the queue when completed
        removeOnFail: 1000, // Keep failed jobs in the queue for debugging
    },
});

export default cacheQueue;