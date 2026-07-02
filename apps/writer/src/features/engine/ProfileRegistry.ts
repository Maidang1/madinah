import { mergeEngineProfiles, type EngineProfile } from "../../domain/engine";

export class ProfileRegistry {
  private readonly profiles = new Map<string, EngineProfile>();

  constructor(profiles: EngineProfile[] = []) {
    profiles.forEach((profile) => this.register(profile));
  }

  register(profile: EngineProfile) {
    if (this.profiles.has(profile.id)) {
      throw new Error(`Duplicate profile id: ${profile.id}`);
    }

    this.profiles.set(profile.id, profile);
  }

  get(id: string): EngineProfile | undefined {
    return this.profiles.get(id) ?? this.profiles.get(legacyProfileAliases[id] ?? "");
  }

  require(id: string): EngineProfile {
    const profile = this.get(id);
    if (!profile) {
      throw new Error(`Unknown profile id: ${id}`);
    }

    return profile;
  }

  list(): EngineProfile[] {
    return [...this.profiles.values()];
  }

  mergeProfileStack(baseProfileId: string, profiles: EngineProfile[]): EngineProfile {
    return mergeEngineProfiles([this.require(baseProfileId), ...profiles]);
  }
}

const legacyProfileAliases: Record<string, string> = {
  "standard-markdown": "commonmark",
  "mdx-compatible": "mdx",
};
