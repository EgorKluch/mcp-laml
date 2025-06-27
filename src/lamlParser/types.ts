// LAML Parser types

export enum LamlValueType {
  Reference = 'reference',
  Literal = 'literal', 
  Descriptive = 'descriptive',
  Boolean = 'boolean',
  Number = 'number',
  Array = 'array'
}

export type LamlValue = {
  type: LamlValueType;
  value: any;
  raw?: string;
  line?: number;
  column?: number;
};

export type LamlDocument = {
  $meta: {
    name: LamlValue;
    purpose: LamlValue;
    version: LamlValue;
    spec?: LamlValue;
    [key: string]: any;
  };
  [key: string]: any;
};

export type LamlParseResult = {
  success: true;
  document: LamlDocument;
  warnings: string[];
} | {
  success: false;
  document: null;
  errors: string[];
  warnings: string[];
}; 