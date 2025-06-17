export interface User {
    id:number; // PRIMARY KEY
    username:string;
    passwordHash:string;
    createdAt:Date;
    lastLogin:Date;
}