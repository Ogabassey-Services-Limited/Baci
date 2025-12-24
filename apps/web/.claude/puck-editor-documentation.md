# Puck Editor - Complete AI Reference Documentation

## Overview
**Puck** is an open-source, modular visual editor for React.js that enables developers to build custom drag-and-drop page builders with their own React components. Licensed under MIT, it's suitable for both internal systems and commercial applications with no vendor lock-in.

**Package:** `@measured/puck`
**Installation:** `npm i @measured/puck --save` or `npx create-puck-app my-app`

---

## Core Components

### `<Puck>` - The Editor Component
Renders the full visual editor UI where users can drag, drop, and configure components.

```jsx
import { Puck } from "@measured/puck";
import "@measured/puck/puck.css";

export function Editor() {
  return (
    <Puck 
      config={config} 
      data={initialData} 
      onPublish={(data) => saveToDatabase(data)}
      onChange={(data) => console.log("Data updated", data)}
      metadata={{ userId: "123", pageId: "456" }}
      ui={{ leftSideBarVisible: true, viewports: { current: { width: 768 } } }}
      viewports={[
        { width: 360, height: "auto", label: "Mobile" },
        { width: 768, height: "auto", label: "Tablet" },
        { width: 1280, height: "auto", label: "Desktop" }
      ]}
      iframe={{ enabled: true }}  // Enable/disable iframe rendering
      permissions={{ delete: true, drag: true }}  // Global permissions
      overrides={{
        headerActions: ({ children }) => <>{children}<button>Custom</button></>,
        componentItem: ({ children }) => <div>{children}</div>
      }}
    />
  );
}
```

**Key Props:**
- `config` - Component configuration (required)
- `data` - Initial data payload (cannot change after mount)
- `onPublish` - Callback when user clicks "Publish"
- `onChange` - Callback on any data change
- `metadata` - Additional data available to all components via `puck.metadata`
- `ui` - Initial UI state
- `viewports` - Custom viewport configurations
- `iframe` - Control iframe rendering (`{ enabled: boolean }`)
- `permissions` - Global feature permissions
- `plugins` - Array of plugins
- `fieldTransforms` - Transform field values before rendering
- `overrides` - Custom UI component overrides

### `<Render>` - The Display Component
Renders the final output based on saved data and config.

```jsx
import { Render } from "@measured/puck";

export function Page() {
  return <Render config={config} data={data} />;
}
```

---

## Configuration (Config)

The `Config` object defines available components, rendering, fields, and behavior.

### Complete Structure

```typescript
import type { Config } from "@measured/puck";

type Components = {
  HeadingBlock: { title: string };
  Card: { text: string };
};

type RootProps = {
  title: string;
  description: string;
};

const config: Config<Components, RootProps, "typography" | "layout"> = {
  components: {
    HeadingBlock: {
      label: "Heading Block",
      fields: {
        title: { type: "text" }
      },
      defaultProps: {
        title: "Hello, world"
      },
      render: ({ title }) => <h1>{title}</h1>,
      resolveData: async ({ props }, { changed }) => {
        // Dynamic prop resolution
        return { props };
      },
      resolveFields: (data) => {
        // Dynamic field configuration
        return { title: { type: "text" } };
      },
      resolvePermissions: (data, { permissions }) => {
        // Dynamic permissions
        return permissions;
      },
      permissions: {
        delete: true,
        drag: true
      },
      inline: false
    }
  },
  root: {
    fields: {
      title: { type: "text" },
      description: { type: "textarea" }
    },
    defaultProps: {
      title: "My Page",
      description: "Page description"
    },
    resolveData: async ({ props }) => {
      return { props };
    },
    render: ({ children, title, description }) => (
      <div>
        <header>
          <h1>{title}</h1>
          <p>{description}</p>
        </header>
        <main>{children}</main>
      </div>
    )
  },
  categories: {
    typography: {
      title: "Typography",
      components: ["HeadingBlock"],
      defaultExpanded: true,
      visible: true
    },
    layout: {
      title: "Layout",
      components: ["TwoColumn", "Section"],
      defaultExpanded: false,
      visible: true
    },
    other: {
      title: "Other Components"  // Special "other" category for uncategorized
    }
  }
};
```

---

## Component Configuration

### ComponentConfig Properties

```typescript
{
  label: string;              // Display name (defaults to component key)
  fields: Record<string, Field>;  // Input fields
  defaultProps: object;       // Initial prop values
  render: (props) => ReactNode;   // Render function
  resolveData: async (data, params) => ResolvedData;  // Dynamic props
  resolveFields: (data, params) => Fields;  // Dynamic fields
  resolvePermissions: (data, params) => Permissions;  // Dynamic permissions
  permissions: Permissions;   // Static permissions
  inline: boolean;           // Remove wrapper (for CSS layouts)
  meta: object;              // Additional metadata
}
```

### render Function

