import { reactRouter } from "@react-router/dev/vite";
import basicSsl from "@vitejs/plugin-basic-ssl";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig, type Plugin } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

const muteWarningsPlugin = (warningsToIgnore: string[][]): Plugin => {
  return {
    name: "mute-warnings",
    enforce: "pre",
    config: (userConfig) => ({
      build: {
        rollupOptions: {
          onwarn(warning, defaultHandler) {
            if (warning.code) {
              const muted = warningsToIgnore.find(
                ([code, message]) =>
                  code == warning.code && warning.message.includes(message),
              );

              if (muted) {
                return;
              }
            }

            if (userConfig.build?.rollupOptions?.onwarn) {
              userConfig.build.rollupOptions.onwarn(warning, defaultHandler);
            } else {
              defaultHandler(warning);
            }
          },
        },
      },
    }),
  };
};

const warningsToIgnore = [
  ["SOURCEMAP_ERROR", "Can't resolve original location of error"],
];

export default defineConfig({
  server: { port: 3333 },
  plugins: [
    basicSsl() as any,
    tailwindcss(),
    reactRouter(),
    tsconfigPaths(),
    muteWarningsPlugin(warningsToIgnore),
  ],
});
