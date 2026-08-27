import { PROMPT_VERSION, SCHEMA_VERSION } from "./feedback-contract.mjs";

const CANDIDATES = new Set(["correct", "schema-valid-wrong"]);

function correctResult() {
  return {
    analysisOutcome: "feedbackAvailable",
    feedbackPoint: {
      signalType: "actualError",
      category: "execution",
      confirmedPoint: "At 2x + 3 = 14, the learner distributed 2 to x but did not distribute 2 to +3.",
      whyImportant: "The first changed equation is no longer equivalent to 2(x + 3) = 14, so every later result starts from the wrong equation.",
      keyIdea: "A factor outside parentheses multiplies every term inside the parentheses.",
      nextAction: "Distribute the outside factor to every term inside the parentheses before simplifying.",
      confidence: 0.99
    },
    memoryEvaluations: [],
    missingEvidenceKinds: [],
    evidenceGuidance: "",
    metadata: {
      promptVersion: PROMPT_VERSION,
      schemaVersion: SCHEMA_VERSION
    }
  };
}

function schemaValidWrongResult() {
  return {
    analysisOutcome: "feedbackAvailable",
    feedbackPoint: {
      signalType: "actualError",
      category: "execution",
      confirmedPoint: "The division from 2x = 11 to x = 5.5 is incorrect.",
      whyImportant: "This final calculation changes the answer shown in the work.",
      keyIdea: "Divide both sides consistently.",
      nextAction: "Recheck the final division after isolating x.",
      confidence: 0.92
    },
    memoryEvaluations: [],
    missingEvidenceKinds: [],
    evidenceGuidance: "",
    metadata: {
      promptVersion: PROMPT_VERSION,
      schemaVersion: SCHEMA_VERSION
    }
  };
}

export class MockResponsesProvider {
  constructor({ candidate = "correct" } = {}) {
    if (!CANDIDATES.has(candidate)) throw new Error(`Unknown mock candidate: ${candidate}`);
    this.name = "mock-responses-provider";
    this.candidate = candidate;
    this.callCount = 0;
  }

  async analyze({ caseData, evidence }) {
    this.callCount += 1;
    if (caseData.synthetic !== true || caseData.caseID !== "synthetic-first-error") {
      throw new Error("The mock provider accepts only the documented synthetic case.");
    }
    if (!Array.isArray(evidence) || evidence.length !== 3 || evidence.some((item) => typeof item.content !== "string")) {
      throw new Error("The mock provider requires all three loaded evidence assets.");
    }

    const result = this.candidate === "correct" ? correctResult() : schemaValidWrongResult();

    return {
      id: `resp_mock_synthetic_first_error_${this.candidate}`,
      object: "response",
      status: "completed",
      output_text: JSON.stringify(result)
    };
  }
}