```jsx
render: ({ title, puck }) => {
  // puck.metadata - Global metadata from <Puck metadata={...}>
  // puck.dragRef - Ref for draggable element (when inline: true)
  // puck.renderDropZone - For server components (deprecated API)
  return <h1 ref={puck.dragRef}>{title}</h1>;
}
```

### resolveData - Dynamic Props API

Used for API calls, prop transformations, and setting read-only fields.

```jsx
resolveData: async ({ props }, { changed, metadata, trigger, lastData }) => {
  // Only run expensive operation if specific prop changed
  if (!changed.title) return { props };
  
  // Fetch external data
  const data = await fetch('/api/data').then(r => r.json());
  
  return {
    props: {
      ...props,
      resolvedTitle: data.title
    },
    readOnly: {
      resolvedTitle: true  // Make field read-only
    }
  };
}
```

**Parameters:**
- `props` - Current component props
- `changed` - Object indicating which props changed (e.g., `{ title: true }`)
- `metadata` - Global metadata from `<Puck>`
- `trigger` - Why resolveData ran: `"load"`, `"insert"`, `"replace"`, or `"force"`
- `lastData` - Previous data from last resolveData run

**Note:** When inserting components with `resolveData`, Puck state updates twice - once for initial insert, once when method resolves if data changes. This is reflected in undo/redo history.

### resolveFields - Dynamic Fields API

Dynamically change field configuration based on props (synchronous or asynchronous).

```jsx
resolveFields: async (data, { changed, lastFields }) => {
  // Don't call API unless specific field changed
  if (!changed.category) return lastFields;
  
  const options = await getOptions(data.props.category);
  
  return {
    category: {
      type: "radio",
      options: [
        { label: "Fruit", value: "fruit" },
        { label: "Vegetables", value: "vegetables" }
      ]
    },
    item: {
      type: "select",
      options  // Dynamically loaded options
    }
  };
}
```

**Limitations:** The `slot` field type is not supported by Dynamic Fields. Use Dynamic Props instead.

### resolvePermissions - Dynamic Permissions API

Calculate permissions at runtime based on component data.

```jsx
resolvePermissions: async (data, { changed, permissions, lastPermissions }) => {
  // Return cached permissions if relevant prop hasn't changed
  if (!changed.locked) return lastPermissions;
  
  // Query permissions from server
  if (data.props.locked) {
    return { delete: false, drag: false, edit: false };
  }
  
  return permissions;  // Return inherited permissions
}
```

**Parameters:**
- `data` - Component data
- `changed` - Object indicating which props changed
- `permissions` - Inherited permissions (component or global)
- `lastPermissions` - Previous permissions

---

## Field Types

All fields support these base properties:
- `type` - Field type (required)
- `label` - Display label
- `labelIcon` - React node for custom icon

### text
```jsx
{ type: "text", placeholder: "Enter text..." }
```

### textarea
```jsx
{ type: "textarea", placeholder: "Enter description..." }
```

### number
```jsx
{ type: "number", min: 0, max: 100, placeholder: "0" }
```

### select
```jsx
{
  type: "select",
  options: [
    { label: "Option 1", value: "opt1" },
    { label: "Option 2", value: "opt2" }
  ]
}
```

### radio
```jsx
{
  type: "radio",
  options: [
    { label: "Left", value: "left" },
    { label: "Right", value: "right" }
  ]
}
```

### array
Render a list of items with nested fields.

```jsx
{
  type: "array",
  arrayFields: {
    title: { type: "text" },
    description: { type: "textarea" }
  },
  defaultItemProps: {
    title: "New Item"
  },
  getItemSummary: (item) => item.title || "Item"
}
```

### object
Render nested fields.

```jsx
{
  type: "object",
  objectFields: {
    name: { type: "text" },
    age: { type: "number" }
  }
}
```

### external
Select data from external API (typically for CMS integration).

```jsx
{
  type: "external",
  fetchList: async ({ query }) => {
    const items = await fetch(`/api/items?search=${query}`)
      .then(r => r.json());
    // Must return: [{ title: "...", id: 1 }, ...]
    return items;
  },
  showSearch: true,  // Show search input to user
  placeholder: "Select an item..."
}
```

**Data Syncing Pattern:** Combine with `resolveData` to keep data synced:

```jsx
{
  fields: {
    data: {
      type: "external",
      fetchList: async () => {
        return await fetch('/api/items').then(r => r.json());
      }
    }
  },
  resolveData: async ({ props }, { changed }) => {
    if (!props.data) return { props };
    if (!changed.data) return { props };  // Don't refetch unless changed
    
    // Re-fetch latest data by ID
    const latestData = await fetch(`/api/items/${props.data.id}`)
      .then(r => r.json());
    
    return {
      props: { data: latestData }
    };
  }
}
```

**Hybrid Authoring Pattern:** Allow both external data selection and manual editing:

