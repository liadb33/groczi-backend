import { CATEGORIES } from "./categories.js";

export const storePrompt = `
אתה מקבל אובייקט JSON המכיל מידע על חנות אך הערכים שלו מבולגנים בין השדות. 
סדר את הערכים של השדות הבאים בלבד: "storename", "address", "city".

הנחיות:
- ייתכן שחלק מהשדות חסרים, אם שדה חסר יש למלא אותו בערך null.
- אם השדה "subchainname" קיים, והוא אינו ריק ואינו מכיל ספרות, יש לשים את ערכו במקום "storename" בתוצאה.
- אם השדה "subchainname" הוא מספר (כלומר, מכיל רק ספרות), יש לשים במקום "storename" את הערך של "chainname".
- אם בשדה "storename" יש כתובת כלולה בתוך הטקסט (למשל, אחרי שם החנות מופיעה כתובת עם רחוב, מספר, עיר וכדומה, מופרדת בפסיק), יש לחלץ את הכתובת ולהעביר אותה לשדה "address". בשדה "storename" יש להשאיר רק את שם החנות בלי הכתובת.
- אם בשדה "address" יש עיר או מיקוד, יש להוציא אותם לשדות המתאימים ("city") בהתאם למידע הזמין.
- אם בשדה "address" יש כתובת אתר (URL), יש להוסיף את המילה "אתר" בתחילת מחרוזת ה-"storename".

התוצאה צריכה להיות JSON בלבד, ללא טקסט נוסף.
`;

const formattedCategories = CATEGORIES.map((c) => `"${c}"`).join(", ");

export const groceryPrompt = `
אתה מקבל אובייקט JSON עם השדות הבאים בלבד:
  - "itemName" (שם המוצר)
  - "unitQty" (כמות/משקל – מחרוזת או null)
  - "manufactureName" (יצרן – מחרוזת או null)

הנחיות:
- חיפוש וחליצה מתוך itemName:
   - אם מתוך itemName ניתן לזהות את שם היצרן (manufactureName), הוצא אותו והחזר אותו בשדה manufactureName.
   - אם מתוך itemName ניתן לזהות את הכמות/משקל בעברית (למשל "250 גרם", "1 ליטר"), המיר אותו לשדה unitQty.
- ניקוי manufactureName:
   - אם manufactureName חסר, ריק או לא מחרוזת תקפה – הגדר ל-null.
- בדיקת unitQty:
   - אם לא ניתן לחלץ כמות ברורה, הגדר unitQty ל-null.
- הוספת שדה חדש "category":
   - בחר מתוך רשימת הקטגוריות הבאות: [${formattedCategories}]
   - על סמך ה־itemName בחר את הקטגוריה המתאימה ביותר.
   - אם אין התאמה ברורה, הגדר את category כ-"אחר".

   החזר אך ורק JSON תקף, ללא טקסט נוסף.`;

export const groceryBatchPrompt = `
אתה מקבל מערך JSON של אובייקטים, כל אובייקט מכיל השדות הבאים בלבד:
  - "itemName" (שם המוצר)
  - "unitQty" (כמות/משקל – מחרוזת או null)
  - "manufactureName" (יצרן – מחרוזת או null)
  - "itemCode" (קוד פריט - רק לזיהוי, אל תשנה אותו)

הנחיות:
- חיפוש וחליצה מתוך itemName:
   - אם מתוך itemName ניתן לזהות את שם היצרן (manufactureName), הוצא אותו והחזר אותו בשדה manufactureName.
   - אם מתוך itemName ניתן לזהות את הכמות/משקל בעברית (למשל "250 גרם", "1 ליטר"), המיר אותו לשדה unitQty.
- ניקוי manufactureName:
   - אם manufactureName חסר, ריק או לא מחרוזת תקפה – הגדר ל-null.
- בדיקת unitQty:
   - אם לא ניתן לחלץ כמות ברורה, הגדר unitQty ל-null.
- הוספת שדה חדש "category":
   - בחר מתוך רשימת הקטגוריות הבאות: [${formattedCategories}]
   - על סמך ה־itemName בחר את הקטגוריה המתאימה ביותר.
   - אם אין התאמה ברורה, הגדר את category כ-"אחר".

עבד כל פריט במערך בנפרד והחזר מערך JSON תקף של אובייקטים מעובדים באותו סדר, כל אחד עם השדות: itemCode, itemName, manufactureName, unitQty, category. 
ללא טקסט נוסף, רק JSON.`;
