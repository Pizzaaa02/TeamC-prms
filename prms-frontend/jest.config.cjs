module.exports = {
  testEnvironment: 'node',
  testMatch: ['<rootDir>/src/**/__tests__/*.test.jsx'],
  transform: {
    '^.+\\.[jt]sx?$': [require.resolve('../prms-backend/node_modules/ts-jest'), {
      tsconfig: { allowJs: true, jsx: 'react-jsx', module: 'CommonJS', target: 'ES2020', esModuleInterop: true, isolatedModules: true },
      diagnostics: false,
    }],
  },
};