```jsx
{
  fields: {
    data: { type: "external", fetchList: async () => [/*...*/] },
    title: { type: "text" }
  },
  resolveData: async ({ props }, { changed }) => {
    // If no external data, allow manual editing
    if (!props.data) {
      return { props, readOnly: { title: false } };
    }
    
    // Sync title from external data and make read-only
    if (changed.data) {
      return {
        props: { ...props, title: props.data.title },
        readOnly: { title: true }
      };
    }
    
    return { props };
  }
}
```

**External Data Helper Packages:**
- `@measured/puck-plugin-contentful` - Select content from Contentful spaces

### slot (Replaces DropZone)
Define nested component areas for multi-column layouts.

```jsx
{
  type: "slot",
  allow: ["Card", "Button"],  // Restrict which components can be added
  disallow: ["Section"],       // Exclude specific components
  maxItems: 5                  // Maximum items in slot
}
```

**Basic Usage:**
```jsx
fields: {
  content: { type: "slot" }
},
defaultProps: {
  content: [
    { type: "Header", props: { id: "Header-1", title: "Default" } }
  ]
},
render: ({ content: Content }) => {
  return <Content style={{ display: "flex", gap: 16 }} />;
}
```

**Restricting with Categories:**
```jsx
categories: {
  typography: {
    components: ["HeadingBlock", "Paragraph"]
  }
},
components: {
  Section: {
    fields: {
      content: {
        type: "slot",
        allow: config.categories.typography.components  // Only typography
      }
    }
  }
}
```

**Dynamic Restrictions in Render:**
```jsx
render: ({ content: Content, variant }) => (
  <Content 
    allow={variant === "header" ? ["HeadingBlock"] : undefined}
  />
)
```

### custom
Create completely custom field UI.

```jsx
{
  type: "custom",
  render: ({ name, value, onChange, field }) => (
    <FieldLabel label={field.label}>
      <input
        name={name}
        value={value}
        onChange={(e) => onChange(
          e.target.value,
          { leftSideBarVisible: false }  // Optional UI state change
        )}
      />
    </FieldLabel>
  )
}
```

**Using AutoField inside custom fields:**
```jsx
import { AutoField } from "@measured/puck";

{
  type: "custom",
  render: ({ value, onChange }) => (
    <div>
      <label>Custom Wrapper</label>
      <AutoField 
        field={{ type: "text", placeholder: "Type here..." }}
        value={value}
        onChange={onChange}
      />
    </div>
  )
}
```

---

## Multi-Column & Nested Layouts

### Fixed Layouts (CSS Grid)

```jsx
const config = {
  components: {
    TwoColumn: {
      fields: {
        leftColumn: { type: "slot" },
        rightColumn: { type: "slot" }
      },
      render: ({ leftColumn: Left, rightColumn: Right }) => (
        <div style={{ 
          display: "grid", 
          gridTemplateColumns: "1fr 1fr",
          gap: 16 
        }}>
          <Left />
          <Right />
        </div>
      )
    }
  }
};
```

### Fluid Layouts (Flexbox)

```jsx
render: ({ content: Content }) => (
  <Content style={{ 
    display: "flex",
    flexWrap: "wrap",
    gap: 16 
  }} />
)
```

### Complex Grid Layouts

```jsx
render: ({ content: Content, columns }) => (
  <Content style={{ 
    display: "grid",
    gridTemplateColumns: `repeat(${columns}, 1fr)`,
    gridTemplateRows: "1fr 1fr 1fr 1fr",
    gap: 16
  }} />
)
```

### Inline Components (No Wrapper)

For CSS properties like `flex-grow`, `grid-column`, `grid-row` that require direct parent-child relationship:

```jsx
{
  inline: true,  // Remove Puck's wrapper div
  fields: {
    spanCol: { type: "number", min: 1, max: 4 },
    spanRow: { type: "number", min: 1, max: 4 }
  },
  render: ({ text, spanCol, spanRow, puck }) => (
    <div 
      ref={puck.dragRef}  // REQUIRED for drag functionality
      style={{ 
        gridColumn: `span ${spanCol}`,
        gridRow: `span ${spanRow}` 
      }}
    >
      {text}
    </div>
  )
}
```

**Important:** When `inline: true`, you MUST attach `puck.dragRef` to the element you want to be draggable.

### Pre-populated Templates

Use `defaultProps` to create component templates:

```jsx
{
  fields: {
    items: { type: "slot" }
  },
  defaultProps: {
    items: [
      { type: "Header", props: { id: "Header-1", title: "Hero Title" } },
      { type: "Paragraph", props: { id: "Para-1", text: "Description" } },
      { type: "Button", props: { id: "Btn-1", text: "CTA" } }
    ]
  }
}
```

---

## Root Configuration

Configure the top-level wrapper around all components. By default, root has a `title` text field.

### Complete Root Example

