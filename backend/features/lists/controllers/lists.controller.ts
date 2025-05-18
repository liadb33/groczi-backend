import { Request, Response, NextFunction } from "express";
import { createGroceryList, createListItem, deleteListItem, deleteListsByIds, getListById, getListsByDeviceId, getListWithItems, updateListName } from "../repository/lists.repository.js";


const formatGroceryLists = (
  rawLists: Awaited<ReturnType<typeof getListsByDeviceId>>
) => {
  return rawLists.map((list) => {
    const itemCount = list.ListItem.reduce(
      (count, item) => count + item.quantity,
      0
    );

    const estimatedMinPrice = list.ListItem.reduce((sum, listItem) => {
      const prices =
        listItem.grocery?.store_grocery
          ?.map((p) => Number(p.itemPrice))
          .filter(Boolean) ?? [];

      const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
      return sum + minPrice * listItem.quantity;
    }, 0);

    return {
      id: list.id,
      name: list.name,
      itemCount,
      estimatedMinPrice: estimatedMinPrice.toFixed(2),
    };
  });
};



 // get grocery lists
export const getListsController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const deviceId = req.deviceId!;

  try {
    const rawLists = await getListsByDeviceId(deviceId);
    const formattedLists = formatGroceryLists(rawLists);
    res.json(formattedLists);
  } catch (error) {
    console.error("Failed to fetch lists:", error);
    next(error);
  }
};


// create grocery list
export const createListController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const deviceId = req.deviceId!;
  const { name } = req.body;

  if (!name || typeof name !== "string" || name.trim() === "") {
    return res.status(400).json({ message: "List name is required" });
  }

  try {
    const newList = await createGroceryList(deviceId, name.trim());
    
    // Return only the newly created list
    res.status(201).json({
      id: newList.id,
      name: newList.name,
      itemCount: 0,
      estimatedMinPrice: "0.00"
    });
  } catch (error) {
    console.error("Failed to create grocery list:", error);
    next(error);
  }
};



// add an item to a list
export const addListItemController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const deviceId = req.deviceId!;
  const { listId } = req.params;
  const { itemCode, quantity } = req.body;

  if (
    !itemCode ||
    typeof itemCode !== "string" ||
    typeof quantity !== "number"
  ) {
    return res
      .status(400)
      .json({ message: "itemCode and numeric quantity are required" });
  }

  try {
    const list = await getListById(listId);

    if (!list || list.deviceId !== deviceId) {
      return res
        .status(404)
        .json({ message: "List not found or unauthorized" });
    }

    const parsedQuantity = Math.max(1, Math.round(quantity));
    await createListItem(listId, itemCode, parsedQuantity);

    const listDetails = await getListWithItems(listId);

    res.json(listDetails);
  } catch (error) {
    console.error("Failed to add item to list:", error);
    next(error);
  }
};


// get list details
export const getListDetailController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const deviceId = req.deviceId!;
  const { listId } = req.params;

  try {
    const list = await getListWithItems(listId);

    if (!list || list.deviceId !== deviceId) {
      return res
        .status(404)
        .json({ message: "List not found or unauthorized" });
    }

    const items = list.ListItem.map((listItem) => {
      const prices =
        listItem.grocery?.store_grocery
          ?.map((p) => Number(p.itemPrice))
          .filter(Boolean) ?? [];

      const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
      const name =
        listItem.grocery?.itemName ||
        listItem.grocery?.manufacturerItemDescription ||
        "Unknown";
      const subtotal = minPrice * listItem.quantity;

      return {
        itemCode: listItem.itemCode,
        name,
        quantity: listItem.quantity,
        subtotal: subtotal.toFixed(2),
      };
    });

    res.json({
      id: list.id,
      name: list.name,
      items,
    });
  } catch (error) {
    console.error("Failed to get list details:", error);
    next(error);
  }
};

// update list name
export const updateListNameController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const deviceId = req.deviceId!;
  const { listId } = req.params;
  const { name } = req.body;

  if (!name || typeof name !== "string" || name.trim() === "") {
    return res.status(400).json({ message: "List name is required" });
  }

  try {
    const list = await getListById(listId);

    if (!list || list.deviceId !== deviceId) {
      return res
        .status(404)
        .json({ message: "List not found or unauthorized" });
    }

    const updatedList = await updateListName(listId, name.trim());
    res.json(updatedList);
  } catch (error) {
    console.error("Failed to update list name:", error);
    next(error);
  }
};


// delete lists
export const deleteListsController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const deviceId = req.deviceId!;
  const { listIds } = req.body;

  if (!Array.isArray(listIds) || listIds.length === 0) {
    return res.status(400).json({ message: "listIds array is required" });
  }

  try {
    const deletedCount = await deleteListsByIds(deviceId, listIds);
    res.json({ success: true, deletedCount });
  } catch (error) {
    console.error("Failed to delete lists:", error);
    next(error);
  }
};

// delete list item
export const deleteListItemController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const deviceId = req.deviceId!;
  const { listId, itemCode } = req.params;

  if (!itemCode || !listId) {
    return res.status(400).json({ message: "Missing listId or itemCode" });
  }

  try {
    const list = await getListById(listId);

    if (!list || list.deviceId !== deviceId) {
      return res
        .status(404)
        .json({ message: "List not found or unauthorized" });
    }

    await deleteListItem(listId, itemCode);

    const listDetails = await getListWithItems(listId);
    res.json(listDetails);
  } catch (error) {
    console.error("Failed to delete list item:", error);
    next(error);
  }
};

