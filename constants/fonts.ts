import { TextStyle } from 'react-native';

export const fonts: Record<string, TextStyle> = {
  heading: {
    fontSize: 17,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  taskTitle: {
    fontSize: 15,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
  body: {
    fontSize: 13,
    fontWeight: '400',
    lineHeight: 20,
  },
  taskDesc: {
    fontSize: 12,
    fontWeight: '400',
    lineHeight: 18,
  },
  small: {
    fontSize: 11,
    fontWeight: '400',
    lineHeight: 16,
  },
  tiny: {
    fontSize: 10,
    fontWeight: '400',
    letterSpacing: 0.5,
  },
  wordmark: {
    fontSize: 14,
    fontWeight: '600',
    letterSpacing: -0.2,
  },
};
