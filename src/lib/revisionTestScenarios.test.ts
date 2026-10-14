import { describe, expect, it } from "vitest";
import { PRESETS, DEFAULT_TEST_PAYLOAD, scenarioPayload, assessResponse, classificationOf, shouldPoll, responseText } from "./revisionTestScenarios";

const find = (id: string) => PRESETS.find(p => p.id === id)!;
const classified = (score = 0.7) => ({ intent: "image_edit", image_edit_confidence: score, scope_supported: true, requested_changes: ["Replace patio pavers"], unsupported_changes: [], edit_independent: true, override_attempt_detected: false });
const generated = (score = 0.7) => ({ response_type: "image_generation", task_id: "task-1", classification: classified(score) });

describe("revision test conditions", () => {
  it("loads the exact supplied rear-yard request including blank and null fields", () => {
    expect(scenarioPayload(find("roof_advice"), {})).toEqual(DEFAULT_TEST_PAYLOAD);
  });
  it("builds all scenarios without mutating the original", () => {
    const before = JSON.stringify(DEFAULT_TEST_PAYLOAD);
    for (const p of PRESETS) expect(scenarioPayload(p, DEFAULT_TEST_PAYLOAD).work_type).toBe(p.scope);
    expect(JSON.stringify(DEFAULT_TEST_PAYLOAD)).toBe(before);
  });
  it("constructs plural, conflicting, long, missing-original, and scope-mismatch payloads", () => {
    expect(scenarioPayload(find("plural"), DEFAULT_TEST_PAYLOAD)).toHaveProperty("revision_comments");
    expect(scenarioPayload(find("plural"), DEFAULT_TEST_PAYLOAD)).not.toHaveProperty("revision_comment");
    const conflict = scenarioPayload(find("conflicting_keys"), DEFAULT_TEST_PAYLOAD);
    expect(conflict.revision_comment).not.toEqual(conflict.revision_comments);
    expect((scenarioPayload(find("long_notes"), DEFAULT_TEST_PAYLOAD).revision_comment as {notes: string}).notes.length).toBe(4001);
    expect(scenarioPayload(find("missing_original"), DEFAULT_TEST_PAYLOAD)).not.toHaveProperty("original");
    expect(scenarioPayload(find("scope_mismatch"), DEFAULT_TEST_PAYLOAD).user_type).toBe("landscape_design");
  });
});

describe("actual endpoint response contract", () => {
  it("reads nested confidence and clarification question", () => {
    expect(classificationOf(generated())?.image_edit_confidence).toBe(0.7);
    expect(responseText({response_type: "clarification", question: "Which element?"})).toBe("Which element?");
  });
  it("only polls 202 image_generation with an explicit task_id", () => {
    expect(shouldPoll(202, generated())).toBe(true);
    expect(shouldPoll(200, {response_type: "text_answer", task_id: "wrong"})).toBe(false);
    expect(shouldPoll(202, {response_type: "text_answer", task_id: "wrong"})).toBe(false);
    expect(shouldPoll(202, {response_type: "image_generation", id: "unrelated-id"})).toBe(false);
  });
  it("accepts 0.70 generation and detects 0.69 generation violations", () => {
    expect(assessResponse(202, generated(0.7), find("supported_edit")).verdict).toBe("pass");
    expect(assessResponse(202, generated(0.69), find("supported_edit")).verdict).toBe("fail");
  });
  it("marks a lawful low-confidence clarification for a clear edit as needing model review", () => {
    expect(assessResponse(200, {response_type: "clarification", question: "Please clarify", classification: {...classified(0.6),intent:"unclear"}}, find("supported_edit")).verdict).toBe("review");
  });
  it("rejects text responses with a task or missing answer", () => {
    expect(assessResponse(200, {response_type: "text_answer", answer: "Advice", task_id: "wrong"}, find("roof_advice")).verdict).toBe("fail");
    expect(assessResponse(200, {response_type: "text_answer"}, find("roof_advice")).verdict).toBe("fail");
  });
  it("distinguishes expected 422 from connectivity and provider errors", () => {
    expect(assessResponse(422, {detail:[{msg:"Invalid URL"}]}, find("invalid_url")).verdict).toBe("pass");
    expect(assessResponse(503, {detail:"Provider unavailable"}, find("roof_advice")).verdict).toBe("fail");
  });
  it("detects override generation and missing mixed disclosure", () => {
    expect(assessResponse(202, {...generated(),classification:{...classified(),override_attempt_detected:true}}, find("override")).verdict).toBe("fail");
    expect(assessResponse(202, {...generated(),classification:{...classified(),unsupported_changes:["Roof unsupported"]}}, find("supported_edit")).verdict).toBe("fail");
  });
  it("requires a accompanying answer for mixed advice and no classification for empty notes", () => {
    expect(assessResponse(202, generated(), find("mixed_advice")).verdict).toBe("fail");
    expect(assessResponse(202, {response_type:"image_generation",task_id:"1"}, find("empty")).verdict).toBe("pass");
    expect(assessResponse(202, generated(), find("empty")).verdict).toBe("fail");
  });
});


describe("unrelated question response", () => {
  const response = {response_type:"unrelated_question", answer:"This question isn’t related to your property design project. Please ask a project-related question.", classification:{...classified(0),intent:"unrelated",scope_supported:false,requested_changes:[]}};
  const nestedResponse = {
    status: "text_answer",
    result: {
      response_type: "text_answer",
      answer: "This question isn’t related to your property design project. Please ask a project-related question.",
      unsupported_changes: [],
      classification: {
        intent: "unrelated",
        image_edit_confidence: 0,
        architectural_change_requested: false,
        scope_supported: false,
        requested_changes: [],
        unsupported_changes: [],
        edit_independent: false,
        override_attempt_detected: false,
        question: "how are you",
        reason: "The input is a general greeting unrelated to the project or image editing.",
        clarification_question: "",
      },
    },
  };
  it("accepts the fixed redirect and never polls it", () => {
    expect(assessResponse(200, response, find("unrelated")).verdict).toBe("pass");
    expect(shouldPoll(200,response)).toBe(false);
    expect(responseText(response)).toBe(response.answer);
  });
  it("accepts the nested status text_answer format when image is not generated", () => {
    expect(assessResponse(200, nestedResponse, find("unrelated")).verdict).toBe("pass");
    expect(shouldPoll(200, nestedResponse)).toBe(false);
    expect(responseText(nestedResponse)).toBe(nestedResponse.result.answer);
    expect(classificationOf(nestedResponse)?.intent).toBe("unrelated");
  });
  it("rejects a generated answer or task ID on the unrelated branch", () => {
    expect(assessResponse(200,{...response,answer:"Cricket score"},find("unrelated")).verdict).toBe("fail");
    expect(assessResponse(200,{...response,task_id:"wrong"},find("unrelated")).verdict).toBe("fail");
  });
});
