import { Router, type IRouter } from "express";
import healthRouter from "./health";
import doctorsRouter from "./doctors";

const router: IRouter = Router();

router.use(healthRouter);
router.use(doctorsRouter);

export default router;
