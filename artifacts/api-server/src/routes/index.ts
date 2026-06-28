import { Router, type IRouter } from "express";
import healthRouter from "./health";
import charactersRouter from "./characters";
import gamedataRouter from "./gamedata";
import bossesRouter from "./bosses";
import levelsRouter from "./levels";

const router: IRouter = Router();

router.use(healthRouter);
router.use(charactersRouter);
router.use(gamedataRouter);
router.use(bossesRouter);
router.use(levelsRouter);

export default router;
