import { readFile } from "node:fs/promises";
import path from "node:path";
import { parseResponsesPayload } from "./feedback-contract.mjs";

function normalized(value) {
  return value.toLocaleLowerCase("en-US");
}

function includesPhrase(value, phrase) {
  return normalized(value).includes(normalized(phrase));
}

async function loadCase(fixtureDirectory) {
  const casePath = path.join(fixtureDirectory, "case.json");
  const caseData = JSON.parse(await readFile(casePath, "utf8"));
  if (caseData.synthetic !== true) throw new Error("Fixture must be explicitly marked synthetic.");
  if (!Array.isArray(caseData.evidence) || caseData.evidence.length !== 3) {
    throw new Error("Fixture must list exactly three evidence assets.");
  }

  const evidence = await Promise.all(caseData.evidence.map(async (item) => {
    if (path.basename(item.path) !== item.path) throw new Error("Evidence paths must stay inside the fixture directory.");
    return {
      role: item.role,
      path: item.path,
      content: await readFile(path.join(fixtureDirectory, item.path), "utf8")
    };
  }));
  return { caseData, evidence };
}

function evaluateSemantics(result, expected) {
  const point = result.feedbackPoint;
  const combined = point === null
    ? ""
    : [point.confirmedPoint, point.whyImportant, point.keyIdea, point.nextAction].join("\n");
  const citedVisibleAnchor = point === null
    ? undefined
    : expected.visibleEvidenceAnchors.find((anchor) => includesPhrase(combined, anchor));

  return [
    {
      name: "contract-valid",
      pass: true,
      detail: "The Responses output parsed and passed the current v2.3 public contract."
    },
    {
      name: "first-error-detected",
      pass: point !== null
        && includesPhrase(point.confirmedPoint, expected.firstErrorPhrase)
        && includesPhrase(point.nextAction, expected.requiredNextRule),
      detail: "The feedback identifies the missed distribution and prescribes the required rule."
    },
    {
      name: "evidence-grounded",
      pass: citedVisibleAnchor !== undefined,
      detail: citedVisibleAnchor === undefined
        ? "The feedback does not cite an exact visible learner-work anchor."
        : `The feedback cites a visible learner-work anchor: ${citedVisibleAnchor}.`
    },
    {
      name: "no-unsupported-claim",
      pass: expected.forbiddenClaims.every((claim) => !includesPhrase(combined, claim)),
      detail: "The feedback avoids the fixture's explicit forbidden claims."
    }
  ];
}

export async function runOfflineDemo({ fixtureDirectory, provider }) {
  if (provider === undefined || typeof provider.analyze !== "function") {
    throw new Error("An explicit offline provider with analyze() is required.");
  }
  const { caseData, evidence } = await loadCase(fixtureDirectory);
  const providerCase = {
    caseID: caseData.caseID,
    synthetic: caseData.synthetic,
    problem: caseData.problem,
    learnerWork: caseData.learnerWork,
    reference: caseData.reference
  };
  const payload = await provider.analyze({ caseData: providerCase, evidence });
  const result = parseResponsesPayload(payload, { suppliedMemoryIDs: [] });
  const checks = evaluateSemantics(result, caseData.expected);

  return {
    caseID: caseData.caseID,
    synthetic: caseData.synthetic,
    provider: provider.name,
    evidenceCount: evidence.length,
    result,
    checks,
    passed: checks.every((check) => check.pass)
  };
}
