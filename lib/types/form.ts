export type FormFieldType =
  | "text"
  | "email"
  | "phone"
  | "address"
  | "select"
  | "radio"
  | "checkbox"
  | "textarea"
  | "hidden";

export interface FormFieldOption {
  value: string;
  label: string;
}

export interface FieldVisibilityRule {
  /** The controlling field id in the same schema. */
  whenFieldId: string;
  /** Show this field only when controlling field equals this value. */
  equals: string;
}

export interface FormFieldConfig {
  id: string;
  type: FormFieldType;
  label: string;
  placeholder?: string;
  required?: boolean;
  order?: number;
  options?: FormFieldOption[];
  helperText?: string;
  /** When true, field is shown in an "Optional" section style (e.g. frosted panel) */
  optionalSection?: boolean;
  /** When true, render this field using a boxed, stacked style (radios/checkboxes) */
  boxedStyle?: boolean;
  /**
   * Conditional visibility rule.
   * When set, the field is only shown when another field matches the rule.
   */
  visibility?: FieldVisibilityRule;
}

export interface FormSchema {
  fields: FormFieldConfig[];
}

