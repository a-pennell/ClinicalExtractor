import { fireEvent, render, screen } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { ClinicalEntityExtractorPrototype } from "./ClinicalEntityExtractorPrototype";

describe("ClinicalEntityExtractorPrototype", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("clears extracted entities when the source text is deleted", () => {
    render(<ClinicalEntityExtractorPrototype />);

    expect(screen.getAllByText("Hypertension").length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText("Clinical text"), {
      target: { value: "" }
    });

    expect(screen.getByText("Ready to extract")).toBeTruthy();
    expect(screen.getByText("No entity selected")).toBeTruthy();
    expect(screen.getByText("No source text yet.")).toBeTruthy();
    expect(screen.queryAllByText("Hypertension")).toHaveLength(0);
  });

  it("lets reviewers select and reject candidate codes", () => {
    render(<ClinicalEntityExtractorPrototype />);

    fireEvent.click(screen.getByLabelText("Select ICD-10-CM I10"));
    expect(screen.getByText("selected")).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Reject SNOMED-CT 38341003"));
    expect(screen.getByText("rejected")).toBeTruthy();
  });

  it("lets reviewers edit and mark an entity reviewed", () => {
    render(<ClinicalEntityExtractorPrototype />);

    fireEvent.change(screen.getByLabelText("Display name"), {
      target: { value: "HTN reviewed" }
    });
    fireEvent.change(screen.getByLabelText("Reviewer note"), {
      target: { value: "Confirmed from assessment." }
    });
    fireEvent.click(screen.getByRole("button", { name: /save edits/i }));

    expect(screen.getAllByText("HTN reviewed").length).toBeGreaterThan(0);
    expect(screen.getAllByText("edited").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByRole("button", { name: /mark reviewed/i }));
    expect(screen.getAllByText("reviewed").length).toBeGreaterThan(0);
  });

  it("lets reviewers delete false positive entities", () => {
    render(<ClinicalEntityExtractorPrototype />);

    fireEvent.click(screen.getByRole("button", { name: "Delete" }));

    expect(screen.queryAllByText("Hypertension")).toHaveLength(0);
  });

  it("lets reviewers add a manual entity from selected text", () => {
    render(<ClinicalEntityExtractorPrototype />);
    const textarea = screen.getByLabelText("Clinical text") as HTMLTextAreaElement;

    textarea.setSelectionRange(4, 14);
    fireEvent.select(textarea);
    fireEvent.change(screen.getByLabelText("Manual entity type"), {
      target: { value: "finding" }
    });
    fireEvent.click(screen.getByRole("button", { name: /add selected entity/i }));

    expect(screen.getAllByText("controlled").length).toBeGreaterThan(0);
    expect(screen.getAllByText("manual").length).toBeGreaterThan(0);
    expect(screen.getAllByText("finding").length).toBeGreaterThan(0);
  });

  it("shows document-level JSON and FHIR bundle output", () => {
    render(<ClinicalEntityExtractorPrototype />);

    expect(screen.getByText("output package")).toBeTruthy();
    expect(screen.getByText("Session data")).toBeTruthy();
    expect(screen.getByText("Reviewer handoff")).toBeTruthy();
    expect(screen.getByText("Session JSON")).toBeTruthy();
    expect(screen.getByText("FHIR Bundle")).toBeTruthy();
    expect(screen.getByText("Entity and terminology inventory")).toBeTruthy();
    expect(screen.getByLabelText("FHIR quality")).toBeTruthy();
    expect(screen.getByText("Local checks passed")).toBeTruthy();
    expect(screen.getByRole("button", { name: /copy json/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /download json/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /copy fhir/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /download fhir/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /download report/i })).toBeTruthy();
    expect(screen.getAllByText(/prototype-2026-06/i).length).toBeGreaterThan(0);
  });

  it("keeps specialty context buttons distinct from sample loading controls", () => {
    render(<ClinicalEntityExtractorPrototype />);

    expect(screen.getAllByRole("button", { name: "Primary Care" })).toHaveLength(1);
    expect(screen.getByLabelText("Example note")).toBeTruthy();
    expect(screen.getByLabelText("Eval context filter")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Example note"), {
      target: { value: "mental-health" }
    });

    expect((screen.getByLabelText("Clinical text") as HTMLTextAreaElement).value).toContain("PHQ-9 18");
  });

  it("saves and restores the latest extraction session locally", () => {
    render(<ClinicalEntityExtractorPrototype />);

    fireEvent.click(screen.getByRole("button", { name: /save session/i }));
    expect(screen.getByText("Session saved.")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Clinical text"), {
      target: { value: "" }
    });
    expect(screen.getByText("Ready to extract")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /restore latest/i }));
    expect(screen.getAllByText("Hypertension").length).toBeGreaterThan(0);
  });

  it("imports an exported session JSON file", async () => {
    render(<ClinicalEntityExtractorPrototype />);
    const importedSession = {
      schemaVersion: "prototype-1",
      specialty: "mental-health",
      specialtyLabel: "Mental Health",
      sourceText: "Major depression. Denies SI.",
      sections: [],
      summary: {
        entityCount: 2,
        reviewedCount: 1,
        selectedCodingCount: 0,
        relationCount: 0,
        highPriorityReviewCount: 0,
        byType: { problem: 1, risk: 1 }
      },
      terminology: {
        provider: { id: "local-static", label: "Local static terminology map", contentVersion: "prototype-2026-06", mode: "offline-prototype" },
        systems: [],
        limitations: []
      },
      entities: [
        {
          id: "problem-major-depression",
          canonicalName: "major depressive disorder",
          displayName: "Major depressive disorder",
          type: "problem",
          specialties: ["mental-health"],
          mentions: [{ text: "Major depression", start: 0, end: 16 }],
          attributes: { assertion: "present" },
          confidence: "medium",
          review: { status: "reviewed", note: "Imported review." }
        }
      ]
    };
    const file = new File([JSON.stringify(importedSession)], "session.json", { type: "application/json" });

    fireEvent.change(screen.getByLabelText("Import session JSON"), {
      target: { files: [file] }
    });

    expect(await screen.findByText("Session imported.")).toBeTruthy();
    expect((await screen.findAllByText("Major depressive disorder")).length).toBeGreaterThan(0);
  });

  it("loads synthetic eval notes from the eval lab", () => {
    render(<ClinicalEntityExtractorPrototype />);

    fireEvent.click(screen.getByText("Eval lab"));

    expect(screen.getByText("Coverage dashboard")).toBeTruthy();
    expect(screen.getByText("Entity mix")).toBeTruthy();
    expect(screen.getByText("Terminology")).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Eval note"), {
      target: { value: "mixed-diabetes-depression" }
    });
    fireEvent.click(screen.getByRole("button", { name: /load eval note/i }));

    expect(screen.getAllByText("Major depressive disorder").length).toBeGreaterThan(0);
    expect(screen.getByText("mixed-diabetes-depression")).toBeTruthy();
  });

  it("lets reviewers adjudicate inferred entity relations", () => {
    render(<ClinicalEntityExtractorPrototype />);

    fireEvent.click(screen.getByRole("button", { name: /Lisinopril high confidence/i }));
    expect(screen.getByText(/treats: Hypertension/i)).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Accept relation to Hypertension"));
    expect(screen.getByText(/high confidence · accepted/i)).toBeTruthy();

    fireEvent.click(screen.getByLabelText("Reject relation to Hypertension"));
    expect(screen.getByText(/high confidence · rejected/i)).toBeTruthy();
  });

  it("runs mock async terminology lookup and expansion from the detail panel", async () => {
    render(<ClinicalEntityExtractorPrototype />);

    fireEvent.click(screen.getByText("Terminology lookup"));
    fireEvent.click(screen.getByRole("button", { name: /lookup entity/i }));
    expect(await screen.findByText(/\$lookup · Hypertension/i)).toBeTruthy();
    expect(screen.getAllByText("ICD-10-CM I10").length).toBeGreaterThan(0);

    fireEvent.change(screen.getByLabelText("Search term"), {
      target: { value: "pressure" }
    });
    fireEvent.change(screen.getByLabelText("System"), {
      target: { value: "LOINC" }
    });
    fireEvent.click(screen.getByRole("button", { name: /search terminology/i }));

    expect(await screen.findByText(/\$expand · pressure/i)).toBeTruthy();
    expect(screen.getByText("LOINC 85354-9")).toBeTruthy();
  });
});
