import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToString } from "react-dom/server";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import DesignSummaryCard from "./DesignSummaryCard";
import briefReducer from "../../../store/briefSlice";
import enterpriseReducer from "../../../store/enterprise/enterpriseSlice";
import questionnaireReducer from "../../../store/questionnaires/questionnaireSlice";

function createMockStore({
  scopeAnswer = "Plan and Specs Only",
  status = null as string | null,
}) {
  return configureStore({
    reducer: {
      chat: briefReducer,
      enterprise: enterpriseReducer,
      questionnaires: questionnaireReducer,
    },
    preloadedState: {
      chat: {
        id: "test",
        work_type: "front_yard" as const,
        watermark: null,
        image_url: null,
        value: null,
        original: {
          project_scope: {
            name: "Select The Asset You Would Like To Receive",
            question: "Select The Asset You Would Like To Receive",
            answer: scopeAnswer,
          },
        },
        revision_comment: { notes: "", files: [] },
        role: "enterprise",
        status,
      },
      enterprise: {
        entries: [],
        lifecycle: "idle" as const,
        error: null,
        editId: null,
      },
      questionnaires: {
        data: null,
        signature: null,
        questionnaireSequence: ["project_scope"],
        lifecycle: "idle" as const,
        error: null,
        lastFetchedAt: null,
      },
    },
  });
}

describe("DesignSummaryCard - Plan and Specs Only proceed button disabling", () => {
  it("enables the Proceed button before clicking (status is null) and keeps active color styling", () => {
    const store = createMockStore({ scopeAnswer: "Plan and Specs Only", status: null });
    const html = renderToString(
      <Provider store={store}>
        <DesignSummaryCard
          answers={{}}
          uploadTotal={0}
          onGenerate={vi.fn()}
          onChanges={vi.fn()}
        />
      </Provider>
    );

    // Active color gradient preserved
    expect(html).toContain("from-emerald-500 to-teal-600");
    // Button not disabled
    expect(html).toContain("Proceed</button>");
    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>[\s\S]*?Proceed<\/button>/);
  });

  it.each(["engage_designer", "skip", "all_i_need"])(
    "disables the Proceed button when status is %s for Plan and Specs Only",
    (status) => {
      const store = createMockStore({ scopeAnswer: "Plan and Specs Only", status });
      const html = renderToString(
        <Provider store={store}>
          <DesignSummaryCard
            answers={{}}
            uploadTotal={0}
            onGenerate={vi.fn()}
            onChanges={vi.fn()}
          />
        </Provider>
      );

      // Button is disabled
      expect(html).toMatch(/<button[^>]*disabled=""[^>]*>[\s\S]*?Proceed<\/button>/);
      // Active gradient class remains unchanged on the element
      expect(html).toContain("from-emerald-500 to-teal-600");
    }
  );

  it("does not disable the Proceed button when scope is Plan, Specs and Renderings and status is engage_designer", () => {
    const store = createMockStore({ scopeAnswer: "Plan, Specs and Renderings", status: "engage_designer" });
    const html = renderToString(
      <Provider store={store}>
        <DesignSummaryCard
          answers={{}}
          uploadTotal={0}
          onGenerate={vi.fn()}
          onChanges={vi.fn()}
        />
      </Provider>
    );

    expect(html).not.toMatch(/<button[^>]*disabled=""[^>]*>[\s\S]*?Proceed<\/button>/);
  });
});
