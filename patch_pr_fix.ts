import fs from 'fs';

const filePath = 'apps/web/src/components/builder/floating-controls.tsx';
let content = fs.readFileSync(filePath, 'utf-8');

// 1. Destructure config from usePuck
content = content.replace(
  "const { appState, dispatch } = usePuck();",
  "const { appState, dispatch, config } = usePuck();"
);

// 2. Remove config from PuckInternalState
content = content.replace(
  "  config: {\n    components: Record<\n      string,\n      { label?: string; fields?: Record<string, PuckFieldConfig> }\n    >;\n  };\n",
  ""
);

// 3. Update state assignment and extraction
content = content.replace(
  "  const state = appState as unknown as PuckInternalState;\n  // Safety check: Ensure state and ui exist before accessing\n  if (!state?.ui) return null;\n\n  const { selectedItem } = state.ui;\n  const { config } = state;",
  "  const state = appState as unknown as PuckInternalState;\n  // Safety check: Ensure state and ui exist before accessing\n  if (!state?.ui) return null;\n\n  const { selectedItem } = state.ui;"
);

// 4. Update the Config Type, since config from usePuck has a slightly different type probably.
// It's actually `Record<string, any>` internally but we should type it strictly or let TS infer it if it's imported.
// Wait, the original code had:
// const componentConfig = config.components[selectedItem.type];
// So `config` must have `components` property.
// If `config` is destructured from `usePuck()`, TS might infer its type. Let's see if it complains.

fs.writeFileSync(filePath, content, 'utf-8');
console.log('patched');
