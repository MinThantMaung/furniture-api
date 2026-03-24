import { prisma } from "./prismaClient";

export const createOneProduct = async (data: any) => {
  let productData: any = {
    name: data.name,
    description: data.description,
    price: data.price,
    discount: data.discount,
    inventory: data.inventory,
    category: {
      connectOrCreate: {
        where: {
          name: data.category,
        },
        create: {
          name: data.category,
        },
      },
    },
    type: {
      connectOrCreate: {
        where: {
          name: data.type,
        },
        create: {
          name: data.type,
        },
      },
    },
    images: {
      create: data.images,
    },
  };
  if (data.tags && data.tags.length > 0) {
    productData.tags = {
      connectOrCreate: data.tags.map((tagName: string) => ({
        where: {
          name: tagName,
        },
        create: {
          name: tagName,
        },
      })),
    };
  }
  return await prisma.product.create({ data: productData });
};

export const getProductById = async (id: number) => {
  return await prisma.product.findUnique({
    where: {
      id,
    },
    include: {
      images: true,
    },
  });
};

export const updateOneProduct = async (productId: number, data: any) => {
  let productData: any = {
    name: data.name,
    description: data.description,
    price: data.price,
    discount: data.discount,
    inventory: data.inventory,
    category: {
      connectOrCreate: {
        where: {
          name: data.category,
        },
        create: {
          name: data.category,
        },
      },
    },
    type: {
      connectOrCreate: {
        where: {
          name: data.type,
        },
        create: {
          name: data.type,
        },
      },
    },
  };
  if (data.tags && data.tags.length > 0) {
    productData.tags = {
      set: [],
      connectOrCreate: data.tags.map((tagName: string) => ({
        where: {
          name: tagName,
        },
        create: {
          name: tagName,
        },
      })),
    };
  }

  if (data.images && data.images.length > 0) {
    productData.images = {
      deleteMany: {},
      create: data.images,
    };
  }
  return await prisma.product.update({
    where: { id: productId },
    data: productData,
  });
};

export const deleteOneProduct = async (id: number) => {
  return await prisma.product.delete({
    where: {
      id,
    },
  });
};

export const getProductsWithRelations = async (id: number) => {
  return await prisma.product.findUnique({
    where: {
      id,
    },
    omit: {
      createdAt: true,
      updatedAt: true,
      categoryId: true,
      typeId: true,
    },
    include: {
      images: {
        select: {
          id: true,
          path: true,
        },
      },
    }
  });
};

export const getProductsList = async (options: any) => {
  return await prisma.product.findMany(options);
}