```jsx
root: {
  fields: {
    title: { type: "text" },        // Must redefine if you want to keep it
    description: { type: "textarea" },
    theme: { 
      type: "select",
      options: [
        { label: "Light", value: "light" },
        { label: "Dark", value: "dark" }
      ]
    }
  },
  defaultProps: {
    title: "My Page",
    description: "Page description",
    theme: "light"
  },
  resolveData: async ({ props }, { changed, metadata }) => {
    // Same API as component resolveData
    if (changed.theme) {
      // Load theme-specific config
      const config = await loadThemeConfig(props.theme);
      return { 
        props: { ...props, themeConfig: config },
        readOnly: { themeConfig: true }
      };
    }
    return { props };
  },
  render: ({ children, title, description, theme }) => (
    <div className={`theme-${theme}`}>
      <header>
        <h1>{title}</h1>
        <p>{description}</p>
      </header>
      <main>{children}</main>
    </div>
  )
}
```

**TypeScript:**
```typescript
type RootProps = {
  title: string;
  description: string;
  theme: "light" | "dark";
};

const config: Config<Components, RootProps> = { /* ... */ };
```

**Note:** If you don't render `children`, your components won't display unless you define another slot.

---

## Categories

Group components in the left sidebar for better organization.

### Basic Categories

```jsx
categories: {
  typography: {
    title: "Typography",
    components: ["HeadingBlock", "Paragraph"],
    defaultExpanded: true,  // Expanded by default
    visible: true           // Show category
  },
  layout: {
    title: "Layout",
    components: ["Section", "TwoColumn"],
    defaultExpanded: false,  // Collapsed by default
    visible: true
  },
  foundational: {
    components: ["HeadingBlock"],
    visible: false  // Hidden category (for programmatic use)
  },
  other: {
    title: "Other Components",  // Special category for uncategorized
    defaultExpanded: true
  }
}
```

**TypeScript:**
```typescript
const config: Config<Components, RootProps, "typography" | "layout"> = {
  categories: {
    typography: {},
    layout: {}
  }
};
```

**Note:** Components can appear in multiple categories.

---

## Permissions & Feature Toggling

Control what users can do with components using the Permissions API.

### Supported Permissions

- `delete` - Can delete component
- `drag` - Can drag/reorder component
- `duplicate` - Can duplicate component
- `edit` - Can edit fields (setting to false makes all fields read-only)
- `insert` - Can insert new components

### Global Permissions

```jsx
<Puck
  permissions={{
    delete: false,  // Disable delete globally
    drag: true,
    edit: true
  }}
  config={config}
  data={data}
/>
```

### Component Permissions

```jsx
const config = {
  components: {
    HeadingBlock: {
      permissions: {
        delete: false,  // Disable delete for all HeadingBlock instances
        duplicate: false
      },
      // ...
    }
  },
  root: {
    permissions: {
      edit: true  // Root can also have permissions
    }
  }
};
```

### Dynamic Permissions

```jsx
{
  resolvePermissions: async (data, { changed, permissions, lastPermissions }) => {
    // Cache permissions if relevant prop hasn't changed
    if (!changed.locked) return lastPermissions;
    
    // Query server for permissions
    const serverPermissions = await fetch(`/api/permissions/${data.props.id}`)
      .then(r => r.json());
    
    return serverPermissions;
    
    // Or calculate based on props
    if (data.props.locked) {
      return {
        delete: false,
        drag: false,
        edit: false
      };
    }
    
    return permissions;  // Return inherited permissions
  }
}
```

**Note:** Permission resolvers are cached based on component props to prevent duplicate calls.

---

## Viewports (Responsive Preview)

### Default Viewports

Puck provides 3 default viewports:
- Small: 360px wide
- Medium: 768px wide  
- Large: 1280px wide

All default to `height: "auto"` (fills available space).

### Custom Viewports

```jsx
<Puck
  viewports={[
    { 
      width: 360, 
      height: 640,  // Can be numeric or "auto"
      label: "Mobile",
      icon: <Phone />  // Use lucide-react icons
    },
    { 
      width: 768, 
      height: "auto",
      label: "Tablet",
      icon: <Tablet />
    },
    { 
      width: 1440, 
      height: "auto",
      label: "Desktop",
      icon: <Monitor />
    }
  ]}
  ui={{ 
    viewports: { current: { width: 768 } }  // Initial viewport
  }}
/>
```

### Disable Iframe Rendering

```jsx
<Puck
  iframe={{ enabled: false }}  // Disables iframe and viewport functionality
  config={config}
  data={data}
/>
```

### Viewports with Compositional UI

When using compositional interfaces, control viewport size via wrapping element dimensions and CSS transforms:

```jsx
import { Puck } from "@measured/puck";

export function Editor() {
  return (
    <Puck>
      <div style={{ transform: "scale(0.5)", width: 1280 }}>
        <Puck.Preview />
      </div>
    </Puck>
  );
}
```

---

## Data Model

### Data Structure

