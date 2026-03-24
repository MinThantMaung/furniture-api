import { Queue } from 'bullmq';
import 'dotenv/config';


import { redis } from "../../../config/redisClient";

const ImageQueue = new Queue('imageQueue', { connection: redis });

export default ImageQueue;