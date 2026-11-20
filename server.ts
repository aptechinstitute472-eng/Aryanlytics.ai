import "dotenv/config";
import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const MODEL_NAME = "gemini-4-hydrogen";

function getAiClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured in environment secrets.");
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });
}

function getLanguageInstruction(language: string): string {
  switch (language) {
    case "roman_urdu":
      return `Write all narrative explanations, verdictHeadline, executiveSummary, intentAnalysis, issue explanations, good/bad pattern reasoning, step explanations, and change reasons in clear, natural Roman Urdu (e.g., "Ye equation isliye galat hai kyunki denominator x - 2 zero ho sakta hai...", "Bessel correction n-1 isliye behtar hai..."). Keep mathematical symbols, LaTeX equations, data types, code snippets, JSON, and SQL in standard technical notation.`;
    case "bilingual":
      return `Write narrative explanations with crisp English technical phrasing paired with a clear Roman Urdu explanation so both mathematical rigor and everyday Roman Urdu clarity are immediately understandable. Keep LaTeX equations, code, SQL, and JSON syntax clean and valid.`;
    case "english":
    default:
      return `Write all explanations, pattern reasoning, and summaries in crisp, direct mathematical and engineering English.`;
  }
}

function getModeInstruction(mode: string): string {
  switch (mode) {
    case "math":
      return "Focus deeply on Mathematical Equations, Symbolic Logic, Domain Constraints, & Step-by-Step Proofs: inspect every variable's domain (R, Z, N), division-by-zero traps, extraneous roots, sign errors, statistical bias (e.g. n vs n-1), and algebraic/numerical stability.";
    case "prompt":
      return "Focus deeply on Prompt Engineering & Task Specification quality: ambiguity, missing constraints, conflicting instructions, output schema clarity, edge-case handling, and injection/hallucination risks.";
    case "data":
      return "Focus deeply on Data Quality, Variable Types, Schema Design & Normalization: null/missing values, type mismatches (string vs numeric), duplicate keys, unit consistency, statistical outliers, and pipeline bottlenecks.";
    case "sql":
      return "Focus deeply on SQL & Query Correctness: join fan-out/cartesian bugs, NULL comparison traps, missing GROUP BY/window logic, SQL injection risks, index/sargability anti-patterns, and aggregation errors.";
    case "code":
      return "Focus deeply on Code, Logic & Architecture: race conditions, O(n^2) complexity traps, mutability/state bugs, error-handling gaps, security flaws, and clean design patterns.";
    case "auto":
    default:
      return "Automatically detect whether the input is a mathematical equation/problem, dataset/JSON/CSV problem, prompt/task brief, SQL query, or code/logic snippet, and apply the strictest domain standards for that category.";
  }
}