```typescript
{
  content: [
    {
      type: "HeadingBlock",
      props: {
        id: "HeadingBlock-1234",  // Auto-generated unique ID
        title: "Hello, world"
      }
    },
    {
      type: "TwoColumn",
      props: {
        id: "TwoColumn-5678"
      }
    }
  ],
  root: {
    props: {
      title: "Page Title",
      description: "Page description"
    }
  },
  zones: {
    "TwoColumn-5678:leftColumn": [
      {
        type: "Card",
        props: { id: "Card-9012", text: "Left content" }
      }
    ],
    "TwoColumn-5678:rightColumn": [
      {
        type: "Card",
        props: { id: "Card-3456", text: "Right content" }
      }
    ]
  }
}
```

### Utility Functions

**resolveAllData** - Execute all resolveData functions:
```jsx
import { resolveAllData } from "@measured/puck";

const resolvedData = await resolveAllData(data, config);
// Use before rendering server-side or when you need all dynamic props resolved
```

**transformProps** - Transform props throughout data payload:
```jsx
import { transformProps } from "@measured/puck";

// Rename prop across all components
const newData = transformProps(data, {
  HeadingBlock: ({ title, ...props }) => ({
    ...props,
    heading: title  // Rename 'title' to 'heading'
  })
});
```

**walkTree** - Recursively traverse and update data:
```jsx
import { walkTree } from "@measured/puck";

const newData = walkTree(data, (node) => {
  if (node.type === "Button") {
    return { 
      ...node, 
      props: { ...node.props, variant: "primary" } 
    };
  }
  return node;
});
```

**migrate** - Migrate legacy data payloads to latest model:
```jsx
import { migrate } from "@measured/puck";

const migratedData = migrate(legacyData);
```

---

## Data Migration Strategies

### Version Migration

Use the `migrate` helper for Puck version updates:

```jsx
import { migrate } from "@measured/puck";

const currentData = migrate(legacyData);
```

### Prop Migration (Breaking Changes)

**Strategy 1: Backwards Compatibility**
```jsx
const config = {
  HeadingBlock: {
    render: ({ title, heading }) => <h1>{heading || title}</h1>
  }
};
```

**Strategy 2: Transform Props**
```jsx
import { transformProps } from "@measured/puck";

const transforms = {
  HeadingBlock: ({ title, ...props }) => ({ 
    heading: title,  // Rename prop
    ...props 
  })
};

// Apply on every render
export const MyEditor = ({ data, config }) => (
  <Puck data={transformProps(data, transforms)} config={config} />
);

export const MyPage = ({ data, config }) => (
  <Render data={transformProps(data, transforms)} config={config} />
);

// Or batch operation on database
const allData = await fetchAllPages();
const migratedData = allData.map(page => ({
  ...page,
  data: transformProps(page.data, transforms)
}));
await saveAllPages(migratedData);
```

---

## React Server Components (RSC)

### Server Environment Support

**Supported on Server:**
- `<Render>` - Render pages
- `resolveAllData()` - Run all data resolvers

**Client-Only (Cannot run on server):**
- `<Puck>` - Editor component
- All interactive APIs

### Implementation Strategies

### Strategy 1: Avoid Client-Specific Code

Easiest but may not be realistic. Avoid `useState`, `useContext`, etc.

```jsx
// ✓ Works on server
const config = {
  components: {
    HeadingBlock: {
      render: ({ title }) => <h1>{title}</h1>
    }
  }
};
```

**Note:** `<DropZone>` component has issues with server components. Use `slot` field instead, which provides native server component support.

### Strategy 2: Mark Components with "use client"

For components needing client-side behavior, separate into files with `"use client"` directive.

**puck.config.tsx:**
```typescript
import type { Config } from "@measured/puck";
import type { HeadingBlockProps } from "./components/HeadingBlock";
import HeadingBlock from "./components/HeadingBlock";

type Props = {
  HeadingBlock: HeadingBlockProps;
};

export const config: Config<Props> = {
  components: {
    HeadingBlock: {
      fields: {
        title: { type: "text" }
      },
      defaultProps: {
        title: "Heading"
      },
      // Must call component (this will change in future)
      render: ({ title }) => <HeadingBlock title={title} />
    }
  }
};
```

**components/HeadingBlock.tsx:**
```tsx
"use client";

import { useState } from "react";

export type HeadingBlockProps = {
  title: string;
};

export default ({ title }: HeadingBlockProps) => {
  const [count, setCount] = useState(0);  // Client-side state
  
  return (
    <div>
      <h1>{title}</h1>
      <button onClick={() => setCount(count + 1)}>
        Clicked {count} times
      </button>
    </div>
  );
};
```

**Server page (Next.js App Router):**
```tsx
import { Render, resolveAllData } from "@measured/puck";
import { config } from "../puck.config";

export default async function Page() {
  const data = await getData();  // Server function
  const resolvedData = await resolveAllData(data, config);  // Optional
  
  return <Render data={resolvedData} config={config} />;
}
```

### Strategy 3: Separate Configs

Different configs for client and server with shared types.

**puck-types.ts:**
```typescript
import type { Config } from "@measured/puck";

type Props = {
  HeadingBlock: { title: string };
};

export type UserConfig = Config<Props>;
```

