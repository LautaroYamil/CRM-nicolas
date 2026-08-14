import nextVitals from "eslint-config-next/core-web-vitals";

const config = [{ ignores: [".open-next/**", ".wrangler/**"] }, ...nextVitals];

export default config;