const analysisResponseSchema = {
  type: Type.OBJECT,
  properties: {
    title: {
      type: Type.STRING,
      description: "A concise 3-7 word title describing this math problem, dataset, prompt, or logic task.",
    },
    detectedType: {
      type: Type.STRING,
      description: "Detected category, e.g., 'Algebraic Rational Equation', 'Statistical Variance Data', 'Data Normalization Schema', 'SQL Aggregation Query'.",
    },
    verdict: {
      type: Type.STRING,
      enum: ["valid", "needs_refinement", "flawed"],
      description: "'valid' if mathematically/logically/structurally sound, 'needs_refinement' if usable but missing constraints/edge cases, 'flawed' if broken, incorrect, or contains invalid steps.",
    },
    verdictHeadline: {
      type: Type.STRING,
      description: "A direct 1-sentence verdict stating clearly whether the input/solution is right or not and the core reason.",
    },
    executiveSummary: {
      type: Type.STRING,
      description: "2-3 sentence diagnostic overview. You may wrap inline math expressions in $...$ LaTeX.",
    },
    intentAnalysis: {
      type: Type.STRING,
      description: "Breakdown of the Given conditions, target variable/goal, implicit assumptions, and hidden domain constraints. Use $...$ for math symbols where helpful.",
    },
    variablesAndSymbols: {
      type: Type.ARRAY,
      description: "2 to 8 key variables, mathematical symbols, operators, or data fields extracted from the problem with their formal data types and domain constraints.",
      items: {
        type: Type.OBJECT,
        properties: {
          symbol: {
            type: Type.STRING,
            description: "The variable, symbol, or field name (e.g., 'x', 'σ²', '∑', 'total_amount', 'NULL').",
          },
          dataType: {
            type: Type.STRING,
            description: "Formal math/data type (e.g., 'ℝ (Real Scalar)', 'ℤ⁺ (Positive Int)', 'Decimal(12,2)', 'Array<Object>', 'Boolean').",
          },
          role: {
            type: Type.STRING,
            description: "What this symbol/variable represents in the problem.",
          },
          domainConstraint: {
            type: Type.STRING,
            description: "Valid domain or constraint (e.g., 'x ≠ 2, x > 0', 'NOT NULL, ≥ 0', 'ISO-8601 Date').",
          },
        },
        required: ["symbol", "dataType", "role", "domainConstraint"],
      },
    },
    equationSteps: {
      type: Type.ARRAY,
      description: "2 to 6 step-by-step formal derivation, equation solving, or structural transformation steps leading to the verified answer.",
      items: {
        type: Type.OBJECT,
        properties: {
          stepLabel: {
            type: Type.STRING,
            description: "Short step label (e.g., 'Step 1: Domain Restriction', 'Step 2: Factor & Simplify', 'Final Solution (Q.E.D.)').",
          },
          expressionLatex: {
            type: Type.STRING,
            description: "Pure LaTeX expression without surrounding $$ delimiters (e.g., '\\frac{x^2 - 4}{x - 2} = x + 2, \\quad x \\neq 2' or 's^2 = \\frac{1}{n-1}\\sum_{i=1}^{n}(x_i - \\bar{x})^2'). For non-math schemas/code, write a clean formal mathematical/logical relation in LaTeX.",
          },
          explanation: {
            type: Type.STRING,
            description: "Why this step holds and how it advances the proof/fix.",
          },
        },
        required: ["stepLabel", "expressionLatex", "explanation"],
      },
    },
    isCorrectAsIs: {
      type: Type.BOOLEAN,
      description: "True only if the input is completely correct and requires no mathematical, data, or structural fixes.",
    },
    issues: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          id: { type: Type.STRING },
          severity: {
            type: Type.STRING,
            enum: ["critical", "warning", "suggestion"],
          },
          title: { type: Type.STRING },
          evidence: {
            type: Type.STRING,
            description: "Exact quote, equation term, field, or line from the user input showing the flaw.",
          },
          explanation: {
            type: Type.STRING,
            description: "Why this is wrong or breaks edge cases.",
          },
          fixApplied: {
            type: Type.STRING,
            description: "How this specific issue was resolved.",
          },
        },
        required: ["id", "severity", "title", "evidence", "explanation", "fixApplied"],
      },
    },
    goodPatterns: {
      type: Type.ARRAY,
      description: "2 to 3 strong mathematical, analytical, or engineering patterns recommended here and WHY each is good.",
      items: {
        type: Type.OBJECT,
        properties: {
          patternName: { type: Type.STRING },
          category: { type: Type.STRING },
          whyGood: {
            type: Type.STRING,
            description: "Specific reasoning why this method/pattern gives exact, stable, or scalable results.",
          },
          whenToUse: { type: Type.STRING },
          exampleSnippet: { type: Type.STRING },
        },
        required: ["patternName", "category", "whyGood", "whenToUse", "exampleSnippet"],
      },
    },
    badPatterns: {
      type: Type.ARRAY,
      description: "2 to 3 anti-patterns or common mistakes here and WHY each fails.",
      items: {
        type: Type.OBJECT,
        properties: {
          patternName: { type: Type.STRING },
          category: { type: Type.STRING },
          whyBad: {
            type: Type.STRING,
            description: "Specific reasoning why this approach fails or produces wrong answers.",
          },
          failureMode: {
            type: Type.STRING,
            description: "Concrete counterexample or failure mode.",
          },
          exampleFlaw: { type: Type.STRING },
        },
        required: ["patternName", "category", "whyBad", "failureMode", "exampleFlaw"],
      },
    },
    patternDifferentiationSummary: {
      type: Type.STRING,
      description: "Concise comparison contrasting the winning pattern/method against the flawed pattern.",
    },
    resolvedOutput: {
      type: Type.STRING,
      description: "The complete, verified, corrected solution, normalized dataset, fixed SQL, or repaired code/prompt.",
    },
    resolvedOutputFormat: {
      type: Type.STRING,
      enum: ["markdown", "json", "sql", "code", "text"],
    },
    changesLog: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          area: { type: Type.STRING },
          beforeSummary: { type: Type.STRING },
          afterSummary: { type: Type.STRING },
          reason: { type: Type.STRING },
        },
        required: ["area", "beforeSummary", "afterSummary", "reason"],
      },
    },
    verificationSteps: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "2 to 4 concrete verification checks (substitution check, boundary check, unit test) to confirm correctness.",
    },
  },
  required: [
    "title",
    "detectedType",
    "verdict",
    "verdictHeadline",
    "executiveSummary",
    "intentAnalysis",
    "variablesAndSymbols",
    "equationSteps",
    "isCorrectAsIs",
    "issues",
    "goodPatterns",
    "badPatterns",
    "patternDifferentiationSummary",
    "resolvedOutput",
    "resolvedOutputFormat",
    "changesLog",
    "verificationSteps",
  ],
};