**puck.config.client.tsx:** (for `<Puck>`)
```typescript
import type { UserConfig } from "./puck-types";

export const config: UserConfig = {
  components: {
    HeadingBlock: {
      fields: { title: { type: "text" } },
      render: ({ title }) => {
        useState();  // Client-only code
        return <h1>{title}</h1>;
      }
    }
  }
};
```

**puck.config.server.tsx:** (for `<Render>`)
```typescript
import type { UserConfig } from "./puck-types";

export const config: UserConfig = {
  components: {
    HeadingBlock: {
      // No fields needed for server rendering
      render: ({ title }) => <h1>{title}</h1>
    }
  }
};
```

**Server page:**
```tsx
import { config } from "../puck.config.server";

export default async function Page() {
  const data = await getData();
  return <Render data={data} config={config} />;
}
```

---

## Compositional UI (Custom Interfaces)

Build custom editor layouts using sub-components:

```jsx
import { Puck } from "@measured/puck";

export function CustomEditor() {
  return (
    <Puck config={config} data={data}>
      <div className="custom-layout">
        <aside className="left-sidebar">
          <Puck.Components />  {/* Component list */}
        </aside>
        <main className="canvas">
          <Puck.Preview />  {/* Editor canvas */}
        </main>
        <aside className="right-sidebar">
          <Puck.Fields />  {/* Selected component fields */}
          <Puck.Outline />  {/* Component tree */}
        </aside>
      </div>
    </Puck>
  );
}
```

**Available Sub-Components:**
- `<Puck.Components>` - Draggable component list
- `<Puck.Preview>` - Editor canvas
- `<Puck.Fields>` - Field editor for selected component
- `<Puck.Outline>` - Component tree outline

---

## Hooks & Internal API

### usePuck

Access Puck's internal state and actions:

```jsx
import { usePuck } from "@measured/puck";

function CustomComponent() {
  const { appState, dispatch } = usePuck();
  
  const insertComponent = () => {
    dispatch({
      type: "insert",
      componentType: "HeadingBlock",
      index: 0
    });
  };
  
  return (
    <div>
      <p>Selected: {appState.ui.itemSelector?.type}</p>
      <button onClick={insertComponent}>Add Heading</button>
    </div>
  );
}
```

**Selectors (for performance):**
```jsx
import { createUsePuck } from "@measured/puck";

const useSelectedItem = createUsePuck((state) => state.ui.itemSelector);

function Component() {
  const selectedItem = useSelectedItem();  // Only re-renders when selection changes
  return <div>Selected: {selectedItem?.type}</div>;
}
```

### useGetPuck

Access latest state in callbacks without re-renders:

```jsx
import { useGetPuck } from "@measured/puck";

function Component() {
  const getPuck = useGetPuck();
  
  const handleClick = () => {
    const { appState } = getPuck();
    console.log("Current state:", appState);
  };
  
  return <button onClick={handleClick}>Log State</button>;
}
```

---

## Metadata API

Inject data into all components without React context:

```jsx
const metadata = { pageId: "123", userId: "456", apiUrl: "/api" };

// In <Puck>
<Puck config={config} data={data} metadata={metadata} />

// Access in render
render: ({ puck }) => {
  return <div>Page ID: {puck.metadata.pageId}</div>;
}

// Access in resolveData
resolveData: async (data, { metadata }) => {
  const apiData = await fetch(`${metadata.apiUrl}/items`).then(r => r.json());
  return { props: { data: apiData } };
}

// Access in resolveFields
resolveFields: async (data, { metadata }) => {
  // Use metadata to customize fields
  return { /* fields */ };
}

// Access in resolvePermissions
resolvePermissions: async (data, { metadata }) => {
  // Check user permissions from metadata
  if (metadata.userId === data.props.ownerId) {
    return { delete: true, edit: true };
  }
  return { delete: false, edit: false };
}
```

---

## Overrides (Customize UI)

Replace or enhance default UI components:

```jsx
<Puck
  overrides={{
    headerActions: ({ children }) => (
      <>
        {children}  {/* Default Publish button */}
        <button onClick={handleSave}>Save Draft</button>
        <button onClick={handlePreview}>Preview</button>
      </>
    ),
    componentItem: ({ name, children }) => (
      <div className="custom-component-item">
        <span className="icon">★</span>
        {children}
      </div>
    ),
    componentOverlay: ({ children, itemSelector }) => (
      <div className="custom-overlay">
        {children}
        <button onClick={() => editComponent(itemSelector)}>
          Edit {itemSelector.type}
        </button>
      </div>
    ),
    fields: ({ children, itemSelector }) => (
      <div className="custom-fields">
        <h3>Editing: {itemSelector?.type}</h3>
        {children}
      </div>
    ),
    fieldLabel: ({ children, label, icon, el }) => (
      <label className="custom-label">
        {icon}
        <span>{label}</span>
        {children}
      </label>
    )
  }}
/>
```

