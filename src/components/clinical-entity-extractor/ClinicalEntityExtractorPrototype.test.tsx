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

    fireEvent.click(screen.getByRole("button", { name: /delete/i }));

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

    expect(screen.getByText("document output")).toBeTruthy();
    expect(screen.getByText("Session JSON")).toBeTruthy();
    expect(screen.getByText("FHIR Bundle")).toBeTruthy();
    expect(screen.getByRole("button", { name: /copy json/i })).toBeTruthy();
    expect(screen.getByRole("button", { name: /download json/i })).toBeTruthy();
  });

  it("saves and restores the latest extraction session locally", () => {
    render(<ClinicalEntityExtractorPrototype />);

    fireEvent.click(screen.getByRole("button", { name: /save session/i }));
    expect(screen.getByText(/^Saved /)).toBeTruthy();

    fireEvent.change(screen.getByLabelText("Clinical text"), {
      target: { value: "" }
    });
    expect(screen.getByText("Ready to extract")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: /restore latest/i }));
    expect(screen.getAllByText("Hypertension").length).toBeGreaterThan(0);
  });

  it("loads synthetic eval notes from the eval lab", () => {
    render(<ClinicalEntityExtractorPrototype />);

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
