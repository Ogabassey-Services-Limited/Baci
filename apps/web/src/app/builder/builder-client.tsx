'use client';

import '@puckeditor/core/puck.css';
import { BuilderClientView } from './builder-client-view';
import { useBuilderClientController } from './use-builder-client-controller';

export default function BuilderClient() {
  return <BuilderClientView controller={useBuilderClientController()} />;
}
