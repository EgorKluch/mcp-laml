import * as yaml from 'yaml';
import { ValidationContext } from '../types.js';
import { isProperLiteralFormat } from '../utils/literalUtils.js';

/**
 * Validates individual $meta field values according to LAML specification
 */
export function validateMetaFieldValue(context: ValidationContext, field: string, fieldItem: yaml.Pair): void {
  const { session } = context;
  
  // Handle both scalar and non-scalar values
  let value: any;
  let isScalar = false;
  
  if (yaml.isScalar(fieldItem.value)) {
    value = fieldItem.value.value;
    isScalar = true;
  } else {
    value = fieldItem.value;
    isScalar = false;
  }

  switch (field) {
    case 'name':
      // Must be string and camelCase literal
      if (!isScalar) {
        session.logger.addError({
          code: 'LAML_META_FIELD_INVALID_TYPE',
          message: `$meta.${field} must be a scalar value`,
          context: { field, actualType: typeof fieldItem.value }
        });
        return;
      }
      
      if (typeof value !== 'string') {
        session.logger.addError({
          code: 'LAML_META_NAME_INVALID_TYPE',
          message: `$meta.name must be a string: ${value}`,
          context: { field, value, expectedType: 'string' }
        });
        return;
      }
      
      if (value.trim().length === 0) {
        session.logger.addError({
          code: 'LAML_META_NAME_EMPTY',
          message: `$meta.name cannot be empty`,
          context: { field, value }
        });
        return;
      }
      
      if (!isProperLiteralFormat(value)) {
        session.logger.addError({
          code: 'LAML_META_NAME_INVALID_FORMAT',
          message: `$meta.name must be in camelCase format: ${value}`,
          context: { field, value, expected: 'camelCase like "documentName"' }
        });
      }
      break;
      
    case 'purpose':
      // Must be string and descriptive (natural language)
      if (!isScalar) {
        session.logger.addError({
          code: 'LAML_META_FIELD_INVALID_TYPE',
          message: `$meta.${field} must be a scalar value`,
          context: { field, actualType: typeof fieldItem.value }
        });
        return;
      }
      
      if (typeof value !== 'string') {
        session.logger.addError({
          code: 'LAML_META_PURPOSE_INVALID_TYPE',
          message: `$meta.purpose must be a string: ${value}`,
          context: { field, value, expectedType: 'string' }
        });
        return;
      }
      
      if (value.trim().length === 0) {
        session.logger.addError({
          code: 'LAML_META_PURPOSE_INVALID',
          message: `$meta.purpose cannot be empty`,
          context: { field, value }
        });
      }
      break;
      
    case 'version':
      // Must be numeric - can be scalar or direct number
      if (typeof value !== 'number') {
        session.logger.addError({
          code: 'LAML_META_VERSION_INVALID_TYPE',
          message: `$meta.version must be a number: ${value}`,
          context: { field, value, expectedType: 'number' }
        });
        return;
      }
      
      if (value < 0) {
        session.logger.addError({
          code: 'LAML_META_VERSION_NEGATIVE',
          message: `$meta.version must be positive: ${value}`,
          context: { field, value }
        });
      }
      break;
      
    case 'spec':
      // Must be string and valid path
      if (!isScalar) {
        session.logger.addError({
          code: 'LAML_META_FIELD_INVALID_TYPE',
          message: `$meta.${field} must be a scalar value`,
          context: { field, actualType: typeof fieldItem.value }
        });
        return;
      }
      
      if (typeof value !== 'string') {
        session.logger.addError({
          code: 'LAML_META_SPEC_INVALID_TYPE',
          message: `$meta.spec must be a string: ${value}`,
          context: { field, value, expectedType: 'string' }
        });
        return;
      }
      
      if (value.trim().length === 0) {
        session.logger.addError({
          code: 'LAML_META_SPEC_INVALID',
          message: `$meta.spec cannot be empty`,
          context: { field, value }
        });
      }
      break;
      

      
    case 'goal':
      // Must be string and camelCase
      if (!isScalar) {
        session.logger.addError({
          code: 'LAML_META_FIELD_INVALID_TYPE',
          message: `$meta.${field} must be a scalar value`,
          context: { field, actualType: typeof fieldItem.value }
        });
        return;
      }
      
      if (typeof value !== 'string') {
        session.logger.addError({
          code: 'LAML_META_GOAL_INVALID_TYPE',
          message: `$meta.goal must be a string: ${value}`,
          context: { field, value, expectedType: 'string' }
        });
        return;
      }
      
      if (!isProperLiteralFormat(value)) {
        session.logger.addError({
          code: 'LAML_META_GOAL_INVALID_FORMAT',
          message: `$meta.goal must be in camelCase format: ${value}`,
          context: { field, value, expected: 'camelCase' }
        });
      }
      break;
      

  }
} 