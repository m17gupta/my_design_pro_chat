import { describe, expect, it } from "vitest";
import { cachedRoleMatches, questionnaireChoices, resolveQuestionnaireContext } from "./questionnaireContext";
import { buildEpisodesFromContext } from "../components/chat/flow";

const phase = (id: string) => ({ title: id, questions: [{ id, name: id, type: "textarea" }] });
const branch = { original: phase("goals"), revision: phase("changes") };
const data = {
  enterprise: { "color-material": { color_material: branch, arc_addition: branch } },
  "enterprise-client": { "landscape-design": { front_yard: branch } },
};

describe("questionnaire context resolution", () => {
  it("offers API branches instead of assuming a work type", () => {
    const result = resolveQuestionnaireContext(data, { role: "enterprise" });
    expect(result.context).toBeNull();
    expect(result.choices).toEqual(questionnaireChoices(data, "enterprise"));
    expect(result.choices).toHaveLength(2);
  });
  it("automatically resolves the sole branch and named phases", () => {
    const result = resolveQuestionnaireContext(data, { role: "enterprise-client" });
    expect(result.context).toMatchObject({ user_type: "landscape-design", work_type: "front_yard", question_sets: { original: ["original"], revision: ["revision"] } });
    const episodes = buildEpisodesFromContext(result.context!, data);
    expect(episodes.map((ep) => ep.apiKey)).toEqual(["overview", "goals", "summary", "changes"]);
    expect(episodes.find((ep) => ep.apiKey === "changes")?.revisionStep).toBe(true);
  });
  it("preserves explicit phases and deliberately empty revisions", () => {
    const result = resolveQuestionnaireContext(data, { role: "enterprise", user_type: "color_material", work_type: "color-material", question_sets: { original: ["original"], revision: [] } });
    expect(result.context?.question_sets.revision).toEqual([]);
    expect(buildEpisodesFromContext(result.context!, data).some((ep) => ep.revisionStep)).toBe(false);
  });
  it("rejects nonexistent phases rather than silently omitting them", () => {
    const result = resolveQuestionnaireContext(data, { role: "enterprise-client", question_sets: { original: ["phase_1"], revision: ["revision"] } });
    expect(result.context).toBeNull();
    expect(result.error).toContain("invalid");
  });
  it("keeps numbered-phase inference compatible", () => {
    const numbered = { enterprise: { "landscape-design": { front_yard: { phase_1: phase("goals"), phase_2: { title: "Summary", questions: [{ id: "design_summary", type: "display" }] }, phase_3: phase("changes") } } } };
    expect(resolveQuestionnaireContext(numbered, { role: "enterprise" }).context?.question_sets).toEqual({ original: ["phase_1", "phase_2"], revision: ["phase_3"] });
  });
  it("does not reuse another role's shared cache", () => {
    expect(cachedRoleMatches("enterprise", "enterprise-client")).toBe(false);
    expect(cachedRoleMatches(undefined, "enterprise-client")).toBe(false);
    expect(cachedRoleMatches("enterprise-client", "enterprise-client")).toBe(true);
  });
  it("uses optional role defaults without overriding explicit host context", () => {
    const configured = { ...data, enterprise: { ...data.enterprise, defaults: { user_type: "color-material", work_type: "arc_addition" } } };
    expect(resolveQuestionnaireContext(configured, { role: "enterprise" }).context?.work_type).toBe("arc_addition");
    expect(resolveQuestionnaireContext(configured, { role: "enterprise", work_type: "color_material" }).context?.work_type).toBe("color_material");
  });
  it("supports legacy direct phases with named original/revision keys", () => {
    const direct = { "enterprise-client": { "color-material": branch } };
    expect(resolveQuestionnaireContext(direct, { role: "enterprise-client" }).context?.question_sets).toEqual({ original: ["original"], revision: ["revision"] });
  });
  it("reports unavailable branches", () => {
    expect(resolveQuestionnaireContext(data, { role: "enterprise-client", work_type: "rear_yard" }).error).toContain("No matching");
  });
  it("uses changed API question content without changing context", () => {
    const ctx = resolveQuestionnaireContext(data, { role: "enterprise-client" }).context!;
    const updated = { ...data, "enterprise-client": { "landscape-design": { front_yard: { ...branch, original: phase("new_question") } } } };
    expect(buildEpisodesFromContext(ctx, updated).map((ep) => ep.apiKey)).toContain("new_question");
  });
});
