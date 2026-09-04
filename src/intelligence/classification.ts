export type SourceClassification = "production" | "test" | "generated";

export const GENERATED_FILE_PATTERN = /(?:\.g|\.freezed|\.gr|\.mocks)\.dart$/i;
export const TEST_PATH_PATTERN = /(?:^|\/)(?:test|integration_test)(?:\/|$)/i;

export function classifySourcePath(sourcePath: string): SourceClassification {
  const normalizedPath = sourcePath.replaceAll("\\", "/");
  if (GENERATED_FILE_PATTERN.test(normalizedPath)) return "generated";
  if (TEST_PATH_PATTERN.test(normalizedPath)) return "test";
  return "production";
}
