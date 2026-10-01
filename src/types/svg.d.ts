declare module '*.svg' {
  import type { ComponentType } from 'react';
  import type { SvgProps } from 'react-native-svg';

  const SvgIcon: ComponentType<SvgProps>;
  export default SvgIcon;
}
