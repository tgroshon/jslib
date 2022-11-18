import globals from "globals";

import prettierConfig from "eslint-config-prettier";

export default [
  "eslint:recommended",
  {
    files: ["**/*.js"],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
  prettierConfig,
];
