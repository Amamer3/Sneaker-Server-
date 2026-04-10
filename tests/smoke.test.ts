import { readFileSync } from 'fs';
import { join } from 'path';

describe('production readiness', () => {
  it('declares build, start, and test scripts', () => {
    const pkgPath = join(__dirname, '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as {
      scripts?: Record<string, string>;
      engines?: Record<string, string>;
    };
    expect(pkg.scripts?.build).toBeTruthy();
    expect(pkg.scripts?.start).toBeTruthy();
    expect(pkg.scripts?.test).toBeTruthy();
    expect(String(pkg.engines?.node)).toMatch(/\d+/);
  });

  it('does not run build on every install (no postinstall build)', () => {
    const pkgPath = join(__dirname, '..', 'package.json');
    const pkg = JSON.parse(readFileSync(pkgPath, 'utf8')) as { scripts?: Record<string, string> };
    expect(pkg.scripts?.postinstall).toBeUndefined();
  });
});
