import { describe, expect, it } from "vitest";
import {
  buildEnterpriseClientPayload,
  extractAnswerValue,
} from "./enterpriseClientPayload";

describe("extractAnswerValue", () => {
  it("extracts simple string values", () => {
    expect(extractAnswerValue("Modern")).toBe("Modern");
  });

  it("extracts array values from brief items", () => {
    const item = {
      name: "Most Important Improvement",
      question: "...",
      answer: {
        notes: "",
        value: ["Better curb appeal", "Better landscaping"],
      },
    };
    expect(extractAnswerValue(item)).toEqual([
      "Better curb appeal",
      "Better landscaping",
    ]);
  });

  it("appends notes when present alongside value array", () => {
    const item = {
      name: "Site Concerns",
      answer: {
        notes: "Need attention to front corner",
        value: ["Drainage Issues"],
      },
    };
    expect(extractAnswerValue(item)).toEqual([
      "Drainage Issues",
      "Need attention to front corner",
    ]);
  });
});

describe("buildEnterpriseClientPayload", () => {
  it("transforms standard brief payload into clean key-answer payload matching Untitled-1", () => {
    const inputPayload = {
      projectId: 177,
      watermark: "https://mydesigns.pro/img/luna-logo.png",
      work_type: "color_material",
      image_url:
        "https://dzinlyv2.s3.us-east-2.amazonaws.com/local/projects/177/front/Test_Project_1773334626.jpg",
      value: "",
      user_type: "landscape-design",
      dc_name: "",
      role: "enterprise-client",
      original: {
        property_verified: {
          name: "Verify Property",
          answer: "Yes, this is correct",
          question: "<p>Please confirm</p>",
        },
        most_important_improvement: {
          name: "Most Important Improvement",
          answer: {
            notes: "",
            value: [
              "More entertaining space",
              "Better landscaping",
            ],
          },
          question: "<p>What is</p>",
        },
        site_concerns: {
          name: "Site Concerns",
          answer: {
            notes: "",
            value: [
              "Lack of Privacy",
              "Outdated Appearance",
            ],
          },
          question: "<p>Are there</p>",
        },
        existing_features: {
          name: "Existing Features",
          answer: {
            notes: "",
            value: ["Existing Patio", "Pool"],
          },
          question: "<p>Which</p>",
        },
        important_property_notes: {
          name: "Important Property Notes",
          question: "<p>Is there</p>",
          answer: {
            value: ["HOA requirements", "Septic field"],
            notes: "",
          },
        },
        ai_site_assessment_existing_conditions: {
          name: "Existing Conditions",
          answer: {
            notes: "",
            value: ["Sun/shade observations"],
          },
          question: "",
        },
        ai_site_assessment_opportunities: {
          name: "Opportunities",
          answer: {
            notes: "",
            value: ["Privacy enhancement opportunities"],
          },
          question: "",
        },
        ai_site_assessment_potential_constraints: {
          name: "Potential Constraints",
          answer: {
            notes: "",
            value: ["Grade changes"],
          },
          question: "",
        },
        assessment_confirmation: {
          name: "Assessment Confirmation",
          question: "<p>Does this</p>",
          answer: "Yes, Continue",
        },
        primary_uses: {
          name: "Primary Uses",
          question: "<p>How</p>",
          answer: {
            value: ["Relaxation", "Fire Feature"],
            notes: "",
          },
        },
        must_have_features: {
          name: "Must-Have Features",
          question: "<p>What</p>",
          answer: {
            value: ["Pergola", "Hot Tub"],
            notes: "",
          },
        },
        design_style: {
          name: "Design Style",
          question: "<p>Which</p>",
          answer: "Contemporary",
        },
        desired_feeling: {
          name: "Desired Feeling",
          question: "<p>How</p>",
          answer: {
            value: ["Private", "Resort-Like"],
            notes: "",
          },
        },
        design_preferences: {
          name: "Design Preferences",
          question: "<p>What</p>",
          answer: {
            value: [
              "High Maintenance Landscaping",
              "Modern Architecture",
            ],
            notes: "",
          },
        },
        material_preferences_material: {
          name: "Material Preferences (Materials)",
          question: "<p>Which</p>",
          answer: "Composite Materials",
        },
        material_preferences_accent_colors: {
          name: "Material Preferences (Accent Colors)",
          question: "<p>Which</p>",
          answer: "Bronze",
        },
        evening_use_lighting: {
          name: "Evening Use & Lighting",
          question: "<p>How</p>",
          answer: "Not Important",
        },
        privacy_importance: {
          name: "Privacy Importance",
          question: "How",
          answer: "Not Important",
        },
        maintenance_preference: {
          name: "Maintenance Preference",
          question: "<p>How</p>",
          answer: "Low",
        },
        budget_range: {
          name: "Budget Range",
          question: "<p>What</p>",
          answer: "Under $25,000",
        },
        defining_success: {
          name: "Defining Success",
          question: "<p>If</p>",
          answer: "sfddf",
        },
      },
      revision_comment: { files: [], notes: "" },
    };

    const result = buildEnterpriseClientPayload(inputPayload);

    expect(result.watermark).toBe("https://mydesigns.pro/img/luna-logo.png");
    expect(result.image_url).toBe(
      "https://dzinlyv2.s3.us-east-2.amazonaws.com/local/projects/177/front/Test_Project_1773334626.jpg"
    );
    expect(result.revisions).toEqual({});

    // UI gates should be excluded
    expect(result.original.property_verified).toBeUndefined();
    expect(result.original.assessment_confirmation).toBeUndefined();

    // Direct answer mappings
    expect(result.original.most_important_improvement).toEqual([
      "More entertaining space",
      "Better landscaping",
    ]);
    expect(result.original.site_concerns).toEqual([
      "Lack of Privacy",
      "Outdated Appearance",
    ]);
    expect(result.original.existing_features).toEqual([
      "Existing Patio",
      "Pool",
    ]);
    expect(result.original.important_property_notes).toEqual([
      "HOA requirements",
      "Septic field",
    ]);
    expect(result.original.design_style).toBe("Contemporary");
    expect(result.original.material_preferences_material).toBe("Composite Materials");
    expect(result.original.material_preferences_accent_colors).toBe("Bronze");
    expect(result.original.defining_success).toBe("sfddf");

    // Sub-questions grouped under ai_site_assessment
    expect(result.original.ai_site_assessment).toEqual({
      ai_site_assessment_existing_conditions: ["Sun/shade observations"],
      ai_site_assessment_opportunities: ["Privacy enhancement opportunities"],
      ai_site_assessment_potential_constraints: ["Grade changes"],
    });
  });

  it("dynamically groups multi_questions and skips gates using provided questionnaires", () => {
    const mockQuestionnaires = {
      "enterprise-client": {
        "landscape-design": {
          phase_1: {
            title: "Site Assessment",
            questions: [
              { id: "property_verified", type: "radio", is_property_address: true },
              {
                id: "custom_group",
                type: "multi_questions",
                multi_questions: [
                  { id: "custom_child_1", type: "checkbox" },
                  { id: "custom_child_2", type: "checkbox" },
                ],
              },
            ],
          },
        },
      },
    };

    const payload = {
      projectId: "cp-138963",
      role: "enterprise-client",
      user_type: "landscape-design",
      original: {
        property_verified: { answer: "Yes" },
        custom_child_1: { answer: ["Option A"] },
        custom_child_2: { answer: ["Option B"] },
        direct_question: { answer: "Hello" },
      },
    };

    const result = buildEnterpriseClientPayload(payload, mockQuestionnaires);

    // Gates skipped
    expect(result.original.property_verified).toBeUndefined();

    // Custom multi-question grouped dynamically under parent group id
    expect(result.original.custom_group).toEqual({
      custom_child_1: ["Option A"],
      custom_child_2: ["Option B"],
    });
    expect(result.original.direct_question).toBe("Hello");
  });

  it("preserves unified multi_questions dictionary answers on original", () => {
    const payload = {
      projectId: "cp-138963",
      role: "enterprise-client",
      user_type: "landscape-design",
      original: {
        ai_site_assessment: {
          name: "AI Site Assessment",
          question: "Luna analyzes",
          answer: {
            ai_site_assessment_existing_conditions: ["Sun/shade observations"],
            ai_site_assessment_opportunities: ["Lighting opportunities"],
            ai_site_assessment_potential_constraints: ["Space limitations"],
          },
        },
      },
    };

    const result = buildEnterpriseClientPayload(payload);
    expect(result.original.ai_site_assessment).toEqual({
      ai_site_assessment_existing_conditions: ["Sun/shade observations"],
      ai_site_assessment_opportunities: ["Lighting opportunities"],
      ai_site_assessment_potential_constraints: ["Space limitations"],
    });
  });
});
