import path from "path";
import dotenv from "dotenv";

const candidates = [
  path.resolve(process.cwd(), ".env.local"),
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "../.env.local"),
  path.resolve(process.cwd(), "../.env"),
];

candidates.forEach((envPath) => {
  dotenv.config({ path: envPath, override: false, quiet: true });
});
