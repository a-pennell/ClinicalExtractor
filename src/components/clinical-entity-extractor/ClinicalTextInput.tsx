import type React from "react";

type ClinicalTextInputProps = {
  value: string;
  onChange: (value: string) => void;
  onSelectionChange?: (start: number, end: number) => void;
};

export function ClinicalTextInput({ value, onChange, onSelectionChange }: ClinicalTextInputProps) {
  function handleSelectionChange(event: React.SyntheticEvent<HTMLTextAreaElement>) {
    onSelectionChange?.(event.currentTarget.selectionStart, event.currentTarget.selectionEnd);
  }

  return (
    <label className="text-input-label">
      <span>Clinical text</span>
      <textarea
        value={value}
        onChange={(event) => onChange(event.target.value)}
        onKeyUp={handleSelectionChange}
        onMouseUp={handleSelectionChange}
        onSelect={handleSelectionChange}
        placeholder="Paste or type clinical text..."
        rows={12}
      />
    </label>
  );
}
