const mockConstants: any = {
  expoConfig: { hostUri: '192.168.1.200:8081' },
  manifest: null,
  manifest2: null,
  linkingUri: '',
};

jest.mock('expo-constants', () => ({
  __esModule: true,
  default: mockConstants,
}));

jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
  NativeModules: { SourceCode: {} },
}));

import { getAutoDetectedHost, getLocalApiBaseUrl, getLocalAiBaseUrl, DEV_LAN_HOST } from './config';

describe('config auto-detection tests', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    process.env = { ...originalEnv };
    delete process.env.EXPO_PUBLIC_API_URL;
    delete process.env.EXPO_PUBLIC_API_BASE_URL;
    delete process.env.EXPO_PUBLIC_AI_URL;
    mockConstants.expoConfig = { hostUri: '192.168.1.200:8081' };
    mockConstants.manifest = null;
    mockConstants.manifest2 = null;
    mockConstants.linkingUri = '';
  });


  afterAll(() => {
    process.env = originalEnv;
  });

  it('detects IP from Constants.expoConfig.hostUri', () => {
    mockConstants.expoConfig = { hostUri: '192.168.1.200:8081' };
    expect(getAutoDetectedHost()).toBe('192.168.1.200');
    expect(getLocalApiBaseUrl()).toBe('http://192.168.1.200:5023');
    expect(getLocalAiBaseUrl()).toBe('http://192.168.1.200:5000');
  });

  it('detects IP from manifest debuggerHost if expoConfig is missing', () => {
    delete mockConstants.expoConfig;
    mockConstants.manifest = { debuggerHost: '10.20.30.40:8081' };
    expect(getAutoDetectedHost()).toBe('10.20.30.40');
    expect(getLocalApiBaseUrl()).toBe('http://10.20.30.40:5023');
  });

  it('honors https public domain from env over auto-detection', () => {
    mockConstants.expoConfig = { hostUri: '192.168.1.200:8081' };
    process.env.EXPO_PUBLIC_API_URL = 'https://api.taxkeep.vn';
    expect(getLocalApiBaseUrl()).toBe('https://api.taxkeep.vn');
  });

  it('falls back to DEV_LAN_HOST when no host can be detected', () => {
    delete mockConstants.expoConfig;
    delete mockConstants.manifest;
    delete mockConstants.manifest2;
    mockConstants.linkingUri = '';
    expect(getLocalApiBaseUrl()).toBe(`http://${DEV_LAN_HOST}:5023`);
  });
});
