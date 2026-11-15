import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const sourceRelativePrefixes = [
  "../",
  "../../",
  "../../../",
  "../../../../",
  "../../../../../",
  "../../../../../../",
];

const workspaceRelativePrefixes = sourceRelativePrefixes.slice(1);

function restrictedBoundaryPatterns(target) {
  return [
    `@/${target}`,
    `@/${target}/**`,
    ...sourceRelativePrefixes.flatMap((prefix) => [
      `${prefix}${target}`,
      `${prefix}${target}/**`,
    ]),
    ...workspaceRelativePrefixes.flatMap((prefix) => [
      `${prefix}src/${target}`,
      `${prefix}src/${target}/**`,
    ]),
  ];
}

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    files: ["src/lib/**"],
    rules: {
      "no-restricted-imports": [
        "warn",
        {
          patterns: [
            {
              group: [
                ...restrictedBoundaryPatterns("app"),
                ...restrictedBoundaryPatterns("modules"),
              ],
              message: "lib no debe depender de rutas de app ni de módulos de negocio.",
            },
          ],
        },
      ],
    },
  },
  {
    // Only global shared components are covered; app-local components belong to their route/domain.
    files: ["src/components/**"],
    rules: {
      "no-restricted-imports": [
        "warn",
        {
          patterns: [
            {
              group: [
                ...restrictedBoundaryPatterns("app"),
                ...restrictedBoundaryPatterns("modules"),
              ],
              message: "components globales no deben depender de rutas de app ni de módulos de negocio.",
            },
          ],
        },
      ],
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