function extractApiError(err: unknown): { status: number; message: string } {
  const anyErr = err as { status?: number; message?: string; error?: { code?: number; message?: string } };
  const status = anyErr?.status || anyErr?.error?.code || 500;
  const rawMessage = anyErr?.error?.message || anyErr?.message || "Unexpected server error while contacting Gemini API.";

  if (status === 403 || rawMessage.includes("PERMISSION_DENIED") || rawMessage.includes("API_KEY_INVALID")) {
    return {
      status: 403,
      message: "Gemini API key permission error. Please verify your GEMINI_API_KEY in Settings > Secrets.",
    };
  }
  if (status === 429 || rawMessage.includes("RESOURCE_EXHAUSTED")) {
    return {
      status: 429,
      message: "API rate limit or quota reached. Please wait a moment and try again.",
    };
  }
  return { status: typeof status === "number" && status >= 400 && status < 600 ? status : 500, message: rawMessage };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: "2mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true });
  });

  app.post("/api/analyze", async (req, res) => {
    try {
      const { input, mode = "auto", language = "english", rigor = "standard", contextNote = "" } = req.body ?? {};
      if (!input || typeof input !== "string" || input.trim().length < 2) {
        return res.status(400).json({ error: "Please provide a math problem, equation, dataset, task, or code snippet to analyze." });
      }

      const rigorInstruction =
        rigor === "strict"
          ? "AUDIT RIGOR: STRICT PRODUCTION. Apply zero-tolerance engineering standards: flag missing null checks, O(n^2) traps, SQL injection/concurrency issues, unvalidated data types, and edge-case failures."
          : rigor === "academic"
          ? "AUDIT RIGOR: ACADEMIC PROOF. Apply formal mathematical rigor: state exact set membership, domain restrictions, edge/boundary cases, and formal LaTeX derivation steps."
          : "AUDIT RIGOR: STANDARD. Provide balanced, practical diagnostics and clear pattern comparisons.";

      const ai = getAiClient();
      const systemInstruction = [
        "You are '#ArYanLyticS.Ai/', a rigorous mathematical proof engine, data architect, and principal systems analyst.",
        "Present every analysis like a clear mathematical & data solution sheet:",
        "1. SYMBOLS, VARIABLES & DATA TYPES: Populate 'variablesAndSymbols' with every key symbol/variable/field, its formal data type (e.g., Real Scalar ℝ, Integer ℤ, Decimal(10,2), Matrix, Boolean, String), role, and domain constraints.",
        "2. STEP-BY-STEP EQUATION / DERIVATION TRACE: Populate 'equationSteps' with formal LaTeX expressions ('expressionLatex' without $$ delimiters) showing the exact transformation, proof, or data-validation formula step-by-step.",
        "3. DIFFERENTIATE PATTERNS: Explicitly separate GOOD patterns/methods (and explain WHY each is valid, accurate, or optimal) from BAD anti-patterns/mistakes (and explain WHY each produces errors, domain violations, or bias).",
        "4. VALIDATE CORRECTNESS: Give an honest verdict ('valid', 'needs_refinement', or 'flawed') telling the user plainly whether their problem/solution/data is right or not.",
        "5. RESOLVE & FIX: Produce a complete, verified solution in 'resolvedOutput' plus an itemized 'changesLog' and boundary 'verificationSteps'.",
        getModeInstruction(mode),
        rigorInstruction,
        getLanguageInstruction(language),
        "Quote exact evidence from the user's submission and never invent fake metrics.",
      ].join("\n\n");

      const promptParts = [
        `Selected Mode: ${mode} | Evaluation Rigor: ${rigor}`,
        contextNote?.trim() ? `Additional Context / Constraints:\n${contextNote.trim()}` : null,
        `User Input to Analyze, Differentiate, Validate & Resolve:\n"""\n${input.trim()}\n"""`,
      ]
        .filter(Boolean)
        .join("\n\n");

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: promptParts,
        config: {
          systemInstruction,
          responseMimeType: "application/json",
          responseSchema: analysisResponseSchema,
          thinkingConfig: {
            thinkingLevel: rigor === "standard" ? ThinkingLevel.MEDIUM : ThinkingLevel.HIGH,
          },
        },
      });

      const rawText = (response.text ?? "").trim();
      if (!rawText) {
        return res.status(502).json({ error: "Model returned an empty response. Please try again." });
      }

      const parsed = JSON.parse(rawText);
      const result = {
        ...parsed,
        id: crypto.randomUUID(),
        createdAt: new Date().toISOString(),
        modeUsed: mode,
        languageUsed: language,
        rigorUsed: rigor,
        originalInput: input,
      };

      return res.json(result);
    } catch (err) {
      const { status, message } = extractApiError(err);
      console.error("[/api/analyze] error:", err);
      return res.status(status).json({ error: message });
    }
  });

  app.post("/api/followup", async (req, res) => {
    try {
      const {
        originalInput,
        analysisSummary,
        resolvedOutput,
        question,
        history = [],
        language = "english",
      } = req.body ?? {};

      if (!question || typeof question !== "string" || !question.trim()) {
        return res.status(400).json({ error: "Please enter a follow-up question." });
      }

      const ai = getAiClient();
      const systemInstruction = [
        "You are '#ArYanLyticS.Ai/', continuing a mathematical, data, and pattern inspection session.",
        "Use crisp $...$ inline LaTeX or $$...$$ block LaTeX for mathematical expressions where appropriate.",
        "Answer clearly, referencing the original input, variable constraints, pattern differentiation, and resolved output.",
        getLanguageInstruction(language),
      ].join("\n\n");

      const historyText = Array.isArray(history) && history.length > 0
        ? history
            .slice(-6)
            .map((m: { role: string; content: string }) => `${m.role === "user" ? "User" : "#ArYanLyticS.Ai/"}: ${m.content}`)
            .join("\n")
        : "None yet.";

      const prompt = [
        `Original Input:\n${String(originalInput ?? "").slice(0, 4000)}`,
        `Diagnosis Summary:\n${String(analysisSummary ?? "").slice(0, 2000)}`,
        `Current Resolved Output:\n${String(resolvedOutput ?? "").slice(0, 4000)}`,
        `Previous Follow-up Conversation:\n${historyText}`,
        `User Follow-up Question:\n${question.trim()}`,
      ].join("\n\n---\n\n");

      const response = await ai.models.generateContent({
        model: MODEL_NAME,
        contents: prompt,
        config: {
          systemInstruction,
          thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
        },
      });

      const answer = (response.text ?? "").trim();
      if (!answer) {
        return res.status(502).json({ error: "Model returned an empty follow-up response." });
      }

      return res.json({ answer });
    } catch (err) {
      const { status, message } = extractApiError(err);
      console.error("[/api/followup] error:", err);
      return res.status(status).json({ error: message });
    }
  });

  if (process.env.NODE_ENV !== "production") {
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`#ArYanLyticS.Ai/ server running at http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error("Failed to start server:", err);
  process.exit(1);
});
