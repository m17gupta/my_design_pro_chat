import { describe, expect, it } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import QuestionCard from "./QuestionCard";
import briefReducer from "../../store/briefSlice";
import type { QuestionCardSpec } from "./types";

function createMockStore(role: string | null = null) {
  return configureStore({
    reducer: {
      chat: briefReducer,
    },
    preloadedState: {
      chat: {
        id: "test",
        work_type: null,
        watermark: null,
        image_url: null,
        value: null,
        original: {},
        revision_comment: { notes: "", files: [] },
        role,
      },
    },
  });
}

const mockSpec: QuestionCardSpec = {
  id: "assessment_confirmation",
  title: "Assessment Confirmation",
  description: "Does this assessment look accurate?",
  fields: [
    {
      kind: "radio",
      options: ["Yes, Continue", "I'd Like to Make Corrections"],
    },
  ],
};

describe("QuestionCard - enterprise-client assessment_confirmation hiding", () => {
  it("hides the card when role is enterprise-client and questionId is assessment_confirmation", () => {
    const store = createMockStore("enterprise-client");
    const html = renderToString(
      <Provider store={store}>
        <QuestionCard
          spec={mockSpec}
          questionId="assessment_confirmation"
          onSubmit={() => {}}
        />
      </Provider>
    );
    expect(html).toBe("");
  });

  it("hides the card when role prop is enterprise-client even if store role is empty", () => {
    const store = createMockStore(null);
    const html = renderToString(
      <Provider store={store}>
        <QuestionCard
          spec={mockSpec}
          questionId="assessment_confirmation"
          role="enterprise-client"
          onSubmit={() => {}}
        />
      </Provider>
    );
    expect(html).toBe("");
  });

  it("renders the card when role is not enterprise-client", () => {
    const store = createMockStore("client");
    const html = renderToString(
      <Provider store={store}>
        <QuestionCard
          spec={mockSpec}
          questionId="assessment_confirmation"
          onSubmit={() => {}}
        />
      </Provider>
    );
    expect(html).toContain("Assessment Confirmation");
    expect(html).toContain("Yes, Continue");
  });

  it("renders the card when questionId is not assessment_confirmation for enterprise-client", () => {
    const store = createMockStore("enterprise-client");
    const lotSizeSpec: QuestionCardSpec = {
      id: "lot_size",
      title: "Lot Size",
      description: "Select lot size",
      fields: [
        {
          kind: "radio",
          options: ["Under 0.25 acres", "0.25 - 0.5 acres"],
        },
      ],
    };
    const html = renderToString(
      <Provider store={store}>
        <QuestionCard
          spec={lotSizeSpec}
          questionId="lot_size"
          onSubmit={() => {}}
        />
      </Provider>
    );
    expect(html).toContain("Lot Size");
    expect(html).toContain("Under 0.25 acres");
  });
});
