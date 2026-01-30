import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export const getSettingStatue = async (key: string) => {
  return await prisma.setting.findUnique({
    where: { key },
  });
}

export const createOrUpdateSettingStatue = async (key: string, value: string) => {
  return await prisma.setting.upsert({
    where: { key },
    update: { value },
    create: { key, value },
  });
}
