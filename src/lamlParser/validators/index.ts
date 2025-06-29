// Main validation function
export { validateLaml } from './core/validateLaml.js';

// Types and interfaces
export type { 
  LamlValidationResult,
  ValidationContext,
  ReferenceInfo,
  DefinitionInfo,
  CircularReference,
  OverlappingDomains,
  AliasInfo,
} from './types.js';

// Utilities
export { AutoFixManager } from './utils/autoFixManager.js';

// Core validators
export { validateMandatorySections } from './core/validateMandatorySections.js';
export { validateMetaSection } from './core/validateMetaSection.js';
export { validateMetaFieldValue } from './core/validateMetaFieldValue.js';

// Reference validators
export { validateReferences } from './references/validateReferences.js';
export { validateYamlMergeKeys } from './references/validateYamlMergeKeys.js';
export { findAllReferences, findAllDefinitions, isValidReference, referenceExists } from './references/referenceUtils.js';

// Value validators
export { validateValueTypes } from './values/validateValueTypes.js';
export { validateLiteralOrDescriptiveValue } from './values/validateLiteralOrDescriptiveValue.js';


// Domain validators
export { validateDomainsField } from './domains/validateDomainsField.js';
export { isValidDomainFormat } from './domains/domainUtils.js';

// Structure validators
export { validateStructurePrinciples } from './structure/validateStructurePrinciples.js';
export { formatDataStructures } from './structure/formatDataStructures.js';
export { validateYamlWrapping } from './structure/validateYamlWrapping.js';
export { validateMetaPosition } from './structure/validateMetaPosition.js';

// Conversion utilities
export { convertAliasesToReferences } from './conversion/convertAliasesToReferences.js';

// Utilities
export { 
  isProperLiteralFormat,
  isLiteralValue,
  formatAsLiteral,
  isBooleanTrigger
} from './utils/literalUtils.js';

export { extractYamlFromMarkdown, hasUnwrappedContent, wrapInYamlBlocks } from './utils/markdownUtils.js'; 
