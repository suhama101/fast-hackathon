import { spawn } from "child_process";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workerScript = path.resolve(__dirname, "../ai_worker/crew_pipeline.py");

const getPythonCommand = () =>
  process.env.CREWAI_PYTHON ||
  process.env.PYTHON ||
  "python";

export function runCrewStage(stage, payload = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(getPythonCommand(), [workerScript, stage], {
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        CREWAI_STAGE: stage,
      },
      windowsHide: true,
    });

    let stdout = "";
    let stderr = "";

    child.stdout.on("data", (chunk) => {
      stdout += chunk.toString("utf-8");
    });

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString("utf-8");
    });

    child.on("error", (error) => {
      reject(error);
    });

    child.on("close", (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `CrewAI worker exited with code ${code}`));
        return;
      }

      try {
        resolve(stdout ? JSON.parse(stdout) : {});
      } catch (error) {
        reject(new Error(`CrewAI worker returned invalid JSON: ${error.message}`));
      }
    });

    child.stdin.write(JSON.stringify(payload));
    child.stdin.end();
  });
}

export default runCrewStage;
