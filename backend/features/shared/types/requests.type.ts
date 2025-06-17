
export enum ReqStatus {
  SENT = "נשלחה",
  IN_PROGRESS = "בטיפול",
  DONE = "טופל",
}

export interface Request {
    id:number; // PRIMARY KEY
    itemId:string;
    deviceId:number; // FOREIGN KEY
    reqSubject:string;
    reqBody:string;
    createdAt:Date;
    requestStatus:ReqStatus; 
}



