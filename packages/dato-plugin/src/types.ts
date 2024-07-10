export type FirstInstallationParameters = {};

export type ValidConfig = {
  organizationName: string;
  baseEndpoint: string;
  clientId: string;
  clientSecret: string;
  autoApplyToFieldsWithApiKey: string;
  paramsVersion: "2";
};

export type LegacyConfig =
  | {
      organizationName: string;
      baseEndpoint: string;
      clientId: string;
      clientSecret: string;
    }
  | FirstInstallationParameters;

export type Config = ValidConfig | LegacyConfig | FirstInstallationParameters;

export function isValidConfig(params: Config): params is ValidConfig {
  return params && "paramsVersion" in params && params.paramsVersion === "2";
}

export function normalizeConfig(params: Config): ValidConfig {
  if (isValidConfig(params)) {
    return params;
  }

  return {
    paramsVersion: "2",
    organizationName:
      "organizationName" in params ? params.organizationName : "",
    baseEndpoint: "baseEndpoint" in params ? params.baseEndpoint : "",
    clientId: "clientId" in params ? params.clientId : "",
    clientSecret: "clientSecret" in params ? params.clientSecret : "",
    autoApplyToFieldsWithApiKey: "",
  };
}
