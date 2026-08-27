import assert from "node:assert/strict";
import { readdir } from "node:fs/promises";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { MockResponsesProvider } from "../src/mock-responses-provider.mjs";
import { runOfflineDemo } from "../src/offline-evaluator.mjs";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

async function singleFixtureDirectory() {
  const fixtureEntries = await readdir(path.join(repositoryRoot, "fixtures"), { withFileTypes: true });
  const fixtureDirectories = fixtureEntries.filter((entry) => entry.isDirectory());
  assert.equal(fixtureDirectories.length, 1, "exactly one fixture directory is public");
  return path.join(repositoryRoot, "fixtures", fixtureDirectories[0].name);
}

function checkResults(report) {
  return Object.fromEntries(report.checks.map((check) => [check.name, check.pass]));
}

test("correct candidate passes the four scoped checks", async () => {
  const originalFetch = globalThis.fetch;
  let networkCallCount = 0;
  globalThis.fetch = async () => {
    networkCallCount += 1;
    throw new Error("Network access is forbidden in the offline demo.");
  };

  try {
    const provider = new MockResponsesProvider();
    const report = await runOfflineDemo({
      fixtureDirectory: await singleFixtureDirectory(),
      provider
    });
    const checks = checkResults(report);

    assert.equal(report.caseID, "synthetic-first-error", "the expected synthetic case is loaded");
    assert.equal(report.synthetic, true, "the fixture is explicitly labeled synthetic");
    assert.equal(report.provider, "mock-responses-provider", "the explicit mock provider is used");
    assert.equal(provider.callCount, 1, "the mock provider is called exactly once");
    assert.equal(report.evidenceCount, 3, "all three local evidence assets are loaded");
    assert.equal(report.result.analysisOutcome, "feedbackAvailable", "the Responses-shaped payload is parsed");
    assert.deepEqual(
      report.checks.map((check) => check.name),
      ["contract-valid", "first-error-detected", "evidence-grounded", "no-unsupported-claim"],
      "the four scoped evaluation checks run"
    );
    assert.equal(checks["contract-valid"], true, "the correct candidate passes the sanitized contract");
    assert.equal(checks["first-error-detected"], true, "the correct candidate identifies the first error");
    assert.equal(checks["evidence-grounded"], true, "the correct candidate cites visible learner work");
    assert.equal(checks["no-unsupported-claim"], true, "the correct candidate avoids unsupported claims");
    assert.equal(report.passed, true, "the offline evaluation passes as a whole");
    assert.equal(networkCallCount, 0, "the demo performs zero network calls");

    console.log(`correct-candidate contract=PASS firstError=PASS grounding=PASS unsupportedClaim=PASS finalDecision=ACCEPT networkCalls=${networkCallCount}`);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("contract-valid wrong candidate is rejected semantically", async () => {
  const originalFetch = globalThis.fetch;
  let networkCallCount = 0;
  globalThis.fetch = async () => {
    networkCallCount += 1;
    throw new Error("Network access is forbidden in the offline demo.");
  };

  try {
    const provider = new MockResponsesProvider({ candidate: "schema-valid-wrong" });
    const report = await runOfflineDemo({
      fixtureDirectory: await singleFixtureDirectory(),
      provider
    });
    const checks = checkResults(report);
    const contractOnlyAccepted = checks["contract-valid"];

    assert.equal(report.caseID, "synthetic-first-error", "the wrong candidate uses the same synthetic fixture");
    assert.equal(report.provider, "mock-responses-provider", "the explicit mock provider is used");
    assert.equal(provider.callCount, 1, "the wrong-candidate provider is called exactly once");
    assert.equal(report.result.analysisOutcome, "feedbackAvailable", "the wrong Responses-shaped payload is parsed");
    assert.equal(contractOnlyAccepted, true, "contract-only acceptance incorrectly lets the wrong candidate through");
    assert.equal(checks["contract-valid"], true, "the wrong candidate passes the sanitized contract");
    assert.equal(checks["first-error-detected"], false, "the wrong candidate misses the first error");
    assert.equal(checks["evidence-grounded"], true, "the wrong candidate still cites visible learner work");
    assert.equal(checks["no-unsupported-claim"], false, "the wrong candidate makes the fixture-defined false division claim");
    assert.equal(report.passed, false, "the layered semantic evaluation rejects the wrong candidate");
    assert.equal(networkCallCount, 0, "the wrong-candidate path performs zero network calls");

    console.log("semantic-failure-baseline contract=PASS baselineDecision=ACCEPT");
    console.log(`semantic-failure-layer firstError=FAIL grounding=PASS unsupportedClaim=FAIL finalDecision=REJECT networkCalls=${networkCallCount}`);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
