import { requireNativeViewManager } from 'expo-modules-core';
import * as React from 'react';

import { SmsSenderViewProps } from './SmsSender.types';

const NativeView: React.ComponentType<SmsSenderViewProps> =
  requireNativeViewManager('SmsSender');

export default function SmsSenderView(props: SmsSenderViewProps) {
  return <NativeView {...props} />;
}
