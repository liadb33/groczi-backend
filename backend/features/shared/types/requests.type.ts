
export enum ReqStatus {
  SENT = "SENT",
  IN_PROGRESS = "IN_PROGRESS",
  DONE = "DONE",
  REJECTED = "REJECTED"
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



