export const PROMPT_VERSION = "linxol-feedback-v2.3";
export const SCHEMA_VERSION = "linxol-feedback-schema-v2";

const TOP_LEVEL_FIELDS = [
  "analysisOutcome",
  "evidenceGuidance",
  "feedbackPoint",
  "memoryEvaluations",
  "metadata",
  "missingEvidenceKinds"
];
const FEEDBACK_POINT_FIELDS = [
  "category",
  "confidence",
  "confirmedPoint",
  "keyIdea",
  "nextAction",
  "signalType",
  "whyImportant"
];
const MEMORY_EVALUATION_FIELDS = ["confidence", "explanation", "feedbackAtomId", "status"];
const METADATA_FIELDS = ["promptVersion", "schemaVersion"];

const ANALYSIS_OUTCOMES = new Set(["feedbackAvailable", "noUsefulFeedback", "needsMoreEvidence"]);
const SIGNAL_TYPES = new Set(["actualError", "selfFlaggedUncertainty", "correctedError"]);
const CATEGORIES = new Set(["concept", "approach", "condition", "execution", "verification", "memory", "other"]);
const MEMORY_STATUSES = new Set(["resolved", "repeated", "unclear"]);
const EVIDENCE_KINDS = new Set(["context", "learnerWork", "reference"]);

export class ContractValidationError extends Error {
  constructor(message) {
    super(message);
    this.name = "ContractValidationError";
  }
}

function fail(path, message) {
  throw new ContractValidationError(`${path}: ${message}`);
}

function isPlainObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertExactFields(value, expected, path) {
  if (!isPlainObject(value)) fail(path, "must be an object");
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  if (actual.length !== wanted.length || actual.some((field, index) => field !== wanted[index])) {
    fail(path, `must contain exactly: ${wanted.join(", ")}`);
  }
}

function cleanString(value, path, { min = 0, max } = {}) {
  if (typeof value !== "string") fail(path, "must be a string");
  const cleaned = value.trim();
  const length = [...cleaned].length;
  if (length < min) fail(path, `must contain at least ${min} character`);
  if (max !== undefined && length > max) fail(path, `must contain at most ${max} characters`);
  return cleaned;
}

function cleanConfidence(value, path) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > 1) {
    fail(path, "must be a finite number from 0 through 1");
  }
  return value;
}

function cleanEnum(value, choices, path) {
  if (typeof value !== "string" || !choices.has(value)) {
    fail(path, `must be one of: ${[...choices].join(", ")}`);
  }
  return value;
}

function cleanFeedbackPoint(value) {
  if (value === null) return null;
  assertExactFields(value, FEEDBACK_POINT_FIELDS, "feedbackPoint");
  return {
    signalType: cleanEnum(value.signalType, SIGNAL_TYPES, "feedbackPoint.signalType"),
    category: cleanEnum(value.category, CATEGORIES, "feedbackPoint.category"),
    confirmedPoint: cleanString(value.confirmedPoint, "feedbackPoint.confirmedPoint", { min: 1, max: 250 }),
    whyImportant: cleanString(value.whyImportant, "feedbackPoint.whyImportant", { min: 1, max: 300 }),
    keyIdea: cleanString(value.keyIdea, "feedbackPoint.keyIdea", { min: 1, max: 300 }),
    nextAction: cleanString(value.nextAction, "feedbackPoint.nextAction", { min: 1, max: 250 }),
    confidence: cleanConfidence(value.confidence, "feedbackPoint.confidence")
  };
}

function cleanMemoryEvaluations(value, suppliedMemoryIDs) {
  if (!Array.isArray(value)) fail("memoryEvaluations", "must be an array");
  if (value.length > 6) fail("memoryEvaluations", "must contain at most 6 items");
  const expectedIDs = [...suppliedMemoryIDs];
  if (value.length !== expectedIDs.length) {
    fail("memoryEvaluations", "must cover every supplied memory exactly once");
  }
  const seen = new Set();
  const cleaned = value.map((item, index) => {
    const path = `memoryEvaluations[${index}]`;
    assertExactFields(item, MEMORY_EVALUATION_FIELDS, path);
    const feedbackAtomId = cleanString(item.feedbackAtomId, `${path}.feedbackAtomId`, { min: 1 });
    if (!expectedIDs.includes(feedbackAtomId)) fail(`${path}.feedbackAtomId`, "was not supplied");
    if (seen.has(feedbackAtomId)) fail(`${path}.feedbackAtomId`, "must be unique");
    seen.add(feedbackAtomId);
    return {
      feedbackAtomId,
      status: cleanEnum(item.status, MEMORY_STATUSES, `${path}.status`),
      explanation: cleanString(item.explanation, `${path}.explanation`, { min: 1, max: 200 }),
      confidence: cleanConfidence(item.confidence, `${path}.confidence`)
    };
  });
  if (expectedIDs.some((id) => !seen.has(id))) fail("memoryEvaluations", "is missing a supplied memory");
  return cleaned;
}

