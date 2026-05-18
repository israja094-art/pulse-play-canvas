import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "app.lovable.zabplay",
  appName: "ZabPlay",
  webDir: "www",
  android: {
    allowMixedContent: true,
  },
};

export default config;
