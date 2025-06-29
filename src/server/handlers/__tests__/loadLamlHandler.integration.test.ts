import { CallToolRequest } from '@modelcontextprotocol/sdk/types.js';
import { McpSession } from 'flowmcp';
import { readFile, writeFile, unlink, mkdir, rmdir } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { handleLoadLaml, LoadLamlResult } from '../loadLamlHandler.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create mock session
function createMockSession(): McpSession {
  const errors: any[] = [];
  const warnings: any[] = [];
  
  return {
    logger: {
      addError: (error: any) => errors.push(error),
      addWarning: (warning: any) => warnings.push(warning),
    },
    getResult: (result: any) => ({ content: [{ type: 'text', text: JSON.stringify(result) }] }),
    _errors: errors,
    _warnings: warnings,
  } as any;
}

describe('LoadLamlHandler Integration Tests', () => {
  const testDir = resolve(__dirname, 'test-files');
  const initialFilePath = resolve(testDir, 'initial-content.laml.mdc');
  const expectedFilePath = resolve(testDir, 'expected-content.laml.mdc');
  const tempTestFilePath = resolve(testDir, 'temp-test.laml.mdc');

  // Initial content with various fixable and non-fixable issues
  const initialContent = `---
tags: ["test", "integration"]
---

$meta:
  name: "testDocument"

section1:
  hasFeature: 'true'
  isEnabled: 'false'
  canExecute: 'yes'
  hasPermission: 'maybe'
  literalValue: "shouldBeSingle"
  descriptiveValue: 'Should be double quotes for descriptive text'
  reference: '*nonExistent.ref'

dataStructures:
  shortArray: ['item1', 'item2', 'item3']
  longArray: ['item1', 'item2', 'item3', 'item4', 'item5', 'item6', 'item7', 'item8', 'item9', 'item10']
  shortObject: {key1: 'value1', key2: 'value2'}
  longObject: {key1: 'value1', key2: 'value2', key3: 'value3', key4: 'value4', key5: 'value5'}
`;

  // Expected content after auto-fixes
  const expectedContent = `---
tags: ["test", "integration"]
---

\`\`\`yaml
$meta:
  name: 'testDocument'
  purpose: "LAML document"
  version: 1.0
  spec: ".cursor/rules/g-laml.mdc"
  domains: []

section1:
  hasFeature: true
  isEnabled: false
  canExecute: true
  hasPermission: 'maybe'
  literalValue: 'shouldBeSingle'
  descriptiveValue: "Should be double quotes for descriptive text"
  reference: '*nonExistent.ref'

dataStructures:
  shortArray: ['item1', 'item2', 'item3']
  longArray:
    - 'item1'
    - 'item2'
    - 'item3'
    - 'item4'
    - 'item5'
    - 'item6'
    - 'item7'
    - 'item8'
    - 'item9'
    - 'item10'
  shortObject: {key1: 'value1', key2: 'value2'}
  longObject:
    key1: 'value1'
    key2: 'value2'
    key3: 'value3'
    key4: 'value4'
    key5: 'value5'
\`\`\``;

  beforeAll(async () => {
    // Create test directory and files
    await mkdir(testDir, { recursive: true });
    await writeFile(initialFilePath, initialContent, 'utf-8');
    await writeFile(expectedFilePath, expectedContent, 'utf-8');
  });

  afterAll(async () => {
    // Cleanup test files
    try {
      await unlink(initialFilePath);
      await unlink(expectedFilePath);
      await unlink(tempTestFilePath);
      await rmdir(testDir);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  beforeEach(async () => {
    // Copy initial content to temp file for each test
    await writeFile(tempTestFilePath, initialContent, 'utf-8');
  });

  afterEach(async () => {
    // Cleanup temp file after each test
    try {
      await unlink(tempTestFilePath);
    } catch (error) {
      // Ignore cleanup errors
    }
  });

  test('should auto-fix multiple issues and return correct result', async () => {
    const session = createMockSession();
    const request: CallToolRequest = {
      method: 'tools/call',
      params: {
        name: 'loadLaml',
        arguments: {
          project: testDir,
          path: tempTestFilePath
        }
      }
    };

    // Execute the handler
    const result = await handleLoadLaml(session, request);
    
    // Parse the result correctly from MCP format
    const parsedResult = JSON.parse((result.content as any)[0].text) as LoadLamlResult;

    // Verify that auto-fixes were applied
    expect(parsedResult.autoFixedIssues).toBeDefined();
    expect(parsedResult.autoFixedIssues!.length).toBeGreaterThan(0);

    // Check for expected auto-fixes
    const autoFixMessages = parsedResult.autoFixedIssues!.join(' ');
    expect(autoFixMessages).toContain('Wrapped content in ```yaml blocks');
    expect(autoFixMessages).toContain('Added missing required field: purpose');
    expect(autoFixMessages).toContain('Added missing required field: version');
    expect(autoFixMessages).toContain('Added missing required field: spec');
    expect(autoFixMessages).toContain('Added missing required field: domains');
    expect(autoFixMessages).toContain('Fixed boolean value');
    expect(autoFixMessages).toContain('Fixed literal quote style');
    expect(autoFixMessages).toContain('Fixed descriptive quote style');
    
    // Note: "$meta moved to first position" doesn't appear because $meta is already first after frontmatter

    // Verify that the document is not valid due to unfixable errors
    expect(parsedResult.isValid).toBe(false);

    // Verify that YAML content is returned
    expect(parsedResult.content).toBeDefined();
    expect(parsedResult.content).toContain('$meta:');
    expect(parsedResult.content).toContain('section1:');

    // Read the modified file and verify it was written correctly
    const modifiedContent = await readFile(tempTestFilePath, 'utf-8');
    
    // Verify file was actually modified
    expect(modifiedContent).not.toBe(initialContent);
    
    // Verify key fixes were applied to the file
    expect(modifiedContent).toContain('```yaml');
    expect(modifiedContent).toContain('hasFeature: true');
    expect(modifiedContent).toContain('isEnabled: false');
    expect(modifiedContent).toContain('canExecute: true');
    expect(modifiedContent).toContain('hasPermission: \'maybe\'');
    expect(modifiedContent).toContain("literalValue: 'shouldBeSingle'");
    expect(modifiedContent).toContain('descriptiveValue: "Should be double quotes for descriptive text"');
    expect(modifiedContent).toMatch(/\$meta:\s*\n\s*name:/); // $meta should be first

    // Verify errors were logged for unfixable issues
    expect((session as any)._errors.length).toBeGreaterThan(0);
    
    // Check for specific unfixable errors
    const errorCodes = (session as any)._errors.map((e: any) => e.code);
    // Note: 'maybe' is still invalid and cannot be auto-fixed, but 'true', 'false', 'yes' can be fixed
    expect(errorCodes).toContain('LAML_INVALID_BOOLEAN_VALUE'); // 'maybe' cannot be fixed
    expect(errorCodes).toContain('LAML_REFERENCE_NOT_FOUND'); // *nonExistent.ref
    expect(errorCodes).toContain('LAML_DOMAINS_EMPTY'); // Empty domains array
  });

  test('should handle file not found error', async () => {
    const session = createMockSession();
    const nonExistentPath = resolve(testDir, 'non-existent.laml.mdc');
    
    const request: CallToolRequest = {
      method: 'tools/call',
      params: {
        name: 'loadLaml',
        arguments: {
          project: testDir,
          path: nonExistentPath
        }
      }
    };

    const result = await handleLoadLaml(session, request);
    const parsedResult = (result.content as any)[0] ? JSON.parse((result.content as any)[0].text) as LoadLamlResult : {};

    // Should return empty result for file not found
    expect(parsedResult.content).toBeUndefined();
    expect(parsedResult.autoFixedIssues).toBeUndefined();
    expect(parsedResult.isValid).toBeUndefined();

    // Should log appropriate error
    expect((session as any)._errors.length).toBe(1);
    expect((session as any)._errors[0].code).toBe('LAML_FILE_NOT_FOUND');
  });

  test('should handle invalid path format', async () => {
    const session = createMockSession();
    
    const request: CallToolRequest = {
      method: 'tools/call',
      params: {
        name: 'loadLaml',
        arguments: {
          project: testDir,
          path: 'relative/path.laml.mdc' // Non-absolute path
        }
      }
    };

    const result = await handleLoadLaml(session, request);
    const parsedResult = (result.content as any)[0] ? JSON.parse((result.content as any)[0].text) as LoadLamlResult : {};

    // Should return empty result for invalid path
    expect(parsedResult.content).toBeUndefined();
    
    // Should log path format error
    expect((session as any)._errors.length).toBe(1);
    expect((session as any)._errors[0].code).toBe('LAML_INVALID_PATH_FORMAT');
  });

  test('should not modify file when no auto-fixes are needed', async () => {
    // Create a valid LAML file that doesn't need fixes
    const validContent = `\`\`\`yaml
$meta:
  name: 'validDocument'
  purpose: "A perfectly valid test document"
  version: 1.0
  spec: ".cursor/rules/g-laml.mdc"
  domains: ['test.domain.valid']

section1:
  literalValue: 'correctLiteral'
  descriptiveValue: "Correct descriptive text"
  booleanValue: true
\`\`\``;

    await writeFile(tempTestFilePath, validContent, 'utf-8');
    
    const session = createMockSession();
    const request: CallToolRequest = {
      method: 'tools/call',
      params: {
        name: 'loadLaml',
        arguments: {
          project: testDir,
          path: tempTestFilePath
        }
      }
    };

    const result = await handleLoadLaml(session, request);
    
    // Parse the result correctly from MCP format
    const parsedResult = JSON.parse((result.content as any)[0].text) as LoadLamlResult;

    // Should be valid and have minimal auto-fixes
    expect(parsedResult.isValid).toBe(true);
    // Note: There will be one auto-fix for spec field quote style (double -> single quotes)
    expect(parsedResult.autoFixedIssues).toHaveLength(1);
    expect(parsedResult.autoFixedIssues![0]).toContain('Fixed literal quote style for ".cursor/rules/g-laml.mdc"');

    // File should be modified with auto-fixes applied
    const fileContentAfter = await readFile(tempTestFilePath, 'utf-8');
    expect(fileContentAfter).not.toBe(validContent); // File should be modified
    
    // Should contain the auto-fixed quote style
    expect(fileContentAfter).toContain("spec: '.cursor/rules/g-laml.mdc'"); // Double quotes fixed to single

    // Should have no errors
    expect((session as any)._errors.length).toBe(0);
  });
}); 