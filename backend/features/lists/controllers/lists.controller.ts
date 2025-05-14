 import { Request, Response, NextFunction } from "express";
 import { getGroceryListsByDeviceId } from "../repository/lists.repository.js";


 // get grocery lists
 export const getGroceryListsController = async (
   req: Request,
   res: Response,
   next: NextFunction
 ) => {
   const deviceId = req.deviceId!;

   try {
     const lists = await getGroceryListsByDeviceId(deviceId);

     const formatted = lists.map((list) => {
       const itemCount = list.ListItem.length;

       const estimatedMinPrice = list.ListItem.reduce((sum: number, item: any) => {
         const price = item.grocery?.unitOfMeasurePrice ?? 0;
         return sum + price * item.quantity;
       }, 0);

       return {
         id: list.id,
         name: list.name,
         itemCount,
         estimatedMinPrice: Number(estimatedMinPrice.toFixed(2)),
       };
     });

     res.json(formatted);
   } catch (error) {
     console.error("Failed to fetch grocery lists:", error);
     next(error);
   }
 };
