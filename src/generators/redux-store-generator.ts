import { ParsedAPI } from '../types';
import { writeFile } from 'fs-extra';
import path from 'path';

export async function generateReduxStore(
  api: ParsedAPI,
  outputDir: string,
  moduleName: string
): Promise<void> {
  const lines: string[] = [];

  // Imports
  lines.push("import { configureStore } from '@reduxjs/toolkit';");
  lines.push(`import { ${moduleName}Reducer, ${capitalize(moduleName)}State } from './reducers';\n`);

  // Store configuration helper
  lines.push(`/**`);
  lines.push(` * Create a Redux store with the ${moduleName} reducer`);
  lines.push(` * @param preloadedState - Optional preloaded state`);
  lines.push(` * @param additionalReducers - Optional additional reducers to include`);
  lines.push(` */`);
  lines.push(`export function create${capitalize(moduleName)}Store(`);
  lines.push(`  preloadedState?: { ${moduleName}?: Partial<${capitalize(moduleName)}State> },`);
  lines.push(`  additionalReducers?: Record<string, any>`);
  lines.push(') {');
  lines.push('  return configureStore({');
  lines.push('    reducer: {');
  lines.push(`      ${moduleName}: ${moduleName}Reducer,`);
  lines.push('      ...additionalReducers,');
  lines.push('    },');
  lines.push('    preloadedState,');
  lines.push('  });');
  lines.push('}\n');

  // Type exports
  lines.push(`export type ${capitalize(moduleName)}Store = ReturnType<typeof create${capitalize(moduleName)}Store>;`);
  lines.push(`export type ${capitalize(moduleName)}RootState = ReturnType<${capitalize(moduleName)}Store['getState']>;`);
  lines.push(`export type ${capitalize(moduleName)}Dispatch = ${capitalize(moduleName)}Store['dispatch'];\n`);

  // Export reducer for use in existing stores
  lines.push(`// Export the reducer to use in existing stores`);
  lines.push(`export { ${moduleName}Reducer } from './reducers';\n`);

  // Hook helpers
  lines.push("// Hook helpers (requires react-redux)");
  lines.push("// Uncomment if using with React:");
  lines.push("/*");
  lines.push("import { TypedUseSelectorHook, useDispatch, useSelector } from 'react-redux';");
  lines.push("");
  lines.push(`export const use${capitalize(moduleName)}Dispatch = () => useDispatch<${capitalize(moduleName)}Dispatch>();`);
  lines.push(`export const use${capitalize(moduleName)}Selector: TypedUseSelectorHook<${capitalize(moduleName)}RootState> = useSelector;`);
  lines.push("*/\n");

  const content = lines.join('\n');
  await writeFile(path.join(outputDir, 'store.ts'), content);
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1);
}