**Available Overrides:**
- `headerActions` - Header action buttons
- `componentItem` - Component in drawer
- `componentOverlay` - Overlay when component selected
- `fields` - Field rendering panel
- `fieldLabel` - Individual field labels

---

## Advanced Patterns

### Component Templates with defaultProps

Create pre-configured component templates:

```jsx
{
  fields: {
    items: { type: "slot" }
  },
  defaultProps: {
    items: [
      { 
        type: "Header", 
        props: { 
          id: "Header-1",
          title: "Hero Title",
          subtitle: "Compelling subtitle"
        } 
      },
      { 
        type: "Paragraph", 
        props: { 
          id: "Para-1",
          text: "Engaging description text"
        } 
      },
      { 
        type: "Button", 
        props: { 
          id: "Btn-1",
          text: "Call to Action",
          variant: "primary"
        } 
      }
    ]
  },
  render: ({ items: Items }) => (
    <section className="hero">
      <Items />
    </section>
  )
}
```

### Conditional Field Visibility

```jsx
resolveFields: (data) => {
  const baseFields = {
    type: { 
      type: "radio",
      options: [
        { label: "Image", value: "image" },
        { label: "Video", value: "video" },
        { label: "Text", value: "text" }
      ]
    }
  };
  
  if (data.props.type === "image") {
    return {
      ...baseFields,
      imageUrl: { type: "text", label: "Image URL" },
      alt: { type: "text", label: "Alt Text" },
      caption: { type: "textarea", label: "Caption" }
    };
  } else if (data.props.type === "video") {
    return {
      ...baseFields,
      videoUrl: { type: "text", label: "Video URL" },
      poster: { type: "text", label: "Poster Image" },
      autoplay: { 
        type: "radio",
        options: [
          { label: "Yes", value: true },
          { label: "No", value: false }
        ]
      }
    };
  } else {
    return {
      ...baseFields,
      content: { type: "textarea", label: "Text Content" }
    };
  }
}
```

### Data Syncing with External Sources

Keep component data synchronized with external APIs:

```jsx
{
  fields: {
    productId: {
      type: "external",
      fetchList: async ({ query }) => {
        const products = await fetch(`/api/products?search=${query}`)
          .then(r => r.json());
        return products;  // [{ title: "Product 1", id: "p1" }, ...]
      },
      showSearch: true
    },
    name: { type: "text" },
    price: { type: "number" },
    description: { type: "textarea" }
  },
  resolveData: async ({ props }, { changed }) => {
    if (!props.productId) return { props };
    
    // Only refetch if productId changed
    if (!changed.productId) return { props };
    
    // Fetch latest product data
    const product = await fetch(`/api/products/${props.productId.id}`)
      .then(r => r.json());
    
    return {
      props: {
        productId: props.productId,
        name: product.name,
        price: product.price,
        description: product.description
      },
      readOnly: {
        name: true,
        price: true,
        description: true
      }
    };
  },
  render: ({ name, price, description }) => (
    <div className="product">
      <h3>{name}</h3>
      <p className="price">${price}</p>
      <p>{description}</p>
    </div>
  )
}
```

### Complex Permission Logic

```jsx
{
  resolvePermissions: async (data, { changed, permissions, lastPermissions, metadata }) => {
    // Return cached permissions if props haven't changed
    if (!changed.userId && !changed.status) return lastPermissions;
    
    // Check if current user owns the component
    const isOwner = metadata.currentUserId === data.props.userId;
    
    // Check component status
    const isPublished = data.props.status === "published";
    const isDraft = data.props.status === "draft";
    
    // Query server for role-based permissions
    const userRole = await fetch(`/api/users/${metadata.currentUserId}/role`)
      .then(r => r.json());
    
    // Complex permission logic
    if (userRole === "admin") {
      return { delete: true, drag: true, edit: true, duplicate: true };
    }
    
    if (isOwner && isDraft) {
      return { delete: true, drag: true, edit: true, duplicate: true };
    }
    
    if (isOwner && isPublished) {
      return { delete: false, drag: false, edit: true, duplicate: true };
    }
    
    // Read-only for non-owners
    return { delete: false, drag: false, edit: false, duplicate: false };
  }
}
```

---

## Best Practices

1. **Type Safety**: Always use TypeScript with `Config<Components, RootProps, Categories>` for type checking
2. **Performance**: Use `changed` parameter in `resolveData` and `resolvePermissions` to avoid unnecessary operations
3. **Slots over DropZone**: Prefer the `slot` field type for nested layouts (native server component support)
4. **Inline for Layouts**: Use `inline: true` when you need CSS properties like `flex-grow` or `grid-column`
5. **Metadata over Context**: Use the Metadata API instead of React Context for passing data
6. **Selectors**: Use `createUsePuck` selectors to optimize re-renders when using hooks
7. **Field Transforms**: Use `fieldTransforms` prop to modify all field values globally
8. **Cache Permissions**: Permission resolvers cache based on props - use `changed` param for expensive operations
9. **Batch Migrations**: Run `transformProps` as batch operation on database rather than every render if possible
10. **Server Components**: Use separate configs or "use client" directive for RSC compatibility

