import crypto from "node:crypto";
import open from "open";

import { loadCredentialRecord, saveCredentialRecord } from "./credential-store.js";
import { OAUTH_SCOPES } from "./constants.js";

export class SecureOAuthProvider {
  constructor({ redirectUrl, interactive = false } = {}) {
    this._redirectUrl = redirectUrl;
    this.interactive = interactive;
    this.authorizationUrl = undefined;
    this.record = undefined;
  }

  get redirectUrl() {
    return this._redirectUrl;
  }

  get clientMetadata() {
    return {
      client_name: "ifczt CRM CLI",
      redirect_uris: [String(this._redirectUrl)],
      grant_types: ["authorization_code", "refresh_token"],
      response_types: ["code"],
      token_endpoint_auth_method: "none",
      scope: OAUTH_SCOPES.join(" "),
    };
  }

  async _load() {
    if (!this.record) this.record = await loadCredentialRecord();
    return this.record;
  }

  async _save(changes) {
    const record = { ...(await this._load()), ...changes };
    this.record = record;
    await saveCredentialRecord(record);
  }

  async state() {
    return crypto.randomBytes(24).toString("base64url");
  }

  async clientInformation() {
    return (await this._load()).clientInformation;
  }

  async saveClientInformation(clientInformation) {
    await this._save({ clientInformation });
  }

  async tokens() {
    return (await this._load()).tokens;
  }

  async saveTokens(tokens) {
    await this._save({ tokens, authenticatedAt: new Date().toISOString() });
  }

  async redirectToAuthorization(authorizationUrl) {
    this.authorizationUrl = authorizationUrl.toString();
    if (!this.interactive) return;
    process.stderr.write(`${JSON.stringify({ type: "authorization_required", url: this.authorizationUrl })}\n`);
    await open(this.authorizationUrl, { wait: false });
  }

  async saveCodeVerifier(codeVerifier) {
    await this._save({ codeVerifier });
  }

  async codeVerifier() {
    const verifier = (await this._load()).codeVerifier;
    if (!verifier) throw new Error("OAuth PKCE verifier is missing");
    return verifier;
  }

  async saveDiscoveryState(discoveryState) {
    await this._save({ discoveryState });
  }

  async discoveryState() {
    return (await this._load()).discoveryState;
  }

  async invalidateCredentials(scope) {
    const record = await this._load();
    if (scope === "all") {
      this.record = {};
    } else if (scope === "client") {
      delete record.clientInformation;
    } else if (scope === "tokens") {
      delete record.tokens;
      delete record.authenticatedAt;
    } else if (scope === "verifier") {
      delete record.codeVerifier;
    } else if (scope === "discovery") {
      delete record.discoveryState;
    }
    await saveCredentialRecord(this.record || record);
  }
}
