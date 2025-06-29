import * as yaml from 'yaml';
import { ValidationContext, OverlappingDomains } from '../types.js';
import { isValidDomainFormat } from './domainUtils.js';

/**
 * Validates domains field according to LAML specification
 */
export function validateDomainsField(context: ValidationContext, metaMap: yaml.YAMLMap): void {
  const { session } = context;
  
  const domainsItem = metaMap.items.find(item =>
    yaml.isScalar(item.key) && item.key.value === 'domains'
  );
  
  if (!domainsItem) {
    session.logger.addError({
      code: 'LAML_META_DOMAINS_MISSING',
      message: 'domains field is required in $meta section',
      context: { missingField: 'domains' }
    });
    return;
  }
  
  if (!yaml.isSeq(domainsItem.value)) {
    session.logger.addError({
      code: 'LAML_META_DOMAINS_INVALID_TYPE',
      message: '$meta.domains must be an array',
      context: { actualType: typeof domainsItem?.value || 'undefined' }
    });
    return;
  }

  const domainsSeq = domainsItem.value;

  // Check if domains array is empty
  if (domainsSeq.items.length === 0) {
    session.logger.addError({
      code: 'LAML_DOMAINS_EMPTY',
      message: '$meta.domains array cannot be empty - at least one domain is required',
      context: { domainsCount: 0 }
    });
    return;
  }

  const domains: string[] = [];

  // Validate each domain
  for (const item of domainsSeq.items) {
    if (!yaml.isScalar(item) || typeof item.value !== 'string') {
      session.logger.addError({
        code: 'LAML_DOMAIN_INVALID_TYPE',
        message: 'All domain values must be strings',
        context: { actualType: typeof item }
      });
      continue;
    }

    const domain = item.value;
    domains.push(domain);

    // Validate domain format (dot notation, camelCase, max 4 levels)
    if (!isValidDomainFormat(domain)) {
      session.logger.addError({
        code: 'LAML_DOMAIN_INVALID_FORMAT', 
        message: `Invalid domain format - must be dot notation with camelCase (maximum of 4 levels): ${domain}`,
        context: { 
          domain,
          expected: 'level1.level2.level3.level4 (maximum of 4 levels, camelCase)'
        }
      });
    }
  }

  // Auto-fix duplicate domains by removing duplicates
  const uniqueDomains = new Set(domains);
  if (uniqueDomains.size !== domains.length) {
    const duplicates = domains.filter((domain, index) => domains.indexOf(domain) !== index);
    
    // Remove duplicate items from the YAML sequence, keeping only the first occurrence
    const indicesToRemove: number[] = [];
    for (let i = domains.length - 1; i >= 0; i--) {
      const domain = domains[i];
      if (domains.indexOf(domain) !== i) {
        indicesToRemove.push(i);
      }
    }
    
    // Remove duplicates from the YAML sequence
    for (const index of indicesToRemove) {
      domainsSeq.items.splice(index, 1);
    }
    
    // Update domains array to reflect the changes
    domains.splice(0, domains.length, ...Array.from(uniqueDomains));
    
    // Track the auto-fix
    context.autoFixedIssues.push(`Removed duplicate domains: ${duplicates.join(', ')}`);
  }

  // Validate maximum 3 domains
  if (domains.length > 3) {
    session.logger.addError({
      code: 'LAML_DOMAINS_COUNT_EXCEEDED',
      message: `Maximum 3 domains allowed, found ${domains.length}`,
      context: { 
        domainsCount: domains.length,
        maxAllowed: 3,
        domains 
      }
    });
  }

  // Validate non-overlapping domains
  const overlappingPairs = findOverlappingDomains(domains);
  for (const pair of overlappingPairs) {
    session.logger.addError({
      code: 'LAML_DOMAINS_OVERLAPPING',
      message: `Found overlapping domains: ${pair.domain1} and ${pair.domain2}`,
      context: { 
        domain1: pair.domain1,
        domain2: pair.domain2,
        explanation: 'Domain paths must not be subsets of each other'
      }
    });
  }
}

/**
 * Finds overlapping domains (where one is a subset of another)
 */
function findOverlappingDomains(domains: string[]): OverlappingDomains[] {
  const overlapping: OverlappingDomains[] = [];
  
  for (let i = 0; i < domains.length; i++) {
    for (let j = i + 1; j < domains.length; j++) {
      const domain1 = domains[i];
      const domain2 = domains[j];
      
      // Check if one domain is a prefix of another
      if (domain1.startsWith(domain2 + '.') || domain2.startsWith(domain1 + '.')) {
        overlapping.push({ domain1, domain2 });
      }
    }
  }
  
  return overlapping;
} 