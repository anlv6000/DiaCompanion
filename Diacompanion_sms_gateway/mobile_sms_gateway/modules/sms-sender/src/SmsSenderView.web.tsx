import * as React from 'react';

import { SmsSenderViewProps } from './SmsSender.types';

export default function SmsSenderView(props: SmsSenderViewProps) {
  return (
    <div>
      <span>{props.name}</span>
    </div>
  );
}