function cleanMissingEvidenceKinds(value) {
  if (!Array.isArray(value)) fail("missingEvidenceKinds", "must be an array");
  if (value.length > 3) fail("missingEvidenceKinds", "must contain at most 3 items");
  const cleaned = value.map((kind, index) => cleanEnum(kind, EVIDENCE_KINDS, `missingEvidenceKinds[${index}]`));
  if (new Set(cleaned).size !== cleaned.length) fail("missingEvidenceKinds", "must contain unique values");
  return cleaned;
}

export function validateFeedbackResult(value, { suppliedMemoryIDs = [] } = {}) {
  if (!Array.isArray(suppliedMemoryIDs) || suppliedMemoryIDs.some((id) => typeof id !== "string" || id.length === 0)) {
    fail("suppliedMemoryIDs", "must be an array of non-empty strings");
  }
  if (new Set(suppliedMemoryIDs).size !== suppliedMemoryIDs.length) {
    fail("suppliedMemoryIDs", "must contain unique values");
  }

  assertExactFields(value, TOP_LEVEL_FIELDS, "result");
  const analysisOutcome = cleanEnum(value.analysisOutcome, ANALYSIS_OUTCOMES, "analysisOutcome");
  const feedbackPoint = cleanFeedbackPoint(value.feedbackPoint);
  const memoryEvaluations = cleanMemoryEvaluations(value.memoryEvaluations, suppliedMemoryIDs);
  const missingEvidenceKinds = cleanMissingEvidenceKinds(value.missingEvidenceKinds);
  const evidenceGuidance = cleanString(value.evidenceGuidance, "evidenceGuidance", { max: 250 });

  assertExactFields(value.metadata, METADATA_FIELDS, "metadata");
  if (value.metadata.promptVersion !== PROMPT_VERSION) fail("metadata.promptVersion", `must equal ${PROMPT_VERSION}`);
  if (value.metadata.schemaVersion !== SCHEMA_VERSION) fail("metadata.schemaVersion", `must equal ${SCHEMA_VERSION}`);

  if (analysisOutcome === "feedbackAvailable") {
    if (feedbackPoint === null) fail("feedbackPoint", "must be present when feedback is available");
    if (missingEvidenceKinds.length !== 0) fail("missingEvidenceKinds", "must be empty when feedback is available");
    if (evidenceGuidance !== "") fail("evidenceGuidance", "must be empty when feedback is available");
  } else if (analysisOutcome === "noUsefulFeedback") {
    if (feedbackPoint !== null) fail("feedbackPoint", "must be null when no useful feedback is available");
    if (missingEvidenceKinds.length !== 0) fail("missingEvidenceKinds", "must be empty when no useful feedback is available");
    if (evidenceGuidance !== "") fail("evidenceGuidance", "must be empty when no useful feedback is available");
  } else {
    if (feedbackPoint !== null) fail("feedbackPoint", "must be null when more evidence is needed");
    if (missingEvidenceKinds.length === 0) fail("missingEvidenceKinds", "must identify missing evidence");
    if (evidenceGuidance === "") fail("evidenceGuidance", "must explain what evidence is needed");
  }

  return {
    analysisOutcome,
    feedbackPoint,
    memoryEvaluations,
    missingEvidenceKinds,
    evidenceGuidance,
    metadata: {
      promptVersion: PROMPT_VERSION,
      schemaVersion: SCHEMA_VERSION
    }
  };
}

export function parseResponsesPayload(payload, options = {}) {
  if (!isPlainObject(payload)) fail("response", "must be an object");
  if (typeof payload.output_text !== "string" || payload.output_text.trim() === "") {
    fail("response.output_text", "must be a non-empty string");
  }
  let candidate;
  try {
    candidate = JSON.parse(payload.output_text);
  } catch (error) {
    fail("response.output_text", `must contain JSON (${error.message})`);
  }
  return validateFeedbackResult(candidate, options);
}
