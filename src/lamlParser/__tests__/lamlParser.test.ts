import { parseLaml, parseLamlFile } from '../lamlParser';
import { writeFileSync, unlinkSync } from 'fs';

describe('LAML Parser', () => {
  it('should parse YAML content from markdown code block', () => {
    const content = `
\`\`\`yaml
$meta:
  name: "test"
  version: 1.0

syntax:
  purpose: "test syntax"
\`\`\`
`;

    const result = parseLaml(content);
    
    expect(result.error).toBeUndefined();
    expect(result.ast).not.toBeNull();
    expect(result.source).toBeTruthy();
    
    if (result.ast) {
      const jsObj = result.ast.toJS();
      expect(jsObj.$meta.name).toBe('test');
      expect(jsObj.syntax.purpose).toBe('test syntax');
    }
  });

  it('should handle invalid YAML gracefully', () => {
    const content = `
\`\`\`yaml
invalid: [unclosed array
\`\`\`
`;

    const result = parseLaml(content);
    
    // Should not throw, might have parsing issues but return something
    expect(result.ast).toBeDefined();
  });

  it('should return error when no YAML found', () => {
    const content = `
Just some text without YAML
`;

    const result = parseLaml(content);
    
    expect(result.ast).toBeNull();
    expect(result.error).toBe('No YAML content found in markdown');
  });

  it('should return error when content has no YAML structure', () => {
    const content = `
Some text without colons or dashes
No YAML structure here
`;

    const result = parseLaml(content);
    
    expect(result.ast).toBeNull();
    expect(result.error).toBe('No YAML content found in markdown');
  });

  it('should return error when content is empty', () => {
    const content = '';

    const result = parseLaml(content);
    
    expect(result.ast).toBeNull();
    expect(result.error).toBe('No YAML content found in markdown');
  });

  it('should handle plain YAML without markdown blocks', () => {
    const content = `
name: "test"
value: 42
`;

    const result = parseLaml(content);
    
    expect(result.error).toBeUndefined();
    expect(result.ast).not.toBeNull();
    
    if (result.ast) {
      const jsObj = result.ast.toJS();
      expect(jsObj.name).toBe('test');
      expect(jsObj.value).toBe(42);
    }
  });

  it('should parse anchor and alias notation', () => {
    const content = `
\`\`\`yaml
base: &ref
  value: 42
  
derived:
  baseData: *ref
  extra: "test"
\`\`\`
`;

    const result = parseLaml(content);
    
    expect(result.error).toBeUndefined();
    expect(result.ast).not.toBeNull();
    
    if (result.ast) {
      const jsObj = result.ast.toJS();
      expect(jsObj.derived.baseData.value).toBe(42);
      expect(jsObj.derived.extra).toBe('test');
    }
  });

  describe('parseLamlFile', () => {
    const testFilePath = './test-laml-file.mdc';

    afterEach(() => {
      try {
        unlinkSync(testFilePath);
      } catch (e) {
        // File might not exist, ignore
      }
    });

    it('should parse LAML file successfully', () => {
      const content = `
\`\`\`yaml
name: "file-test"
value: 123
\`\`\`
`;
      writeFileSync(testFilePath, content);

      const result = parseLamlFile(testFilePath);
      
      expect(result.error).toBeUndefined();
      expect(result.ast).not.toBeNull();
      
      if (result.ast) {
        const jsObj = result.ast.toJS();
        expect(jsObj.name).toBe('file-test');
        expect(jsObj.value).toBe(123);
      }
    });

    it('should handle file read errors', () => {
      const result = parseLamlFile('/non/existent/path/file.laml.mdc');
      
      expect(result.ast).toBeNull();
      expect(result.error).toBeDefined();
      expect(result.source).toBeUndefined();
      // Just check that we have an error message
      if (result.error) {
        expect(typeof result.error).toBe('string');
        expect(result.error.length).toBeGreaterThan(0);
      }
    });

    it('should handle permission denied errors', () => {
      // Test with a path that will definitely cause an error
      const result = parseLamlFile('/dev/null/impossible/path.laml.mdc');
      
      expect(result.ast).toBeNull();
      expect(result.error).toBeDefined();
      expect(result.source).toBeUndefined();
    });
  });

  describe('Complex data structures', () => {
    it('should parse simple string arrays', () => {
      const content = `
\`\`\`yaml
items:
  - 'three'
  - 'three'
  - 'three'
\`\`\`
`;

      const result = parseLaml(content);
      
      expect(result.error).toBeUndefined();
      expect(result.ast).not.toBeNull();
      
      if (result.ast) {
        const jsObj = result.ast.toJS();
        expect(jsObj.items).toEqual(['three', 'three', 'three']);
      }
    });

    it('should parse arrays of objects', () => {
      const content = `
\`\`\`yaml
items:
  - key: 'one'
    value: 1
  - key: 'two'
    value: 2
\`\`\`
`;

      const result = parseLaml(content);
      
      expect(result.error).toBeUndefined();
      expect(result.ast).not.toBeNull();
      
      if (result.ast) {
        const jsObj = result.ast.toJS();
        expect(jsObj.items).toEqual([
          { key: 'one', value: 1 },
          { key: 'two', value: 2 }
        ]);
      }
    });

    it('should parse inline arrays', () => {
      const content = `
\`\`\`yaml
key: [1, 2, 3]
\`\`\`
`;

      const result = parseLaml(content);
      
      expect(result.error).toBeUndefined();
      expect(result.ast).not.toBeNull();
      
      if (result.ast) {
        const jsObj = result.ast.toJS();
        expect(jsObj.key).toEqual([1, 2, 3]);
      }
    });

    it('should parse inline objects', () => {
      const content = `
\`\`\`yaml
key: {one: 1, two: 2}
\`\`\`
`;

      const result = parseLaml(content);
      
      expect(result.error).toBeUndefined();
      expect(result.ast).not.toBeNull();
      
      if (result.ast) {
        const jsObj = result.ast.toJS();
        expect(jsObj.key).toEqual({ one: 1, two: 2 });
      }
    });

    it('should parse complex nested structures', () => {
      const content = `
\`\`\`yaml
complex:
  arrays:
    - 'first'
    - 'second'
    - 'third'
  objects:
    - name: 'item1'
      value: 100
    - name: 'item2'
      value: 200
  inline_array: [1, 2, 3, 4, 5]
  inline_object: {type: 'test', active: true}
  nested:
    level1:
      - item: 'a'
        subarray: [1, 2, 3]
      - item: 'b'
        subobject: {x: 10, y: 20}
\`\`\`
`;

      const result = parseLaml(content);
      
      expect(result.error).toBeUndefined();
      expect(result.ast).not.toBeNull();
      
      if (result.ast) {
        const jsObj = result.ast.toJS();
        expect(jsObj.complex.arrays).toEqual(['first', 'second', 'third']);
        expect(jsObj.complex.objects).toEqual([
          { name: 'item1', value: 100 },
          { name: 'item2', value: 200 }
        ]);
        expect(jsObj.complex.inline_array).toEqual([1, 2, 3, 4, 5]);
        expect(jsObj.complex.inline_object).toEqual({ type: 'test', active: true });
        expect(jsObj.complex.nested.level1[0].subarray).toEqual([1, 2, 3]);
        expect(jsObj.complex.nested.level1[1].subobject).toEqual({ x: 10, y: 20 });
      }
    });

    it('should handle mixed types in arrays', () => {
      const content = `
\`\`\`yaml
mixed:
  - 'string'
  - 42
  - true
  - null
  - [1, 2, 3]
  - {key: 'value'}
\`\`\`
`;

      const result = parseLaml(content);
      
      expect(result.error).toBeUndefined();
      expect(result.ast).not.toBeNull();
      
      if (result.ast) {
        const jsObj = result.ast.toJS();
        expect(jsObj.mixed).toEqual([
          'string',
          42,
          true,
          null,
          [1, 2, 3],
          { key: 'value' }
        ]);
      }
    });
  });
}); 