---

## Common Use Cases

### Page Builder
```jsx
const config = {
  components: {
    Hero: { 
      fields: {
        title: { type: "text" },
        subtitle: { type: "text" },
        backgroundImage: { type: "text" },
        cta: { type: "object", objectFields: {
          text: { type: "text" },
          url: { type: "text" }
        }}
      }
    },
    Features: { 
      fields: {
        items: { type: "array", arrayFields: {
          icon: { type: "text" },
          title: { type: "text" },
          description: { type: "textarea" }
        }}
      }
    },
    Testimonials: { 
      fields: {
        items: { type: "array", arrayFields: {
          quote: { type: "textarea" },
          author: { type: "text" },
          role: { type: "text" },
          avatar: { type: "text" }
        }}
      }
    },
    CTA: { 
      fields: {
        title: { type: "text" },
        description: { type: "textarea" },
        buttonText: { type: "text" },
        buttonUrl: { type: "text" }
      }
    }
  }
};
```

### Form Builder
```jsx
const config = {
  components: {
    TextInput: { 
      fields: {
        label: { type: "text" },
        placeholder: { type: "text" },
        required: { type: "radio", options: [
          { label: "Yes", value: true },
          { label: "No", value: false }
        ]}
      }
    },
    Checkbox: { 
      fields: {
        label: { type: "text" },
        checked: { type: "radio", options: [
          { label: "Checked", value: true },
          { label: "Unchecked", value: false }
        ]}
      }
    },
    RadioGroup: { 
      fields: {
        label: { type: "text" },
        options: { type: "array", arrayFields: {
          label: { type: "text" },
          value: { type: "text" }
        }}
      }
    },
    FormSection: { 
      fields: {
        title: { type: "text" },
        fields: { type: "slot", allow: ["TextInput", "Checkbox", "RadioGroup"] }
      }
    }
  }
};
```

### Email Builder
```jsx
const config = {
  components: {
    EmailHeader: { 
      fields: {
        logo: { type: "text" },
        tagline: { type: "text" }
      }
    },
    TextBlock: { 
      fields: {
        content: { type: "textarea" },
        align: { type: "radio", options: [
          { label: "Left", value: "left" },
          { label: "Center", value: "center" },
          { label: "Right", value: "right" }
        ]}
      }
    },
    ImageBlock: { 
      fields: {
        src: { type: "text" },
        alt: { type: "text" },
        width: { type: "number" },
        link: { type: "text" }
      }
    },
    ButtonBlock: { 
      fields: {
        text: { type: "text" },
        url: { type: "text" },
        backgroundColor: { type: "text" },
        textColor: { type: "text" }
      }
    }
  }
};
```

---

## Migration Notes

### DropZone → Slot (IMPORTANT)

The `<DropZone>` component is deprecated and will be removed. Use the `slot` field type instead.

**Old (DropZone):**
```jsx
render: () => (
  <div>
    <DropZone zone="content" />
  </div>
)
```

**New (Slot):**
```jsx
fields: { 
  content: { type: "slot" } 
},
render: ({ content: Content }) => (
  <div>
    <Content />
  </div>
)
```

**For Server Components:**
Old way used `puck.renderDropZone({ zone: "content" })` - now use slot field instead.

---

## Quick Reference

### Installation
```bash
npm i @measured/puck --save
# or
npx create-puck-app my-app
```

### Basic Setup
```jsx
import { Puck, Render } from "@measured/puck";
import "@measured/puck/puck.css";

const config = {
  components: {
    HeadingBlock: {
      fields: { title: { type: "text" } },
      render: ({ title }) => <h1>{title}</h1>
    }
  }
};

// Editor
export function Editor() {
  return <Puck config={config} data={data} onPublish={save} />;
}

// Display
export function Page() {
  return <Render config={config} data={data} />;
}
```

### Field Types Quick List
- `text` - Text input
- `textarea` - Multi-line text
- `number` - Numeric input
- `select` - Dropdown select
- `radio` - Radio buttons
- `array` - List of items
- `object` - Nested fields
- `external` - External data selector
- `slot` - Nested components (replaces DropZone)
- `custom` - Custom field UI

### Utility Functions
- `resolveAllData(data, config)` - Execute all resolveData
- `transformProps(data, transforms)` - Transform props in data
- `walkTree(data, callback)` - Recursively traverse data
- `migrate(data)` - Migrate legacy data to current version

---

## Resources
- **Documentation**: https://puckeditor.com/docs
- **GitHub**: https://github.com/puckeditor/puck
- **Discord**: https://discord.gg/D9e4E3MQVZ
- **Demo**: https://puckeditor.com/demo
- **Support**: Open GitHub issue or book discovery call at https://app.cal.com/chrisvxd/puck-enquiry/