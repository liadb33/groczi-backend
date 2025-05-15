import { Request, Response, NextFunction } from "express";
import { getCartItemsByDeviceId, upsertCartItem, removeCartItem, updateCartItemQuantity } from "../repositories/cart.repository.js";


// format cart response
const formatCartResponse = (cartItems: any[]) => {
  const items = cartItems.map((item) => {
    const prices =
      item.grocery?.store_grocery
        ?.map((p : any) => Number(p.itemPrice))
        .filter(Boolean) ?? [];
    const minPrice = prices.length > 0 ? Math.min(...prices) : 0;
    const name =
      item.grocery?.itemName ||
      item.grocery?.manufacturerItemDescription ||
      "Unknown";
    const subtotal = minPrice * item.quantity;

    return {
      cartItemId: item.id,
      itemCode: item.itemCode,
      name,
      quantity: item.quantity,
      subtotal: subtotal.toFixed(2),
    };
  });

  return { items };
};


// get cart items by device id
export const getCartController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const deviceId = req.deviceId!;
  try {
    const cartItems = await getCartItemsByDeviceId(deviceId);
    res.json(formatCartResponse(cartItems));
  } catch (error) {
    console.error("Failed to fetch cart:", error);
    next(error);
  }
};

// add cart item
export const addCartItemController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const deviceId = req.deviceId!;
  const { itemCode, quantity } = req.body;

  if (!itemCode || !quantity || typeof quantity !== "number") {
    return res
      .status(400)
      .json({ message: "itemCode and numeric quantity are required" });
  }

  try {
    // Make sure quantity is a positive integer
    const parsedQuantity = Math.max(1, Math.round(quantity));
    
    await upsertCartItem(deviceId, itemCode, parsedQuantity);
    
    const updatedCart = await getCartItemsByDeviceId(deviceId);
    res.json(formatCartResponse(updatedCart));
  } catch (error) {
    console.error("Failed to upsert cart item:", error);
    next(error);
  }
};

// update cart item quantity -  increments the quantity 
export const updateCartItemController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const deviceId = req.deviceId!;
  const { itemCode } = req.params;
  const { quantity } = req.body;

  if (!itemCode || quantity === undefined || typeof quantity !== "number") {
    return res
      .status(400)
      .json({ message: "itemCode and numeric quantity are required" });
  }

  try {
    // Just round the quantity to ensure it's an integer, but allow negative values
    const parsedQuantityToAdd = Math.round(quantity);
    
    // Now we increment instead of replacing
    await updateCartItemQuantity(deviceId, itemCode, parsedQuantityToAdd);

    const updatedCart = await getCartItemsByDeviceId(deviceId);
    res.json(formatCartResponse(updatedCart));
  } catch (error) {
    console.error("Failed to update cart item:", error);
    
    // Special handling for item not found error
    if (error instanceof Error && error.message.includes("not found")) {
      return res.status(404).json({ message: "Cart item not found" });
    }
    
    next(error);
  }
};

// remove item from cart
export const removeCartItemController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const deviceId = req.deviceId!;
  const { itemCode } = req.params;

  if (!itemCode) {
    return res.status(400).json({ message: "itemCode is required" });
  }

  try {
    await removeCartItem(deviceId, itemCode);

    const updatedCart = await getCartItemsByDeviceId(deviceId);
    res.json(formatCartResponse(updatedCart));
  } catch (error) {
    console.error("Failed to remove cart item:", error);
    next(error);
  }
};
