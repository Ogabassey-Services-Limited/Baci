'use client';

import { CopilotKit } from '@copilotkit/react-core';
import { CopilotSidebar } from '@copilotkit/react-ui';
import '@copilotkit/react-ui/styles.css';

interface CopilotBuilderWrapperProps {
  children: React.ReactNode;
}

/**
 * CopilotKit wrapper for the builder.
 * Provides AI chat sidebar alongside Puck editor.
 */
export function CopilotBuilderWrapper({
  children,
}: CopilotBuilderWrapperProps) {
  return (
    <CopilotKit runtimeUrl="/api/copilotkit">
      <div className="flex h-screen">
        <div className="flex-1">{children}</div>
        <CopilotSidebar
          labels={{
            title: 'AI Builder Assistant',
            initial: "Describe your storefront and I'll help you build it!",
          }}
          defaultOpen={false}
          clickOutsideToClose={true}
        />
      </div>
    </CopilotKit>
  );
}
