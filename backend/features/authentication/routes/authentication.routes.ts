import { RequestHandler, Router } from "express";
import { login, register } from "../controllers/authentication.controller.js";

const authenticationRoutes = Router();


authenticationRoutes.post("/login",    login as RequestHandler);
authenticationRoutes.post("/register", register as RequestHandler);

export default authenticationRoutes;