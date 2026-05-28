import { Router, type IRouter } from "express";
import healthRouter from "./health";
import charactersRouter from "./characters";
import gamedataRouter from "./gamedata";
import bossesRouter from "./bosses";

const router: IRouter = Router();

router.use(healthRouter);
router.use(charactersRouter);
router.use(gamedataRouter);
router.use(bossesRouter);

export default router;
