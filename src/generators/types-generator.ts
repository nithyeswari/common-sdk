import { OpenAPIV3 } from 'openapi-types';
import { ParsedAPI } from '../types';
import { writeFile } from 'fs-extra';
import path from 'path';

export async function generateTypes(
  api: ParsedAPI,
  outputDir: string
): Promise<void> {
  const typeDefinitions: string[] = [];

  typeDefinitions.push('// Generated TypeScript types from OpenAPI specification\n');

  // Generate types for schemas
  for (const { name, schema } of api.schemas) {
    const typeDefinition = generateTypeFromSchema(name, schema);
    typeDefinitions.push(typeDefinition);
  }

  // Generate parameter types for operations
  for (const operation of api.operations) {
    const paramTypes = generateOperationParameterTypes(operation);
    if (paramTypes) {
      typeDefinitions.push(paramTypes);
    }
  }

  const content = typeDefinitions.join('\n');
  await writeFile(path.join(outputDir, 'types.ts'), content);
}

function generateTypeFromSchema(
  name: string,
  schema: OpenAPIV3.SchemaObject,
  indent: number = 0
): string {
  const indentation = '  '.repeat(indent);

  if (schema.enum) {
    const enumValues = schema.enum.map((v: any) => `'${v}'`).join(' | ');
    return `${indentation}export type ${name} = ${enumValues};\n`;
  }

  if (schema.type === 'object' || schema.properties) {
    let typeStr = `${indentation}export interface ${name} {\n`;

    if (schema.properties) {
      for (const [propName, propSchema] of Object.entries(schema.properties)) {
        if (propSchema && '$ref' in propSchema) {
          const refType = extractRefType((propSchema as any).$ref);
          const optional = !schema.required?.includes(propName) ? '?' : '';
          typeStr += `${indentation}  ${propName}${optional}: ${refType};\n`;
        } else {
          const propType = mapSchemaTypeToTS(propSchema as OpenAPIV3.SchemaObject);
          const optional = !schema.required?.includes(propName) ? '?' : '';
          const description = (propSchema as OpenAPIV3.SchemaObject).description;
          if (description) {
            typeStr += `${indentation}  /** ${description} */\n`;
          }
          typeStr += `${indentation}  ${propName}${optional}: ${propType};\n`;
        }
      }
    }

    if (schema.additionalProperties) {
      if (typeof schema.additionalProperties === 'boolean') {
        typeStr += `${indentation}  [key: string]: any;\n`;
      } else if ('$ref' in schema.additionalProperties) {
        const refType = extractRefType(schema.additionalProperties.$ref);
        typeStr += `${indentation}  [key: string]: ${refType};\n`;
      } else {
        const propType = mapSchemaTypeToTS(schema.additionalProperties);
        typeStr += `${indentation}  [key: string]: ${propType};\n`;
      }
    }

    typeStr += `${indentation}}\n`;
    return typeStr;
  }

  if (schema.type === 'array' && schema.items) {
    const itemType = '$ref' in schema.items
      ? extractRefType(schema.items.$ref)
      : mapSchemaTypeToTS(schema.items as OpenAPIV3.SchemaObject);
    return `${indentation}export type ${name} = ${itemType}[];\n`;
  }

  const baseType = mapSchemaTypeToTS(schema);
  return `${indentation}export type ${name} = ${baseType};\n`;
}

function mapSchemaTypeToTS(schema: OpenAPIV3.SchemaObject): string {
  if (schema.enum) {
    return schema.enum.map((v: any) => `'${v}'`).join(' | ');
  }

  if (schema.allOf || schema.oneOf || schema.anyOf) {
    const schemas = schema.allOf || schema.oneOf || schema.anyOf || [];
    const types = schemas.map((s: any) => {
      if ('$ref' in s) {
        return extractRefType(s.$ref);
      }
      return mapSchemaTypeToTS(s as OpenAPIV3.SchemaObject);
    });
    const separator = schema.allOf ? ' & ' : ' | ';
    return `(${types.join(separator)})`;
  }

  if (schema.type === 'array' && schema.items) {
    if ('$ref' in schema.items) {
      return `${extractRefType(schema.items.$ref)}[]`;
    }
    return `${mapSchemaTypeToTS(schema.items as OpenAPIV3.SchemaObject)}[]`;
  }

  if (schema.type === 'object' || schema.properties) {
    if (!schema.properties) {
      return 'Record<string, any>';
    }
    let objType = '{\n';
    for (const [propName, propSchema] of Object.entries(schema.properties)) {
      const optional = !schema.required?.includes(propName) ? '?' : '';
      if (propSchema && '$ref' in propSchema) {
        objType += `    ${propName}${optional}: ${extractRefType((propSchema as any).$ref)};\n`;
      } else {
        const propType = mapSchemaTypeToTS(propSchema as OpenAPIV3.SchemaObject);
        objType += `    ${propName}${optional}: ${propType};\n`;
      }
    }
    objType += '  }';
    return objType;
  }

  switch (schema.type) {
    case 'integer':
    case 'number':
      return 'number';
    case 'string':
      return schema.format === 'binary' ? 'Blob' : 'string';
    case 'boolean':
      return 'boolean';
    default:
      return 'any';
  }
}

function extractRefType(ref: string): string {
  const parts = ref.split('/');
  return parts[parts.length - 1];
}

function generateOperationParameterTypes(operation: any): string | null {
  const typeName = `${capitalize(operation.operationId)}Params`;
  const params = operation.parameters || [];

  if (params.length === 0) {
    return null;
  }

  let typeStr = `export interface ${typeName} {\n`;

  for (const param of params) {
    const optional = !param.required ? '?' : '';
    const paramType = param.schema
      ? mapSchemaTypeToTS(param.schema as OpenAPIV3.SchemaObject)
      : 'any';

    if (param.description) {
      typeStr += `  /** ${param.description} */\n`;
    }
    typeStr += `  ${param.name}${optional}: ${paramType};\n`;
  }

  typeStr += '}\n';
  return typeStr;
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
