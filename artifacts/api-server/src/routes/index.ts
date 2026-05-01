import { Router, type IRouter } from "express";
import healthRouter from "./health";
import publicRouter from "./public";
import patientRouter from "./patient";

const router: IRouter = Router();

router.use(healthRouter);
router.use(publicRouter);
router.use(patientRouter);

export default router;
