import { ParsedAPI, ParsedOperation } from '../types';
import { writeFile } from 'fs-extra';
import path from 'path';

export async function generateReduxReducers(
  api: ParsedAPI,
  outputDir: string,
  moduleName: string
): Promise<void> {
  const lines: string[] = [];

  // Imports
  lines.push("import { createSlice, PayloadAction } from '@reduxjs/toolkit';");
  lines.push("import * as Actions from './actions';\n");

  // Generate state interfaces for each operation
  lines.push('// State interfaces');
  for (const operation of api.operations) {
    lines.push(generateOperationState(operation));
  }

  // Generate root state interface
  lines.push(`export interface ${capitalize(moduleName)}State {`);
  for (const operation of api.operations) {
    lines.push(`  ${operation.operationId}: ${capitalize(operation.operationId)}State;`);
  }
  lines.push('}\n');

  // Initial state
  lines.push(`const initialState: ${capitalize(moduleName)}State = {`);
  for (const operation of api.operations) {
    lines.push(`  ${operation.operationId}: {`);
    lines.push('    data: null,');
    lines.push('    loading: false,');
    lines.push('    error: null,');
    lines.push('  },');
  }
  lines.push('};\n');

  // Create slice
  lines.push(`const ${moduleName}Slice = createSlice({`);
  lines.push(`  name: '${moduleName}',`);
  lines.push('  initialState,');
  lines.push('  reducers: {');
  lines.push('    // Add custom reducers here');
  lines.push(`    reset: (state) => {`);
  lines.push('      return initialState;');
  lines.push('    },');
  for (const operation of api.operations) {
    lines.push(`    reset${capitalize(operation.operationId)}: (state) => {`);
    lines.push(`      state.${operation.operationId} = initialState.${operation.operationId};`);
    lines.push('    },');
  }
  lines.push('  },');
  lines.push('  extraReducers: (builder) => {');

  // Add reducers for each async thunk
  for (const operation of api.operations) {
    lines.push(generateReducerCases(operation));
  }

  lines.push('  },');
  lines.push('});\n');

  // Export actions and reducer
  lines.push(`export const { reset, ${api.operations.map(op => `reset${capitalize(op.operationId)}`).join(', ')} } = ${moduleName}Slice.actions;`);
  lines.push(`export const ${moduleName}Reducer = ${moduleName}Slice.reducer;\n`);

  // Export selectors
  lines.push('// Selectors');
  for (const operation of api.operations) {
    lines.push(generateSelectors(operation, moduleName));
  }

  const content = lines.join('\n');
  await writeFile(path.join(outputDir, 'reducers.ts'), content);
}

function generateOperationState(operation: ParsedOperation): string {
  const lines: string[] = [];
  const stateName = `${capitalize(operation.operationId)}State`;
  const responseType = 'any'; // Simplified for now, could be enhanced

  lines.push(`interface ${stateName} {`);
  lines.push(`  data: ${responseType} | null;`);
  lines.push('  loading: boolean;');
  lines.push('  error: string | null;');
  lines.push('}\n');

  return lines.join('\n');
}

function generateReducerCases(operation: ParsedOperation): string {
  const lines: string[] = [];
  const actionName = operation.operationId;

  lines.push(`    // ${operation.summary || actionName}`);
  lines.push(`    builder.addCase(Actions.${actionName}.pending, (state) => {`);
  lines.push(`      state.${actionName}.loading = true;`);
  lines.push(`      state.${actionName}.error = null;`);
  lines.push('    });');

  lines.push(`    builder.addCase(Actions.${actionName}.fulfilled, (state, action) => {`);
  lines.push(`      state.${actionName}.loading = false;`);
  lines.push(`      state.${actionName}.data = action.payload;`);
  lines.push(`      state.${actionName}.error = null;`);
  lines.push('    });');

  lines.push(`    builder.addCase(Actions.${actionName}.rejected, (state, action) => {`);
  lines.push(`      state.${actionName}.loading = false;`);
  lines.push(`      state.${actionName}.error = action.error.message || 'An error occurred';`);
  lines.push('    });\n');

  return lines.join('\n');
}

function generateSelectors(operation: ParsedOperation, moduleName: string): string {
  const lines: string[] = [];
  const operationName = operation.operationId;
  const capitalizedOp = capitalize(operationName);

  lines.push(`export const select${capitalizedOp}Data = (state: { ${moduleName}: ${capitalize(moduleName)}State }) =>`);
  lines.push(`  state.${moduleName}.${operationName}.data;`);

  lines.push(`export const select${capitalizedOp}Loading = (state: { ${moduleName}: ${capitalize(moduleName)}State }) =>`);
  lines.push(`  state.${moduleName}.${operationName}.loading;`);

  lines.push(`export const select${capitalizedOp}Error = (state: { ${moduleName}: ${capitalize(moduleName)}State }) =>`);
  lines.push(`  state.${moduleName}.${operationName}.error;\n`);

  return lines.join('\n');
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
