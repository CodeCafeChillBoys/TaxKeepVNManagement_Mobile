import React from 'react';
import { StyleProp, TextStyle, ViewStyle } from 'react-native';

declare module 'react-native-markdown-display' {
  export interface MarkdownProps {
    children?: React.ReactNode;
    style?: Record<string, StyleProp<ViewStyle | TextStyle>>;
    mergeStyle?: boolean;
    rules?: Record<string, (...args: any[]) => React.ReactNode>;
    onLinkPress?: (url: string) => boolean;
  }

  const Markdown: React.ComponentType<MarkdownProps>;
  export default Markdown;
}

