export const dualsenseMapping = {
  confirm: '✕',
  back: '○',
  secondary: '□',
  info: '△',
  previousTab: 'L1',
  nextTab: 'R1',
  previousView: 'L2',
  nextView: 'R2',
  menu: 'Options',
} as const;
export const isPlayStation = (id: string) =>
  /dualsense|dualshock|playstation|054c|wireless controller/i.test(id);