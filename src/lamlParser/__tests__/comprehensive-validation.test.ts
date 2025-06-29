import { validateLaml, McpSession } from '../lamlValidator.js';
import { parseLaml } from '../lamlParser.js';

// Mock session for testing
function createMockSession(): McpSession {
  const errors: Array<{ code: string; message: string; context?: unknown }> = [];
  const warnings: Array<{ code: string; message: string; context?: unknown }> = [];
  
  return {
    logger: {
      addError: (error) => errors.push(error),
      addWarning: (warning) => warnings.push(warning)
    },
    throwError: (error) => {
      errors.push(error);
      throw new Error(error.message);
    },
    _errors: errors,
    _warnings: warnings
  } as McpSession & { _errors: unknown[]; _warnings: unknown[] };
}

describe('Comprehensive LAML Validation', () => {
  test('should fix all auto-fixable issues and detect invalid constructs in complex document', () => {
    // Некорректный LAML документ со всеми исправимыми проблемами
    const incorrectLaml = `
# Документ без $meta секции - будет добавлена автоматически

section1:
  property: 'value'
  hasPermission: 'true'      # Boolean fix: 'true' -> true  
  isEnabled: 'false'         # Boolean fix: 'false' -> false
  canExecute: 'yes'          # Boolean fix: 'yes' -> true
  shouldRun: 'no'            # Boolean fix: 'no' -> false
  mustValidate: '1'          # Boolean fix: '1' -> true
  allowsAccess: '0'          # Boolean fix: '0' -> false

section2:
  nestedProperty: 'test'
  reference: '*section1.property'
  
  # Многострочные строки с валидными LAML ссылками
  description: |
    This section references *section1.property
    and also mentions *section3.anotherProperty
    for configuration purposes.
  
  instructions: >
    Please check the value of *section1.property
    before proceeding with any operations.

# YAML anchors (простые, без merge keys) - допустимы
baseConfig: &config
  format: 'standard'
  level: 'info'

section3:
  anotherProperty: 'example'
  # Простой алиас (не merge key) - допустим
  logLevel: *config

# $meta секция НЕ в начале документа - будет перемещена  
$meta:
  name: 'testDocument'
  # Отсутствующие обязательные поля будут добавлены автоматически
  # purpose, version, domains отсутствуют
`;

    // Ожидаемый исправленный результат (с учетом сохранения комментариев)
    const expectedFixedLaml = `# Документ без $meta секции - будет добавлена автоматически


# $meta секция НЕ в начале документа - будет перемещена  
$meta:
  name: 'testDocument'
  purpose: "LAML document"
  version: 1
  domains: []
  # Отсутствующие обязательные поля будут добавлены автоматически
  # purpose, version, domains отсутствуют
section1:
  property: 'value'
  hasPermission: true
  isEnabled: false
  canExecute: true
  shouldRun: false
  mustValidate: true
  allowsAccess: false

section2:
  nestedProperty: 'test'
  reference: '*section1.property'

  # Многострочные строки с валидными LAML ссылками
  description: |
    This section references *section1.property
    and also mentions *section3.anotherProperty
    for configuration purposes.

  instructions: >
    Please check the value of *section1.property before proceeding with any
    operations.

# YAML anchors (простые, без merge keys) - допустимы
baseConfig: &config
  format: 'standard'
  level: 'info'

section3:
  anotherProperty: 'example'
  # Простой алиас (не merge key) - допустим
  logLevel: *config
`;

    const session = createMockSession();
    const parseResult = parseLaml(incorrectLaml);
    const result = validateLaml(parseResult, session);

    // Document should be INVALID due to empty domains array (critical error)  
    expect(result.isValid).toBe(false);
    expect(result.fixedSource).toBeDefined(); // Should be defined when there are auto-fixes, even if invalid
    
    // Should have auto-fix attempts but still be invalid due to critical error
    expect(result.autoFixedIssues.length).toBeGreaterThan(0);
    
    // Should detect empty domains as critical error
    const errors = (session as any)._errors;
    expect(errors.some((e: any) => e.code === 'LAML_DOMAINS_EMPTY')).toBe(true);
    
    // Should have these auto-fixes
    expect(result.autoFixedIssues.some(issue => issue.includes('purpose'))).toBe(true);
    expect(result.autoFixedIssues.some(issue => issue.includes('version'))).toBe(true);
    expect(result.autoFixedIssues.some(issue => issue.includes('domains'))).toBe(true);
    expect(result.autoFixedIssues.filter(issue => issue.includes('Fixed boolean value')).length).toBe(6);
  });

  test('should document unfixable issues including merge keys and invalid multiline refs', () => {
    const unfixableLaml = `
$meta: "should be object not string"   # Критическая ошибка - неправильный тип

# YAML merge keys - НЕДОПУСТИМЫ в LAML
baseSettings: &base
  enabled: true
  timeout: 30

section1:
  hasFlag: 'maybe'                     # Неисправимое boolean значение
  badReference: '*invalid-ref.format'  # Неправильный формат ссылки  
  missingRef: '*nonexistent.property'  # Несуществующая ссылка
  <<: *base                           # MERGE KEY - невалиден в LAML

section2:
  <<: *base                           # Еще один MERGE KEY
  level1:
    level2:
      level3:
        level4:
          level5: 'deep'
  tooDeepRef: '*section2.level1.level2.level3.level4.level5'  # Предупреждение о глубокой ссылке
  
  # Многострочные строки с невалидными ссылками
  badMultilineRefs: |
    This references *invalid.bad-format
    and *nonexistent.missing.ref
    which should cause validation errors.
    
  errorInstructions: >
    Check *wrong-format.reference
    before using *another.missing.target
    in your configuration.

# Концептуальное дублирование - предупреждения
userAuth:
  method: 'oauth'
  
authentication: 
  type: 'saml'

userAuthentication:
  provider: 'google'
`;

    const session = createMockSession();
    const parseResult = parseLaml(unfixableLaml);
    const result = validateLaml(parseResult, session);
    
    const errors = (session as any)._errors;
    const warnings = (session as any)._warnings;

    // Документ должен быть невалидным из-за критических ошибок
    expect(result.isValid).toBe(false);

    // Проверяем конкретные ошибки
    expect(errors.some((e: any) => e.code === 'LAML_META_INVALID_TYPE')).toBe(true);
    expect(errors.some((e: any) => e.code === 'LAML_INVALID_BOOLEAN_VALUE')).toBe(true);
    expect(errors.some((e: any) => e.code === 'LAML_INVALID_REFERENCE_FORMAT')).toBe(true);
    expect(errors.some((e: any) => e.code === 'LAML_REFERENCE_NOT_FOUND')).toBe(true);
    
    // Проверяем ошибки YAML merge keys
    expect(errors.some((e: any) => e.code === 'LAML_YAML_MERGE_KEY_INVALID')).toBe(true);
    
    // Проверяем что найдены невалидные ссылки в многострочных строках
    const invalidRefErrors = errors.filter((e: any) => 
      e.code === 'LAML_INVALID_REFERENCE_FORMAT' || e.code === 'LAML_REFERENCE_NOT_FOUND'
    );
    expect(invalidRefErrors.length).toBeGreaterThanOrEqual(4); // минимум 4 невалидные ссылки
    
    // No structural warnings to check after removal of deep reference validation
  });
}); 