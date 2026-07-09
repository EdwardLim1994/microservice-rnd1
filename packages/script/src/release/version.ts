const VERSION_RE = /^(\d+)\.(\d+)\.(\d+)(?:-rc(\d+))?$/;

export type ParsedVersion = {
  major: number;
  minor: number;
  patch: number;
  rc: number | null;
};

export function parseVersion(version: string): ParsedVersion {
  const match = VERSION_RE.exec(version);
  if (!match) {
    throw new Error(
      `Invalid version "${version}", expected "x.y.z" or "x.y.z-rcN"`,
    );
  }
  const [, major, minor, patch, rc] = match;
  return {
    major: Number(major),
    minor: Number(minor),
    patch: Number(patch),
    rc: rc === undefined ? null : Number(rc),
  };
}

export function formatVersion(version: ParsedVersion): string {
  const base = `${version.major}.${version.minor}.${version.patch}`;
  return version.rc === null ? base : `${base}-rc${version.rc}`;
}

/** Cutting a release: bump minor, reset patch, seed rc1. */
export function bumpMinorToRc1(version: string): string {
  const parsed = parseVersion(version);
  return formatVersion({
    major: parsed.major,
    minor: parsed.minor + 1,
    patch: 0,
    rc: 1,
  });
}

/** A UAT-failure fix on an app already in the manifest: increment rc only. */
export function bumpRc(version: string): string {
  const parsed = parseVersion(version);
  if (parsed.rc === null) {
    throw new Error(`Cannot bump rc on a non-rc version "${version}"`);
  }
  return formatVersion({ ...parsed, rc: parsed.rc + 1 });
}

/** Strip the -rcN suffix when a release is promoted to main. */
export function stripRc(version: string): string {
  const parsed = parseVersion(version);
  return formatVersion({ ...parsed, rc: null });
}

/** A hotfix off main: bump patch, no rc involved. */
export function bumpPatch(version: string): string {
  const parsed = parseVersion(version);
  if (parsed.rc !== null) {
    throw new Error(`Cannot hotfix-bump a pending rc version "${version}"`);
  }
  return formatVersion({ ...parsed, patch: parsed.patch + 1 });
}
