import prisma from "../../shared/prisma-client/prisma-client.js";


// get grocery lists by device id
export const getGroceryListsByDeviceId = async (deviceId: string) => {
  return await prisma.groceryList.findMany({
    where: { deviceId },
    include: {
      ListItem: {
        include: {
          grocery: true,
        },
      },
    },
  });
};


