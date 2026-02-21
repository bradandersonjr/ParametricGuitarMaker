import type { Parameter, ParameterGroup, PendingParam } from "@/types"

export interface GroupSchemaRef {
  id: string
  label: string
}

export interface ParamInfoModalProps {
  param: Parameter
  currentGroupId: string
  groupSchemas: GroupSchemaRef[]
  allParamNames: Set<string>
  displayValue: string
  unit: string
  isSchema: boolean
  onClose: () => void
  customCategories: GroupSchemaRef[]
  onAddCustomCategory?: (id: string, label: string) => void
  onRemoveCustomCategory?: (id: string) => void
  documentUnit?: string
  isInitial: boolean
}

export interface SchemaParamRowProps {
  param: Parameter
  displayValue: string
  displayUnit: string
  modified: boolean
  hasError: boolean
  errorMessage?: string
  scaleMode: "single" | "multi"
  radiusMode: "compound" | "straight" | "flat"
  editStartValues: Record<string, string>
  groupSchemas: GroupSchemaRef[]
  allParamNames: Set<string>
  onChange: (name: string, val: string) => void
  onFocus: (name: string) => void
  onBlur: (name: string, currentValOverride?: string) => void
  customCategories: GroupSchemaRef[]
  onAddCustomCategory?: (id: string, label: string) => void
  onRemoveCustomCategory?: (id: string) => void
  documentUnit?: string
  isInitial: boolean
}

export interface ExtraParamRowProps {
  param: Parameter
  currentGroupId: string
  groupSchemas: GroupSchemaRef[]
  displayValue: string
  modified: boolean
  unit: string
  allParamNames: Set<string>
  onChange: (name: string, val: string) => void
  onFocus: (name: string) => void
  onBlur: (name: string, currentValOverride?: string) => void
  customCategories: GroupSchemaRef[]
  onAddCustomCategory?: (id: string, label: string) => void
  onRemoveCustomCategory?: (id: string) => void
  documentUnit?: string
}

export interface AddParamFormProps {
  groupId: string
  documentUnit: string
  allParamNames: Set<string>
  onCancel: () => void
}

export interface GroupSectionProps {
  group: ParameterGroup
  displayValues: Record<string, string>
  originalExpressions: Record<string, string>
  onChange: (name: string, val: string) => void
  onFocus: (name: string) => void
  onBlur: (name: string, currentValOverride?: string) => void
  defaultOpen: boolean
  searchQuery: string
  scaleMode: "single" | "multi"
  radiusMode: "compound" | "straight" | "flat"
  documentUnit: string
  validationErrors: Record<string, string>
  editStartValues: Record<string, string>
  errorFilter: Set<string> | null
  pendingParams: PendingParam[]
  categorizedExtras: Parameter[]
  groupSchemas: GroupSchemaRef[]
  isAddFormOpen: boolean
  onOpenAddForm: () => void
  onCloseAddForm: () => void
  onRemovePendingParam: (id: string) => void
  onPendingParamChange: (id: string, value: string) => void
  allParamNames: Set<string>
  showAddButton: boolean
  customCategories: GroupSchemaRef[]
  onAddCustomCategory: (id: string, label: string) => void
  onRemoveCustomCategory: (id: string) => void
  isInitial: boolean
  disabled?: boolean
  dragHandleProps?: Record<string, unknown>
}

export interface CustomCategorySectionProps {
  category: GroupSchemaRef
  extraParams: Parameter[]
  displayValues: Record<string, string>
  originalExpressions: Record<string, string>
  onChange: (name: string, val: string) => void
  onFocus: (name: string) => void
  onBlur: (name: string, currentValOverride?: string) => void
  searchQuery: string
  parameterMap: Record<string, { unit: string }>
  groupSchemas: GroupSchemaRef[]
  allParamNames: Set<string>
  customCategories: GroupSchemaRef[]
  onAddCustomCategory?: (id: string, label: string) => void
  onRemoveCustomCategory?: (id: string) => void
  documentUnit: string
  isAddFormOpen: boolean
  onOpenAddForm: () => void
  onCloseAddForm: () => void
}

export interface UncategorizedSectionProps {
  extraParams: Parameter[]
  displayValues: Record<string, string>
  originalExpressions: Record<string, string>
  onChange: (name: string, val: string) => void
  onFocus: (name: string) => void
  onBlur: (name: string, currentValOverride?: string) => void
  searchQuery: string
  parameterMap: Record<string, { unit: string }>
  groupSchemas: GroupSchemaRef[]
  allParamNames: Set<string>
  customCategories: GroupSchemaRef[]
  onAddCustomCategory?: (id: string, label: string) => void
  onRemoveCustomCategory?: (id: string) => void
  documentUnit?: string
}
