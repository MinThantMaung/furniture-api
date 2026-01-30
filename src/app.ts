import express, { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import compression from "compression";
import cors from "cors";
import morgan from "morgan";
import cookeieParser from "cookie-parser";
import i18next from "i18next";
import Backend from "i18next-fs-backend";
import middleware from "i18next-http-middleware";
import path from "path";
import { limiter } from "./middlewares/rateLimiter";
import routes from "./routes/v1";
import cron from "node-cron";
import { createOrUpdateSettingStatue, getSettingStatue } from "./services/settingService";

export const app = express();

var whitelist = ['http://example1.com', 'http://localhost:5174']
var corsOptions = {
  origin: function (origin:any, callback:(err: Error | null, origin?: any) => void) {
    if (!origin) return callback(null, true);
    if (whitelist.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error('Not allowed by CORS'))
    }
  },
  credentials: true, //allow cookies or authorization headers with CORS requests
}
app
  .use(morgan("dev"))
  .use(express.urlencoded({ extended: true }))
  .use(express.json())
  .use(cookeieParser())
  .use(cors())
  .use(helmet())
  .use(compression())
  .use(limiter);

  // Internationalization i18n initialization with fs backend,detection order,cookie caching and fallback language
  i18next.use(Backend).use(middleware.LanguageDetector).init({
    backend: {
      loadPath: path.join(
        process.cwd(),
        "src/locales",
        "{{lng}}",
        "{{ns}}.json"
      ),
    },
    detection: {
      order: ["querystring", "cookie"],
      caches: ["cookie"],
    },
    fallbackLng: "en",
    preload: ["en", "mm"],
  });

app.use(middleware.handle(i18next));

app.use(express.static("public"))
app.use(express.static("uploads"))
app.use(routes);

app.use((error: any, req: Request, res: Response, next: NextFunction) => {
  const status = error.status || 500;
  const message = error.message || "Server Error";
  const errorCode = error.code || "Error Code";
  res.status(status).json({ message, error: errorCode });
});

cron.schedule("* * * * *", async () => {
  console.log("Cron job executed every minute");
  const setting = await getSettingStatue("maintenance");
  if (setting && setting.value === "true") {
    await createOrUpdateSettingStatue("maintenance", "false");
    console.log("Maintenance mode turned off by cron job");
   }
});