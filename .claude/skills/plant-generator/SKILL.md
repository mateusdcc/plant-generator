````markdown
# plant-generator Development Patterns

> Auto-generated skill from repository analysis

## Overview

This skill covers the development patterns and conventions used in the `plant-generator` TypeScript codebase. It provides guidance on file organization, code style, testing practices, and common workflows to help contributors maintain consistency and quality.

## Coding Conventions

### File Naming

- Use **camelCase** for file names.
    - Example: `plantGenerator.ts`

### Import Style

- Use **relative imports** for referencing modules.
    - Example:
        ```typescript
        import { generatePlant } from "./plantGenerator";
        ```

### Export Style

- Use **named exports** for all modules.
    - Example:
        ```typescript
        // plantGenerator.ts
        export function generatePlant() { ... }
        ```

### Commit Patterns

- Commit messages are **freeform**, sometimes with prefixes.
- Average commit message length is about 40 characters.
    - Example: `Add leaf shape generator`

## Workflows

### Adding a New Feature

**Trigger:** When implementing a new functionality.
**Command:** `/add-feature`

1. Create a new file using camelCase naming (e.g., `newFeature.ts`).
2. Implement the feature using TypeScript.
3. Use relative imports to integrate with existing modules.
4. Export new functions or constants using named exports.
5. Write corresponding tests in a file named `newFeature.test.ts`.
6. Commit your changes with a clear, concise message.

### Running Tests

**Trigger:** To verify code correctness.
**Command:** `/run-tests`

1. Ensure all test files follow the `*.test.ts` naming pattern.
2. Run tests using the `vitest` framework:
    ```bash
    npx vitest
    ```
3. Review test results and fix any failing tests.

### Refactoring Code

**Trigger:** When improving or reorganizing existing code.
**Command:** `/refactor`

1. Identify code to refactor.
2. Rename files using camelCase if necessary.
3. Update imports to use relative paths.
4. Ensure all exports remain named.
5. Update or add tests as needed.
6. Run the test suite to confirm correctness.

## Testing Patterns

- Tests are written using the **vitest** framework.
- Test files are named with the `.test.ts` suffix.
- Example: `plantGenerator.test.ts`
- Place tests alongside or near the module they cover.
- Example test:

    ```typescript
    // plantGenerator.test.ts
    import { describe, expect, it } from "vitest";
  import { generatePlant } from "./plantGenerator";

  describe("generatePlant", () => {
    it("should create a plant object", () => {
      const plant = generatePlant();
      expect(plant).toHaveProperty("leaves");
    });
  });
    ```

## Commands

| Command      | Purpose                        |
| ------------ | ------------------------------ |
| /add-feature | Guide for adding a new feature |
| /run-tests   | Steps to run the test suite    |
| /refactor    | Checklist for refactoring code |
````
