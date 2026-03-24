import { redis } from "../../config/redisClient";

export const getOrSetCache = async (key: any,cb: any) => {
    try{
        const cachedData = await redis.get(key);
        if(cachedData){
            console.log("Cache hit for key: ", key);
            return JSON.parse(cachedData);
        }
        console.log("Cache miss for key: ", key);
        const freshData = await cb();
        redis.setex(key, 3600, JSON.stringify(freshData)); // Cache for 1 hour
        return freshData;
    }catch(err){
        console.error("Redis Error ", err);
        throw err;
    }
}