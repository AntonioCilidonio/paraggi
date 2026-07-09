module.exports = {
  preset: "ts-jest",
  testEnvironment: "node",
  roots: ["<rootDir>/src"],
  moduleNameMapper: {
    "^@paraggi/domain$": "<rootDir>/../domain/src/index.ts"
  }
};

